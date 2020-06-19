/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as Completion from "./Completion";
import { assetsPath, extensionName } from './constants';
import { ISnippet, ISnippetManager } from "./ISnippetManager";
import * as language from "./Language";
import { readUtf8FileWithBom } from './util/readUtf8FileWithBom';

interface ISnippetDefinitionFromFile {
    prefix: string; // e.g. "arm!"
    body: string[];
    description: string; // e.g. "Resource Group Template"
}

export class SnippetManager implements ISnippetManager {
    private _snippetMap: Map<string, ISnippet> | undefined;

    public constructor(private readonly _snippetPath: string) {
    }

    public static createDefault(): ISnippetManager {
        return new SnippetManager(path.join(assetsPath, "armsnippets.jsonc"));
    }

    /**
     * Read snippets from file
     */
    private async getMap(): Promise<Map<string, ISnippet>> {
        if (!this._snippetMap) {
            const content: string = await readUtf8FileWithBom(this._snippetPath);
            const snippets = <{ [key: string]: ISnippetDefinitionFromFile }>JSON.parse(content);
            this._snippetMap = new Map<string, ISnippet>();

            for (const name of Object.getOwnPropertyNames(snippets)) {
                const snippet = snippets[name];
                const body = snippet.body.join('\n'); // vscode will change to EOL as appropriate

                this._snippetMap.set(name, {
                    name: name,
                    prefix: snippet.prefix,
                    description: snippet.description,
                    insertText: body,
                    context: {
                        isResource: this.isResourceSnippet(snippet)
                    }
                });
            }
        }

        return this._snippetMap;
    }

    private isResourceSnippet(snippet: ISnippetDefinitionFromFile): boolean {
        return snippet.body.some(
            line => !!line.match(/"apiVersion"\s*:/)
        );
    }

    /**
     * Retrieve all snippets
     */
    public async getSnippets(): Promise<ISnippet[]> {
        const map = await this.getMap();
        return Array.from(map.values());
    }

    /**
     * Retrieve completion items for all snippets
     */
    public async getSnippetsAsCompletionItems(span: language.Span, _triggerCharacter: string | undefined): Promise<Completion.Item[]> {
        const map = await this.getMap();

        const items: Completion.Item[] = [];
        for (const entry of map.entries()) {
            const name = entry[0];
            const snippet = entry[1];
            const detail = `${snippet.description} (${extensionName})`;

            items.push(new Completion.Item({
                label: snippet.prefix,
                snippetName: name,
                detail,
                insertText: snippet.insertText,
                span,
                kind: Completion.CompletionKind.Snippet,
                // Make sure snippets show up after normal completions
                priority: Completion.CompletionPriority.low
            }));

        }

        return items;
    }
}
