// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { templateKeys } from "../../constants";
import { assert } from "../../fixed_assert";
import * as TLE from "../../language/expressions/TLE";
import * as Json from "../../language/json/JSON";
import { isSingleQuoted, removeSingleQuotes } from "../../util/strings";
import { areDecoupledChildAndParent } from "./areDecoupledChildAndParent";
import { TemplateScope } from "./scopes/TemplateScope";

/**
 * Get useful info about each resource in the template in a flat list, including the ability to understand full resource names and types in the
 * presence of parent/child resources
 */
export function getResourcesInfo(
    { scope, recognizeDecoupledChildren }:
        {
            scope: TemplateScope;
            recognizeDecoupledChildren: boolean;
        }
): IJsonResourceInfo[] {
    const resourcesArray = scope.rootObject?.getPropertyValue(templateKeys.resources)?.asArrayValue;
    if (resourcesArray) {
        const infos = getInfoFromResourcesArray(resourcesArray, undefined, scope);
        if (recognizeDecoupledChildren) {
            findAndSetDecoupledChildren(infos);
        }

        return infos;
    }

    return [];
}

// tslint:disable-next-line: no-suspicious-comment
// TODO: Consider combining with or hanging off of IResource. IResource currently only used for sorting templates and finding nested deployments? Nested subnets are not currently IResources but are IResourceInfos
export interface IResourceInfo {
    /**
     * The parent resource, if any (might be a decoupled parent)
     */
    parent?: IResourceInfo;

    /**
     * True if this is a child that was defined at top level instead of nested inside the parent
     */
    isDecoupledChild: boolean;

    children: IResourceInfo[];

    /**
     * The full reource name, split into segments (e.g. "sqlServer/firewallRule1" => ["sqlServer", "firewallRule1"]).
     * For nested child resources, the name of the parent will automatically be added if not specified in the child
     */
    nameSegmentExpressions: string[];

    /**
     * The full reource type, split into segments (e.g. "Microsoft.sql/servers/firewallRules" => ["Microsoft.sql/servers", "firewallRules"]).
     * For nested child resources, the type of the parent will automatically be added if not specified in the child
     */
    typeSegmentExpressions: string[];

    /**
     * Provides just the last segment in the name
     */
    shortNameExpression: string | undefined;

    /**
     * asdf
     */
    shortTypeExpression: string | undefined;

    /**
     * Gets the full name of the resource as a TLE expression
     */
    getFullNameExpression(): string | undefined;

    /**
     * Gets the type name of the resource as a TLE expression
     */
    getFullTypeExpression(): string | undefined;

    /**
     * Creates a resourceId expression to reference this resource
     */
    getResourceIdExpression(): string | undefined;
}

export interface IJsonResourceInfo extends IResourceInfo {
    /**
     * The JSON object that represents this resource
     */
    resourceObject: Json.ObjectValue;

    /**
     * The COPY element for this resource, if any
     */
    copyBlockElement: Json.ObjectValue | undefined;

    //asdf comment
    getFriendlyLabel(): string;
}

export class ResourceInfo implements IResourceInfo {
    public readonly children: IResourceInfo[] = [];
    public constructor(public readonly nameSegmentExpressions: string[], public readonly typeSegmentExpressions: string[], public readonly parent?: IResourceInfo) {
        if (parent) {
            parent.children.push(this);
        }
    }

    public isDecoupledChild: boolean = false;

    public get shortNameExpression(): string {
        return this.nameSegmentExpressions[this.nameSegmentExpressions.length - 1];
    }

