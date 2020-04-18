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
        return getResourceTypeCompletions(funcCall, pc, resourceIdCompletions, argIndexAtCursor);
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
        return getResourceTypeCompletions(funcCall, pc, resourceIdCompletions, argIndexAtCursor);
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

        let argExpression: string | undefined = getArgumentExpressionText(pc, funcCall, parentStringToken, argIndex);
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
                commitCharacters: [')', ','],
                telemetryProperties: {
                    segment: String(argIndex),
                    arg: String(argIndexAtCursor),
                    function: funcCall.fullName
                }
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
        let argText: string | undefined = getArgumentExpressionText(pc, funcCall, parentStringToken, argIndex);
        if (argText) {
            if (looksLikeResourceTypeStringLiteral(argText)) {
                return { argIndex, typeExpression: argText };
            }

            let argTextLC = argText?.toLowerCase();
            for (let info of resources) {
                const resFullType = getFullTypeName(info);
                if (resFullType.toLowerCase() === argTextLC) {
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
    const segmentExpressionLC = lowerCaseAndNoWhitespace(segmentExpression);
    return infos.filter(info => lowerCaseAndNoWhitespace(info.nameExpressions[segmentIndex]) === segmentExpressionLC);
}

function lowerCaseAndNoWhitespace(s: string | undefined): string | undefined {
    return s?.toLowerCase().replace(/\s/g, '');
}

/**
 * Get completions for all resource types available (all those used in the template)
 * at the given document index
 */
function getResourceTypeCompletions(
    funcCall: TLE.FunctionCallValue,
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
            commitCharacters: [','],
            telemetryProperties: {
                segment: String(0),
                arg: String(argumentIndex),
                function: funcCall.fullName
            }
        }));
    }

    return Completion.Item.dedupeByLabel(results);
}

/**
 * Get useful info about each resource in the template
 */
function getResourcesInfo(template: DeploymentTemplate): IResourceInfo[] {
    if (template.resources) {
        return getInfoFromResourcesArray(template.resources, undefined, template);
    }

    return [];
}

