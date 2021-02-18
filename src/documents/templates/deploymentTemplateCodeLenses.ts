// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import * as path from "path";
import { Range, Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { documentSchemes } from "../../constants";
import { ext } from '../../extensionVariables';
import { Span } from '../../language/Span';
import { LanguageServerState } from '../../languageclient/startArmLanguageServer';
import { assertNever } from '../../util/assertNever';
import { pathExists } from '../../util/pathExists';
import { IGotoParameterValueArgs } from '../../vscodeIntegration/commandArguments';
import { getVSCodeRangeFromSpan } from '../../vscodeIntegration/vscodePosition';
import { ResolvableCodeLens } from '../DeploymentDocument';
import { IParameterDefinition } from '../parameters/IParameterDefinition';
import { IParameterValuesSource } from '../parameters/IParameterValuesSource';
import { IParameterValuesSourceProvider } from '../parameters/IParameterValuesSourceProvider';
import { getRelativeParameterFilePath } from "../parameters/parameterFilePaths";
import { ILinkedTemplateReference } from "./linkedTemplates/ILinkedTemplateReference";
import { LinkedFileLoadState } from "./linkedTemplates/LinkedFileLoadState";
import { TemplateScope, TemplateScopeKind } from './scopes/TemplateScope';
import { LinkedTemplateScope, TopLevelTemplateScope } from './scopes/templateScopes';

/**
 * A code lens to indicate the current parameter file and to open it
 */
export class ShowCurrentParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TopLevelTemplateScope,
        span: Span,
        private parameterFileUri: Uri | undefined
    ) {
        super(scope, span);
    }

    public async resolve(): Promise<boolean> {
        if (this.parameterFileUri) {
            const paramFile = getRelativeParameterFilePath(this.scope.document.documentUri, this.parameterFileUri);
            this.command = {
                title: `Parameter file: "${paramFile}"`,
                command: 'azurerm-vscode-tools.openParameterFile',
                arguments: [this.scope.document.documentUri] // Template file uri
            };
            if (!await pathExists(this.parameterFileUri)) {
                this.command.title += " $(error) Not found";
            }
            return true;
        }

        return false;
    }
}

/**
 * A code lens to allow changing the current parameter file (or associating one if none currently)
 */
export class SelectParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TemplateScope,
        span: Span,
        private parameterFileUri: Uri | undefined,
        private _options: {
            isForLinkedTemplate?: boolean;
        }
    ) {
        super(scope, span);
    }

    public async resolve(): Promise<boolean> {
        let title: string;
        if (this.parameterFileUri) {
            title = `Change...`;
        } else {
            title =
                this._options.isForLinkedTemplate ?
                    "Select or create a parameter file to enable validation of relative linked templates..." :
                    "Select or create a parameter file to enable full validation...";
        }

        this.command = {
            title,
            command: 'azurerm-vscode-tools.selectParameterFile',
            arguments: [this.scope.document.documentUri] // template file uri
        };

        return true;
    }
}

/**
 * A code lens that displays the actual value of a parameter at its definition and allows navigating to it
 */
export class ParameterDefinitionCodeLens extends ResolvableCodeLens {
    // Max # of characters to show for the value in the code lens
    private readonly _maxCharactersInValue: number = 120;

    public constructor(
        scope: TemplateScope,
        public readonly parameterDefinition: IParameterDefinition,
        private parameterValuesSourceProvider: IParameterValuesSourceProvider
    ) {
        super(scope, parameterDefinition.nameValue.span);
    }

