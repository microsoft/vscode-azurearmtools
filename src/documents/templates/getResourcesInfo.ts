// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { templateKeys } from "../../constants";
import { assert } from "../../fixed_assert";
import { getFriendlyExpressionFromTleExpression } from "../../language/expressions/friendlyExpressions";
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
        const infos = getInfoFromResourcesArray(resourcesArray, undefined);
        if (recognizeDecoupledChildren) {
            findAndSetDecoupledChildren(infos);
        }

        return infos;
    }

    return [];
}

/**
 * Get useful info about a single resource in a template, ignoring children and parents
 */
export function getResourceInfo(
    resourceObject: Json.ObjectValue
): IJsonResourceInfo | undefined {
    const results: IJsonResourceInfo[] = [];
    getInfoFromResourceObject(resourceObject, undefined, results, false);
    return results[0];
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
     * The full reource name, split into segments (e.g. "'sqlServer/firewallRule1'" => ["'sqlServer'", "'firewallRule1'"]).
     * For nested child resources, the name of the parent will automatically be added if not specified in the child
     */
    nameSegmentExpressions: string[];

    /**
     * The full reource type as a TLE expression, split into segments (e.g. "'Microsoft.sql/servers/firewallRules'" => ["'Microsoft.sql/servers'", "'firewallRules'"]).
     * For nested child resources, the type of the parent will automatically be added if not specified in the child
     */
    typeSegmentExpressions: string[];

    /**
     * Provides just the last segment in the name as a TLE expression
     * @example "'firewallRule1'" (where the full name is "'Microsoft.sql/servers/firewallRules'")
     * @example "[parameters('name')]" (where the full name is "[concat(parameters('parent'), '/', parameters('name'))]")
     */
    shortNameExpression: string | undefined;

    /**
     * Retrieves the last component of the type name as a TLE expression (does not including the RP name)
     * @example "'firewallRules'" (where the full type name is "'Microsoft.sql/servers/firewallRules'")
     * @example "[parameters('type')]" (where the full name is "[concat(parameters('RP'), '/', parameters('type'))]")
     */
    shortTypeExpression: string | undefined;

    /**
     * Gets the full name of the resource as a TLE expression
     * @example "'Microsoft.sql/servers/firewallRules'"
     */
    getFullNameExpression(): string | undefined;

    /**
     * Gets the type name of the resource as a TLE expression
     * @example "'Microsoft.sql/servers/firewallRules'"
     */
    getFullTypeExpression(): string | undefined;

    /**
     * Creates a resourceId expression to reference this resource
     */
    getResourceIdExpression(): string | undefined;

    /**
     * Retrieves a shortened, user-friendly label for the resource that can be used in treeviews,
     * code lens references, etc.  It consists of a version of the name (short or full) and type, using
     * a format similar to the new string interpolation (e.g. concat's are coalesced and var/param references
     * use ${x} notation).
     */
    getFriendlyResourceLabel({ fullName }: { fullName?: boolean }): string;

    /**
     * Retrieves a friendly name expression (might be the display name) for just the resource name
     */
    getFriendlyNameExpression({ fullName }: { fullName?: boolean }): string;

    /**
     * Retrieves a friendly name expression for just the resource type
     */
    getFriendlyTypeExpression({ fullType }: { fullType?: boolean }): string;
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
            // Example: ["'Microsoft.sql/servers'", "'firewallRules'"]
            // Short name is simply the last segment
            return this.typeSegmentExpressions[this.typeSegmentExpressions.length - 1];
        } else {
            const firstSegment = this.typeSegmentExpressions[0];

            if (firstSegment && isSingleQuoted(firstSegment)) {
                // It's a string, remove the RP portion
                // Example: "'Microsoft.sql/servers'" -> "'servers'"
                return firstSegment.replace(/'.+\//g, "'");
            } else {
                // It's an expression
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

    public getFriendlyNameExpression({ fullName }: { fullName?: boolean }): string {
        return getFriendlyNameExpression({ resource: this, fullName });
    }

    public getFriendlyTypeExpression({ fullType }: { fullType?: boolean }): string {
        return getFriendlyTypeExpression({ resource: this, fullType });
    }

    public getFriendlyResourceLabel({ fullName, fullType }: { fullName?: boolean; fullType?: boolean }): string {
        return getFriendlyResourceLabel({ resource: this, fullName, fullType });
    }
}

export class JsonResourceInfo extends ResourceInfo implements IJsonResourceInfo {
    public constructor(nameSegmentExpressions: string[], typeSegmentExpressions: string[], public readonly resourceObject: Json.ObjectValue, parent: IJsonResourceInfo | undefined) {
        super(nameSegmentExpressions, typeSegmentExpressions, parent);
    }

    public get copyBlockElement(): Json.ObjectValue | undefined {
        return this.resourceObject.getPropertyValue(templateKeys.copyLoop)?.asObjectValue;
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

function getInfoFromResourcesArray(resourcesArray: Json.ArrayValue, parent: IJsonResourceInfo | undefined): IJsonResourceInfo[] {
    const results: IJsonResourceInfo[] = [];
    for (let resourceValue of resourcesArray.elements ?? []) {
        const resourceObject = Json.asObjectValue(resourceValue);
        if (resourceObject) {
            getInfoFromResourceObject(resourceObject, parent, results, true);
        }
    }

    return results;
}

function getInfoFromResourceObject(resourceObject: Json.ObjectValue, parent: IJsonResourceInfo | undefined, results: IJsonResourceInfo[], processChildren: boolean): void {
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

        const nameSegments = splitResourceNameIntoSegments(resName.unquotedValue);
        if (parent && nameSegments.length <= 1) {
            // Add to end of parent name segments
            nameExpressions = [...parent.nameSegmentExpressions, ...nameSegments];
        } else {
            nameExpressions = nameSegments;
        }

        const info: IJsonResourceInfo = new JsonResourceInfo(nameExpressions, typeExpressions, resourceObject, parent);
        results.push(info);

        if (processChildren) {
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
export function splitResourceNameIntoSegments(nameUnquotedValue: string): string[] {
    if (isJsonStringAnExpression(nameUnquotedValue)) {
        // It's an expression.  Try to break it into segments by handling certain common patterns
        return splitExpressionIntoSegments(nameUnquotedValue);
    }

    return nameUnquotedValue.split('/').map(segment => `'${segment}'`);
}

// e.g.
// "Microsoft.Network/networkSecurityGroups/securityRules"
//   ->
// [ "'Microsoft.Network/networkSecurityGroups'", "'securityRules'" ]
function splitResourceTypeIntoSegments(typeNameUnquotedValue: string): string[] {
    let segments: string[];

    if (isJsonStringAnExpression(typeNameUnquotedValue)) {
        // It's an expression.  Try to break it into segments by handling certain common patterns
        // Example: "[concat(variables('a'), '/', variables('c'))]"
        return splitExpressionIntoSegments(typeNameUnquotedValue);
    } else {
        segments = typeNameUnquotedValue.split('/');

        if (segments.length >= 2) {
            // The first segment consists of a namespace and an initial name (e.g. 'Microsoft.sql/servers'), so combine our first two entries
            segments = [`${segments[0]}/${segments[1]}`].concat(segments.slice(2));
        }

        return segments.map(segment => `'${segment}'`);
    }
}

/**
 * Try to break up a expression (surrounded by square brackets) by handling certain common patterns
 */
function splitExpressionIntoSegments(jsonString: string): string[] {
    assert(jsonString[0] === '[');

    // No sense taking time for parsing the expression if '/' is nowhere in the expression
    if (jsonString.includes('/')) {
        const quotedValue = `"${jsonString}"`;
        const parseResult = TLE.Parser.parse(quotedValue);
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
    return [jsonStringToTleExpression(jsonString)];
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

function getFriendlyNameExpression(
    { resource, fullName }:
        {
            resource: IResourceInfo | IJsonResourceInfo;
            fullName?: boolean;
        }
): string {
    const resourceObject = ("resourceObject" in resource) ? resource.resourceObject : undefined;

    let friendlyName: string;

    // Look for displayName tag first
    let tags = resourceObject?.getPropertyValue(templateKeys.tags)?.asObjectValue;
    let displayName = tags?.getPropertyValue(templateKeys.displayNameTag)?.asStringValue?.unquotedValue;
    if (displayName) {
        friendlyName = displayName;
    } else {
        // No displayName tag, use name
        const name = fullName ? resource.getFullNameExpression() : resource.shortNameExpression;
        if (name) {
            friendlyName = getFriendlyExpressionFromTleExpression(name);
        } else {
            friendlyName = "(unnamed resource)";
        }
    }

    return friendlyName;
}

function getFriendlyTypeExpression(
    { resource, fullType }:
        {
            resource: IResourceInfo;
            fullType?: boolean;
        }
): string {
    let friendlyType = fullType ? resource.getFullTypeExpression() : resource.shortTypeExpression;
    friendlyType = friendlyType ? getFriendlyExpressionFromTleExpression(friendlyType) : '(no type)';
    return friendlyType;
}

function getFriendlyResourceLabel(
    { resource, fullName, fullType }:
        {
            resource: IResourceInfo;
            fullName?: boolean;
            fullType?: boolean;
        }
): string {
    let nameLabel: string = getFriendlyNameExpression({ resource, fullName });

    // Add short type as well
    let typeLabel = getFriendlyTypeExpression({ resource, fullType });

    return `${nameLabel} (${typeLabel})`;
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
                // Can't actually remove until we're done with the loop
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
