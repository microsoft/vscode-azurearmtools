// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { MarkdownString } from "vscode";
import { templateKeys } from "../../../common";
import { assert } from "../../fixed_assert";
import { ContainsBehavior, Span } from "../../language/Span";
import { getFriendlyExpressionFromTleExpression } from "../../language/expressions/friendlyExpressions";
import { isTleExpression } from "../../language/expressions/isTleExpression";
import * as Json from "../../language/json/JSON";
import * as Completion from "../../vscodeIntegration/Completion";
import { TemplatePositionContext } from "../positionContexts/TemplatePositionContext";
import { IJsonResourceInfo, IResourceInfo, getResourcesInfo, jsonStringToTleExpression } from "./getResourcesInfo";

// Handle completions for dependsOn array entries
export function getDependsOnCompletions(
    pc: TemplatePositionContext
): Completion.Item[] {
    const completions: Completion.Item[] = [];
    let span: Span;
    if (pc.jsonToken?.type === Json.TokenType.QuotedString) {
        // We're already inside a JSON string.  The completion should replace the entire string because it's
        // not likely the user would want anything else
        span = pc.jsonToken.span;
    } else {
        span = pc.emptySpanAtDocumentCharacterIndex;
    }

    // Allow suggest dependsOn completions only when the string is not (yet) an expression.  Inside
    //  an expression they will just add a bunch of completions that are confusing for the context
    if (pc.tleInfo?.tleParseResult.leftSquareBracketToken) {
        return [];
    }

    const scope = pc.getScope();
    const infos = getResourcesInfo({ scope, recognizeDecoupledChildren: true });
    if (infos.length === 0) {
        return completions;
    }

    // Find the nearest IResource containing the current position
    const currentResource = findClosestEnclosingResource(pc.documentCharacterIndex, infos);

    // Find descendents of the resource
    const descendentsIncludingSelf: Set<IResourceInfo> = findDescendentsIncludingSelf(currentResource);

    for (const resource of infos) {
        // Don't offer completion from a resource to itself or to any direct descendent
        if (descendentsIncludingSelf.has(resource)) {
            continue;
        }

        const items = getDependsOnCompletionsForResource(resource, span, currentResource?.parent === resource);
        completions.push(...items);
    }

    return completions;
}

/**
 * Get possible completions for entries inside a resource's "dependsOn" array
 */
function getDependsOnCompletionsForResource(resource: IJsonResourceInfo, span: Span, isParent: boolean): Completion.Item[] {
    const completions: Completion.Item[] = [];

    const resourceIdExpression = resource.getResourceIdExpression();

    if (resourceIdExpression) {
        const friendlyNameExpression = resource.getFriendlyNameExpression({ fullName: false });
        const friendlyTypeExpression = resource.getFriendlyTypeExpression({ fullType: false });

        const label = friendlyNameExpression;
        const insertText = `"[${resourceIdExpression}]"`;
        const detail = friendlyTypeExpression;
        const documentation = `Inserts this resourceId reference:\n\`\`\`arm-template\n"[${resourceIdExpression}]"\n\`\`\`\n<br/>`;

        const item = new Completion.Item({
            label: isParent ? `Parent (${label})` : label,
            insertText: insertText,
            detail,
            documentation: new MarkdownString(documentation),
            span,
            kind: Completion.CompletionKind.dependsOnResourceId,
            filterText: `${insertText}${isParent ? " parent" : ""}`, // Allow filtering off of "parent"
            priority: isParent ? Completion.CompletionPriority.high : Completion.CompletionPriority.normal
        });

        completions.push(item);

        const copyName = resource.copyBlockElement?.getPropertyValue(templateKeys.copyName)?.asStringValue?.unquotedValue;
        if (copyName) {
            const copyNameExpression = jsonStringToTleExpression(copyName);
            const copyLabel = `Loop ${getFriendlyExpressionFromTleExpression(copyNameExpression)}`;
            const copyInsertText = isTleExpression(copyName) ? `"[${copyNameExpression}]"` : `"${copyName}"`;
            const copyDetail = detail;
            // tslint:disable-next-line: prefer-template
            const copyDocumentation = `Inserts this COPY element reference:
\`\`\`arm-template
${copyInsertText}
\`\`\`
from resource \`${friendlyNameExpression}\` of type \`${friendlyTypeExpression}\``;

            // CONSIDER: set parent as preselected if the resource doesn't already have it listed in dependsOn (requires understanding non-resourceId types of dependsOn entries)
            const copyItem = new Completion.Item({
                label: copyLabel,
                insertText: copyInsertText,
                detail: copyDetail,
                documentation: new MarkdownString(copyDocumentation),
                span,
                kind: Completion.CompletionKind.dependsOnResourceCopyLoop,
                // Normally vscode uses label if this isn't specified, but it doesn't seem to like the "[" in the label,
                // so specify filter text explicitly
                filterText: copyInsertText
            });

            completions.push(copyItem);
        }
    }

    return completions;
}

function findClosestEnclosingResource(documentIndex: number, infos: IJsonResourceInfo[]): IJsonResourceInfo | undefined {
    const containsBehavior = ContainsBehavior.enclosed;

    // Find any resource that contains the point
    const firstMatch = infos.find(info => info.resourceObject.span.contains(documentIndex, containsBehavior));
    if (firstMatch) {
        // We found an arbitrary resource that contains this position.  Find the deepest child that still contains it
        let deepestMatch = firstMatch;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const childrenContainingResource = deepestMatch.children.filter(child => (<IJsonResourceInfo>child).resourceObject.span.contains(documentIndex, containsBehavior));
            assert(childrenContainingResource.length <= 1, "Shouldn't find multiple children containing the document position");
            if (childrenContainingResource.length > 0) {
                deepestMatch = <IJsonResourceInfo>childrenContainingResource[0];
            } else {
                return deepestMatch;
            }
        }
    }

    return undefined;
}

function findDescendentsIncludingSelf(resource: IResourceInfo | undefined): Set<IResourceInfo> {
    const descendentsIncludingSelf: Set<IResourceInfo> = new Set<IResourceInfo>();
    visit(resource);
    return descendentsIncludingSelf;

    function visit(res: IResourceInfo | undefined): void {
        if (res) {
            descendentsIncludingSelf.add(res);

            for (const child of res.children) {
                visit(child);
            }
        }
    }
}
