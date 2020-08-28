// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { assert } from "../../fixed_assert";
import { AzureRMAssets } from "../../language/expressions/AzureRMAssets";
import * as TLE from "../../language/expressions/TLE";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import * as Completion from "../../vscodeIntegration/Completion";
import { PositionContext } from "../positionContexts/PositionContext";
import { TemplatePositionContext } from "../positionContexts/TemplatePositionContext";
import { getResourcesInfo, IResourceInfo } from "./getResourcesInfo";
import { FunctionBehaviors } from "./IFunctionMetadata";

// Handle completions for resourceId and similar functions with the usesResourceIdCompletions behavior

export function getResourceIdCompletions(
    pc: TemplatePositionContext,
    funcCall: TLE.FunctionCallValue,
    parentStringToken: Json.Token
): Completion.Item[] {
    assert(parentStringToken.type === Json.TokenType.QuotedString, "parentStringToken should be a string token");

    if (!funcCall.isUserDefinedFunction && funcCall.name) {
        const functionMetadata = AzureRMAssets.getFunctionMetadataFromName(funcCall.name);
        if (functionMetadata?.hasBehavior(FunctionBehaviors.usesResourceIdCompletions)) {
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
        return getResourceTypeCompletions(funcCall, pc, resourceIdCompletions, argIndexAtCursor, parentStringToken);
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
        return getResourceTypeCompletions(funcCall, pc, resourceIdCompletions, argIndexAtCursor, parentStringToken);
    }

    // Only look at resources with that type
    let filteredResources = filterResourceInfosByType(allResources, argWithResourceType.typeExpression);

    // Previous parts of the name must also match what is currently specified in the function call

    // argIndex = index of the argument where the cursor is (including any optional parameters), e.g.:
    //   resourceId('subscriptionId', 'resourceGroupName', 'Microsoft.Fake/resource', 'name1', 'name2')
    // If the cursor is on 'name2', then argIndex = 4
    let argIndex = argWithResourceType.argIndex + 1;

    // nameSegmentIndex = index of the name's segment where the cursor is, e.g.:
    //   resourceId('subscriptionId', 'resourceGroupName', 'Microsoft.Fake/resource', 'name1', 'name2')
    // If the cursor is on 'name2', then nameSegmentIndex = 1 (the 2nd segment of the name, which is after
    //   all optional args and after the resource type)
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

            let nameSegmentArgument = funcCall.argumentExpressions[argIndex];
            let span = getReplacementSpan(pc, nameSegmentArgument, parentStringToken);

            results.push(new Completion.Item({
                label,
                insertText,
                span,
                kind: Completion.CompletionKind.tleResourceIdResNameParameter,
                priority: Completion.CompletionPriority.high,
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
                const resFullType = info.fullTypeName;
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
    return infos.filter(info => info.fullTypeName.toLowerCase() === typeExpressionLC);
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
    argumentIndex: number,
    parentStringToken: Json.Token
): Completion.Item[] {
    if (argumentIndex > resourceIdCompletions.maxOptionalParameters) {
        // The resource type must be the argument after the optional arguments.
        // This argument is past that, so no resource type completions.
        return [];
    }

    const results: Completion.Item[] = [];
    for (let info of getResourcesInfo(pc.document)) {
        const insertText = info.fullTypeName;
        const label = insertText;
        let typeArgument = funcCall.argumentExpressions[argumentIndex];
        let span = getReplacementSpan(pc, typeArgument, parentStringToken);

        results.push(new Completion.Item({
            label,
            insertText,
            span,
            kind: Completion.CompletionKind.tleResourceIdResTypeParameter,
            priority: Completion.CompletionPriority.high,
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

function getReplacementSpan(pc: PositionContext, argument: TLE.Value | undefined, parentStringToken: Json.Token): Span {
    let span = argument?.getSpan()?.translate(parentStringToken.span.startIndex)
        ?? pc.emptySpanAtDocumentCharacterIndex;
    return span;
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

export function looksLikeResourceTypeStringLiteral(text: string): boolean {
    // e.g. 'Microsoft.Compute/virtualMachines/extensions'
    return !!text.match(/^'[^'.]+\.[^'.]+\/([^'.]+)(\.[^'.]+)*'$/);
}
