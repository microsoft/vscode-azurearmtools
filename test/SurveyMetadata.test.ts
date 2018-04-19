// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import { SurveyMetadata } from "../src/SurveyMetadata";
import { SurveySettings } from "../src/SurveySettings";

// tslint:disable-next-line:no-suspicious-comment
// TODO: Re-enable as part of https://github.com/Microsoft/vscode-azurearmtools/issues/51
function suiteDisabled(name: string, func: Function) {
}

suite("SurveyMetadata", () => {
    test("constructor()", () => {
        const sm = new SurveyMetadata();
        assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
        assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
        assert.deepStrictEqual(undefined, sm.surveyLink);
        assert.deepStrictEqual(undefined, sm.surveysEnabled);
    });

    suiteDisabled("shouldShowSurveyPrompt(SurveySettings)", () => {
        test("with undefined settings", () => {
            const sm = new SurveyMetadata();
            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(undefined), false);
        });

        test("with null settings", () => {
            const sm = new SurveyMetadata();
            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(undefined), false);
        });

        test("with settings.showSurveyPrompts set to false", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = false;

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss), false);
        });

        test("with metadata.surveysEnabled set to false", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: false
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss), false);
        });

        test("with not enough days before first survey", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                daysBeforeFirstSurvey: 10
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();

            const nowInMilliseconds: number = new Date(2016, 3, 4).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), false);
        });

        test("with enough days before first survey, but without a surveyLink", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                daysBeforeFirstSurvey: 10
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();

            const nowInMilliseconds: number = new Date(2016, 3, 13).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), false);
        });

        test("with enough days before first survey", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                surveyLink: "www.bing.com",
                daysBeforeFirstSurvey: 10
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();

            const nowInMilliseconds: number = new Date(2016, 3, 13).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), true);
        });

        test("with not enough days since previous survey", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                daysBeforeFirstSurvey: 10,
                surveyLink: "www.bing.com",
                daysBetweenSurveys: 15
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();
            ss.previousSurveyPromptDateAndTime = new Date(2016, 4, 2).getTime();

            const nowInMilliseconds: number = new Date(2016, 4, 14).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), false);
        });

        test("with enough days since previous survey, but without a surveyLink", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                daysBeforeFirstSurvey: 10,
                daysBetweenSurveys: 15
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();
            ss.previousSurveyPromptDateAndTime = new Date(2016, 4, 2).getTime();

            const nowInMilliseconds: number = new Date(2016, 4, 17).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), false);
        });

        test("with enough days since previous survey", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: true,
                surveyLink: "www.bing.com",
                daysBeforeFirstSurvey: 10,
                daysBetweenSurveys: 15
            });

            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime = new Date(2016, 3, 3).getTime();
            ss.previousSurveyPromptDateAndTime = new Date(2016, 4, 2).getTime();

            const nowInMilliseconds: number = new Date(2016, 4, 17).getTime();

            assert.deepStrictEqual(sm.shouldShowSurveyPrompt(ss, nowInMilliseconds), true);
        });
    });

    suiteDisabled("fromString(string)", () => {
        test("with undefined", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString(undefined);
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with null", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString(null);
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with empty string", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString("");
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with empty object", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString("{}");
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with surveysEnabled property", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString("{ \"surveysEnabled\": true }");
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(true, sm.surveysEnabled);
        });

        test("with daysBeforeFirstSurvey property", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString("{ \"daysBeforeFirstSurvey\": 30 }");
            assert(sm);
            assert.deepStrictEqual(30, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with non-JSON string", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromString("hello world");
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });
    });

    suiteDisabled("fromJSON(any)", () => {
        test("with undefined", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON(undefined);
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with null", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON(null);
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with empty object", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({});
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with surveysEnabled property", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({ surveysEnabled: true });
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(undefined, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(true, sm.surveysEnabled);
        });

        test("with daysBetweenSurveys property", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({ daysBetweenSurveys: 20 });
            assert(sm);
            assert.deepStrictEqual(undefined, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(20, sm.daysBetweenSurveys);
            assert.deepStrictEqual(undefined, sm.surveyLink);
            assert.deepStrictEqual(undefined, sm.surveysEnabled);
        });

        test("with vsCode specific properties", () => {
            const sm: SurveyMetadata = SurveyMetadata.fromJSON({
                surveysEnabled: false,
                daysBeforeFirstSurvey: 20,
                surveyLink: "test",

                vsCode: {
                    daysBetweenSurveys: 7,
                    surveysEnabled: true
                }
            });
            assert(sm);
            assert.deepStrictEqual(20, sm.daysBeforeFirstSurvey);
            assert.deepStrictEqual(7, sm.daysBetweenSurveys);
            assert.deepStrictEqual("test", sm.surveyLink);
            assert.deepStrictEqual(true, sm.surveysEnabled);
        });
    });
});
