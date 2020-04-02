// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Language } from "../extension.bundle";
import { AzureRMAssets } from "./AzureRMAssets";
import * as Completion from "./Completion";
import { templateKeys } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { assert } from "./fixed_assert";
import { Behaviors } from "./IFunctionMetadata";
import * as Json from "./JSON";
import { TemplatePositionContext } from "./TemplatePositionContext";
import * as TLE from "./TLE";

// Handle completions for resourceId and similar functions with the usesResourceIdCompletions behavior

interface IResourceInfo {
    nameExpressions: string[];
    typeExpressions: string[];
}

export function getResourceIdFunctionCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token
): Completion.Item[] {
    if (!funcCall.isUserDefinedFunction && funcCall.name) {
        const functionMetadata = AzureRMAssets.getFunctionMetadataFromName(funcCall.name); //asdf refactor
        if (functionMetadata?.hasBehavior(Behaviors.usesResourceIdCompletions)) {
            // If the completion is for 'resourceId' or related function, then in addition
            // to the regular completions, also add special completions for resourceId

            // What argument to the function call is the cursor in?
            const argumentIndex = pc.getFunctionCallArgumentIndex(funcCall);
            if (typeof argumentIndex === 'number') {
                const segmentIndex = argumentIndex;
                if (segmentIndex === 0) {
                    return getResourceTypeCompletions(pc, pc.documentCharacterIndex);
                } else {
                    return getResourceNameCompletions(pc, funcCall, parentStringToken, 0, segmentIndex);
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
    for (let info of getResourcesInfo(pc.document)) {
        const insertText = getFullTypeName(info);
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

    return Completion.Item.dedupeByLabel(results);
}

function getArgumentExpressionText(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    argumentIndex: number
): string | undefined {
    const argExpressionValue: TLE.Value | undefined = funcCall.argumentExpressions[argumentIndex];
    if (argExpressionValue) {
        return pc.document.getTextAtTleValue(argExpressionValue, parentStringToken)?.toLowerCase();
    }

    return undefined;
}

function getResourceNameCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    indexOfResourceTypeArgument: number,
    // segment 0 = type
    // segment 1 = first part of name
    // segment 2 = second part of name, etc.
    segmentIndex: number
): Completion.Item[] {
    assert(indexOfResourceTypeArgument === 0, "NYI asdf");

    // Get the resource type specified in the first argument of resourceId
    let resourceTypeArgAsStringLC: string | undefined = getArgumentExpressionText(pc, funcCall, parentStringToken, 0)
        ?.toLowerCase();
    if (!resourceTypeArgAsStringLC) {
        return [];
    }

    const results: Completion.Item[] = [];
    for (let info of getResourcesInfo(pc.document)) {
        const resFullType = getFullTypeName(info);
        //const resFullName = getFullResourceName(info);

        if (resFullType.toLowerCase() !== resourceTypeArgAsStringLC) {
            // Resource type for this resource doesn't match the first argument
            continue;
        }

        // Previous parts of the name must also match what is currently specified in the template text
        let previousNameSegmentsMatch = true;
        for (let iSegment = 1; iSegment <= segmentIndex - 1; ++iSegment) {
            const namePartIndex = iSegment - 1;
            const segmentName = info.nameExpressions[namePartIndex];

            const checkingArgIndex = indexOfResourceTypeArgument + iSegment;
            let namePartArgumentText: string | undefined = getArgumentExpressionText(pc, funcCall, parentStringToken, checkingArgIndex);
            if (segmentName.toLowerCase() !== namePartArgumentText?.toString()) {
                previousNameSegmentsMatch = false;
                break; //asdf test with 3 segments
            }
        }
        if (!previousNameSegmentsMatch) { //asdf refactor
            continue;
        }

        const resSegmentName = info.nameExpressions[segmentIndex - 1]; //asdf
        if (resSegmentName) {
            const insertText = resSegmentName;
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

function getResourcesInfo(template: DeploymentTemplate): IResourceInfo[] {
    if (template.resources) {
        return getInfoFromResourcesArray(template.resources, undefined);
    }

    return [];
}

function getInfoFromResourcesArray(resourcesArray: Json.ArrayValue, parent: IResourceInfo | undefined): IResourceInfo[] {
    const results: IResourceInfo[] = [];
    for (let resourceValue of resourcesArray.elements ?? []) {
        const resourceObject = Json.asObjectValue(resourceValue);
        if (resourceObject) {
            const resName = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceName));
            const resType = Json.asStringValue(resourceObject.getPropertyValue(templateKeys.resourceType));

            if (resName && resType) {
                let nameExpressions: string[];
                let typeExpressions: string[];

                if (parent) {
                    nameExpressions = parent?.nameExpressions.slice() ?? [];
                    nameExpressions.push(jsonStringToTleExpression(resName));
                    typeExpressions = parent?.typeExpressions.slice() ?? [];
                    typeExpressions.push(jsonStringToTleExpression(resType));
                } else {
                    nameExpressions = getNameSegmentExpressions(resName);
                    typeExpressions = getTypeSegmentExpressions(resType);
                }

                const info: IResourceInfo = { nameExpressions, typeExpressions };
                results.push(info);

                // Check child resources
                const childResources = Json.asArrayValue(resourceObject.getPropertyValue(templateKeys.resources));
                if (childResources) {
                    const childrenInfo = getInfoFromResourcesArray(childResources, info);
                    results.push(...childrenInfo);
                }
            }
        }
    }

    return results;
}

function isExpression(text: string): boolean {
    // Not perfect, but good enough for our purposes here
    return text.length >= 2 && text.startsWith('[') && text.endsWith(']');
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
    const text = stringValue.unquotedValue;
    if (isExpression(text)) {
        return text.slice(1, text.length - 1);
    } else {
        return `'${text}'`;
    }
}

// asdf what about expressions?
function unquote(expression: string): string {
    if (expression.length >= 2 && expression[0] === `'` && expression.slice(-1) === `'`) {
        return expression.slice(1, expression.length - 1);
    }

    return expression;
}

function getFullTypeName(info: IResourceInfo): string { //asdf need the array?
    if (info.typeExpressions.length > 1) {
        return `'${info.typeExpressions.map(unquote).join('/')}'`; //asdf
    } else {
        return info.typeExpressions[0];
    }
}

//asdf
// function getFullResourceName(info: IResourceInfo): string { //asdf need the array?
//     if (info.nameExpressions.length > 1) {
//         return `'${info.nameExpressions.map(unquote).join('/')}'`; //asdf
//     } else {
//         return info.nameExpressions[0];
//     }
// }

//asdf expressions?
// e.g.
//   "networkSecurityGroup2/networkSecurityGroupRule2"
//     ->
//   ["'networkSecurityGroup2'", "'networkSecurityGroupRule2'"]
function getNameSegmentExpressions(name: Json.StringValue): string[] {
    const text = name.unquotedValue;

    if (isExpression(text)) {
        // If it's an expression, we don't currently handle splitting it into segments asdf
        return [jsonStringToTleExpression(name)];
    }

    return text.split('/').map(segment => `'${segment}'`);
}

// e.g.
// "'Microsoft.Network/networkSecurityGroups/securityRules'"
//   ->
// ["'Microsoft.Network/networkSecurityGroups'", "'securityRules']
function getTypeSegmentExpressions(typeName: Json.StringValue): string[] {
    const text = typeName.unquotedValue;

    if (isExpression(text)) {
        // If it's an expression, we don't currently handle splitting it into segments asdf
        return [jsonStringToTleExpression(typeName)];
    }

    let segments = text.split('/');
    if (segments.length >= 2) {
        // Combine first two segments
        segments = [`${segments[0]}/${segments[1]}`].concat(segments.slice(2));
    }

    return segments.map(segment => `'${segment}'`);
}
