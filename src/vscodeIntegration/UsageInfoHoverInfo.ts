// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable max-classes-per-file // Grandfathered in

import * as os from 'os';
import { MarkdownString } from 'vscode';
import { Span } from '../language/Span';
import { IHoverInfo } from './IHoverInfo';

export interface IUsageInfo {
    usage: string;
    friendlyType: string; // e.g "parameter", "user function"
    description: string | undefined;
}

/**
 * The information that will be displayed when the cursor hovers over parts of a document.
 */
export class UsageInfoHoverInfo implements IHoverInfo {
    constructor(private _hoverType: string, private readonly _usageInfo: IUsageInfo, private readonly _referenceSpan: Span) {
    }

    public getHoverText(): MarkdownString {
        let info = `**${this._usageInfo.usage}**${os.EOL}*(${this._usageInfo.friendlyType})*`;
        const description = this._usageInfo.description;
        if (description) {
            info += os.EOL + os.EOL + description;
        }

        return new MarkdownString(info);
    }

    public get span(): Span {
        return this._referenceSpan;
    }

    public get hoverType(): string {
        return this._hoverType;
    }

    public get friendlyType(): string {
        return this._usageInfo.friendlyType;
    }

    public get usage(): string {
        return this._usageInfo.usage;
    }

    public get description(): string | undefined {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._usageInfo.description || undefined;
    }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.getHoverText().value;
    }
}
