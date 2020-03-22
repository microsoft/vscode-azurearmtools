// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition
// tslint:disable:prefer-template no-http-string

import * as assert from 'assert';
import { commands } from 'vscode';
import { ext } from '../../extension.bundle';
import { IDeploymentParametersFile, IDeploymentTemplate } from "../support/diagnostics";
import { getDocumentMarkers, removeEOLMarker } from "../support/parseTemplate";
import { stringify } from '../support/stringify';
import { TempDocument, TempEditor, TempFile } from '../support/TempFile';
import { testWithLanguageServer } from '../support/testWithLanguageServer';

const longTemplate = {
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredString": {
            "type": "string"
        },
        "requiredArray": {
            "type": "int"
        },
        "optionalObject": {
            "type": "int",
            "defaultValue": {
                "abc": "def"
            }
        },
        "optionalInt": {
            "type": "int",
            "defaultValue": 1
        }
    }
};

const templateWithOneOptionalParam = {
    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "optionalInt": {
            "type": "int",
            "defaultValue": 1
        }
    }
};

suite("Add missing parameters - functional", () => {

    enum Params {
        "all",
        "onlyRequired"
    }

    function createAddMissingParamsTestAllAndRequired(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        expectedResultForAllParameters: string,
        expectedResultForOnlyRequiredParameters: string
    ): void {
        createAddMissingParamsTest(
            `${testName} - all Parameters`,
            params,
            template,
            Params.all,
            expectedResultForAllParameters);

        createAddMissingParamsTest(
            `${testName} - only required parameters`,
            params,
            template,
            Params.onlyRequired,
            expectedResultForOnlyRequiredParameters);
    }

    function createAddMissingParamsTest(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        whichParams: Params,
        expectedResult: string
    ): void {
        testWithLanguageServer(testName, async () => {
            let editor: TempEditor | undefined;
            let templateFile: TempFile | undefined;

            try {
                const { unmarkedText } = getDocumentMarkers(params);
                expectedResult = removeEOLMarker(expectedResult);

                // Create template/params files
                if (template) {
                    templateFile = new TempFile(stringify(template, 4));
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

                await commands.executeCommand(
                    whichParams === Params.all
                        ? 'azurerm-vscode-tools.codeAction.addAllMissingParameters'
                        : 'azurerm-vscode-tools.codeAction.addMissingRequiredParameters'
                );

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

    createAddMissingParamsTestAllAndRequired(
        "Empty parameters section",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
    }
}`,
        longTemplate,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredString": {
            "value": "" // TODO: Fill in parameter value
        },
        "requiredArray": {
            "value": 0 // TODO: Fill in parameter value
        },
        "optionalObject": {
            "value": {
                "abc": "def"
            }
        },
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredString": {
            "value": "" // TODO: Fill in parameter value
        },
        "requiredArray": {
            "value": 0 // TODO: Fill in parameter value
        }
    }
}`
    );

    createAddMissingParamsTestAllAndRequired(
        "Empty parameters section with no whitespace",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {}
}`,
        templateWithOneOptionalParam,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {}
}`
    );

    createAddMissingParamsTestAllAndRequired(
        "Comma after existing param",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "unknownParameter": {
            "value": 1
        }
    }
}`,
        templateWithOneOptionalParam,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "unknownParameter": {
            "value": 1
        },
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "unknownParameter": {
            "value": 1
        }
    }
}`
    );

    createAddMissingParamsTestAllAndRequired(
        "Insert after existing param and comments",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "existingParam1": {
            "value": 1
        }
        // Hello
    }
}`,
        templateWithOneOptionalParam,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "existingParam1": {
            "value": 1
        },
        // Hello
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "existingParam1": {
            "value": 1
        }
        // Hello
    }
}`
    );

    createAddMissingParamsTestAllAndRequired(
        "Insert after comments only",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        // Hello
    }
}`,
        templateWithOneOptionalParam,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        // Hello
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        // Hello
    }
}`
    );

    createAddMissingParamsTestAllAndRequired(
        "Some params aren't missing",
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredArray": {
            "value": 0 // TODO: Fill in parameter value
        },
        "optionalObject": {
            "value": {
                "abc": "def"
            }
        }
    }
}`,
        longTemplate,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredArray": {
            "value": 0 // TODO: Fill in parameter value
        },
        "optionalObject": {
            "value": {
                "abc": "def"
            }
        },
        "requiredString": {
            "value": "" // TODO: Fill in parameter value
        },
        "optionalInt": {
            "value": 1
        }
    }
}`,
        `{
    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "requiredArray": {
            "value": 0 // TODO: Fill in parameter value
        },
        "optionalObject": {
            "value": {
                "abc": "def"
            }
        },
        "requiredString": {
            "value": "" // TODO: Fill in parameter value
        }
    }
}`
    );
});
