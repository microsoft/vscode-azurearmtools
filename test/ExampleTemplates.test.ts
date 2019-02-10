// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression
// tslint:disable:max-func-body-length

import * as assert from "assert";
import { DeploymentTemplate } from "../extension.bundle";

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

        test("listKeys", async () => {
            await verifyTemplateHasNoErrors(`
            {
                "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "storageAccountName": {
                        "type": "string"
                    }
                },
                "resources": [
                  {
                    "name": "[parameters('storageAccountName')]",
                    "type": "Microsoft.Storage/storageAccounts",
                    "apiVersion": "2016-12-01",
                    "sku": {
                      "name": "Standard_LRS"
                    },
                    "kind": "Storage",
                    "location": "[resourceGroup().location]",
                    "tags": {},
                    "properties": {
                    }
                  }
                ],
                "outputs": {
                    "referenceOutput": {
                        "type": "object",
                        "value": "[listKeys(parameters('storageAccountName'), '2016-12-01')]"
                    }
                  }
              }
              `);
        });
    });
});
