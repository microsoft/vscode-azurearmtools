// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { MarkdownString } from 'vscode';
import * as TLE from '../language/expressions/TLE';
import { Span } from '../language/Span';
import { indentMultilineString } from '../util/multilineStrings';
import { IHoverInfo } from "./IHoverInfo";

/**
 * A hover that shows an expression formatted in an easy-to-read, multi-line manner
 */
export class FormattedExpressionHoverInfo implements IHoverInfo {
    constructor(private readonly _expression: TLE.Value) {
    }

    public hoverType: string = 'formattedExpression';

    public get span(): Span {
        return this._expression.getSpan();
    }

    public getHoverText(): MarkdownString {
        let formattedExpression = this._expression.format({ multiline: { tabSize: 4 } });
        formattedExpression = indentMultilineString(formattedExpression, 4);
        const markdown = new MarkdownString();
        markdown.appendMarkdown("Full expression:");
        markdown.appendCodeblock(`"[\n${formattedExpression}\n]"`, 'arm-template');
        return markdown;
    }
}
