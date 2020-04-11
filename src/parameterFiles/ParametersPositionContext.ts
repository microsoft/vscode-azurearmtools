// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { EOL } from "os";
import * as Completion from "../Completion";
import { DeploymentTemplate } from "../DeploymentTemplate";
import * as language from "../Language";
import { createParameterFromTemplateParameter } from "../parameterFileGeneration";
import { IReferenceSite, PositionContext } from "../PositionContext";
import { ReferenceList } from "../ReferenceList";
import * as TLE from '../TLE';
import { DeploymentParameters } from "./DeploymentParameters";

/**
 * Represents a position inside the snapshot of a deployment parameter file, plus all related information
 * that can be parsed and analyzed about it from that position.
 */
export class ParametersPositionContext extends PositionContext {
    // CONSIDER: pass in function to *get* the deployment template, not the template itself?
    private _associatedTemplate: DeploymentTemplate | undefined;

    private constructor(deploymentParameters: DeploymentParameters, associatedTemplate: DeploymentTemplate | undefined) {
        super(deploymentParameters);
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
    public getReferenceSiteInfo(): IReferenceSite | undefined {
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
                        referenceSpan: paramValue.nameValue.span,
                        definition: paramDef,
                        definitionDocument: this._associatedTemplate
                    };
                }

                break;
            }
        }

        return undefined;
    }

    // Returns undefined if references are not supported at this location.
    // Returns empty list if supported but none found
    public getReferences(): ReferenceList | undefined {
        const refInfo = this.getReferenceSiteInfo();
        if (refInfo) {
            return this.document.findReferences(refInfo.definition);
        }

        return undefined;
    }

    public getCompletionItems(): Completion.Item[] {
        let completions: Completion.Item[] = [];

        if (this.canAddPropertyHere) {
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
        const label = `"<new parameter>"`;

        return this.createParameterCompletion(
            label,
            snippet,
            Completion.CompletionKind.NewPropertyValue,
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

                // tslint:disable-next-line:prefer-template
                const isRequired = !param.defaultValue;
                const label = `${param.nameValue.quotedValue} ${isRequired ? "(required)" : "(optional)"}`;
                const paramText = createParameterFromTemplateParameter(this._associatedTemplate, param);
                let replacement = paramText;
                const documentation = `Insert a value for parameter '${param.nameValue.unquotedValue}' from the template file"`;
                const detail = paramText;

                completions.push(
                    this.createParameterCompletion(
                        label,
                        replacement,
                        Completion.CompletionKind.PropertyValue,
                        detail,
                        documentation));
            }
        }

        return completions;
    }

    private createParameterCompletion(
        label: string,
        replacement: string,
        kind: Completion.CompletionKind,
        detail: string,
        documentation: string
    ): Completion.Item {
        // Replacement span
        let span = this.determineCompletionSpan();

        // Comma after?
        if (this.needsCommaAfterCompletion()) {
            replacement += ',';
        }

        // Comma before?
        const commaEdit = this.document.createEditToAddCommaBeforePosition(this.documentCharacterIndex);

        return new Completion.Item(
            label,
            replacement,
            span,
            kind,
            detail,
            documentation,
            undefined,
            commaEdit ? [commaEdit] : undefined);
    }

    private determineCompletionSpan(): language.Span {
        let span = this.emptySpanAtDocumentCharacterIndex;

        // If the completion is triggered inside double quotes, or from a trigger character of a double quotes (
        // which ends up adding '""' first, then triggering the completion inside the quotes), then
        // the insert range needs to subsume those quotes so they get deleted when the new param is inserted.
        if (this.document.documentText.charAt(this.documentCharacterIndex - 1) === '"') {
            span = span.extendLeft(1);
        }
        if (this.document.documentText.charAt(this.documentCharacterIndex) === '"') {
            span = span.extendRight(1);
        }

        return span;
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
