/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as stripJsonComments from "strip-json-comments";
import { window } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from 'vscode-azureextensionui';
import { assetsPath, extensionName } from '../constants';
import { assert } from '../fixed_assert';
import { Span } from '../language/Span';
import { CachedPromise } from '../util/CachedPromise';
import { readUtf8FileWithBom } from '../util/readUtf8FileWithBom';
import * as Completion from "../vscodeIntegration/Completion";
import { InsertionContext } from "./InsertionContext";
import { ISnippet } from "./ISnippet";
import { ISnippetManager } from "./ISnippetManager";
import { Context, KnownContexts } from './KnownContexts';
import { createResourceSnippetFromFile } from './resourceSnippetsConversion';

export interface ISnippetDefinitionFromFile {
    prefix: string; // e.g. "arm!"
    body: string[];
    description: string; // e.g. "Resource Group Template"
    context: string;
}

interface ISnippetInternal extends ISnippetDefinitionFromFile {
    name: string;
    hasCurlyBraces: boolean; // Are the first and last lines the beginning and ending curly braces?s
}

export class SnippetManager implements ISnippetManager {
    private _snippetMap: CachedPromise<Map<string, ISnippetInternal>> = new CachedPromise<Map<string, ISnippetInternal>>();

    public constructor(private readonly _snippetFilePath: string, private readonly _resourceSnippetsFolderPath: string | undefined) {
    }

    public static createDefault(): ISnippetManager {
        return new SnippetManager(path.join(assetsPath, "armsnippets.jsonc"), path.join(assetsPath, "resourceSnippets"));
    }

    /**
     * Read snippets from file
     */
    private async createSnippetsMap(): Promise<Map<string, ISnippetInternal>> {
        return this._snippetMap.getOrCachePromise(async () => {
            const map = await SnippetManager.readSnippetFile(this._snippetFilePath);

            if (this._resourceSnippetsFolderPath) {
                const resourceSnippets = await SnippetManager.readResourceSnippetsFromFolder(this._resourceSnippetsFolderPath);
                for (const snippet of resourceSnippets.entries()) {
                    const key = snippet[0];
                    const value = snippet[1];
                    assert(!map.has(key), `Resource snippet ${key} already has an entry in the main snippet file`);
                    map.set(key, value)
                }
            }

            return map;
        });
    }

    private static async readSnippetFile(filePath: string): Promise<Map<string, ISnippetInternal>> {
        const content: string = await readUtf8FileWithBom(filePath);
        const preprocessed = stripJsonComments(content);
        const snippets = <{ [key: string]: ISnippetDefinitionFromFile }>JSON.parse(preprocessed);
        const map = new Map<string, ISnippetInternal>();

        for (const name of Object.getOwnPropertyNames(snippets).filter(n => !n.startsWith('$'))) {
            const snippetFromFile = snippets[name];
            const snippet = convertToInternalSnippet(name, snippetFromFile);
            validateSnippet(snippet);
            assert(snippet.context !== KnownContexts.resources, `Resource snippet "${snippet.name}" should be placed in the resourceSnippets folder instead of "${filePath}"`);
            map.set(name, snippet);
        }

        return map;
    }

    private static async readResourceSnippetsFromFolder(folderPath: string): Promise<Map<string, ISnippetInternal>> {
        const map = new Map<string, ISnippetInternal>();

        const snippetFiles = await fse.readdir(folderPath);
        for (const relativePath of snippetFiles) {
            const snippetName = relativePath.replace(/(.*)\.snippet\.json$/, '$1');
            assert(snippetName !== relativePath, `Incorrectly formed resource snippet file name ${relativePath}`)
            const content: string = await readUtf8FileWithBom(path.join(folderPath, relativePath));
            const snippet = createResourceSnippetFromFile(snippetName, content);
            const internalSnippet = convertToInternalSnippet(snippetName, snippet);
            validateSnippet(internalSnippet);
            map.set(snippetName, internalSnippet);
        }

        return map;
    }

    /**
     * Retrieve all snippets that support a given context
     */
    public async getSnippets(context: Context | undefined): Promise<ISnippet[]> {
        const map = await this.createSnippetsMap();
        return Array.from(map.values())
            .filter(s => doesSnippetSupportContext(s, context))
            .map(convertToSnippet);
    }

