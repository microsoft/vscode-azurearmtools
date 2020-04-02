// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from "../extension.bundle";
import { AzureRMAssets } from "./AzureRMAssets";
import * as Completion from "./Completion";
import { templateKeys } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { Behaviors } from "./IFunctionMetadata";
import * as Json from "./JSON";
import { TemplatePositionContext } from "./TemplatePositionContext";
import * as TLE from "./TLE";

// Handle completions for resourceId and similar functions with the usesResourceIdCompletions behavior

export function getResourceIdFunctionCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token
): Completion.Item[] {
    if (!funcCall.isUserDefinedFunction && funcCall.name) {
        const functionMetadata = AzureRMAssets.getFunctionMetadataFromName(funcCall.name);
        if (functionMetadata?.hasBehavior(Behaviors.usesResourceIdCompletions)) {
            // If the completion is for 'resourceId' or related function, then in addition
            // to the regular completions, also add special completions for resourceId

            // What argument to the function call is the cursor in?
            const argumentIndex = pc.getFunctionCallArgumentIndex(funcCall);
            if (typeof argumentIndex === 'number') {
                if (argumentIndex === 0) {
                    return getResourceTypeCompletions(pc, pc.documentCharacterIndex);
                } else if (argumentIndex === 1) {
                    return getResourceNameCompletions(pc, funcCall, parentStringToken);
                }
            }
        }
    }

    return [];
}

function getResourceTypeCompletions(
    pc: TemplatePositionContext,
    documentCharacterIndex: number
): Completion.Item[] {
    const results: Completion.Item[] = [];
    for (let { typeExpression } of getResourcesInfo(pc.document)) {
        if (typeExpression) {
            const insertText = typeExpression;
            const label = insertText;
            const span = new Language.Span(documentCharacterIndex, 0);

            results.push(new Completion.Item({
                label,
                insertText,
                span,
                kind: Completion.CompletionKind.DtResourceIdResType,
                highPriority: true,
                // Force the first of the resourceId completions to be preselected, otherwise
                // vscode tends to preselect one of the regular function completions based
                // on recently-typed text
                preselect: true,
                commitCharacters: [',']
            }));
        }
    }

    return Completion.Item.dedupeByLabel(results);
}

function getResourceNameCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token
): Completion.Item[] {
    // Get the resource type specified in the first argument of resourceId
    let firstArgAsStringLC: string | undefined;
    const firstArgExpr: TLE.Value | undefined = funcCall.argumentExpressions[0];
    if (firstArgExpr) {
        firstArgAsStringLC = pc.document.getTextAtTleValue(firstArgExpr, parentStringToken)?.toLowerCase();
    }

    if (!firstArgAsStringLC) {
        return [];
    }

    const results: Completion.Item[] = [];
    for (let { nameExpression, typeExpression } of getResourcesInfo(pc.document)) {
        if (nameExpression) {
            if (typeExpression && typeExpression.toLowerCase() !== firstArgAsStringLC) {
                // Resource type for this resource doesn't match the first argument
                continue;
            }

            const insertText = nameExpression;
            const label = insertText;
            const span = new Language.Span(pc.documentCharacterIndex, 0);

            results.push(new Completion.Item({
                label,
                insertText,
                span,
                kind: Completion.CompletionKind.DtResourceIdResName,
                highPriority: true,
                // Force the first of the resourceId completions to be preselected, otherwise
                // vscode tends to preselect one of the regular function completions based
                // on recently-typed text
                preselect: true,
                commitCharacters: [')', ',']
            }));
        }
    }

    return Completion.Item.dedupeByLabel(results);
}

function getResourcesInfo(template: DeploymentTemplate): { nameExpression?: string; typeExpression?: string }[] {
    const results: { nameExpression?: string; typeExpression?: string }[] = [];
    for (let resourceValue of template.resources?.elements ?? []) {
        const resourceObject = Json.asObjectValue(resourceValue);
        if (resourceObject) {
            const resName = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceName));
            const resType = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceType));
            results.push({
                nameExpression: resName ? jsonStringToTleExpression(resName) : undefined,
                typeExpression: resType ? jsonStringToTleExpression(resType) : undefined
            });
        }
    }

    return results;
}

/**
 * Given a JSON string, turn it into a string representing a TLE subexpression by
 * either wrapping it with single quotes (if it's a plain JSON string value), or
 * removing the surrounding square brackets (if it's a TLE expression string)
 *
 * Examples:
 *   "mystring" => "'mystring'"
 *   "[variables('abc')]" => "variables('abc')"
 */
function jsonStringToTleExpression(stringValue: Json.StringValue): string {
    const s = stringValue.unquotedValue;
    if (s[0] === '[' && s[s.length - 1] === ']') {
        return s.slice(1, s.length - 1);
    } else {
        return `'${s}'`;
    }
}
