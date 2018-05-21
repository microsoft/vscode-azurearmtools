// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:promise-function-async // Grandfathered in

import * as moment from "moment";
import { httpGet } from "./httpGet";
import { SurveySettings } from "./SurveySettings";

/**
 * The SurveyMetadata class represents the settings related to our user
 * feedback surveys that pertain to all users. This data is stored
 * remotely in our storage account.
 */
export class SurveyMetadata {
    private _surveysEnabled: boolean;
    private _daysBeforeFirstSurvey: number;
    private _daysBetweenSurveys: number;
    private _surveyLink: string;

    public get surveysEnabled(): boolean {
        return this._surveysEnabled;
    }

    public get daysBeforeFirstSurvey(): number {
        return this._daysBeforeFirstSurvey;
    }

    public get daysBetweenSurveys(): number {
        return this._daysBetweenSurveys;
    }

    public get surveyLink(): string {
        return this._surveyLink;
    }

    public shouldShowSurveyPrompt(surveySettings: SurveySettings, nowInMilliseconds?: number): boolean {
        let result: boolean = false;

        if (this.surveysEnabled && this.surveyLink && surveySettings) {
            const now: moment.Moment = nowInMilliseconds ? moment(nowInMilliseconds) : moment();

            if (!surveySettings.previousSurveyPromptDateAndTime) {
                const daysSinceFirstDeploymentTemplate: number = now.diff(surveySettings.deploymentTemplateFirstOpenedOrCreatedDateAndTime, "days");
                result = daysSinceFirstDeploymentTemplate >= this.daysBeforeFirstSurvey;
            } else {
                const daysSincePreviousSurveyPrompt: number = now.diff(surveySettings.previousSurveyPromptDateAndTime, "days");
                result = daysSincePreviousSurveyPrompt >= this.daysBetweenSurveys;
            }
        }

        return result;
    }

    public static fromUrl(metadataUrl: string): Promise<SurveyMetadata> {
        return httpGet(metadataUrl).then((content: string) => {
            return SurveyMetadata.fromString(content);
        });
    }

    public static fromString(metadataString: string): SurveyMetadata {
        let metadataJSON: SurveyMetadataContract;
        try {
            metadataJSON = JSON.parse(metadataString);
        } catch (e) {
            metadataJSON = {};
        }
        return SurveyMetadata.fromJSON(metadataJSON);
    }

    public static fromJSON(metadataJSON: SurveyMetadataContract, initialResult?: SurveyMetadata): SurveyMetadata {
        let result: SurveyMetadata = (initialResult ? initialResult : new SurveyMetadata());

        if (metadataJSON) {
            // tslint:disable-next-line:no-for-in // Grandfathered in
            for (const metadataName in result) {
                if (metadataJSON[metadataName]) {
                    result[`_${metadataName}`] = metadataJSON[metadataName];
                }
            }

            if (metadataJSON.vsCode) {
                result = SurveyMetadata.fromJSON(metadataJSON.vsCode, result);
            }
        }

        return result;
    }
}

interface SurveyMetadataContract {
    surveysEnabled?: boolean;
    daysBeforeFirstSurvey?: number;
    daysBetweenSurveys?: number;
    surveyLink?: string;

    vsCode?: {
        surveysEnabled?: boolean;
        daysBeforeFirstSurvey?: number;
        daysBetweenSurveys?: number;
        surveyLink?: string;
    };
}
