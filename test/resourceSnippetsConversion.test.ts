// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { getBodyFromResourceSnippetFile } from "../extension.bundle";
import { assertEx } from "./support/assertEx";

suite("resourceSnippetsConversion", () => {

    suite("getBodyFromResourceSnippetFile", () => {
        test("Convert simple snippet", () => {
            const input = `{
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": {},
            "functions": [],
            "variables": {},
            "resources": [
                {
                    "name": "\${1:parent/automationCertificate1}",
                    "type": "Microsoft.Automation/automationAccounts/certificates",
                    "apiVersion": "2015-10-31",
                    "dependsOn": [
                        "[resourceId('Microsoft.Automation/automationAccounts', '\${2:automationAccount1}')]"
                    ],
                    "properties": {
                        "base64Value": "\${3:base64Value}",
                        "description": "\${4:description}",
                        "thumbprint": "\${5:thumbprint}"
                    }
                }
            ],
            "outputs": {}
        }`;
            const expected: string[] = [
                "{",
                "\t\"name\": \"\${1:parent/automationCertificate1}\",",
                "\t\"type\": \"Microsoft.Automation/automationAccounts/certificates\",",
                "\t\"apiVersion\": \"2015-10-31\",",
                "\t\"dependsOn\": [",
                "\t\t\"[resourceId('Microsoft.Automation/automationAccounts', '\${2:automationAccount1}')]\"",
                "\t],",
                "\t\"properties\": {",
                "\t\t\"base64Value\": \"\${3:base64Value}\",",
                "\t\t\"description\": \"\${4:description}\",",
                "\t\t\"thumbprint\": \"\${5:thumbprint}\"",
                "\t}",
                "}"
            ];

            const actual = getBodyFromResourceSnippetFile('snippet name', input);
            assertEx.deepEqual(actual, expected, {});
        });

        test("Simple string placeholder with default", () => {
            const input = `{
            "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
            "resources": [
                {
                    "name": "\${1:parent/automationCertificate1}"
                }
            ],
            "outputs": {}
        }`;
            const expected: string[] = [
                "{",
                "\t\"name\": \"\${1:parent/automationCertificate1}\"",
                "}"
            ];

            const actual = getBodyFromResourceSnippetFile('snippet name', input);
            assertEx.deepEqual(actual, expected, {});
        });

        test("String comment placeholder with quoted default", () => {
            const input = `{
            "resources": [
                {
                    "state": /*"\${5|Enabled,Disabled|}"*/"Enabled",
                    "stateWithSpace": /*"\${5|Enabled,Disabled|}"*/ "Disabled"
                }
            ]
        }`;
            const expected: string[] = [
                "{",
                `\t"state": "\${5|Enabled,Disabled|}",`,
                `\t"stateWithSpace": "\${5|Enabled,Disabled|}"`,
                "}"
            ];

            const actual = getBodyFromResourceSnippetFile('snippet name', input);
            assertEx.deepEqual(actual, expected, {});
        });

        test("Non-string comment placeholders", () => {
            const input = `{
            "resources": [
                {
                    "name": "parent/automationCertificate1",
                    "properties": {
                        "isExportable": /*\${6|true,false|}*/false,
                        "isExportableWithSpace": /*\${6|true,false|}*/ false,
                        "port": /*\${9|80,1433|}*/ 80
                    }
                }
            ]
        }`;
            const expected: string[] = [
                "{",
                "\t\"name\": \"parent/automationCertificate1\",",
                "\t\"properties\": {",
                "\t\t\"isExportable\": \${6|true,false|},",
                "\t\t\"isExportableWithSpace\": \${6|true,false|},",
                "\t\t\"port\": \${9|80,1433|}",
                "\t}",
                "}"
            ];

            const actual = getBodyFromResourceSnippetFile('snippet name', input);
            assertEx.deepEqual(actual, expected, {});
        });

    });
});
