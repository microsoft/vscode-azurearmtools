/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { parseError } from "vscode-azureextensionui";
import { assert } from "../fixed_assert";
import { KnownContexts } from "./KnownContexts";
import { ISnippetDefinitionFromFile } from "./SnippetManager";

// Similar to Bicep snippet placeholder format
const StringSnippetPlaceholderCommentPatternRegex = new RegExp(
    `\\/\\*"\\\${` + // start: /*"{
    `(?<snippetPlaceholder>(.*?))` +
    `}"\\*\\/` + // end: }"*/
    `\\s?` + // allow space after placeholder (see above)
    `(` + // placeholder value, either:
    // /**/ `'(.*?)'` + // single-quoted value
    /**/ `"(.*?)"` + // double-quoted value
    ///**/ `|\\w+` + // or word
    // /**/ `|-\\d+` + // or integer value
    ///**/ `|.*?` + // or any other string of characters
    `)`,
    'g'
);

const NonStringSnippetPlaceholderCommentPatternRegex = new RegExp(
    `\\/\\*\\\${` + // start: /*{
    `(?<snippetPlaceholder>(.*?))` +
    `}\\*\\/` + // end: }*/
    `\\s?` + // allow space after placeholder (see above)
    `(` + // placeholder value, either:
    // /**/ `'(.*?)'` + // single-quoted value
    ///**/ `"(.*?)"` + // double-quoted value
    /**/ `\\w+` + // word
    // /**/ `|-\\d+` + // or integer value
    ///**/ `|.*?` + // or any other string of characters
    `)`,
    'g'
);

////////////////////////////////////
//
//    This supports the same convension currently used in bicep snippets for placeholders which could cause
//    parse errors (e.g. if the placeholder is not inside a string).  The placeholder itself is placed inside
//    an inline comment followed immediately by an acceptable value for parsing (which is removed)
//
//    Example:
//
//      "isExportable": /*${6|true,false|}*/false
//        or
//      "isExportable": /*${6|true,false|}*/ false
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
    // e.g.  /*"{$5|Enabled,Disabled|}"*/"Enabled"  ->   "EMBEDDEDSTRING!"{$5|Enabled,Disabled|}"!EMBEDDEDSTRING"
    // e.g. /*${6|true,false|}*/false -> /*${6|true,false|}*/false
    let snippetNoPlaceholders = snippetFileContent.replace(StringSnippetPlaceholderCommentPatternRegex, "\"EMBEDDEDSTRING!$1!EMBEDDEDSTRING\"");

    // e.g.  /*"{$5|Enabled,Disabled|}"*/"Enabled"  ->   "EMBEDDEDSTRING!"{$5|Enabled,Disabled|}"!EMBEDDEDSTRING"
    // e.g. /*${6|true,false|}*/false -> /*${6|true,false|}*/false
    snippetNoPlaceholders = snippetNoPlaceholders.replace(NonStringSnippetPlaceholderCommentPatternRegex, "\"NOTASTRING!$1!NOTASTRING\"");

    try {
        return JSON.parse(snippetNoPlaceholders);
    } catch (ex) {
        throw new Error(`Error processing resource snippet '${snippetName}': ${parseError(ex).message}`);
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
        let lineWithCorrectPlaceholders = lineWithTabs.replace(/EMBEDDEDSTRING!/, '${').replace(/!EMBEDDEDSTRING/, '}');
        lineWithCorrectPlaceholders = lineWithCorrectPlaceholders.replace(/\"NOTASTRING!/, '${').replace(/!NOTASTRING\"/, '}');

        const lineNormalized = lineWithCorrectPlaceholders.replace(/"/g, '\"');

        body.push(lineNormalized);
    }

    return body;
}
