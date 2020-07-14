// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { armTemplateLanguageId, ext } from "../../extension.bundle";
import { TempDocument, TempFile } from "../support/TempFile";

suite("updateOpenedDocument", () => {
    function createTest(
        name: string,
        fileContents: string,
        fileExtension: string,
        expected: {
            openedType: string;
            languageId: string;
        }): void {
        test(`updateOpenedDocument: ${name}`, async () => {
            let tempFile: TempFile | undefined;
            let tempDoc: TempDocument | undefined;

            try {
                // Create file
                tempFile = new TempFile(fileContents, "updateOpenedDocumentTest", fileExtension);

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
        'JSON file with template schema - automatically changes to arm-template',
        `{
            "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            "contentVersion": "1.0.0.0",
            "parameters": { "parameter2": {
            "type": "string"
            }, "parameter1": {
            "type": "string"
            }}
        }`,
        '.json',
        {
            openedType: 'template',
            languageId: armTemplateLanguageId
        });

    createTest(
        'JSON file without template schema - stays as JSON',
        `{
                "$schema": "https://schema.WRONG-SCHEMA.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": { "parameter2": {
                "type": "string"
                }, "parameter1": {
                "type": "string"
                }}
            }`,
        '.json',
        {
            openedType: 'ignored',
            languageId: 'json'
        });
});
