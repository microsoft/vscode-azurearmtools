// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { MarkdownString } from 'vscode';
import * as Json from '../language/json/JSON';
import { Span } from '../language/Span';
import { IHoverInfo } from "./IHoverInfo";

/**
 * A hover that shows a JSON string with \r, \n formatted in multiple lines
 */
export class FormattedStringHoverInfo implements IHoverInfo {
    constructor(private readonly _value: Json.StringValue) {
    }

    public hoverType: string = 'formattedString';

    public get span(): Span {
        return this._value.span;
    }

    public getHoverText(): MarkdownString {
        const formattedString = this._value.quotedValue
            .replace(/\\r\\n/g, '\n')
            .replace(/\\r/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t');
        const markdown = new MarkdownString();
        markdown.appendMarkdown("Multi-line string:");
        markdown.appendCodeblock(formattedString, 'plaintext');
        return markdown;
    }
}