    public async resolve(): Promise<boolean> {
        let paramsSource: IParameterValuesSource | undefined;
        let errorMessage: string | undefined;
        try {
            paramsSource = await this.parameterValuesSourceProvider.getValuesSource();
        } catch (err) {
            if (this.parameterValuesSourceProvider.parameterFileUri) {
                if (!await pathExists(this.parameterValuesSourceProvider.parameterFileUri)) {
                    errorMessage = `$(error) Parameter file not found`;
                } else {
                    errorMessage = `$(error) Could not open parameter file: ${parseError(err).message}`;
                }
            } else {
                errorMessage = parseError(err).message;
            }
        }

        let title: string | undefined;
        if (paramsSource && !errorMessage) {
            const param = paramsSource.getParameterValue(this.parameterDefinition.nameValue.unquotedValue);
            const paramValue = param?.value;
            const paramReference = param?.reference;
            const givenValueAsString = paramValue?.toFullFriendlyString();
            const hasDefaultValue = !!this.parameterDefinition.defaultValue;

            if (!!paramReference) {
                title = 'Value: (KeyVault reference)';
            } else if (givenValueAsString !== undefined) {
                title = `Value: ${givenValueAsString}`;
            } else if (hasDefaultValue) {
                title = "Using default value";
            } else {
                title = "$(warning) No value found - click here to enter a value";
            }
        }

        if (!title) {
            title = errorMessage ?? 'Could not find parameter value';
        }

        if (title.length > this._maxCharactersInValue) {
            // tslint:disable-next-line: prefer-template
            title = title.slice(0, this._maxCharactersInValue) + "...";
        }

        let args: IGotoParameterValueArgs;
        if (this.parameterValuesSourceProvider.parameterFileUri) {
            // We delay resolving the location if navigating to a parameter file because it could change before the user clicks on the code lens
            args = {
                inParameterFile: {
                    parameterFileUri: this.parameterValuesSourceProvider.parameterFileUri,
                    parameterName: this.parameterDefinition.nameValue.unquotedValue
                }
            };
        } else if (paramsSource) {
            // If the parameter doesn't have a value to navigate to, then show the
            // properties section or top of the file
            let span: Span = paramsSource.getParameterValue(this.parameterDefinition.nameValue.unquotedValue)?.value?.span
                ?? paramsSource?.parameterValuesProperty?.nameValue.span
                ?? new Span(0, 0);
            const range: Range = getVSCodeRangeFromSpan(paramsSource.document, span);

            args = {
                inTemplateFile: {
                    documentUri: paramsSource.document.documentUri,
                    range
                }
            };
        } else {
            return false;
        }

        this.command = {
            title: title,
            command: "azurerm-vscode-tools.codeLens.gotoParameterValue",
            arguments: [args]
        };
        return true;
    }
}

export class NestedTemplateCodeLen extends ResolvableCodeLens {
    private constructor(
        scope: TemplateScope,
        span: Span,
        title: string
    ) {
        super(scope, span);
        this.command = {
            title: title,
            command: ''
        };
    }

    public static create(scope: TemplateScope, span: Span): NestedTemplateCodeLen | undefined {
        switch (scope.scopeKind) {
            case TemplateScopeKind.NestedDeploymentWithInnerScope:
                return new NestedTemplateCodeLen(scope, span, "Nested template with inner scope");
            case TemplateScopeKind.NestedDeploymentWithOuterScope:
                return new NestedTemplateCodeLen(scope, span, "Nested template with outer scope");
            default:
                return undefined;
        }
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}

export class LinkedTemplateCodeLens extends ResolvableCodeLens {
    private constructor(
        scope: TemplateScope,
        span: Span,
        title: string,
        linkedFileUri?: Uri
    ) {
        super(scope, span);
        this.command = {
            title: title,
            command: linkedFileUri ? 'azurerm-vscode-tools.codeLens.openLinkedTemplateFile' : '',
            arguments:
                linkedFileUri
                    ? [linkedFileUri]
                    : []
        };
    }