    public get shortTypeExpression(): string | undefined {
        if (this.typeSegmentExpressions.length > 1) {
            return this.typeSegmentExpressions[this.typeSegmentExpressions.length - 1];
        } else {
            const firstSegment = this.typeSegmentExpressions[0];
            if (isSingleQuoted(firstSegment)) {
                const a = removeSingleQuotes(firstSegment).replace(/.+\//, ''); //asdf
                return a;
            } else {
                return firstSegment;
            }
        }
    }

    public getFullTypeExpression(): string | undefined {
        return concatExpressionWithSeparator(this.typeSegmentExpressions, '/');
    }

    public getFullNameExpression(): string | undefined {
        return concatExpressionWithSeparator(this.nameSegmentExpressions, '/');
    }

    public getResourceIdExpression(): string | undefined {
        if (this.nameSegmentExpressions.length > 0 && this.typeSegmentExpressions.length > 0) {
            const typeExpression = this.getFullTypeExpression();
            const nameExpressions = this.nameSegmentExpressions.join(', ');
            return `resourceId(${typeExpression}, ${nameExpressions})`;
        }

        return undefined;
    }
}

export class JsonResourceInfo extends ResourceInfo implements IJsonResourceInfo {
    public constructor(nameSegmentExpressions: string[], typeSegmentExpressions: string[], public readonly resourceObject: Json.ObjectValue, parent: IJsonResourceInfo | undefined) {
        super(nameSegmentExpressions, typeSegmentExpressions, parent);
    }

    public get copyBlockElement(): Json.ObjectValue | undefined {
        return this.resourceObject.getPropertyValue(templateKeys.copyLoop)?.asObjectValue;
    }

    public getFriendlyLabel(): string {
        return getResourceFriendlyName(this);
    }
}

/**
 * Concatenates a list of TLE expressions into a single expression, using 'concat' if necessary, and combining string literals when possible.
 * @param expressions TLE expressions to concat
 * @param unquotedLiteralSeparator An optional separator string literal (without the quotes) to place between every expression
 *
 * @example
 *  concatExpressionsWithSeparator(
 *    [ `parameters('a')`, `'b'`,`'c'`, `'d'`, `123`, `456`, `parameters('e')`, `parameters('f')`, `'g'`, `'h'` ],
 *    `/`
 *  )
 *
 *    returns
 *
 * `concat(parameters('a'), '/b/c/d/', 123, '/', 456, '/', parameters('e'), '/', parameters('f'), '/g/h')`
 */
function concatExpressionWithSeparator(expressions: string[], unquotedLiteralSeparator?: string): string | undefined {
    if (expressions.length < 2) {
        return expressions[0];
    }

    // Coalesce adjacent string literals
    const coalescedExpressions: string[] = [];
    const expressionsLength = expressions.length;
    for (let i = 0; i < expressionsLength; ++i) {
        let expression = expressions[i];
        const isLastSegment = i === expressionsLength - 1;

        if (isSingleQuoted(expression)) {
            if (unquotedLiteralSeparator && !isLastSegment) {
                // Add separator
                expression = `'${removeSingleQuotes(expression)}${unquotedLiteralSeparator}'`;
            }

            // Merge with last expression if it's also a string literal
            const lastCoalescedExpression = coalescedExpressions[coalescedExpressions.length - 1];
            if (lastCoalescedExpression && isSingleQuoted(lastCoalescedExpression)) {
                coalescedExpressions[coalescedExpressions.length - 1] =
                    `'${removeSingleQuotes(lastCoalescedExpression)}${removeSingleQuotes(expression)}'`;
            } else {
                coalescedExpressions.push(expression);
            }
        } else {
            coalescedExpressions.push(expression);
            if (unquotedLiteralSeparator && !isLastSegment) {
                // Add separator
                coalescedExpressions.push(`'${unquotedLiteralSeparator}'`);
            }
        }
    }

    if (coalescedExpressions.length < 2) {
        return coalescedExpressions[0];
    }

    return `concat(${coalescedExpressions.join(', ')})`;
}

function getInfoFromResourcesArray(resourcesArray: Json.ArrayValue, parent: IJsonResourceInfo | undefined, scope: TemplateScope): IJsonResourceInfo[] {
    const results: IJsonResourceInfo[] = [];
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
                    typeExpressions = [...parent.typeSegmentExpressions, ...typeSegments];
                } else {
                    typeExpressions = typeSegments;
                }

                const nameSegments = splitResourceNameIntoSegments(resName.unquotedValue, scope);
                if (parent && nameSegments.length <= 1) {
                    // Add to end of parent name segments
                    nameExpressions = [...parent.nameSegmentExpressions, ...nameSegments];
                } else {
                    nameExpressions = nameSegments;
                }

                const info: IJsonResourceInfo = new JsonResourceInfo(nameExpressions, typeExpressions, resourceObject, parent);
                results.push(info);

