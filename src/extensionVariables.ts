/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IAzExtOutputChannel, IAzureUserInput, ITelemetryReporter } from "vscode-azureextensionui";
import { LanguageClient } from "vscode-languageclient";
import { IConfiguration, VsCodeConfiguration } from "./Configuration";
import { configPrefix, isWebpack } from "./constants";
import { assert } from "./fixed_assert";
import { LanguageServerState } from "./languageclient/startArmLanguageServer";
import { JsonOutlineProvider } from "./Treeview";

/**
 * Represents a scalar value that must be initialized before its getValue is called
 */
class InitializeBeforeUse<T> {
    private _value: { value: T; initialized: true } | { initialized: false } = { initialized: false };

    public setValue(value: T): void {
        this._value = { value: value, initialized: true };
    }

    public getValue(): T {
        if (this._value.initialized) {
            return this._value.value;
        } else {
            assert.fail("ExtensionVariables has not been fully initialized");
        }
    }
}

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
// Work-around for https://github.com/microsoft/vscode/issues/83254 - store ext instance on global to keep it a singleton
// tslint:disable-next-line: class-name
class ExtensionVariables {
    public readonly extensionId: string = "msazurermtools.azurerm-vscode-tools";
    private _context: InitializeBeforeUse<vscode.ExtensionContext> = new InitializeBeforeUse<vscode.ExtensionContext>();
    private _jsonOutlineProvider: InitializeBeforeUse<JsonOutlineProvider> = new InitializeBeforeUse<JsonOutlineProvider>();
    private _reporter: InitializeBeforeUse<ITelemetryReporter> = new InitializeBeforeUse<ITelemetryReporter>();
    private _outputChannel: InitializeBeforeUse<IAzExtOutputChannel> = new InitializeBeforeUse<IAzExtOutputChannel>();
    private _ui: InitializeBeforeUse<IAzureUserInput> = new InitializeBeforeUse<IAzureUserInput>();

    public set context(context: vscode.ExtensionContext) {
        this._context.setValue(context);
    }
    public get context(): vscode.ExtensionContext {
        return this._context.getValue();
    }

    public set jsonOutlineProvider(context: JsonOutlineProvider) {
        this._jsonOutlineProvider.setValue(context);
    }
    public get jsonOutlineProvider(): JsonOutlineProvider {
        return this._jsonOutlineProvider.getValue();
    }

    public set reporter(reporter: ITelemetryReporter) {
        this._reporter.setValue(reporter);
    }
    public get reporter(): ITelemetryReporter {
        return this._reporter.getValue();
    }

    public set outputChannel(outputChannel: IAzExtOutputChannel) {
        this._outputChannel.setValue(outputChannel);
    }
    public get outputChannel(): IAzExtOutputChannel {
        return this._outputChannel.getValue();
    }

    public set ui(ui: IAzureUserInput) {
        this._ui.setValue(ui);
    }
    public get ui(): IAzureUserInput {
        return this._ui.getValue();
    }

    public readonly ignoreBundle: boolean = !isWebpack;

    public languageServerClient: LanguageClient | undefined;
    public languageServerState: LanguageServerState = LanguageServerState.NotStarted;

    // Suite support - lets us know when diagnostics have been completely published for a file
    public addCompletedDiagnostic: boolean = false;

    public readonly configuration: IConfiguration = new VsCodeConfiguration(configPrefix);
}

// tslint:disable-next-line: no-any
if (!(<any>global).vscodearm_ext) {
    // tslint:disable-next-line: no-any
    (<any>global).vscodearm_ext = new ExtensionVariables();
}

// tslint:disable-next-line: no-any no-unsafe-any
export const ext: ExtensionVariables = (<any>global).vscodearm_ext;
