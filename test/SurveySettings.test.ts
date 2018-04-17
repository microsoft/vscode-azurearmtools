// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import { SurveySettings } from "../src/SurveySettings";

// TODO: Re-enable as part of https://github.com/Microsoft/vscode-azurearmtools/issues/51
function suiteDisabled(name: string, func: Function) {
}

suite("SurveySettings", () => {
    test("constructor()", () => {
        const ss = new SurveySettings();
        assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
        assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
        assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
        assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
    });

    suite("incrementDeploymentTemplatesOpenedOrCreated()", () => {
        test("when deploymentTemplatesOpenedOrCreated is undefined", () => {
            const ss = new SurveySettings();
            ss.incrementDeploymentTemplatesOpenedOrCreated();
            assert.deepStrictEqual(1, ss.deploymentTemplatesOpenedOrCreated);
        });

        test("when deploymentTemplatesOpenedOrCreated is null", () => {
            const ss = new SurveySettings();
            ss.deploymentTemplatesOpenedOrCreated = null;
            ss.incrementDeploymentTemplatesOpenedOrCreated();
            assert.deepStrictEqual(1, ss.deploymentTemplatesOpenedOrCreated);
        });

        test("when deploymentTemplatesOpenedOrCreated is 0", () => {
            const ss = new SurveySettings();
            ss.deploymentTemplatesOpenedOrCreated = 0;
            ss.incrementDeploymentTemplatesOpenedOrCreated();
            assert.deepStrictEqual(1, ss.deploymentTemplatesOpenedOrCreated);
        });

        test("when deploymentTemplatesOpenedOrCreated is positive", () => {
            const ss = new SurveySettings();
            ss.deploymentTemplatesOpenedOrCreated = 5;
            ss.incrementDeploymentTemplatesOpenedOrCreated();
            assert.deepStrictEqual(6, ss.deploymentTemplatesOpenedOrCreated);
        });
    });

    suite("toJSONString()", () => {
        test("with no properties defined", () => {
            const ss = new SurveySettings();
            assert.deepStrictEqual("{}", ss.toJSONString());
        });

        test("with showSurveyPrompts defined", () => {
            const ss = new SurveySettings();
            ss.showSurveyPrompts = true;
            assert.deepStrictEqual("{\n \"showSurveyPrompts\": true\n}", ss.toJSONString());
        });

        test("with previousSurveyPromptDateAndTime and showSurveyPrompts defined", () => {
            const ss = new SurveySettings();
            ss.previousSurveyPromptDateAndTime = 15;
            ss.showSurveyPrompts = true;
            assert.deepStrictEqual("{\n \"previousSurveyPromptDateAndTime\": 15,\n \"showSurveyPrompts\": true\n}", ss.toJSONString());
        });
    });

    suiteDisabled("fromString(string)", () => {
        test("with undefined", () => {
            const ss: SurveySettings = SurveySettings.fromString(undefined);
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with null", () => {
            const ss: SurveySettings = SurveySettings.fromString(null);
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with empty string", () => {
            const ss: SurveySettings = SurveySettings.fromString("");
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with empty object", () => {
            const ss: SurveySettings = SurveySettings.fromString("{}");
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with showSurveyPrompts property", () => {
            const ss: SurveySettings = SurveySettings.fromString("{ \"showSurveyPrompts\": true }");
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(true, ss.showSurveyPrompts);
        });

        test("with deploymentTemplatesOpenedOrCreated property", () => {
            const ss: SurveySettings = SurveySettings.fromString("{ \"deploymentTemplatesOpenedOrCreated\": 30 }");
            assert(ss);
            assert.deepStrictEqual(30, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with non-JSON string", () => {
            const ss: SurveySettings = SurveySettings.fromString("hello world");
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });
    });

    suiteDisabled("fromJSON(any)", () => {
        test("with undefined", () => {
            const ss: SurveySettings = SurveySettings.fromJSON(undefined);
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with null", () => {
            const ss: SurveySettings = SurveySettings.fromJSON(null);
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with empty object", () => {
            const ss: SurveySettings = SurveySettings.fromJSON({});
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with showSurveyPrompts property", () => {
            const ss: SurveySettings = SurveySettings.fromJSON({ showSurveyPrompts: true });
            assert(ss);
            assert.deepStrictEqual(undefined, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(true, ss.showSurveyPrompts);
        });

        test("with deploymentTemplatesOpenedOrCreated property", () => {
            const ss: SurveySettings = SurveySettings.fromJSON({ deploymentTemplatesOpenedOrCreated: 30 });
            assert(ss);
            assert.deepStrictEqual(30, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(undefined, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(undefined, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(undefined, ss.showSurveyPrompts);
        });

        test("with all properties", () => {
            const ss: SurveySettings = SurveySettings.fromJSON({
                deploymentTemplatesOpenedOrCreated: 1,
                deploymentTemplateFirstOpenedOrCreatedDateAndTime: 2,
                previousSurveyPromptDateAndTime: 3,
                showSurveyPrompts: true
            });
            assert(ss);
            assert.deepStrictEqual(1, ss.deploymentTemplatesOpenedOrCreated);
            assert.deepStrictEqual(2, ss.deploymentTemplateFirstOpenedOrCreatedDateAndTime);
            assert.deepStrictEqual(3, ss.previousSurveyPromptDateAndTime);
            assert.deepStrictEqual(true, ss.showSurveyPrompts);
        });
    });
});