                // Check child resources
                const childResources = resourceObject.getPropertyValue(templateKeys.resources)?.asArrayValue;
                if (childResources) {
                    const childrenInfo = getInfoFromResourcesArray(childResources, info, scope);
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
                if (resType.unquotedValue.toLowerCase() === 'microsoft.network/virtualnetworks') {
                    const subnets = resourceObject.getPropertyValue(templateKeys.properties)?.asObjectValue
                        ?.getPropertyValue('subnets')?.asArrayValue;
                    for (let subnet of subnets?.elements ?? []) {
                        const subnetObject = subnet.asObjectValue;
                        const subnetName = subnetObject?.getPropertyValue(templateKeys.resourceName)?.asStringValue;
                        if (subnetObject && subnetName) {
                            const subnetTypes = [`'Microsoft.Network/virtualNetworks'`, `'subnets'`];
                            const subnetInfo = new JsonResourceInfo(
                                [
                                    jsonStringToTleExpression(resName.unquotedValue),
                                    jsonStringToTleExpression(subnetName.unquotedValue)
                                ],
                                subnetTypes,
                                subnetObject,
                                info
                            );
                            results.push(subnetInfo);
                        }
                    }
                }
            }
        }
    }

    return results;
}

function isJsonStringAnExpression(text: string): boolean {
    // Not perfect, but good enough for our purposes here (doesn't handle string starting with "[[", for instance)
    return text.length >= 2 && text[0] === '[' && text[text.length - 1] === ']';
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
    if (isJsonStringAnExpression(stringUnquotedValue)) {
        return stringUnquotedValue.slice(1, stringUnquotedValue.length - 1);
    } else {
        return `'${stringUnquotedValue}'`;
    }
}

