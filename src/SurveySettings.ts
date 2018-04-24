// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";

/**
 * The SurveySettings class represents the settings related to our user
 * feedback surveys that pertain to only one user. This data is stored
 * locally on the user's disk.
 */
export class SurveySettings {
    private _deploymentTemplatesOpenedOrCreated: number;
    private _deploymentTemplateFirstOpenedOrCreatedDateAndTime: number;
    private _showSurveyPrompts: boolean;
    private _previousSurveyPromptDateAndTime: number;

    public get deploymentTemplatesOpenedOrCreated(): number {
        return this._deploymentTemplatesOpenedOrCreated;
    }

    public set deploymentTemplatesOpenedOrCreated(value: number) {
        this._deploymentTemplatesOpenedOrCreated = value;
    }

    public incrementDeploymentTemplatesOpenedOrCreated(): void {
        if (this.deploymentTemplatesOpenedOrCreated) {
            this.deploymentTemplatesOpenedOrCreated = this.deploymentTemplatesOpenedOrCreated + 1;
        }
        else {
            this.deploymentTemplatesOpenedOrCreated = 1;
        }
    }

    public get deploymentTemplateFirstOpenedOrCreatedDateAndTime(): number {
        return this._deploymentTemplateFirstOpenedOrCreatedDateAndTime;
    }

    public set deploymentTemplateFirstOpenedOrCreatedDateAndTime(value: number) {
        this._deploymentTemplateFirstOpenedOrCreatedDateAndTime = value;
    }

    public get showSurveyPrompts(): boolean {
        return this._showSurveyPrompts;
    }

    public set showSurveyPrompts(value: boolean) {
        this._showSurveyPrompts = value;
    }

    public get previousSurveyPromptDateAndTime(): number {
        return this._previousSurveyPromptDateAndTime;
    }

    public set previousSurveyPromptDateAndTime(value: number) {
        this._previousSurveyPromptDateAndTime = value;
    }

    private ensureDirectoryExists(folderPath: string): void {
        if (!fs.existsSync(folderPath)) {
            this.ensureDirectoryExists(path.dirname(folderPath));
            fs.mkdirSync(folderPath);
        }
    }

    public toJSONString(): string {
        return JSON.stringify(this, null, " ").replace(/_/g, "");
    }

    public toFile(settingsFilePath: string): void {
        this.ensureDirectoryExists(path.dirname(settingsFilePath));
        const fileContents: string = this.toJSONString();
        fs.writeFileSync(settingsFilePath, fileContents, { encoding: "utf8" });
    }

    public static fromFile(settingsFilePath: string): SurveySettings {
        let result: SurveySettings;

        if (fs.existsSync(settingsFilePath)) {
            const settingsFileContents: string = fs.readFileSync(settingsFilePath, "utf8");
            result = SurveySettings.fromString(settingsFileContents);
        }
        else {
            result = new SurveySettings();
        }

        return result;
    }

    public static fromString(settingsFileContents: string): SurveySettings {
        let settingsJSON: SurveySettingsContract;
        try {
            settingsJSON = JSON.parse(settingsFileContents);
        }
        catch (e) {
            settingsJSON = {};
        }
        return SurveySettings.fromJSON(settingsJSON);
    }

    public static fromJSON(settingsJSON: SurveySettingsContract): SurveySettings {
        const result: SurveySettings = new SurveySettings();

        if (settingsJSON) {
            for (const settingName in result) {
                if (settingsJSON[settingName]) {
                    result[settingName] = settingsJSON[settingName];
                }
            }
        }

        return result;
    }
}

export interface SurveySettingsContract {
    deploymentTemplatesOpenedOrCreated?: number;
    deploymentTemplateFirstOpenedOrCreatedDateAndTime?: number;
    showSurveyPrompts?: boolean;
    previousSurveyPromptDateAndTime?: number;
}
