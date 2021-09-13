/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError } from "vscode-azureextensionui";
import { assert } from "../fixed_assert";
import { ISnippet } from "./ISnippet";
import { KnownContexts } from "./KnownContexts";
import { ISnippetDefinitionFromFile } from "./SnippetManager";

// Note: The '\s?' was added to the bicep version because JSON formatting automatically adds a space after the
//   comment, turning the below into "isExportable": /*${6|true,false|}*/[SPACE]false
const SnippetPlaceholderCommentPatternRegex = /\/\*(?<snippetPlaceholder>(.*?))\*\/\s?('(.*?)'|\w+|-\d+|.*?)/g;

////////////////////////////////////
//
//    This supports the same convension currently used in bicep snippets for placeholders which could cause
//    parse errors (e.g. if the placeholder is not inside a string).  The placeholder itself is placed inside
//    an inline comment followed immediately by an acceptable value for parsing (which is removed)
//
//    Example:
//
//      "isExportable": /*${6|true,false|}*/false
//
//    will be converted to the following in the snippet:
//
//      "isExportable": {6|true,false|}
//
////////////////////////////////////

export function createResourceSnippetFromFile(snippetName: string, snippetFileContent: string): ISnippetDefinitionFromFile {
    const json = getJsonFromResourceSnippetFile(snippetName, snippetFileContent);
    const body = getBodyFromResourceSnippetJson(json);
    const metadata = <{ [key: string]: string | undefined }>json.metadata;
    const description = metadata.description;
    const prefix = metadata.prefix;

    assert(description, `Resource snippet "${snippetName}" is missing metadata.description`);
    assert(prefix, `Resource snippet "${snippetName}" is missing metadata.prefix`);

    return {
        body,
        context: KnownContexts.resources,
        description,
        prefix
    };
}

// for testing only
export function getBodyFromResourceSnippetFile(snippetName: string, snippetFileContent: string): string[] {
    const parsed = getJsonFromResourceSnippetFile(snippetName, snippetFileContent);
    return getBodyFromResourceSnippetJson(parsed);
}

function getJsonFromResourceSnippetFile(snippetName: string, snippetFileContent: string): { [key: string]: unknown } {
    const snippetNoPlaceholders = snippetFileContent.replace(SnippetPlaceholderCommentPatternRegex, "\"REMOVESTRING!$1!REMOVESTRING\"");
    try {
        return JSON.parse(snippetNoPlaceholders);
    } catch (ex) {
        throw new Error(`Error processing resource snippet ${snippetName}: ${parseError(ex).message}`);
    }
}

function getBodyFromResourceSnippetJson(json: { [key: string]: unknown }): string[] {
    const resources = json.resources;
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

export function convertToResourceSnippetJsonFile(snippet: ISnippet): string {
    const lines = snippet.insertText.split(/\n|\r|\r\n/);
    let resources = lines.join('\n');
    const constChars = '[a-zA-Z0-9_]';
    // e.g. "state": "${5|enabled,disabled|}",
    resources = resources.replace(new RegExp(`\\"\\\${([0-9]+)\\|(${constChars}+)(,${constChars}+)*\\|}\\"`, 'g'), '/*{$$$1|$2$3|}*/"$2"')
    // e.g. "\t\t\t\"requestBodyCheck\": ${2|true,false|},",
    resources = resources.replace(new RegExp(`\\\${([0-9]+)\\|(${constChars}+)(,${constChars}+)*\\|}`, 'g'), "/*{$$$1|$2$3|}*/$2")
    // e.g. "Port": ${17:80}
    resources = resources.replace(new RegExp(`: \\\${([0-9]+):(${constChars}+)}`, 'g'), ": /*{$$$1:$2}*/$2")

    const json = `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "metadata": {
        "prefix": "${snippet.prefix}",
        "description": "${snippet.description}"
    },
    "resources": [
${resources}
    ]
}`;
    return json;
}