    public async getAllSnippets(): Promise<ISnippet[]> {
        const map = await this.createSnippetsMap();
        return Array.from(map.values()).map(convertToSnippet);
    }

    /**
     * Retrieve completion items for all snippets
     */
    public async getSnippetsAsCompletionItems(insertionContext: InsertionContext, span: Span): Promise<Completion.Item[]> {
        return await callWithTelemetryAndErrorHandling('getSnippetsAsCompletionItems', async (actionContext: IActionContext) => {
            actionContext.telemetry.suppressIfSuccessful = true;

            const map = await this.createSnippetsMap();

            const items: Completion.Item[] = [];
            for (const entry of map.entries()) {
                const internalSnippet = entry[1];
                if (doesSnippetSupportContext(internalSnippet, insertionContext.context)) {
                    const snippet = convertToSnippet(internalSnippet);
                    const additionalEdits = [];
                    if (insertionContext.curlyBraces) {
                        // Remove the original curly braces since the snippet with have the curly braces
                        // (maybe even multiple resources from a single snippet)
                        additionalEdits.push(
                            {
                                span: insertionContext.curlyBraces,
                                insertText: ""
                            });
                    }

                    const name = entry[0];
                    const detail = `${internalSnippet.description} (${extensionName})`;
                    let label = internalSnippet.prefix;
                    if (insertionContext.insideJsonString && !label.startsWith('"')) {
                        label = `"${label}"`;
                    }

                    items.push(new Completion.Item({
                        label,
                        snippetName: name,
                        detail,
                        insertText: snippet.insertText,
                        span,
                        kind: Completion.CompletionKind.Snippet,
                        // Make sure snippets show up after normal completions
                        priority: Completion.CompletionPriority.low,
                        // Putting the label/description and name into filterText allows users to search
                        //   for snippets by either the label (prefix) or the non-abbreviated words
                        //   in the name or description, e.g. users can type "virtual" and find the "arm-vnet" snippet
                        filterText: `${label} ${name} ${snippet.description}`,
                        additionalEdits: additionalEdits
                    }));
                }
            }

            return items;
        }) ?? [];
    }
}

/**
 * Is this snippet supported in the given context?
 */
function doesSnippetSupportContext(snippet: ISnippetInternal, context: Context | undefined): boolean {
    if (!context || snippet.context !== context) {
        return false;
    }

    return true;
}

function validateSnippet(snippet: ISnippetInternal): ISnippetInternal {
    const context = snippet.context;
    if (context === undefined) {
        window.showWarningMessage(`Snippet "${snippet.name}" has no context specified`);
    }

    const looksLikeResource = snippet.body.some(
        line => !!line.match(/"apiVersion"\s*:/)
    );
    const isResource = doesSnippetSupportContext(snippet, KnownContexts.resources);
    if (isResource) {
        if (!looksLikeResource) {
            window.showWarningMessage(`Snippet "${snippet.name}" is marked with the resources context but doesn't looke like a resource`);
        }
        if (!snippet.hasCurlyBraces) {
            window.showWarningMessage(`Snippet "${snippet.name}" is marked with the resources context but doesn't begin and end with curly braces`);
        }
    } else {
        if (looksLikeResource) {
            window.showWarningMessage(`Snippet "${snippet.name}" looks like a resource but isn't supported in the resources context`);
        }
    }

    return snippet;
}

function convertToInternalSnippet(snippetName: string, snippetFromFile: ISnippetDefinitionFromFile): ISnippetInternal {
    const hasCurlyBraces =
        snippetFromFile.body.length >= 2
        && snippetFromFile.body[0] === '{'
        && snippetFromFile.body[snippetFromFile.body.length - 1] === '}';
    const internalSnippet: ISnippetInternal = {
        name: snippetName,
        prefix: snippetFromFile.prefix,
        description: snippetFromFile.description,
        body: snippetFromFile.body,
        context: snippetFromFile.context,
        hasCurlyBraces
    };

    return internalSnippet;
}

function convertToSnippet(snippet: ISnippetInternal): ISnippet {
    let body = snippet.body;
    const insertText = body.join('\n'); // vscode will change to EOL as appropriate
    return {
        name: snippet.name,
        prefix: snippet.prefix,
        description: snippet.description,
        insertText: insertText
    };
}
