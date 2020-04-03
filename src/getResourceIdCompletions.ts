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

export function getResourceIdCompletions(
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
                const segmentIndex = argumentIndex;
                return getCompletions(pc, funcCall, parentStringToken, segmentIndex, { maxOptionalParameters: 2 });
            }
        }
    }

    return [];
}

function getCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    argIndexAtCursor: number,
    resourceIdCompletions: { maxOptionalParameters: number }
): Completion.Item[] {
    if (argIndexAtCursor === 0) {
        // For the first argument, we always provide completions for the list of resource types,
        // since we don't know if the user is adding optional args to the call
        return getResourceTypeCompletions(pc, resourceIdCompletions, argIndexAtCursor);
    }

    const allResources = getResourcesInfo(pc.document);

    // Check previous arguments in the call to see if any of them matches a known resource type
    let argWithResourceType = findFunctionCallArgumentWithResourceType(
        allResources,
        pc,
        funcCall,
        parentStringToken,
        argIndexAtCursor - 1);

    if (!argWithResourceType) {
        // None of the previous arguments matched a known resource type, so the current argument might
        // be intended to be a resource type.
        return getResourceTypeCompletions(pc, resourceIdCompletions, argIndexAtCursor);
    }

    // Only look at resources with that type
    let filteredResources = filterResourceInfosByType(allResources, argWithResourceType.typeExpression);

    // Previous parts of the name must also match what is currently specified in the function call
    let argIndex = argWithResourceType.argIndex + 1;
    let nameSegmentIndex = 0;
    // tslint:disable-next-line:no-constant-condition
    while (true) {
        assert(argIndex <= argIndexAtCursor);
        if (argIndex === argIndexAtCursor) {
            break;
        }

        let argExpression: string | undefined = getArgumentExpression(pc, funcCall, parentStringToken, argIndex);
        if (!argExpression) {
            return [];
        }

        filteredResources = filterResourceInfosByNameSegment(filteredResources, argExpression, nameSegmentIndex);
        ++argIndex;
        ++nameSegmentIndex;
    }

    // Add completions for all remaining resources, at the given name segment index
    const results: Completion.Item[] = [];
    for (let info of filteredResources) {
        const insertText = info.nameExpressions[nameSegmentIndex];
        if (insertText) {
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

/**
 * Finds the first argument in the function that matches a known type (could be
 * an expression), or looks like a resource type as a string literal, e.g.
 *
 *   resourceId(subscription().id, 'Microsoft.Network/vnet', 'vnet1')
 *     ->
 * returns the second argument (index=0)
 */
function findFunctionCallArgumentWithResourceType(
    resources: IResourceInfo[],
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token,
    maxIndex: number
): { argIndex: number; typeExpression: string } | undefined {
    for (let argIndex = 0; argIndex <= maxIndex; ++argIndex) {
        let argText: string | undefined = getArgumentExpression(pc, funcCall, parentStringToken, argIndex);
        if (argText) {
            if (looksLikeResourceTypeStringLiteral(argText)) {
                return { argIndex, typeExpression: argText };
            }

            let argTextLC = argText?.toLowerCase();
            for (let info of resources) {
                const resFullType = getFullTypeName(info); // asdf put this into the info itself
                if (resFullType.toLowerCase() === argTextLC) { //asdf put lc into info
                    return { argIndex, typeExpression: argText };
                }
            }
        }
    }

    return undefined;
}

function filterResourceInfosByType(infos: IResourceInfo[], typeExpression: string): IResourceInfo[] {
    if (!typeExpression) {
        return [];
    }
    const typeExpressionLC = typeExpression.toLowerCase();
    return infos.filter(info => getFullTypeName(info).toLowerCase() === typeExpressionLC);
}

function filterResourceInfosByNameSegment(infos: IResourceInfo[], segmentExpression: string, segmentIndex: number): IResourceInfo[] {
    if (!segmentExpression) {
        return [];
    }
    const segmentExpressionLC = segmentExpression.toLowerCase();
    return infos.filter(info => info.nameExpressions[segmentIndex]?.toLocaleLowerCase() === segmentExpressionLC); // asdf store LC?
}

/**
 * Get completions for all resource types available (all those used in the template)
 * at the given document index
 */
function getResourceTypeCompletions(
    pc: TemplatePositionContext,
    resourceIdCompletions: { maxOptionalParameters: number },
    argumentIndex: number
): Completion.Item[] {
    if (argumentIndex > resourceIdCompletions.maxOptionalParameters) {
        // The resource type must be the argument after the optional arguments.
        // This argument is past that, so no resource type completions.
        return [];
    }

    const results: Completion.Item[] = [];
    for (let info of getResourcesInfo(pc.document)) {
        const insertText = getFullTypeName(info);
        const label = insertText;
        const span = new Language.Span(pc.documentCharacterIndex, 0);

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

/**
 * Get useful info about each resource in the template
 */
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

                // If there's a parent, generally the type specified in the template
                // is just the last segment, buy it is allowed to put the full
                // type there instead
                const typeSegments = splitTypeIntoSegments(resType);
                if (parent && typeSegments.length <= 1) {
                    // Add to end of parent type segments
                    typeExpressions = [...parent.typeExpressions, ...typeSegments];
                } else {
                    typeExpressions = typeSegments;
                }

                const nameSegments = splitNameIntoSegments(resName);
                if (parent && nameSegments.length <= 1) {
                    // Add to end of parent name segments
                    nameExpressions = [...parent.nameExpressions, ...nameSegments];
                } else {
                    nameExpressions = nameSegments;
                }

                const info: IResourceInfo = { nameExpressions, typeExpressions };
                results.push(info);

                // Check child resources
                const childResources = resourceObject.getPropertyValue(templateKeys.resources)?.asArrayValue;
                if (childResources) {
                    const childrenInfo = getInfoFromResourcesArray(childResources, info);
                    results.push(...childrenInfo);
                }

                // Special-case subnets - they were designed before nested resources were a thing.
                // Subnets are considered children but are defined under properties/subnets instead of
                //   a nested "resources"
                // Example:
                //
                // "resources": [
                //     {
                //         "type": "Microsoft.Network/virtualNetworks",
                //         "name": "vnet1",
                //         "properties": {
                //             "subnets": [
                //                 // These are considered children, with type Microsoft.Network/virtualNetworks/subnets
                //                 {
                //                     "name": "subnet1",
                //                 }
                //             ]
                //         }
                //     }
                // ]
                if (resType.unquotedValue.toLowerCase() === 'Microsoft.Network/virtualNetworks'.toLowerCase()) {
                    const subnets = resourceObject.getPropertyValue(templateKeys.properties)?.asObjectValue
                        ?.getPropertyValue('subnets')?.asArrayValue;
                    for (let subnet of subnets?.elements ?? []) {
                        const subnetObject = Json.asObjectValue(subnet);
                        const subnetName = subnetObject?.getPropertyValue(templateKeys.resourceName)?.asStringValue;
                        if (subnetName) {
                            const subnetTypes = [`'Microsoft.Network/virtualNetworks'`, `'subnets'`];
                            const subnetInfo: IResourceInfo = {
                                nameExpressions: [jsonStringToTleExpression(resName), jsonStringToTleExpression(subnetName)],
                                typeExpressions: subnetTypes
                            };
                            results.push(subnetInfo);
                        }
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Retrieves the document text for the given argument
 */
function getArgumentExpression(
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

function removeSingleQuotes(expression: string): string {
    if (expression.length >= 2 && expression[0] === `'` && expression.slice(-1) === `'`) {
        return expression.slice(1, expression.length - 1);
    }

    return expression;
}

function getFullTypeName(info: IResourceInfo): string { //asdf need the array?
    if (info.typeExpressions.length > 1) {
        return `'${info.typeExpressions.map(removeSingleQuotes).join('/')}'`; //asdf
    } else {
        return info.typeExpressions[0];
    }
}

// e.g.
//   "networkSecurityGroup2/networkSecurityGroupRule2"
//     ->
//   ["'networkSecurityGroup2'", "'networkSecurityGroupRule2'"]
function splitNameIntoSegments(name: Json.StringValue): string[] {
    const text = name.unquotedValue;

    if (isExpression(text)) {
        // If it's an expression, we can't know how to split it into segments in a generic
        // way, so just return the entire expression
        return [jsonStringToTleExpression(name)];
    }

    return text.split('/').map(segment => `'${segment}'`);
}

// e.g.
// "'Microsoft.Network/networkSecurityGroups/securityRules'"
//   ->
// ["'Microsoft.Network/networkSecurityGroups'", "'securityRules']
function splitTypeIntoSegments(typeName: Json.StringValue): string[] {
    const text = typeName.unquotedValue;

    if (isExpression(text)) {
        // If it's an expression, we can't know how to split it into segments in a generic
        // way, so just return the entire expression
        return [jsonStringToTleExpression(typeName)];
    }

    let segments = text.split('/');
    if (segments.length >= 2) {
        // Combine first two segments
        segments = [`${segments[0]}/${segments[1]}`].concat(segments.slice(2));
    }

    return segments.map(segment => `'${segment}'`);
}

export function looksLikeResourceTypeStringLiteral(text: string): boolean {
    // e.g. 'Microsoft.Compute/virtualMachines/extensions'
    return !!text.match(/^'[^'.]+\.[^'.]+\/([^'.]+)(\.[^'.]+)*'$/);
}
