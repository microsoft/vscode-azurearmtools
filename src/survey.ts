// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands, MessageItem, Uri, window, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { configPrefix } from './constants';
import { ext } from "./extensionVariables";
import { assert } from './fixed_assert';
import { httpGet } from "./httpGet";
import { hoursToMs, minutesToMs, weeksToMs } from "./util/time";

// Add the following to your settings file to put the survey into debug mode (using debugSurveyConstants):
//
//    "azureResourceManagerTools.debugSurvey": true
//

namespace stateKeys {
    export const neverShowSurvey = 'neverShowSurvey';
    export const surveyPostponedUntilTime = 'surveyPostponedUntilTime';
}

const linkToSurvey = 'https://aka.ms/arm-tools-survey';
const surveyPrompt = "Could you please take 2 minutes to tell us how well the Azure Resource Manager Tools extension is working for you?";

// Wait for this amount of time since extension first used (this session) before
// considering asking the survey (only if still interacting with extension)
interface ISurveyConstants {
    activeUsageMsBeforeSurvey: number;
    percentageOfUsersToSurvey: number;
    msToPostponeAfterYes: number;
    msToPostponeAfterLater: number;
    msToPostponeAfterNotSelected: number;
    msToPostponeAfterNotAccessible: number;
}

const defaultSurveyConstants: ISurveyConstants = {
    activeUsageMsBeforeSurvey: hoursToMs(1),
    percentageOfUsersToSurvey: 0.25,
    msToPostponeAfterYes: weeksToMs(12),
    msToPostponeAfterLater: weeksToMs(1),
    msToPostponeAfterNotSelected: weeksToMs(12),
    msToPostponeAfterNotAccessible: hoursToMs(1)
};
const debugSurveyConstants: ISurveyConstants = {
    activeUsageMsBeforeSurvey: minutesToMs(1),
    percentageOfUsersToSurvey: 0.5,
    msToPostponeAfterYes: minutesToMs(2),
    msToPostponeAfterLater: minutesToMs(1),
    msToPostponeAfterNotSelected: minutesToMs(0.5),
    msToPostponeAfterNotAccessible: minutesToMs(0.25)
};

let surveyConstants: ISurveyConstants = defaultSurveyConstants;

// Time user started interacting with extension this session
let usageSessionStart: number | undefined;

let isReentrant = false;
let surveyDisabled = false;
let isDebugMode = false;

export namespace survey {
    /**
     * Called whenever the user is interacting with the extension (thus gets called a lot)
     */
    export function registerActiveUse(): void {
        // Don't wait
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling("considerShowingSurvey", async (context: IActionContext) => {
            context.errorHandling.suppressDisplay = true;
            // This gets called a lot, we don't want telemetry for most of it
            context.telemetry.suppressIfSuccessful = true;

            if (isReentrant) {
                return;
            }
            isReentrant = true;
            try {
                await checkForDebugMode(context);

                if (surveyDisabled) {
                    return;
                }

                const neverShowSurvey = getShouldNeverShowSurvey();
                context.telemetry.properties.neverShowSurvey = String(neverShowSurvey);
                if (neverShowSurvey) {
                    surveyDisabled = true;
                    context.telemetry.suppressIfSuccessful = false; // Allow this single telemetry event
                    return;
                }

                const sessionLengthMs = getSessionLengthMs(context);
                context.telemetry.properties.sessionLength = String(sessionLengthMs);
                if (sessionLengthMs < surveyConstants.activeUsageMsBeforeSurvey) {
                    return;
                }

                if (getIsSurveyPostponed()) {
                    return;
                }

                // Enable telemetry from this point on
                context.telemetry.suppressIfSuccessful = false;

                const accessible = await getIsSurveyAccessible();
                context.telemetry.properties.accessible = String(accessible);
                if (!accessible) {
                    // Try again after a while
                    await postponeSurvey(context, surveyConstants.msToPostponeAfterNotAccessible);
                    return;
                }

                const isSelected = getIsUserSelected();
                context.telemetry.properties.isSelected = String(isSelected);
                if (isSelected) {
                    await requestTakeSurvey(context);
                } else {
                    await postponeSurvey(context, surveyConstants.msToPostponeAfterNotSelected);
                }
            } finally {
                isReentrant = false;
            }
        });
    }
}

async function checkForDebugMode(context: IActionContext): Promise<void> {
    if (!isDebugMode) {
        if (workspace.getConfiguration(configPrefix).get<boolean>('debugSurvey')) {
            isDebugMode = true;
            surveyConstants = debugSurveyConstants;

            // Turn off the never show flag (until user selects it again)
            surveyDisabled = false;
            await ext.context.globalState.update(stateKeys.neverShowSurvey, false);
        }
    }

    if (isDebugMode) {
        context.telemetry.properties.debugMode = "true";
    }
}

async function requestTakeSurvey(context: IActionContext): Promise<void> {
    const neverAsk: MessageItem = { title: "Never ask again" };
    const later: MessageItem = { title: "Later" };
    const yes: MessageItem = { title: "Yes" };
    const dismissed: MessageItem = { title: "(dismissed)" };

    const response = await window.showInformationMessage(surveyPrompt, neverAsk, later, yes)
        ?? dismissed;
    context.telemetry.properties.response = String(response.title);

    if (response === neverAsk) {
        await ext.context.globalState.update(stateKeys.neverShowSurvey, true);
    } else if (response === later) {
        await postponeSurvey(context, surveyConstants.msToPostponeAfterLater);
    } else if (response === yes) {
        await postponeSurvey(context, surveyConstants.msToPostponeAfterYes);
        await launchSurvey(context);
    } else {
        assert(response === dismissed, `Unexpected response: ${response.title}`);
        await postponeSurvey(context, surveyConstants.msToPostponeAfterLater);
    }
}

async function launchSurvey(context: IActionContext): Promise<void> {
    await commands.executeCommand('vscode.open', Uri.parse(linkToSurvey));
}

function getIsUserSelected(): boolean {
    // tslint:disable-next-line:insecure-random
    return Math.random() < surveyConstants.percentageOfUsersToSurvey;
}

async function postponeSurvey(context: IActionContext, milliseconds: number): Promise<void> {
    assert(milliseconds > 0);
    let untilTimeMs = Date.now() + milliseconds;

    const currentPostpone = ext.context.globalState.get<number>(stateKeys.surveyPostponedUntilTime, 0);
    if (Number.isInteger(currentPostpone)) {
        untilTimeMs = Math.max(currentPostpone, untilTimeMs);
    }

    context.telemetry.properties.postpone = String(untilTimeMs - Date.now());
    await ext.context.globalState.update(stateKeys.surveyPostponedUntilTime, untilTimeMs);
}

async function getIsSurveyAccessible(): Promise<boolean> {
    try {
        const response = await httpGet(linkToSurvey);
        return !!response;
    } catch (err) {
        return false;
    }
}

function getShouldNeverShowSurvey(): boolean {
    return ext.context.globalState.get<boolean>(stateKeys.neverShowSurvey, false);
}

function getIsSurveyPostponed(): boolean {
    const postponedUntilTime = ext.context.globalState.get<number>(stateKeys.surveyPostponedUntilTime, 0);
    return postponedUntilTime > Date.now();
}

function getSessionLengthMs(context: IActionContext): number {
    if (usageSessionStart === undefined) {
        // Session just started
        usageSessionStart = Date.now();
        return 0;
    } else {
        return Date.now() - usageSessionStart;
    }
}
