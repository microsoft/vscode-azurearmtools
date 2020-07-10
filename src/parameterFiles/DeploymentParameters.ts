// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { CodeAction, CodeActionContext, Command, Range, Selection, Uri } from "vscode";
import { CachedValue } from "../CachedValue";
import { templateKeys } from "../constants";
import { DeploymentDocument, ResolvableCodeLens } from "../DeploymentDocument";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { INamedDefinition } from "../INamedDefinition";
import { IParameterDefinition } from '../IParameterDefinition';
import { IParameterValuesSourceFromFile } from '../IParameterValuesSourceFromFile';
import * as Json from "../JSON";
import * as language from "../Language";
import { ReferenceList } from "../ReferenceList";
import { isParametersSchema } from "../schemas";
import { IParameterValuesSource } from './IParameterValuesSource';
import { ParametersPositionContext } from "./ParametersPositionContext";
import { ParameterValueDefinition } from "./ParameterValueDefinition";
import { getMissingParameters, getParameterValuesCodeActions } from "./ParameterValues";
import { ParameterValuesSource } from "./ParameterValuesSource";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParameters extends DeploymentDocument {
    private _parameterValueDefinitions: CachedValue<ParameterValueDefinition[]> = new CachedValue<ParameterValueDefinition[]>();
    private _parametersProperty: CachedValue<Json.Property | undefined> = new CachedValue<Json.Property | undefined>();
    private _parameterValuesSource: CachedValue<IParameterValuesSource> = new CachedValue<IParameterValuesSource>();

    /**
     * Create a new DeploymentParameters instance
     *
     * @param _documentText The string text of the document.
     * @param _documentUri A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentUri: Uri) {
        super(documentText, documentUri);
    }

    public hasParametersSchema(): boolean {
        return isParametersSchema(this.schemaUri);
    }

    public get parameterValuesSource(): IParameterValuesSource {
        return this._parameterValuesSource.getOrCacheValue(() => {
            return new ParameterValuesSource(this, this.parametersProperty);
        });
    }

    // case-insensitive
    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        // Number of parameters generally small, not worth creating a case-insensitive dictionary
        const parameterNameLC = parameterName.toLowerCase();
        for (let param of this.parameterValueDefinitions) {
            if (param.nameValue.unquotedValue.toLowerCase() === parameterNameLC) {
                return param;
            }
        }

        return undefined;
    }

    public get parameterValueDefinitions(): ParameterValueDefinition[] {
        return this._parameterValueDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: ParameterValueDefinition[] = [];

            // tslint:disable-next-line: strict-boolean-expressions
            for (const parameter of this.parametersObjectValue?.properties || []) {
                parameterDefinitions.push(new ParameterValueDefinition(parameter));
            }

            return parameterDefinitions;
        });
    }

    public get parametersProperty(): Json.Property | undefined {
        return this._parametersProperty.getOrCacheValue(() => {
            return this.topLevelValue?.getProperty(templateKeys.parameters);
        });
    }

    public get parametersObjectValue(): Json.ObjectValue | undefined {
        return Json.asObjectValue(this.parametersProperty?.value);
    }

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentLineAndColumnIndices(this, documentLineIndex, documentColumnIndex, associatedTemplate);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedDocument: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, associatedDocument);
    }

    public findReferencesToDefinition(definition: INamedDefinition): ReferenceList {
        const results: ReferenceList = new ReferenceList(definition.definitionKind);

        // The only reference possible in the parameter file is the parameter's value definition
        if (definition.nameValue) {
            const paramValue = this.getParameterValue(definition.nameValue.unquotedValue);
            if (paramValue) {
                results.add({ document: this, span: paramValue.nameValue.unquotedSpan });
            }
        }
        return results;
    }

    public getCodeLenses(
        _parameterValuesSourceProvider: IParameterValuesSourceFromFile | undefined
    ): ResolvableCodeLens[] {
        return [];
    }

    public async getCodeActions(
        associatedDocument: DeploymentDocument | undefined,
        range: Range | Selection,
        context: CodeActionContext
    ): Promise<(Command | CodeAction)[]> {
        assert(!associatedDocument || associatedDocument instanceof DeploymentTemplate, "Associated document is of the wrong type");
        const template: DeploymentTemplate | undefined = <DeploymentTemplate | undefined>associatedDocument;

        return getParameterValuesCodeActions(
            this.parameterValuesSource,
            template?.topLevelScope,
            range,
            context
        );
    }

    public async getErrorsCore(associatedTemplate: DeploymentTemplate | undefined): Promise<language.Issue[]> {
        if (!associatedTemplate) {
            return [];
        }

        const missingRequiredParams: IParameterDefinition[] = getMissingParameters(
            associatedTemplate.topLevelScope,
            this.parameterValuesSource,
            true // onlyRequiredParameters
        );
        if (missingRequiredParams.length === 0) {
            return [];
        }

        const missingParamNames = missingRequiredParams.map(param => `"${param.nameValue.unquotedValue}"`);
        const message = `The following parameters do not have default values and require a value in the parameter file: ${missingParamNames.join(', ')}`;
        const span = this.parametersProperty?.nameValue.span ?? new language.Span(0, 0);
        return [new language.Issue(span, message, language.IssueKind.params_missingRequiredParam)];
    }

    public getWarnings(): language.Issue[] {
        return [];
    }
}
