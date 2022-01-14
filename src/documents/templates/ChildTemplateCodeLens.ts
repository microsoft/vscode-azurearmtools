// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import * as path from "path";
import { Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { documentSchemes } from "../../../common";
import { ext } from '../../extensionVariables';
import { assert } from "../../fixed_assert";
import { Span } from '../../language/Span';
import { LanguageServerState } from '../../languageclient/startArmLanguageServer';
import { assertNever } from '../../util/assertNever';
import { parseUri } from "../../util/uri";
import { ResolvableCodeLens } from '../DeploymentDocument';
import { IParameterValuesSourceProvider } from '../parameters/IParameterValuesSourceProvider';
import { SelectParameterFileCodeLens } from "./deploymentTemplateCodeLenses";
import { ILinkedTemplateReference } from "./linkedTemplates/ILinkedTemplateReference";
import { LinkedFileLoadState } from "./linkedTemplates/LinkedFileLoadState";
import { IFullValidationStatus } from "./linkedTemplates/linkedTemplates";
import { TemplateScope, TemplateScopeKind } from './scopes/TemplateScope';
import { LinkedTemplateScope } from './scopes/templateScopes';

//const fullValidationOffMsg = "($(warning)full validation off)";

abstract class ChildTemplateCodeLens extends ResolvableCodeLens {
}

export class NestedTemplateCodeLens extends ChildTemplateCodeLens {
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

    public static create(
        fullValidationStatus: IFullValidationStatus | undefined,
        scope: TemplateScope,
        span: Span,
        topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];
        let title: string;
        const hasParameterFile = !!topLevelParameterValuesProvider?.parameterFileUri;

        fullValidationStatus = fullValidationStatus ?? {
            hasParameterFile,
            allParametersHaveDefaults: false,
            fullValidationEnabled: hasParameterFile,
        };

        switch (scope.scopeKind) {
            case TemplateScopeKind.NestedDeploymentWithInnerScope:
                title = "Nested template with inner scope";
                break;
            case TemplateScopeKind.NestedDeploymentWithOuterScope:
                title = "Nested template with outer scope";
                break;
            default:
                assert.fail("Unexpected nested code lens type");
        }

        if (!fullValidationStatus.fullValidationEnabled) {
            // title += " " + "($(warning)Full validation off)";

        }

        // If language server not running yet, show language server state instead of file load state
        let langServerLoadState: string | undefined = getLoadStateFromLanguageServerStatus();
        if (langServerLoadState) {
            title += ` - ${langServerLoadState}`;
        }

        lenses.push(new NestedTemplateCodeLens(scope, span, title));

        addSelectParamFileLensIfNeeded(lenses, fullValidationStatus, topLevelParameterValuesProvider, scope, span);
        return lenses;
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}

export class LinkedTemplateCodeLens extends ChildTemplateCodeLens {
    private constructor(
        scope: TemplateScope,
        span: Span,
        title: string,
        linkedFileUri?: Uri,
        tooltip?: string
    ) {
        super(scope, span);
        this.command = {
            title: title,
            command: linkedFileUri ? 'azurerm-vscode-tools.codeLens.openLinkedTemplateFile' : '',
            tooltip,
            arguments:
                linkedFileUri
                    ? [linkedFileUri]
                    : []
        };
    }

    public static create(
        fullValidationStatus: IFullValidationStatus | undefined,
        scope: LinkedTemplateScope,
        span: Span,
        linkedTemplateReferences: ILinkedTemplateReference[] | undefined,
        topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        const lenses: ResolvableCodeLens[] = [];
        let title: string;
        const isRelativePath = scope.isRelativePath;
        const hasParameterFile = !!topLevelParameterValuesProvider?.parameterFileUri;

        fullValidationStatus = fullValidationStatus ?? {
            hasParameterFile,
            allParametersHaveDefaults: false,
            fullValidationEnabled: hasParameterFile,
        };

        // Currently only dealing with the first reference at the same location (e.g. if in a copy loop, multiple
        // instances will be at the same ilne)
        const firstLinkedTemplateRef = linkedTemplateReferences ? linkedTemplateReferences[0] : undefined;

        if (isRelativePath) {
            title = "Relative linked template";
        } else {
            title = "Linked template";
        }

        if (!fullValidationStatus.fullValidationEnabled) {
            // title += ` ${fullValidationOffMsg}`;
        } else if (!firstLinkedTemplateRef) {
            title += " " + "(cannot validate - make sure all other validation errors have been fixed)";
        }

        let langServerLoadState: string | undefined;

        // If language server not running yet, show language server state instead of file load state
        langServerLoadState = getLoadStateFromLanguageServerStatus();

        let linkedUri: Uri | undefined;
        let friendlyPath: string | undefined;
        let fullPath: string | undefined;
        try {
            const templateUri = scope.document.documentUri;
            linkedUri = firstLinkedTemplateRef?.fullUri ? parseUri(firstLinkedTemplateRef.fullUri) : undefined;
            if (linkedUri && templateUri.fsPath && linkedUri.scheme === documentSchemes.file) {
                const templateFolder = path.dirname(templateUri.fsPath);
                friendlyPath = path.relative(templateFolder, linkedUri.fsPath);
                fullPath = linkedUri.fsPath;
                if (!path.isAbsolute(friendlyPath) && !friendlyPath.startsWith('.')) {
                    friendlyPath = `.${ext.pathSeparator}${friendlyPath}`;
                }
            } else {
                const maxQueryLength = 40;
                let shortenedUri = linkedUri;
                fullPath = linkedUri?.toString(true);
                if (linkedUri && linkedUri?.query.length > maxQueryLength) {
                    shortenedUri = shortenedUri?.with({
                        query: `${linkedUri.query.slice(0, maxQueryLength)}...`
                    });
                }
                friendlyPath = shortenedUri ? shortenedUri.toString(true) : undefined;
            }
        } catch (error) {
            console.warn(parseError(error).message);
        }

        if (firstLinkedTemplateRef && !langServerLoadState) {
            if (friendlyPath) {
                title += `: "${friendlyPath}"`;
            }

            langServerLoadState = getLinkedFileLoadStateLabelSuffix(firstLinkedTemplateRef);
        }

        if (langServerLoadState) {
            title += ` - ${langServerLoadState}`;
        }

        lenses.push(new LinkedTemplateCodeLens(scope, span, title, linkedUri, fullPath));

        addSelectParamFileLensIfNeeded(lenses, fullValidationStatus, topLevelParameterValuesProvider, scope, span);

        // tslint:disable-next-line: no-suspicious-comment
        /* TODO: Need to also resend to language server
        if (!isRelativePath && linkedUri && linkedUri?.scheme !== documentSchemes.file && linkedUri?.scheme !== documentSchemes.untitled) {
            lenses.push(
                new ReloadLinkedTemplateCodeLens(
                    scope,
                    span,
                    linkedUri
                ));
        }
        */

        return lenses;
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}

export class ReloadLinkedTemplateCodeLens extends ResolvableCodeLens {
    public constructor(scope: TemplateScope, span: Span, linkedFileUri: Uri) {
        super(scope, span);
        this.command = {
            title: 'Reload',
            command: 'azurerm-vscode-tools.codeLens.reloadLinkedTemplateFile',
            arguments:
                [linkedFileUri]
        };
    }
    public async resolve(): Promise<boolean> {
        return true;
    }
}

function getLoadStateFromLanguageServerStatus(): string | undefined {
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

function getLinkedFileLoadStateLabelSuffix(ref: ILinkedTemplateReference): string {
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

function addSelectParamFileLensIfNeeded(
    lenses: ResolvableCodeLens[],
    fullValidationStatus: IFullValidationStatus,
    topLevelParameterValuesProvider: IParameterValuesSourceProvider | undefined,
    scope: TemplateScope,
    span: Span
): void {
    if (ext.languageServerState === LanguageServerState.Running) {
        if (!fullValidationStatus.fullValidationEnabled) {
            lenses.push(
                new SelectParameterFileCodeLens(
                    scope,
                    span,
                    topLevelParameterValuesProvider?.parameterFileUri,
                    {
                        isForLinkedOrNestedTemplate: true,
                        fullValidationStatus
                    })
            );
        }
    }
}
