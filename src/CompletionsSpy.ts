// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CompletionItem, Event, EventEmitter } from "vscode";
import { Completion } from "../extension.bundle";
import { DeploymentDocument } from "./DeploymentDocument";

export interface ICompletionsSpyResult {
    document: DeploymentDocument;
    completionItems: Completion.Item[];
    vsCodeCompletionItems: CompletionItem[];
}

export class CompletionsSpy {
    private readonly _completionsEmitter: EventEmitter<ICompletionsSpyResult> = new EventEmitter<ICompletionsSpyResult>();
    private readonly _resolveEmitter: EventEmitter<CompletionItem> = new EventEmitter<CompletionItem>();

    public readonly onCompletionItems: Event<ICompletionsSpyResult> = this._completionsEmitter.event;
    public readonly onCompletionItemResolved: Event<CompletionItem> = this._resolveEmitter.event;

    public postCompletionItemsResult(
        document: DeploymentDocument,
        completionItems: Completion.Item[],
        vsCodeCompletionItems: CompletionItem[]
    ): void {
        this._completionsEmitter.fire({
            document,
            completionItems,
            vsCodeCompletionItems
        });
    }

    public postCompletionItemResolution(item: CompletionItem): void {
        this._resolveEmitter.fire(item);
    }

    public dispose(): void {
        this._completionsEmitter.dispose();
    }
}
