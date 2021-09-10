// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { getBodyFromResourceSnippetFile } from "../extension.bundle";
import { assertEx } from "./support/assertEx";

suite("resourceSnippetsConversion", () => {

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

    test("Convert snippet with non-string placeholders", () => {
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
                    "properties": {
                        "isExportable": /*\${6|true,false|}*/false,
                        "isExportable2": /*\${6|true,false|}*/ false
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
            "\t\"properties\": {",
            "\t\t\"isExportable\": \${6|true,false|},",
            "\t\t\"isExportable2\": \${6|true,false|}",
            "\t}",
            "}"
        ];

        const actual = getBodyFromResourceSnippetFile('snippet name', input);
        assertEx.deepEqual(actual, expected, {});
    });

});
