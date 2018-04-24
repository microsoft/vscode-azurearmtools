// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression
// tslint:disable:max-func-body-length

import * as assert from "assert";

import * as Json from "../src/JSON";
import * as language from "../src/Language";
import * as Reference from "../src/Reference";
import * as TLE from "../src/TLE";

import { AzureRMAssets, FunctionMetadata, FunctionsMetadata } from "../src/AzureRMAssets";
import { DeploymentTemplate } from "../src/DeploymentTemplate";
import { PositionContext } from "../src/PositionContext";

suite("Template tests", () => {
    suite("Functions metadata", () => {

        // Tests to verify given functions do not produce errors - can be used to add quick unit tests for new function metadata

        async function verifyTemplateHasNoErrors(template: string): Promise<void> {
            const dt = new DeploymentTemplate(template, "id");
            const expectedErrors = [
            ];
            let errors = await dt.errors;
            assert.deepStrictEqual(errors, expectedErrors, "Expected no errors in template");
        }

        test("listCallbackUrl", async () => {
            await verifyTemplateHasNoErrors(`
            {
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "logicAppName": {
                        "type": "string"
                    }
                },
                "outputs": {
                    "WebHookURI": {
                        "type": "string",
                        "value": "[listCallbackURL(concat(resourceId('Microsoft.Logic/workflows/', parameters('logicAppName')), '/triggers/manual'), '2016-06-01').value]"
                    }
                }
            }
            `);
        });
    });

});
