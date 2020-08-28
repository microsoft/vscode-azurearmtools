// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { templateKeys } from "../../constants";
import * as TLE from "../../language/expressions/TLE";
import * as Json from "../../language/json/JSON";
import { DeploymentTemplateDoc } from "./DeploymentTemplateDoc";

/**
 * Get useful info about each resource in the template.  Knows how to construct a full resource name for a child resource,
 * for example.
 */
export function getResourcesInfo(template: DeploymentTemplateDoc): IResourceInfo[] {
    if (template.resourceObjects) {
        return getInfoFromResourcesArray(template.resourceObjects, undefined, template);
    }

    return [];
}

// tslint:disable-next-line: no-suspicious-comment
// TODO: Convert to class //asdf
export interface IResourceInfo {
    nameExpressions: string[];
    typeExpressions: string[];
}

export function getFullResourceTypeName(info: IResourceInfo): string {
    if (info.typeExpressions.length > 1) {
        return `'${info.typeExpressions.map(removeSingleQuotes).join('/')}'`;
    } else {
        return info.typeExpressions[0];
    }
}

function getInfoFromResourcesArray(resourcesArray: Json.ArrayValue, parent: IResourceInfo | undefined, dt: DeploymentTemplateDoc): IResourceInfo[] {
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
export function jsonStringToTleExpression(stringUnquotedValue: string): string {
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

// e.g.
//   "networkSecurityGroup2/networkSecurityGroupRule2"
//     ->
//   [ "'networkSecurityGroup2'", "'networkSecurityGroupRule2'" ]
//
//   "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]"
//     ->
//   [ "concat(variables('sqlServer')", "variables('firewallRuleName')" ]
export function splitResourceNameIntoSegments(nameUnquotedValue: string, dt: DeploymentTemplateDoc): string[] {
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
