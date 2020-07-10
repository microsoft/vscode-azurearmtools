// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-classes-per-file

import { Uri } from 'vscode';
import { parseError } from 'vscode-azureextensionui';
import { Language } from '../extension.bundle';
import { IGotoParameterValueArgs } from './commandArguments';
import { ResolvableCodeLens } from "./DeploymentDocument";
import { IParameterDefinition } from './IParameterDefinition';
import { IParameterValuesSourceFromFile } from './IParameterValuesSourceFromFile';
import { IParameterValuesSource } from './parameterFiles/IParameterValuesSource';
import { getRelativeParameterFilePath } from './parameterFiles/parameterFiles';
import { TemplateScope, TemplateScopeKind } from "./TemplateScope";
import { pathExists } from './util/pathExists';

/**
 * A code lens to indicate the current parameter file and to open it
 */
export class ShowCurrentParameterFileCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TemplateScope,
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

export class ParameterDefinitionCodeLens extends ResolvableCodeLens {
    // Max # of characters to show for the value in the code lens
    private readonly _maxCharactersInValue: number = 120;

    public constructor(
        scope: TemplateScope,
        public readonly parameterDefinition: IParameterDefinition,
        private parameterValuesSourceProvider: IParameterValuesSourceFromFile
    ) {
        super(scope, parameterDefinition.nameValue.span);
    }

    public async resolve(): Promise<boolean> {
        let paramsSource: IParameterValuesSource | undefined;
        let title: string = "Could not open parameter file";
        try {
            paramsSource = await this.parameterValuesSourceProvider.fetchParameterValues();
            title = '';
        } catch (err) {
            if (!await pathExists(this.parameterValuesSourceProvider.parameterFileUri)) {
                title = `$(error) Parameter file not found`;
            } else {
                title = `$(error) Could not open parameter file: ${parseError(err).message}`;
            }
        }

        if (paramsSource) {
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

        if (title.length > this._maxCharactersInValue) {
            // tslint:disable-next-line: prefer-template
            title = title.slice(0, this._maxCharactersInValue) + "...";
        }

        this.command = {
            title: title,
            command: "azurerm-vscode-tools.codeLens.gotoParameterValue",
            arguments: [
                <IGotoParameterValueArgs>{
                    parameterFileUri: this.parameterValuesSourceProvider.parameterFileUri,
                    parameterName: this.parameterDefinition.nameValue.unquotedValue
                }
            ]
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
