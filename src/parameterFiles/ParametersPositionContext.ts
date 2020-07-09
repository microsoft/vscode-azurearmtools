// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import * as Completion from "../Completion";
import { DeploymentTemplate } from "../DeploymentTemplate";
import { ext } from '../extensionVariables';
import * as Json from '../JSON';
import * as language from "../Language";
import { createParameterFromTemplateParameter } from "../parameterFileGeneration";
import { IReferenceSite, PositionContext, ReferenceSiteKind } from "../PositionContext";
import { ReferenceList } from "../ReferenceList";
import * as TLE from '../TLE';
import { DeploymentParameters } from "./DeploymentParameters";

const EOL = ext.EOL;
const newParameterValueSnippetLabel = `new-parameter-value`;

/**
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export class ParametersPositionContext extends PositionContext {
    // CONSIDER: pass in function to *get* the deployment template, not the template itself?
    private _associatedTemplate: DeploymentTemplate | undefined;

    private constructor(deploymentParameters: DeploymentParameters, associatedTemplate: DeploymentTemplate | undefined) {
        super(deploymentParameters, associatedTemplate);
        this._associatedTemplate = associatedTemplate;
    }

    public static fromDocumentLineAndColumnIndices(deploymentParameters: DeploymentParameters, documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, associatedTemplate);
        context.initFromDocumentLineAndColumnIndices(documentLineIndex, documentColumnIndex);
        return context;
    }
    public static fromDocumentCharacterIndex(deploymentParameters: DeploymentParameters, documentCharacterIndex: number, deploymentTemplate: DeploymentTemplate | undefined): ParametersPositionContext {
        let context = new ParametersPositionContext(deploymentParameters, deploymentTemplate);
        context.initFromDocumentCharacterIndex(documentCharacterIndex);
        return context;
    }

    public get document(): DeploymentParameters {
        return <DeploymentParameters>super.document;
    }

    /**
     * If this position is inside an expression, inside a reference to an interesting function/parameter/etc, then
     * return an object with information about this reference and the corresponding definition
     */
    public getReferenceSiteInfo(_includeDefinition: boolean): IReferenceSite | undefined {
        if (!this._associatedTemplate) {
            return undefined;
        }

        for (let paramValue of this.document.parameterValues) {
            // Are we inside the name of a parameter?
            if (paramValue.nameValue.span.contains(this.documentCharacterIndex, language.Contains.extended)) {
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

    public async getCompletionItems(triggerCharacter: string | undefined): Promise<Completion.Item[]> {
        let completions: Completion.Item[] = [];

        if ((!triggerCharacter || triggerCharacter === '"') && this.canAddPropertyHere) {
            completions.push(... this.getCompletionsForMissingParameters());
            completions.push(this.getCompletionForNewParameter());
        }

        return completions;
    }

    private getCompletionForNewParameter(): Completion.Item {
        const detail = "Insert new parameter";
        let snippet =
            // tslint:disable-next-line:prefer-template
            `"\${1:parameter1}": {` + EOL
            + `\t"value": "\${2:value}"` + EOL
            + `}`;
        const documentation = "documentation";
        const label = newParameterValueSnippetLabel;

        return this.createParameterCompletion(
            label,
            snippet,
            Completion.CompletionKind.PropertyValueForNewProperty,
            detail,
            documentation);
    }

    /**
     * Get completion items for our position in the document
     */
    private getCompletionsForMissingParameters(): Completion.Item[] {
        const completions: Completion.Item[] = [];
        if (this._associatedTemplate) {
            const paramsInParameterFile: string[] = this.document.parameterValues.map(
                pv => pv.nameValue.unquotedValue.toLowerCase());

            // For each parameter in the template
            for (let param of this._associatedTemplate.topLevelScope.parameterDefinitions) {
                // Is this already in the parameter file?
                const paramNameLC = param.nameValue.unquotedValue.toLowerCase();
                if (paramsInParameterFile.includes(paramNameLC)) {
                    continue;
                }

                const isRequired = !param.defaultValue;
                const label = param.nameValue.quotedValue;
                const paramText = createParameterFromTemplateParameter(this._associatedTemplate, param);
                let replacement = paramText;
                const documentation = `Insert a value for parameter "${param.nameValue.unquotedValue}" from template file "${path.basename(this._associatedTemplate.documentUri.fsPath)}"`;
                const detail = (isRequired ? "(required parameter)" : "(optional parameter)")
                    + EOL
                    + EOL
                    + paramText;

                completions.push(
                    this.createParameterCompletion(
                        label,
                        replacement,
                        Completion.CompletionKind.PropertyValueForExistingProperty,
                        detail,
                        documentation));
            }
        }

        return completions;
    }

    private createParameterCompletion(
        label: string,
        insertText: string,
        kind: Completion.CompletionKind,
        detail: string,
        documentation: string
    ): Completion.Item {
        // The completion span is the entire token at the cursor
        let token = this.jsonToken;
        token = token ?? this.document.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex);

        if (!token && this.documentCharacterIndex > 0) {
            // Also pick up the token touching the cursor on the left, if none found right at it
            token = this.document.getJSONTokenAtDocumentCharacterIndex(this.documentCharacterIndex - 1);
        }

        const span = token?.span ?? this.emptySpanAtDocumentCharacterIndex;

        // Comma after?
        if (this.needsCommaAfterCompletion()) {
            insertText += ',';
        }

        // Comma before?
        const commaEdit = this.document.createEditToAddCommaBeforePosition(this.documentCharacterIndex);

        // Use double quotes around the label if the token is a double-quoted string.
        // That way, the snippet can be used inside or outside of a string, with correct
        // filtering and insertion behavior
        if (token?.type === Json.TokenType.QuotedString) {
            if (label[0] !== '"') {
                label = `"${label}"`;
            }
        }

        return new Completion.Item({
            label,
            insertText,
            span,
            kind,
            detail,
            documentation,
            additionalEdits: commaEdit ? [commaEdit] : undefined
        });
    }

    private needsCommaAfterCompletion(): boolean {
        // If there are any parameters after the one being inserted, we need to add a comma after the new one
        if (this.document.parameterValues.some(p => p.fullSpan.startIndex >= this.documentCharacterIndex)) {
            return true;
        }

        return false;
    }

    // True if inside the "parameters" object, but not inside any properties
    // within it.
    public get canAddPropertyHere(): boolean {
        if (!this.document.parametersObjectValue) {
            // No "parameters" section
            return false;
        }

        const enclosingJsonValue = this.document.jsonParseResult.getValueAtCharacterIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed);

        if (enclosingJsonValue !== this.document.parametersObjectValue) {
            // Directly-enclosing JSON value/object at the cursor is not the "parameters" object
            // (either it's outside it, or it's within a subvalue like an existing parameter)
            return false;
        }

        // Check if we're inside a comment
        if (!!this.document.jsonParseResult.getCommentTokenAtDocumentIndex(
            this.documentCharacterIndex,
            language.Contains.enclosed)
        ) {
            return false;
        }

        return true;
    }

    public getSignatureHelp(): TLE.FunctionSignatureHelp | undefined {
        return undefined;
    }
}
