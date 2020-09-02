import { MarkdownString } from "vscode";
import { assert } from "../../fixed_assert";
import * as Json from "../../language/json/JSON";
import { ContainsBehavior, Span } from "../../language/Span";
import { isSingleQuoted, removeSingleQuotes } from "../../util/strings";
import * as Completion from "../../vscodeIntegration/Completion";
import { TemplatePositionContext } from "../positionContexts/TemplatePositionContext";
import { getResourcesInfo, IJsonResourceInfo, IResourceInfo } from "./getResourcesInfo";

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

    const scope = pc.getScope();
    const infos = getResourcesInfo(scope);
    if (infos.length === 0) {
        return completions;
    }

    // Find the nearest IResource containing the current position
    let currentResource = findClosestEnclosingResource(pc.documentCharacterIndex, infos);

    // Find descendents of the resource
    const descendentsIncludingSelf: Set<IResourceInfo> = findDescendentsIncludingSelf(currentResource);

    for (const resource of infos) {
        // Don't offer completion from a resource to itself or to any direct descendent
        if (descendentsIncludingSelf.has(resource)) {
            continue;
        }

        const item = getDependsOnCompletion(resource, span);
        if (item) {
            completions.push(item);
        }
    }

    return completions;
}

/**
 * Get possible completions for entries inside a resource's "dependsOn" array
 */
function getDependsOnCompletion(resource: IResourceInfo, span: Span): Completion.Item | undefined {
    const resourceIdExpression = resource.getResourceIdExpression();
    const shortNameExpression = resource.shortNameExpression;

    if (shortNameExpression && resourceIdExpression) {
        const label = shortNameExpression;
        let typeExpression = resource.getFullTypeExpression();
        if (typeExpression && isSingleQuoted(typeExpression)) {
            // Simplify the type expression to remove quotes and the first prefix (e.g. 'Microsoft.Compute/')
            typeExpression = removeSingleQuotes(typeExpression);
            typeExpression = typeExpression.replace(/^[^/]+\//, '');
        }
        const insertText = `"[${resourceIdExpression}]"`;
        const detail = typeExpression;

        //const resourceResTypeMarkdown = `- **Name**: *${resource.getFullNameExpression()}*\n- **Type**: *${resource.getFullTypeExpression()}*`;
        // const resourceDocumentation = `#### Inserts a resourceId() reference to the following resource:\n${resourceResTypeMarkdown}`;
        // const documentation = `\`\`\`csharp\n[${resourceIdExpression}]\n\`\`\`\n${resourceDocumentation}`;

        const documentation = `Inserts this resourceId reference:\n\`\`\`arm-template\n"[${resourceIdExpression}]"\n\`\`\`\n<br/>`;

        const item = new Completion.Item({
            label,
            insertText: insertText,
            detail,
            documentation: new MarkdownString(documentation),
            span,
            kind: Completion.CompletionKind.dependsOnResourceId,
            // Normally vscode uses label if this isn't specified, but it doesn't seem to like the "[" in the label,
            // so specify filter text explicitly
            filterText: insertText
        });

        return item;
    }

    return undefined;
}

function findClosestEnclosingResource(documentIndex: number, infos: IJsonResourceInfo[]): IJsonResourceInfo | undefined {
    const containsBehavior = ContainsBehavior.enclosed;

    // Find any resource that contains the point
    const firstMatch = infos.find(info => info.resourceObject.span.contains(documentIndex, containsBehavior));
    if (firstMatch) {
        // We found an arbitrary resource that contains this position.  Find the deepest child that still contains it
        let deepestMatch = firstMatch;
        // tslint:disable-next-line: no-constant-condition
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
