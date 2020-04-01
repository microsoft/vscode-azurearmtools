// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from "../extension.bundle";
import * as Completion from "./Completion";
import { templateKeys } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import * as Json from "./JSON";
import * as TLE from "./TLE";

// Handle completions for resourceId and similar functions

export function getResourceIdFunctionCompletions(
    template: DeploymentTemplate,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    tleCharacterIndex: number,
    argumentIndex: number
): Completion.Item[] {
    if (argumentIndex === 0) {
        return getResourceTypeCompletions(template, tleCharacterIndex);
    } else if (argumentIndex === 1) {
        return getResourceNameCompletions(template, funcCall, parentStringToken, tleCharacterIndex);
    }

    return [];
}

function getResourceTypeCompletions(
    template: DeploymentTemplate,
    tleCharacterIndex: number
): Completion.Item[] {
    const results: Completion.Item[] = [];
    for (let { typeExpression } of getResourcesInfo(template)) {
        if (typeExpression) {
            const insertText = typeExpression;
            const label = insertText;
            const span = new Language.Span(tleCharacterIndex, 0);

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

export function getResourceNameCompletions(
    template: DeploymentTemplate,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    tleCharacterIndex: number
): Completion.Item[] {
    // Get the resource type specified in the first argument of resourceId
    let firstArgAsStringLC: string | undefined;
    const firstArgExpr: TLE.Value | undefined = funcCall.argumentExpressions[0];
    if (firstArgExpr) {
        firstArgAsStringLC = template.getTextAtTleValue(firstArgExpr, parentStringToken)?.toLowerCase();
    }

    if (!firstArgAsStringLC) {
        return [];
    }

    const results: Completion.Item[] = [];
    for (let { nameExpression, typeExpression } of getResourcesInfo(template)) {
        if (nameExpression) {
            if (typeExpression && typeExpression.toLowerCase() !== firstArgAsStringLC) {
                // Resource type for this resource doesn't match the first argument
                continue;
            }

            const insertText = nameExpression;
            const label = insertText;
            const span = new Language.Span(tleCharacterIndex, 0);

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
