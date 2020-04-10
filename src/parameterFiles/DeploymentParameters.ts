// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CachedValue } from "../CachedValue";
import { templateKeys } from "../constants";
import { DeploymentFile } from "../DeploymentFile";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { INamedDefinition } from "../INamedDefinition";
import * as Json from "../JSON";
import { ReferenceList } from "../ReferenceList";
import { isParametersSchema } from "../schemas";
import { nonNullOrEmptyValue } from "../util/nonNull";
import { ParametersPositionContext } from "./ParametersPositionContext";
import { ParameterValueDefinition } from "./ParameterValueDefinition";

/**
 * Represents a deployment parameter file
 */
export class DeploymentParameters extends DeploymentFile {
    private _parameterValueDefinitions: CachedValue<ParameterValueDefinition[]> = new CachedValue<ParameterValueDefinition[]>();

    /**
     * Create a new DeploymentParameters instance
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(documentText: string, documentId: string) {
        super(documentText, documentId);
        nonNullOrEmptyValue(documentId, "documentId");
    }

    public hasParametersUri(): boolean {
        return isParametersSchema(this.schemaUri);
    }

    public get parameterValues(): ParameterValueDefinition[] {
        return this._parameterValueDefinitions.getOrCacheValue(() => {
            const parameterDefinitions: ParameterValueDefinition[] = [];

            if (this.topLevelValue) {
                const parameters: Json.ObjectValue | undefined = Json.asObjectValue(this.topLevelValue.getPropertyValue(templateKeys.parameters));
                if (parameters) {
                    for (const parameter of parameters.properties) {
                        parameterDefinitions.push(new ParameterValueDefinition(parameter));
                    }
                }
            }

            return parameterDefinitions;
        });
    }

    // CONSIDER: Move this to ParametersPositionContext since that depends on DeploymentTemplate asdf
    public getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentLineAndColumnIndexes(this, documentLineIndex, documentColumnIndex, deploymentTemplate);
    }

    // CONSIDER: Move this to ParametersPositionContext since that depends on DeploymentTemplate asdf
    public getContextFromDocumentCharacterIndex(documentCharacterIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        return ParametersPositionContext.fromDocumentCharacterIndex(this, documentCharacterIndex, deploymentTemplate);
    }

    public findReferences(definition: INamedDefinition): ReferenceList {
        return new ReferenceList(definition.definitionKind);
    }
}
