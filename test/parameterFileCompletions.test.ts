// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import * as assert from 'assert';
import { isNullOrUndefined } from 'util';
import { DeploymentTemplate } from "../extension.bundle";
import { IDeploymentParametersFile, IDeploymentTemplate } from "./support/diagnostics";
import { parseParametersWithMarkers, parseTemplate } from "./support/parseTemplate";

const newParamCompletionLabel = `"<new parameter>"`;

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
        },
        // Can either be an array of completion names, or an array of
        //   [completion name, insert text] tuples
        expectedNamesAndInsertTexts: ([string, string][]) | (string[])
    ): void {
        const fullName = isNullOrUndefined(options.cursorIndex) ? testName : `${testName}, index=${options.cursorIndex}`;
        test(fullName, async () => {
            let dt: DeploymentTemplate | undefined = template ? await parseTemplate(template) : undefined;

            const { dp, markers: { bang } } = await parseParametersWithMarkers(params);
            const cursorIndex = !isNullOrUndefined(options.cursorIndex) ? options.cursorIndex : bang.index;
            if (isNullOrUndefined(cursorIndex)) {
                assert.fail(`Expected either a cursor index in options or a "!" in the parameters file`);
            }

            const pc = dp.getContextFromDocumentCharacterIndex(cursorIndex, dt);
            const completions = pc.getCompletionItems();

            const completionNames = completions.map(c => c.label).sort();
            const completionInserts = completions.map(c => c.insertText).sort();

            const expectedNames = (<unknown[]>expectedNamesAndInsertTexts).map(e => Array.isArray(e) ? <string>e[0] : <string>e).sort();
            // tslint:disable-next-line: no-any
            const expectedInsertTexts = expectedNamesAndInsertTexts.every((e: any) => Array.isArray(e)) ? (<[string, string][]>expectedNamesAndInsertTexts).map(e => e[1]).sort() : undefined;

            assert.deepStrictEqual(completionNames, expectedNames, "Completion names didn't match");
            if (expectedInsertTexts !== undefined) {
                assert.deepStrictEqual(completionInserts, expectedInsertTexts, "Completion insert texts didn't match");
            }
        });
    }

    // /**asdf
    //  * Given a deployment template and a character index into it, verify that getReferences on the template
    //  * returns the expected set of locations.
    //  *
    //  * Usually parseTemplateWithMarkers will be used to parse the document and find the indices of a set of locations
    //  * Example:
    //  *
    //  *      const { dt, markers: { apiVersionDef, apiVersionReference } } = await parseTemplateWithMarkers(userFuncsTemplate1, [], { ignoreWarnings: true });
    //  *      // Cursor at reference to "apiVersion" inside resources
    //  *      await testFindReferences(dt, apiVersionReference.index, [apiVersionReference.index, apiVersionDef.index]);
    //  */
    // export async function testParamCompletions(
    //     dt: DeploymentTemplate,
    //     dp: DeploymentParameters,
    //     cursorIndex: number,
    //     expectedReferenceIndices: number[]
    // ): Promise<void> {
    //     const pc = dt.getContextFromDocumentCharacterIndex(cursorIndex);
    //     // tslint:disable-next-line: no-non-null-assertion
    //     const references: ReferenceList = pc.getReferences()!;
    //     assert(references, "Expected non-empty list of references");

    //     const indices = references.spans.map(r => r.startIndex).sort();
    //     expectedReferenceIndices = expectedReferenceIndices.sort();

    //     assert.deepStrictEqual(indices, expectedReferenceIndices);
    // }
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
                    !
                }
            }`,
            undefined,
            {},
            [
                newParamCompletionLabel
            ]);

        createParamsCompletionsTest(
            "Template has no parameters - only new param completions available",
            `{
                $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    !
                }
            }`,
            emptyTemplate,
            {},
            [
                newParamCompletionLabel
            ]);

        // asdf different param types
        // params with default values

        suite("Offer completions for properties from template that aren't already defined in param file", () => {
            createParamsCompletionsTest(
                "2 in template, 0 in params",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        !
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
                    `"p2" (required)`,
                    `"p10" (required)`,
                    newParamCompletionLabel
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
                            !
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
                    `"p10" (required)`,
                    newParamCompletionLabel
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
                        !
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
                    `"Parameter10" (required)`, // Use casing in template file
                    newParamCompletionLabel
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
                            !
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
                    `"Parameter30" (required)`,
                    newParamCompletionLabel
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
                        !
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
                    newParamCompletionLabel
                ]);

            createParamsCompletionsTest(
                "1 optional, 1 required",
                `{
                    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        !
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
                    `"p1optional" (optional)`,
                    `"p2required" (required)`,
                    newParamCompletionLabel
                ]);
        });
    });
});
