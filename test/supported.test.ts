// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-http-string max-func-body-length

import * as assert from 'assert';
import * as os from 'os';
import { Uri } from 'vscode';
import { containsArmSchema, DeploymentTemplate, isArmSchema } from "../extension.bundle";

const fakeId = Uri.file("https://fake-id");

suite("supported", () => {
    suite("doesJsonContainArmSchema(string)", () => {
        suite("Just uri", () => {
            test("with 'hello world'", () => {
                assert.equal(false, isArmSchema("hello world"));
            });

            test("with 'www.bing.com'", () => {
                assert.equal(false, isArmSchema("www.bing.com"));
            });

            test("with 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#'", () => {
                assert(isArmSchema("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"));
            });

            test("with 'https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json'", () => {
                assert(isArmSchema("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json"));
            });

            test("with 'http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json'", () => {
                assert(isArmSchema("http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json"));
            });

            test("with 'http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#'", () => {
                assert(isArmSchema("http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"));
            });

            test("with 'https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#'", () => {
                assert(isArmSchema("https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#"));
            });

            test("subscription deployment template: 'https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#'", () => {
                assert(isArmSchema("https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#"));
            });

            test("subscription deployment template: 'http://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#'", () => {
                assert(isArmSchema("http://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#"));
            });

            test("subscription deployment template: 'http://schema.management.azure.com/schemas/xxxx-yy-zz/subscriptionDeploymentTemplate.json#'", () => {
                assert(isArmSchema("http://schema.management.azure.com/schemas/xxxx-yy-zz/subscriptionDeploymentTemplate.json#"));
            });

            suite("new root schemas", () => {
                // From https://github.com/Azure/azure-resource-manager-schemas/blob/master/tools/tests.ts#L106

                test("2014-04-01-preview (old root schema)", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json"));
                });

                test("2015-01-01 (old root schema)", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json"));
                });

                test("2019-04-01 (new root schema)", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json"));
                });

                test("2019-03-01-hybrid (AzureStack root schema)", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2019-03-01-hybrid/deploymentTemplate.json"));
                });

                test("xxxxx", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/xxxxx/deploymentTemplate.json"));
                });

                test("new subscription deployment template: 'https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#'", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#"));
                });

                test("managementGroupDeploymentTemplate", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2018-05-01/managementGroupDeploymentTemplate.json#"));
                });

                test("tenantDeploymentTemplate", () => {
                    assert(isArmSchema("https://schema.management.azure.com/schemas/2018-05-01/tenantDeploymentTemplate.json#"));
                });
            });

            suite("full template", () => {
                test("simple", () => {
                    const template = `{
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(dt.hasArmSchemaUri());
                });

                test("extra whitespace", () => {
                    const template = `{
                    "$schema"
                    :
                     "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"
                     ,
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(dt.hasArmSchemaUri());
                });

                test("far down in file", () => {
                    let lotsOfProperties = "";
                    for (let i = 0; i < 900; ++i) {
                        lotsOfProperties += `"MyProperty${i}" = "Some string value #${i}",${os.EOL}`;
                    }
                    const template = `{
                    ${lotsOfProperties}
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(dt.hasArmSchemaUri());
                });

                test("before and after comments", () => {
                    const template = `{
                        // a comment
                        /* this is a comment */ "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" /* another comment */,
                        "contentVersion": "1.0.0.0",
                    `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(dt.hasArmSchemaUri());
                });

                test("false - before and after comments", () => {
                    const template = `{
                        // a comment
                        // another comment
                        /* one comment */
                        /* another comment */
                        /* "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#" */,
                        // "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());
                });

                test("false - not in $schema property", () => {
                    const template = `{
                    "$myschema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());

                });

                test("false - line comment", () => {
                    const template = `{
                    // "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());
                });

                test("false - block comment 1", () => {
                    const template = `{
                    /* "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#", */
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());
                });

                test("false - block comment 2", () => {
                    const template = `{
                    /*
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    */
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());
                });

                test("false - both comments", () => {
                    const template = `{
                    /*
                        // "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    */
                    "contentVersion": "1.0.0.0",
                  `;
                    assert(containsArmSchema(template));
                    let dt = new DeploymentTemplate(template, fakeId);
                    assert(!dt.hasArmSchemaUri());
                });

            });
        });
    });
});
