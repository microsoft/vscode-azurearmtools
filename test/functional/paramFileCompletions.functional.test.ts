// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template no-http-string

import * as assert from 'assert';
import { commands, Selection } from 'vscode';
import { ext } from '../../extension.bundle';
import { delay } from '../support/delay';
import { IDeploymentParametersFile, IDeploymentTemplate } from "../support/diagnostics";
import { getCompletionItemResolutionPromise, getCompletionItemsPromise, getDocumentChangedPromise } from '../support/getEventPromise';
import { getDocumentMarkers, removeEOLMarker } from "../support/parseTemplate";
import { stringify } from '../support/stringify';
import { TempDocument, TempEditor, TempFile } from '../support/TempFile';
import { testWithLanguageServer } from '../support/testWithLanguageServer';

const newParamCompletionLabel = `"<new parameter>"`;

const defaultTemplate = {
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "required1": {
            "type": "string"
        },
        "required2": {
            "type": "int"
        },
        "optional1": {
            "type": "int",
            "defaultValue": {
                "abc": "def"
            }
        }
    }
};

suite("Functional parameter file completions", () => {

    function createCompletionsFunctionalTest(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        insertSuggestionPrefix: string, // Insert the suggestion starting with this string
        expectedResult: string
    ): void {
        testWithLanguageServer(testName, async () => {
            let editor: TempEditor | undefined;
            let templateFile: TempFile | undefined;

            try {
                const { markers: { bang }, unmarkedText } = getDocumentMarkers(params);
                expectedResult = removeEOLMarker(expectedResult);

                // Create template/params files
                if (template) {
                    templateFile = new TempFile(stringify(template));
                }
                let paramsFile = new TempFile(unmarkedText);

                // Map template to params
                if (templateFile) {
                    await ext.deploymentFileMapping.getValue().mapParameterFile(templateFile.uri, paramsFile.uri);
                }

                // Open params in editor
                const paramsDoc = new TempDocument(paramsFile);
                editor = new TempEditor(paramsDoc);
                await editor.open();

                // Move cursor to the "!" in the document
                const position = editor.document.realDocument.positionAt(bang.index);
                editor.realEditor.selection = new Selection(position, position);
                await delay(1);

                // Trigger completion UI
                const completionItemsPromise = getCompletionItemsPromise(paramsDoc.realDocument);
                await commands.executeCommand('editor.action.triggerSuggest');

                // Wait for our code to return completion items
                let items = await completionItemsPromise;
                items = items;

                // Wait for any resolution to be sure the UI is ready
                const resolutionPromise = getCompletionItemResolutionPromise();
                await delay(1);
                let currentItem = await resolutionPromise;

                // Select the item we want and accept it
                let tries = 0;
                while (true) {
                    if (tries++ > 100) {
                        assert.fail(`Did not find a completion item starting with "${insertSuggestionPrefix}"`);
                    }

                    if (currentItem.label.startsWith(insertSuggestionPrefix)) {
                        break;
                    }

                    const resolutionPromise2 = getCompletionItemResolutionPromise();
                    await commands.executeCommand('selectNextSuggestion');
                    await delay(1);
                    currentItem = await resolutionPromise2;
                }

                const documentChangedPromise = getDocumentChangedPromise(paramsDoc.realDocument);
                await commands.executeCommand('acceptSelectedSuggestion');

                // Wait for it to get inserted
                await documentChangedPromise;

                // Some completions have additional text edits, and vscode doesn't
                // seem to have made all the changes when it fires didDocumentChange,
                // so give a slight delay to allow it to finish
                await delay(1);

                const actualResult = paramsDoc.realDocument.getText();
                assert.equal(actualResult, expectedResult);
            } finally {
                if (editor) {
                    await editor.dispose();
                }
                if (templateFile) {
                    await ext.deploymentFileMapping.getValue().mapParameterFile(templateFile.uri, undefined);
                }
            }
        });
    }

    suite("Completions for new parameters", async () => {
        createCompletionsFunctionalTest(
            "No template file, new parameter in blank section",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "No template file, new parameter after an existing one, comma already exists",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        !{EOL}
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        "parameter1": {
            "value": "value"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "No template file, new parameter after an existing one, automatically add comma after old param",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        }
        !{EOL}
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        "parameter1": {
            "value": "value"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "No template file, new parameter after an existing one, automatically add comma after old param - has comments",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        }
        // some comments
        !{EOL}
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "PARAmeter2": {
            "value": "string"
        },
        // some comments
        "parameter1": {
            "value": "value"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "No template file, new parameter before an existing one, automatically adds comma after new parameter",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
        "PARAmeter2": {
            "value": "string"
        }
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        },
        "PARAmeter2": {
            "value": "string"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "No template file, inside existing double quotes (or double quote trigger), removes double quotes when inserting",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "!"
    }
}`,
            undefined,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "Template file one required param, new parameter in blank section",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
    }
}`,
            defaultTemplate,
            newParamCompletionLabel,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "parameter1": {
            "value": "value"
        }
    }
}`
        );
    });

    suite("Completions for parameters in template file", async () => {
        createCompletionsFunctionalTest(
            "From required parameter",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        !{EOL}
    }
}`,
            defaultTemplate,
            `"required1"`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "required1": {
            "value": "" // TODO: Fill in parameter value
        }
    }
}`
        );

        createCompletionsFunctionalTest(
            "From optional parameter",
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "required1": {
            "value": "abc"
        },
        !{EOL}
        "required2": {
            "value": "abc"
        }
    }
}`,
            defaultTemplate,
            `"optional1"`,
            `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "required1": {
            "value": "abc"
        },
        "optional1": {
            "value": {
              "abc": "def"
            }
        },
        "required2": {
            "value": "abc"
        }
    }
}`
        );

    });

    createCompletionsFunctionalTest(
        "From optional parameter, no existing comma",
        `{
"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
"contentVersion": "1.0.0.0",
"parameters": {
    "required1": {
        "value": "abc"
    }
    !{EOL}
    "required2": {
        "value": "abc"
    }
}
}`,
        defaultTemplate,
        `"optional1"`,
        `{
"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
"contentVersion": "1.0.0.0",
"parameters": {
    "required1": {
        "value": "abc"
    },
    "optional1": {
        "value": {
          "abc": "def"
        }
    },
    "required2": {
        "value": "abc"
    }
}
}`
    );
});