// example1:
//   "networkSecurityGroup2/networkSecurityGroupRule2"
//     ->
//   [ "'networkSecurityGroup2'", "'networkSecurityGroupRule2'" ]
//
// example2:
//   "[concat(variables('sqlServer'), '/' , variables('firewallRuleName'))]"
//     ->
//   [ "concat(variables('sqlServer')", "variables('firewallRuleName')" ]
export function splitResourceNameIntoSegments(nameUnquotedValue: string, scope: TemplateScope): string[] {
    if (isJsonStringAnExpression(nameUnquotedValue)) {
        // It's an expression.  Try to break it into segments by handling certain common patterns

        // No sense taking time for parsing the expression if '/' is nowhere in the expression
        if (nameUnquotedValue.includes('/')) {
            const quotedValue = `"${nameUnquotedValue}"`;
            const parseResult = TLE.Parser.parse(quotedValue, scope);
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
    if (isJsonStringAnExpression(typeNameUnquotedValue)) {
        // If it's an expression, we can't know how to split it into segments in a generic
        // way, so just return the entire expression
        return [jsonStringToTleExpression(typeNameUnquotedValue)];
    }

    let segments = typeNameUnquotedValue.split('/');
    if (segments.length >= 2) {
        // The first segment consists of a namespace and an initial name (e.g. 'Microsoft.sql/servers'), so combine our first two entries
        segments = [`${segments[0]}/${segments[1]}`].concat(segments.slice(2));
    }

    return segments.map(segment => `'${segment}'`);
}

function findAndSetDecoupledChildren(infos: IJsonResourceInfo[]): void {
    const topLevel = infos.filter(info => !info.parent);
    const possibleParents = topLevel;
    const possibleChildren = topLevel.filter(info => !info.parent && info.nameSegmentExpressions.length > 1);

    for (const parent of possibleParents) { // Note: a resource could be a parent of multiple children (some nested, some decoupled)
        const removeIndices: number[] = [];
        possibleChildren.slice().forEach((child, index) => { // slice() makes a copy of the array so we can modify it while looping
            assert(!child.parent, "Should have been removed from the array already");
            if (areDecoupledChildAndParent(child, parent)) {
                parent.children.push(child);
                child.parent = parent;
                child.isDecoupledChild = true;

                // A resource can't have two parents (whether nested or decoupled), so remove from possibilities
                //asdf   possibleChildren.splice(index, 1);
                removeIndices.push(index);
            }
        });

        for (let i = removeIndices.length - 1; i >= 0; --i) {
            possibleChildren.splice(removeIndices[i], 1);
        }

        if (possibleChildren.length === 0) {
            break;
        }
    }
}

//asdf
function expressionToFriendlyString(expression: string): string { //asdf pass in expression or json string?  Or either?  Need to distinguish the two better
    if (isSingleQuoted(expression)) {
        return removeSingleQuotes(expression); //asdf
    } else {
        return jsonStringToFriendlyString(`[${expression}]`); //asdf
    }
}

/**
 * Shortens a label in a way intended to keep the important information but make it easier to read
 * and shorter (so you can read more in the limited horizontal space)
 */
export function jsonStringToFriendlyString(expression: string): string { //asdf pass in expression or json string?  Or either?  Need to distinguish the two better
    let simplified = expression;

    //asdf
    // If it's an expression - starts and ends with [], but doesn't start with [[, and at least one character inside the []
    if (simplified && simplified.match(/^\[[^\[].*]$/)) {

        //  variables/parameters('a') -> ${a}
        // tslint:disable-next-line: no-invalid-template-strings
        simplified = simplified.replace(/(variables|parameters)\('([^']+)'\)/g, '$${$2}');

        // concat(x,'y') => x,'y'
        // Repeat multiple times for recursive cases
        // tslint:disable-next-line:no-constant-condition
        while (true) {
            let newLabel = simplified.replace(/concat\((.*)\)/g, '$1');
            if (simplified !== newLabel) {
                simplified = newLabel;
            } else {
                break;
            }
        }

        //asdf?
        // if (expression !== originalLabel) {
        //     // If we actually made changes, remove the brackets so users don't think this is the exact expression
        //     return expression.substr(1, expression.length - 2);
        // }

        simplified = simplified.slice(1, simplified.length - 1); //asdf
        //simplified = `"${simplified}"`;
        return simplified;
    }

    return expression;
}

export function getResourceFriendlyName(resource: IJsonResourceInfo): string { //asdf
    const resourceObject = resource.resourceObject;

    // Object contains no elements
    if (resource.resourceObject.properties.length === 0) {
        return "(empty resource)"; //asdf shouldn't happen
    } else {
        // Object contains elements, look for displayName tag first
        // tslint:disable-next-line: strict-boolean-expressions
        let tags = resourceObject.getPropertyValue(templateKeys.tags)?.asObjectValue;
        let displayName = tags?.getPropertyValue(templateKeys.displayNameTag)?.asStringValue?.unquotedValue;
        if (displayName) {
            return displayName;
        }

        let nameLabel: string;
        const name = resource.shortNameExpression; //asdf  resourceObject.getPropertyValue(templateKeys.resourceName)?.asStringValue?.unquotedValue;
        if (name) {
            nameLabel = expressionToFriendlyString(name);
        } else {
            nameLabel = "(unnamed resource)";
        }

        //asdf
        // label = this.getLabelFromProperties("namespace", resourceObject);
        // if (label !== undefined) {
        //     return label;
        // }

        //asdflet typeLabel = resource.getFullTypeExpression() ?? "no type";
        let typeLabel = resource.shortTypeExpression ?? '(no type)';
        typeLabel = /*asdf expressionToFriendlyString*/ (typeLabel.replace(/microsoft\./ig, 'MS.')); //asdf
        //typeLabel = expressionToFriendlyString(typeLabel); //asdf
        typeLabel = removeSingleQuotes(typeLabel);

        //asdf return `{${nameLabel}, ${typeLabel}}`;
        //asdfreturn `${typeLabel} (${nameLabel})`;
        return `"${nameLabel}" (${typeLabel})`;

        //asdf    }

        // } else if (elementInfo.current.value.kind === Json.ValueKind.ArrayValue || elementInfo.current.value.kind === Json.ValueKind.ObjectValue) {
        //     // The value of the node is an array or object (e.g. properties or resources) - return key as the node label
        //     return toFriendlyString(keyNode);
        // } else if (elementInfo.current.value.start !== undefined) {
        //     // For other value types, display key and value since they won't be expandable
        //     const valueNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.current.value.start, ContainsBehavior.strict);

        //     return `${keyNode instanceof Json.StringValue ? toFriendlyString(keyNode) : "?"}: ${toFriendlyString(valueNode)}`;
    }
}
