// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: max-func-body-length

import * as assert from "assert";
import { armTemplateLanguageId, ext } from "../../extension.bundle";
import { TempDocument, TempFile } from "../support/TempFile";

suite("updateOpenedDocument", () => {
    function createTest(
        name: string,
        options: {
            contents: string;
            extension: string;
            uriScheme?: string;
        },
        expected: {
            openedType: string;
            languageId: string;
        }): void {
        test(`updateOpenedDocument: ${name}`, async () => {
            let tempFile: TempFile | undefined;
            let tempDoc: TempDocument | undefined;

            try {
                // Create file
                tempFile = new TempFile(options.contents, "updateOpenedDocumentTest", options.extension);

                const updatedPromise = ext.testEvents.waitForEvent(`Updated: ${tempFile.uri}`);

                // Open document
                tempDoc = new TempDocument(tempFile);
                await tempDoc.open();

                const result = await updatedPromise;
                assert.equal(result?.openedType, expected.openedType);
                assert.equal(tempDoc.realDocument.languageId, expected.languageId);
            } finally {
                if (tempDoc) {
                    await tempDoc.dispose();
                }
                if (tempFile) {
                    tempFile.dispose();
                }
            }
        });
    }

    createTest(
        'plain text file with template schema - stays as plain text',
        {
            contents:
                `{
                    "$schema": "https://schema.WRONG-SCHEMA.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": { "parameter2": {
                    "type": "string"
                    }, "parameter1": {
                    "type": "string"
                    }}
                }`,
            extension: '.txt'
        },
        {
            openedType: 'ignored',
            languageId: 'plaintext'
        });

    createTest(
        'plain text file with template schema - stays as JSON',
        {
            contents:
                `{
                "$schema": "https://schema.WRONG-SCHEMA.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": { "parameter2": {
                "type": "string"
                }, "parameter1": {
                "type": "string"
                }}
            }`,
            extension: '.json'
        },
        {
            openedType: 'ignored',
            languageId: 'json'
        });

    createTest(
        'JSON file with template schema - automatically changes to arm-template',
        {
            contents:
                `{
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": { "parameter2": {
            "type": "string"
            }, "parameter1": {
            "type": "string"
            }}
        }`,
            extension: '.json'
        },
        {
            openedType: 'template',
            languageId: armTemplateLanguageId
        });

    createTest(
        'JSONC file with template schema - automatically changes to arm-template', {
        contents:
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": { "parameter2": {
                "type": "string"
                }, "parameter1": {
                "type": "string"
                }}
            }`,
        extension: '.jsonc'
    },
        {
            openedType: 'template',
            languageId: armTemplateLanguageId
        });

    createTest(//asdf
        'git file with template schema - automatically changes to arm-template', {
        contents:
            `{
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": { "parameter2": {
                    "type": "string"
                    }, "parameter1": {
                    "type": "string"
                    }}
                }`,
        extension: '.jsonc',
        uriScheme: 'git'
    },
        {
            openedType: 'template',
            languageId: armTemplateLanguageId
        });

    createTest(
        'JSON file with template schema - automatically changes to arm-template', {
        contents:
            `{
                "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": { "parameter2": {
                "type": "string"
                }, "parameter1": {
                "type": "string"
                }}
            }`,
        extension: '.json'
    },
        {
            openedType: 'template',
            languageId: armTemplateLanguageId
        });
});
