/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const SnippetPlaceholderCommentPatternRegex = /\/\*(?<snippetPlaceholder>(.*?))\*\/('(.*?)'|\w+|-\d+|.*?)/g;

export function convertSnippetFileToSnippetBody(snippetFileContent: string): string[] {
    const snippetNoPlaceholders = snippetFileContent.replace(SnippetPlaceholderCommentPatternRegex, "\"REMOVESTRING!$1!REMOVESTRING\"");
    const parsed = JSON.parse(snippetNoPlaceholders);
    const resources = parsed.resources;
    const resourcesString = JSON.stringify(resources, null, 1);
    let lines = resourcesString.split(/\r\n|\r|\n/);

    // Remove the beginning '[' and ']'
    lines = lines.slice(1, lines.length - 1);

    const body: string[] = [];
    for (const line of lines) {
        const tabs = (<string[]>line.match(/^ */))[0].length
            - 1; // Remove the indentation of the '[]' that we removed

        const lineWithTabs = line.replace(/^ */, '\t'.repeat(tabs));
        const lineWithCorrectPlaceholders = lineWithTabs.replace(/\"REMOVESTRING!/, '').replace(/!REMOVESTRING\"/, '');

        const lineNormalized = lineWithCorrectPlaceholders.replace(/"/g, '\"');

        body.push(lineNormalized);
    }

    return body;
}
