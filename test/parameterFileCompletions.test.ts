// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from 'assert';
import { isNullOrUndefined } from 'util';
import { DeploymentTemplateDoc } from "../extension.bundle";
import { IDeploymentParametersFile, IDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplate } from "./support/parseTemplate";
import { newParamValueCompletionLabel } from './testConstants';

suite("Parameter file completions", () => {

    const emptyTemplate: string = `{
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "resources": []
    }`;

    function createParamsCompletionsTest(
        testName: string,
        params: string | Partial<IDeploymentParametersFile>,
        template: string | Partial<IDeploymentTemplate> | undefined,
        options: {
            cursorIndex?: number;
            tabSize?: number;
        },
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedNamesAndInsertTexts: ([string, string] | string)[]
    ): void {
        const fullName = isNullOrUndefined(options.cursorIndex) ? testName : `${testName}, index=${options.cursorIndex}`;
        test(fullName, async () => {
            let dt: DeploymentTemplateDoc | undefined = template ? parseTemplate(template) : undefined;

            const { dp, markers: { cursor } } = parseParametersWithMarkers(params);
            // tslint:disable-next-line: strict-boolean-expressions
            const cursorIndex = !isNullOrUndefined(options.cursorIndex) ? options.cursorIndex : cursor?.index;
            if (isNullOrUndefined(cursorIndex)) {
                assert.fail(`Expected either a cursor index in options or a <!cursor!> in the parameters file`);
            }

            const pc = dp.getContextFromDocumentCharacterIndex(cursorIndex, dt);
            const completions = await pc.getCompletionItems("", options.tabSize ?? 4);

            const completionNames = completions.items.map(c => c.label).sort();
            const completionInserts = completions.items.map(c => c.insertText).sort();

            const expectedNames = (<unknown[]>expectedNamesAndInsertTexts).map(e => Array.isArray(e) ? <string>e[0] : <string>e).sort();
            let expectedInsertTexts: string[] | undefined;
            if (expectedNamesAndInsertTexts.every((e: [string, string] | string) => Array.isArray(e))) {
                expectedNamesAndInsertTexts = (<[string, string][]>expectedNamesAndInsertTexts).map(e => e[1]).sort();
            }

            assert.deepStrictEqual(completionNames, expectedNames, "Completion names didn't match");
            if (expectedInsertTexts !== undefined) {
                assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
            }
        });
    }

    // =========================

    suite("Completions for new parameters", async () => {
        suite("Params file with missing parameters section - no completions anywhere", () => {
            const dpWithNoParametersSection: string = `{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0"
            }`;

            for (let i = 0; i < dpWithNoParametersSection.length + 1; ++i) {
                createParamsCompletionsTest(
                    "missing parameters section",
                    dpWithNoParametersSection,
                    undefined,
                    { cursorIndex: i },
                    []);
            }
        });

        // NOTE: The canAddPropertyHere test under ParametersPositionContext.test.ts is very
        // thorough about testing where parameter insertions are allowed, don't need to be
        // thorough about that here, just the results from the completion list.
        createParamsCompletionsTest(
            "No associated template file - no missing param completions",
            `{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    <!cursor!>
                }
            }`,
            undefined,
            {},
            [
                newParamValueCompletionLabel
            ]);

        createParamsCompletionsTest(
            "Template has no parameters - only new param completions available",
            `{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    <!cursor!>
                }
            }`,
            emptyTemplate,
            {},
            [
                newParamValueCompletionLabel
            ]);

        suite("Offer completions for properties from template that aren't already defined in param file", () => {
            createParamsCompletionsTest(
                "2 in template, 0 in params",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        <!cursor!>
                    }
                }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "p10": {
                            "type": "int"
                        },
                        "p2": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    `"p2"`,
                    `"p10"`,
                    newParamValueCompletionLabel
                ]);

            createParamsCompletionsTest(
                "2 in template, 1 in params",
                `{
                        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                        "contentVersion": "1.0.0.0",
                        "parameters": {
                            "p2": {
                                "value": "string"
                            },
                            <!cursor!>
                        }
                    }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "p10": {
                            "type": "int"
                        },
                        "p2": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    // p2 already exists in param file
                    `"p10"`,
                    newParamValueCompletionLabel
                ]);

            createParamsCompletionsTest(
                "2 in template, 1 in params, different casing",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "PARAmeter2": {
                            "value": "string"
                        },
                        <!cursor!>
                    }
                }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "Parameter10": {
                            "type": "int"
                        },
                        "Parameter2": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    // parameter2 already exists in param file
                    `"Parameter10"`, // Use casing in template file
                    newParamValueCompletionLabel
                ]);

            createParamsCompletionsTest(
                "3 in template, 1 in params, different casing, cursor between two existing params",
                `{
                        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                        "contentVersion": "1.0.0.0",
                        "parameters": {
                            "Parameter2": {
                                "value": "string"
                            },
                            <!cursor!>
                            "Parameter10": {
                                "value": "string"
                            }
                        }
                    }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "Parameter10": {
                            "type": "int"
                        },
                        "Parameter2": {
                            "type": "string"
                        },
                        "Parameter30": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    // parameter2 already exists in param file
                    `"Parameter30"`,
                    newParamValueCompletionLabel
                ]);

            createParamsCompletionsTest(
                "2 in template, all of them in param file already",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "Parameter2": {
                            "value": "string"
                        },
                        "Parameter10": {
                            "value": "string"
                        },
                        <!cursor!>
                    }
                }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "Parameter10": {
                            "type": "int"
                        },
                        "Parameter2": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    newParamValueCompletionLabel
                ]);

            createParamsCompletionsTest(
                "1 optional, 1 required",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        <!cursor!>
                    }
                }`,
                {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "parameters": {
                        "p1optional": {
                            "type": "string",
                            "defaultValue": "a"
                        },
                        "p2required": {
                            "type": "string"
                        }
                    }
                },
                {},
                [
                    `"p1optional"`,
                    `"p2required"`,
                    newParamValueCompletionLabel
                ]);
        });
    });
});
