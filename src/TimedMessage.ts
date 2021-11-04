// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, MessageItem, Uri, window } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { ext } from "./extensionVariables";
import { assert } from './fixed_assert';
import { minutesToMs, weeksToMs } from "./util/time";

interface ISettings {
    delayBetweenAttempts: number;
}

const defaultSettings: ISettings = {
    delayBetweenAttempts: weeksToMs(1),
};
const debugSettings: ISettings = {
    delayBetweenAttempts: minutesToMs(1),
};

export class TimedMessage {
    private _settings: ISettings = defaultSettings;
    private _alreadyCheckedThisSession: boolean = false;

    public constructor(
        private _postponeUntilTimeKey: string,
        private _debugSettingKey: string,
        private _message: string,
        private _learnMoreUri: Uri
    ) {
    }

    /**
     * Called whenever the user is interacting with the extension (thus gets called a lot)
     */
    public registerActiveUseNoThrow(): void {
        if (this._alreadyCheckedThisSession) {
            return;
        }
        this._alreadyCheckedThisSession = true;

        // Don't wait
        callWithTelemetryAndErrorHandling("considerShowingMessage", async (context: IActionContext) => {
            context.errorHandling.suppressDisplay = true;
            context.telemetry.properties.message = this._message;

            await this.checkForDebugMode();

            const postponeUntilTime: number = ext.context.globalState.get<number>(this._postponeUntilTimeKey) ?? 0;
            if (postponeUntilTime < 0) {
                // This means never show again
                context.telemetry.properties.status = 'NeverShowAgain';
                return;
            } else if (Date.now() < postponeUntilTime) {
                context.telemetry.properties.status = "TooEarly";
                return;
            } else if (postponeUntilTime === 0) {
                // First time - set up initial delay
                await this.postpone();
                context.telemetry.properties.status = "FirstDelay";
                return;
            }

            // Time to show message

            // In case the user never responds, go ahead and set up postponement until next delay
            await this.postpone();

            const neverAskAgain: MessageItem = { title: "Never ask again" };
            const moreInfo: MessageItem = { title: "More Info" };

            const response = await window.showInformationMessage(this._message, moreInfo, neverAskAgain) ?? neverAskAgain;
            context.telemetry.properties.response = String(response.title);

            // No matter the response, neve show again
            await this.neverShowAgain();

            if (response === moreInfo) {
                await commands.executeCommand('vscode.open', this._learnMoreUri);
            } else {
                assert(response === neverAskAgain);
            }
        }).catch(err => {
            assert.fail("Shouldn't throw");
        });
    }

    private async checkForDebugMode(): Promise<void> {
        if (ext.configuration.get<boolean>(this._debugSettingKey)) {
            this._settings = debugSettings;
        }
    }

    public async neverShowAgain(): Promise<void> {
        this._alreadyCheckedThisSession = true;
        await ext.context.globalState.update(this._postponeUntilTimeKey, -1);
    }

    private async postpone(): Promise<void> {
        await ext.context.globalState.update(this._postponeUntilTimeKey, Date.now() + this._settings.delayBetweenAttempts);
    }
}
