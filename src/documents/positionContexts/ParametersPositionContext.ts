// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as TLE from '../../language/expressions/TLE';
import { ReferenceList } from "../../language/ReferenceList";
import { ContainsBehavior } from '../../language/Span';
import { DeploymentParametersDoc } from "../parameters/DeploymentParametersDoc";
import { getPropertyValueCompletionItems } from "../parameters/ParameterValues";
import { DeploymentTemplateDoc } from "../templates/DeploymentTemplateDoc";
import { ICompletionItemsResult, IReferenceSite, PositionContext, ReferenceSiteKind } from "./PositionContext";

/**
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export class ParametersPositionContext extends PositionContext {
    // CONSIDER: pass in function to *get* the deployment template, not the template itself?
    private _associatedTemplate: DeploymentTemplateDoc | undefined;

    private constructor(deploymentParameters: DeploymentParametersDoc, associatedTemplate: DeploymentTemplateDoc | undefined) {
        super(deploymentParameters, associatedTemplate);
        this._associatedTemplate = associatedTemplate;
    }

    public static fromDocumentLineAndColumnIndices(deploymentParameters: DeploymentParametersDoc, documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentTemplateDoc | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, associatedTemplate);
        context.initFromDocumentLineAndColumnIndices(documentLineIndex, documentColumnIndex);
        return context;
    }
    public static fromDocumentCharacterIndex(deploymentParameters: DeploymentParametersDoc, documentCharacterIndex: number, deploymentTemplate: DeploymentTemplateDoc | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, deploymentTemplate);
        context.initFromDocumentCharacterIndex(documentCharacterIndex);
        return context;
    }

    public get document(): DeploymentParametersDoc {
        return <DeploymentParametersDoc>super.document;
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public getReferenceSiteInfo(_includeDefinition: boolean): IReferenceSite | undefined {
        if (!this._associatedTemplate) {
            return undefined;
        }

        for (let paramValue of this.document.parameterValueDefinitions) {
            // Are we inside the name of a parameter?
            if (paramValue.nameValue.span.contains(this.documentCharacterIndex, ContainsBehavior.extended)) {
                // Does it have an associated parameter definition in the template?
                const paramDef = this._associatedTemplate?.topLevelScope.getParameterDefinition(paramValue.nameValue.unquotedValue);
                if (paramDef) {
                    return {
                        referenceKind: ReferenceSiteKind.reference,
                        unquotedReferenceSpan: paramValue.nameValue.unquotedSpan,
                        referenceDocument: this.document,
                        definition: paramDef,
                        definitionDocument: this._associatedTemplate
                    };
                }

                break;
            }
        }

        return undefined;
    }

    /**
     * Return all references to the given reference site info in this document
     * @returns undefined if references are not supported at this location, or empty list if supported but none found
     */
    protected getReferencesCore(): ReferenceList | undefined {
        const refInfo = this.getReferenceSiteInfo(false);
        return refInfo ? this.document.findReferencesToDefinition(refInfo.definition) : undefined;
    }

    public async getCompletionItems(triggerCharacter: string | undefined, tabSize: number): Promise<ICompletionItemsResult> {
        return {
            items: getPropertyValueCompletionItems(
                this._associatedTemplate?.topLevelScope.parameterDefinitionsSource,
                this.document.parameterValuesSource,
                undefined,
                tabSize,
                this.documentCharacterIndex,
                triggerCharacter
            )
        };
    }

    public getSignatureHelp(): TLE.FunctionSignatureHelp | undefined {
        return undefined;
    }
}