function getInfoFromResourcesArray(resourcesArray: Json.ArrayValue, parent: IResourceInfo | undefined, dt: DeploymentTemplate): IResourceInfo[] {
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
                // is just the last segment, but it is allowed to put the full
                // type there instead
                const typeSegments = splitResourceTypeIntoSegments(resType.unquotedValue);
                if (parent && typeSegments.length <= 1) {
                    // Add to end of parent type segments
                    typeExpressions = [...parent.typeExpressions, ...typeSegments];
                } else {
                    typeExpressions = typeSegments;
                }

                const nameSegments = splitResourceNameIntoSegments(resName.unquotedValue, dt);
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
                    const childrenInfo = getInfoFromResourcesArray(childResources, info, dt);
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
                                nameExpressions: [jsonStringToTleExpression(resName.unquotedValue), jsonStringToTleExpression(subnetName.unquotedValue)],
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
 * Retrieves the document text for the given function call argument
 */
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
function jsonStringToTleExpression(stringUnquotedValue: string): string {
    if (isExpression(stringUnquotedValue)) {
        return stringUnquotedValue.slice(1, stringUnquotedValue.length - 1);
    } else {
        return `'${stringUnquotedValue}'`;
    }
}

function removeSingleQuotes(expression: string): string {
    if (expression.length >= 2 && expression[0] === `'` && expression.slice(-1) === `'`) {
        return expression.slice(1, expression.length - 1);
    }

    return expression;
}

function getFullTypeName(info: IResourceInfo): string {
    if (info.typeExpressions.length > 1) {
        return `'${info.typeExpressions.map(removeSingleQuotes).join('/')}'`;
    } else {
        return info.typeExpressions[0];
    }
}

// e.g.
//   "networkSecurityGroup2/networkSecurityGroupRule2"
//     ->
//   [ "'networkSecurityGroup2'", "'networkSecurityGroupRule2'" ]
//
//   "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]"
//     ->
//   [ "concat(variables('sqlServer')", "variables('firewallRuleName')" ]
export function splitResourceNameIntoSegments(nameUnquotedValue: string, dt: DeploymentTemplate): string[] {
    if (isExpression(nameUnquotedValue)) {
        // It's an expression.  Try to break it into segments by handling certain common patterns

        // No sense taking time for parsing if '/' is nowhere in the expression
        if (nameUnquotedValue.includes('/')) {
            const quotedValue = `"${nameUnquotedValue}"`;
            const parseResult = TLE.Parser.parse(quotedValue, dt.topLevelScope);
            const expression = parseResult.expression;
            if (parseResult.errors.length === 0 && expression) {
                // Handle this pattern:
                // "[concat(expression1, '/' , expression2)]" => [expression1, expression2]
                if (expression instanceof TLE.FunctionCallValue && expression.isCallToBuiltinWithName('concat')) {
                    const argumentExpressions = expression.argumentExpressions;
                    if (argumentExpressions.every(v => !!v)) {
                        // First, rewrite any string literals that contain a forward slash
                        // into separate string literals, e.g.
                        //   concat('a/', parameters('p1')) -> [ 'a', parameters('p1') ]
                        let rewrittenArgs: (TLE.Value | string)[] = []; // string instances are string literals
                        for (let arg of argumentExpressions) {
                            if (arg instanceof TLE.StringValue && arg.unquotedValue.includes('/')) {
                                const refactoredArg: string[] = splitStringWithSeparator(arg.unquotedValue, '/')
                                    .map(s => `'${s}'`);
                                rewrittenArgs.push(...refactoredArg);
                            } else {
                                // tslint:disable-next-line: no-non-null-assertion // checked with .every() above
                                rewrittenArgs.push(arg!);
                            }
                        }

                        // Separate it into groups of arguments that are separated by '/'
                        // string literals, e.g.
                        //   [a, '/', b, c, '/', d] -> [ [a], [b, c], [d]]
                        let segmentGroups: string[][] = [];
                        let newGroup: string[] = [];

                        let separatorFound = false;
                        for (let arg of rewrittenArgs) {
                            const argAsString = typeof arg === 'string' ? arg : arg.getSpan().getText(quotedValue);
                            if (arg === `'/'`) {
                                separatorFound = true;
                                segmentGroups.push(newGroup);
                                newGroup = [];
                            } else {
                                newGroup.push(argAsString);
                            }
                        }
                        segmentGroups.push(newGroup);

                        if (separatorFound && !segmentGroups.some(g => g.length === 0)) {
                            // Create segments out of the groups - groups with more than one element must be recombined
                            // using 'concat'
                            return segmentGroups.map(g => g.length > 1 ? `concat(${g.join(', ')})` : g[0]);
                        }
                    }
                }
            }
        }

        // We don't know how to split this expression into segments in a generic
        // way, so just return the entire expression
        return [jsonStringToTleExpression(nameUnquotedValue)];
    }

    return nameUnquotedValue.split('/').map(segment => `'${segment}'`);
}

/**
 * Splits a string using a separator, but unlike string.split, the separators
 * are keep in the array returned.
 */
function splitStringWithSeparator(s: string, separator: string): string[] {
    let result: string[] = [];
    let substrings: string[] = s.split(separator);

    let first = true;
    for (let substring of substrings) {
        if (!first) {
            result.push('/');
        }
        first = false;

        result.push(substring);
    }

    return result.filter(s2 => s2.length > 0);
}

// e.g.
// "Microsoft.Network/networkSecurityGroups/securityRules"
//   ->
// [ "'Microsoft.Network/networkSecurityGroups'", "'securityRules'" ]
function splitResourceTypeIntoSegments(typeNameUnquotedValue: string): string[] {
    if (isExpression(typeNameUnquotedValue)) {
        // If it's an expression, we can't know how to split it into segments in a generic
        // way, so just return the entire expression
        return [jsonStringToTleExpression(typeNameUnquotedValue)];
    }

    let segments = typeNameUnquotedValue.split('/');
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