    public static create(
        scope: LinkedTemplateScope,
        span: Span,
        linkedTemplateReferences: ILinkedTemplateReference[] | undefined,
        topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined
    ): LinkedTemplateCodeLens[] {
        let title: string;
        const isRelativePath = scope.isRelativePath;
        const hasParameterFile = !!topLevelParameterValuesProvider?.parameterFileUri;

        // Currently only dealing with the first reference at the same location (e.g. if in a copy loop, multiple
        // instances will be at the same ilne)
        const firstLinkedTemplateRef = linkedTemplateReferences ? linkedTemplateReferences[0] : undefined;

        if (isRelativePath) {
            title = "Relative linked template";
        } else {
            title = "Linked template";
        }

        if (!hasParameterFile) {
            title += " " + "(validation disabled)";
        } else if (firstLinkedTemplateRef) {
            // title += " " + "(validation enabled)";
        } else {
            title += " " + "(cannot validate - make sure all other validation errors have been fixed)";
        }

        let langServerLoadState: string | undefined;

        // If language server not running yet, show language server state instead of file load state
        langServerLoadState = LinkedTemplateCodeLens.getLoadStateFromLanguageServerStatus();

        let linkedUri: Uri | undefined;
        let friendlyPath: string | undefined;
        try {
            const templateUri = scope.document.documentUri;
            linkedUri = firstLinkedTemplateRef?.fullUri ? Uri.parse(firstLinkedTemplateRef.fullUri) : undefined;
            if (isRelativePath && linkedUri && templateUri.fsPath && linkedUri.scheme === documentSchemes.file) {
                const templateFolder = path.dirname(templateUri.fsPath);
                friendlyPath = path.relative(templateFolder, linkedUri.fsPath);
                if (!path.isAbsolute(friendlyPath) && !friendlyPath.startsWith('.')) {
                    friendlyPath = `.${ext.pathSeparator}${friendlyPath}`;
                }
            } else {
                friendlyPath = linkedUri?.toString();
            }
        } catch (error) {
            console.warn(parseError(error).message);
        }

        if (firstLinkedTemplateRef && !langServerLoadState) {
            if (friendlyPath) {
                title += `: "${friendlyPath}"`;
            }

            langServerLoadState = LinkedTemplateCodeLens.getLinkedFileLoadStateLabelSuffix(firstLinkedTemplateRef);
        }

        if (langServerLoadState) {
            title += ` - ${langServerLoadState}`;
        }

        const lenses: LinkedTemplateCodeLens[] = [new LinkedTemplateCodeLens(scope, span, title, linkedUri)];

        if (isRelativePath && !hasParameterFile) {
            lenses.push(
                new SelectParameterFileCodeLens(
                    scope,
                    span,
                    topLevelParameterValuesProvider?.parameterFileUri,
                    {
                        isForLinkedTemplate: true
                    })
            );
        }

        return lenses;
    }

    private static getLoadStateFromLanguageServerStatus(): string | undefined {
        switch (ext.languageServerState) {
            case LanguageServerState.Running:
                // Everything fine, no need for state to be displayed in label
                return undefined;
            case LanguageServerState.Failed:
                return "language server failed to start";
            case LanguageServerState.NotStarted:
                return "language server not started";
            case LanguageServerState.Starting:
                return "starting up...";
            case LanguageServerState.Stopped:
                return "language server stopped";
            case LanguageServerState.LoadingSchemas:
                return "loading schemas...";
            default:
                assertNever(ext.languageServerState);
        }
    }

    private static getLinkedFileLoadStateLabelSuffix(ref: ILinkedTemplateReference): string {
        switch (ref.loadState) {
            case LinkedFileLoadState.LoadFailed:
                return `$(error) ${ref.loadErrorMessage ?? 'Load failed'}`;
            case LinkedFileLoadState.Loading:
                return "loading...";
            case LinkedFileLoadState.NotLoaded:
                return "not loaded";
            case LinkedFileLoadState.NotSupported:
            case LinkedFileLoadState.TooDeep:
                // An error will be shown already
                return "";
            case LinkedFileLoadState.SuccessfullyLoaded:
                // Don't need an extra status for successful operation
                return "";
            default:
                assertNever(ref.loadState);
        }
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}
