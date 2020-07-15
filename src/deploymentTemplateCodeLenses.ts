// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import { Range, Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { IGotoParameterValueArgs } from './commandArguments';
import { ResolvableCodeLens } from "./DeploymentDocument";
import { IParameterDefinition } from './IParameterDefinition';
import { IParameterValuesSourceProvider } from './IParameterValuesSourceProvider';
import * as Language from "./Language";
import { IParameterValuesSource } from './parameterFiles/IParameterValuesSource';
import { getRelativeParameterFilePath } from './parameterFiles/parameterFiles';
import { TemplateScope, TemplateScopeKind } from "./TemplateScope";
import { TopLevelTemplateScope } from './templateScopes';
import { pathExists } from './util/pathExists';
import { getVSCodeRangeFromSpan } from './util/vscodePosition';

/**
 * A code lens to indicate the current parameter file and to open it
 */
export class ShowCurrentParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TopLevelTemplateScope,
        span: Language.Span,
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
        span: Language.Span,
        private parameterFileUri: Uri | undefined
    ) {
        super(scope, span);
    }

    public async resolve(): Promise<boolean> {
        let title: string;
        if (this.parameterFileUri) {
            title = `Change...`;
        } else {
            title = "Select or create a parameter file to enable full validation...";
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
            const defaultValueAsString = this.parameterDefinition.defaultValue?.toFullFriendlyString();

            if (!!paramReference) {
                title = 'Value: (KeyVault reference)';
            } else if (givenValueAsString !== undefined) {
                title = `Value: ${givenValueAsString}`;
            } else if (defaultValueAsString !== undefined) {
                title = `Using default value: ${defaultValueAsString}`;
            } else {
                title = "$(warning) No value found";
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
            let span: Language.Span = paramsSource.getParameterValue(this.parameterDefinition.nameValue.unquotedValue)?.value?.span
                ?? paramsSource?.parameterValuesProperty?.nameValue.span
                ?? new Language.Span(0, 0);
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
        span: Language.Span,
        title: string
    ) {
        super(scope, span);
        this.command = {
            title: title,
            command: ''
        };
    }

    public static create(scope: TemplateScope, span: Language.Span): NestedTemplateCodeLen | undefined {
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
        span: Language.Span,
        title: string
    ) {
        super(scope, span);
        this.command = {
            title: title,
            command: ''
        };
    }

    public static create(scope: TemplateScope, span: Language.Span): LinkedTemplateCodeLens {
        return new LinkedTemplateCodeLens(scope, span, "Linked template");
    }

    public async resolve(): Promise<boolean> {
        // Nothing else to do
        return true;
    }
}
