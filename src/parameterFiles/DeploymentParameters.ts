// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CodeAction, CodeActionContext, Command, Uri } from "vscode";
import { CachedValue } from "../CachedValue";
import { templateKeys } from "../constants";
import { DeploymentDoc } from "../DeploymentDoc";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { INamedDefinition } from "../INamedDefinition";
import * as Json from "../JSON";
import { ReferenceList } from "../ReferenceList";
import { isParametersSchema } from "../schemas";
import { ParametersPositionContext } from "./ParametersPositionContext";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParameters extends DeploymentDoc {
    private _parameterValueDefinitions: CachedValue<ParameterValueDefinition[]> = new CachedValue<ParameterValueDefinition[]>();
    private _parametersProperty: CachedValue<Json.Property | undefined> = new CachedValue<Json.Property | undefined>();

    /**
     * Create a new DeploymentParameters instance
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentId: Uri) {
        super(documentText, documentId);
    }

    public hasParametersUri(): boolean {
        return isParametersSchema(this.schemaUri);
    }

    // case-insensitive
    public getParameterValue(parameterName: string): ParameterValueDefinition | undefined {
        // Number of parameters generally small, not worth creating a case-insensitive dictionary
        const parameterNameLC = parameterName.toLowerCase();
        for (let param of this.parameterValues) {
            if (param.nameValue.unquotedValue.toLowerCase() === parameterNameLC) {
                return param;
            }
        }

        return undefined;
    }

    public get parameterValues(): ParameterValueDefinition[] {
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

    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentLineAndColumnIndices(this, documentLineIndex, documentColumnIndex, deploymentTemplate);
    }

    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, deploymentTemplate);
    }

    public findReferences(definition: INamedDefinition): ReferenceList {
        const results: ReferenceList = new ReferenceList(definition.definitionKind);

        // The only reference possible is the definition itself (from the template file)
        if (definition.nameValue) {
            results.add(definition.nameValue.unquotedSpan);
        }
        return results;
    }

    public async onProvideCodeActions(range: Range | Selection, context: CodeActionContext): Promise<(Command | CodeAction)[]> {
        return [];
    }
}
