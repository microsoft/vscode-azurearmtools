// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CodeAction, CodeActionContext, Command, Range, Selection, Uri } from "vscode";
import { templateKeys } from "../../constants";
import { INamedDefinition } from '../../language/INamedDefinition';
import { Issue } from '../../language/Issue';
import * as Json from "../../language/json/JSON";
import { ReferenceList } from "../../language/ReferenceList";
import { isParametersSchema } from "../../schemas";
import { CachedValue } from '../../util/CachedValue';
import { expectTemplateDocument, expectTemplateDocumentOrUndefined } from '../../util/expectDocument';
import { DeploymentDocument, ResolvableCodeLens } from "../DeploymentDocument";
import { ParametersPositionContext } from "../positionContexts/ParametersPositionContext";
import { IParameterValuesSource } from './IParameterValuesSource';
import { IParameterValuesSourceProvider } from './IParameterValuesSourceProvider';
import { ParameterValueDefinition } from "./ParameterValueDefinition";
import { getMissingParameterErrors, getParameterValuesCodeActions } from "./ParameterValues";
import { ParameterValuesSourceFromJsonObject } from "./ParameterValuesSourceFromJsonObject";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParametersDoc extends DeploymentDocument {
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
            return new ParameterValuesSourceFromJsonObject(this, this.parametersProperty, this.topLevelValue);
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

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentDocument | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentLineAndColumnIndices(this, documentLineIndex, documentColumnIndex, expectTemplateDocumentOrUndefined(associatedTemplate));
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedDocument: DeploymentDocument | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, expectTemplateDocumentOrUndefined(associatedDocument));
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
        _parameterValuesSourceProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[] {
        return [];
    }

    public getCodeActions(
        associatedDocument: DeploymentDocument | undefined,
        range: Range | Selection,
        context: CodeActionContext
    ): (Command | CodeAction)[] {
        const template = expectTemplateDocumentOrUndefined(associatedDocument);
        return getParameterValuesCodeActions(
            this.parameterValuesSource,
            template?.topLevelScope,
            range,
            context
        );
    }
    public getErrorsCore(associatedDocument: DeploymentDocument | undefined): Issue[] {
        if (!associatedDocument) {
            return [];
        }

        const template = expectTemplateDocument(associatedDocument);
        return getMissingParameterErrors(this.parameterValuesSource, template.topLevelScope);
    }

    public getWarnings(): Issue[] {
        return [];
    }
}
