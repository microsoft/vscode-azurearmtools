// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { MarkdownString } from 'vscode';
import { Span } from '../language/Span';

export interface IHoverInfo {
    hoverType: string; // for telemetry
    span: Span;
    getHoverText(): MarkdownString;
}

export enum HoverType {

}
