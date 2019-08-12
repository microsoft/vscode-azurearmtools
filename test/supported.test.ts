// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-http-string

import * as assert from 'assert';
import { doesJsonContainArmSchema } from "../extension.bundle";

suite("supported", () => {
    suite("doesJsonContainArmSchema(string)", () => {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Specific tests for doesJsonContainArmSchema, not just whether the whole string is an ARM template
        function isArmDeploymentSchemaUri(uri: string): boolean {
            return doesJsonContainArmSchema(uri);
        }

        test("with 'hello world'", () => {
            assert.equal(false, isArmDeploymentSchemaUri("hello world"));
        });

        test("with 'www.bing.com'", () => {
            assert.equal(false, isArmDeploymentSchemaUri("www.bing.com"));
        });

        test("with 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"));
        });

        test("with 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json"));
        });

        test("with 'http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json"));
        });

        test("with 'http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"));
        });

        test("with 'https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#"));
        });

        test("subscription deployment template: 'https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#"));
        });

        test("subscription deployment template: 'http://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("http://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#"));
        });

        test("subscription deployment template: 'http://schema.management.azure.com/schemas/xxxx-yy-zz/subscriptionDeploymentTemplate.json#'", () => {
            assert.equal(true, isArmDeploymentSchemaUri("http://schema.management.azure.com/schemas/xxxx-yy-zz/subscriptionDeploymentTemplate.json#"));
        });
    });
});
