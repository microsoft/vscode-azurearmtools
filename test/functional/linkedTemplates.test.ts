// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import * as assert from "assert";
import { Uri } from "vscode";
import { parseError } from "vscode-azureextensionui";
import { assertNever, LinkedFileLoadState, notifications, notifyTemplateGraphAvailable, startArmLanguageServerInBackground } from "../../extension.bundle";
import { ExpectedDiagnostics, IExpectedDiagnostic, simplifyBadTypeResourceMessage, testDiagnostics, testDiagnosticsFromUri } from "../support/diagnostics";
import { ensureLanguageServerAvailable } from "../support/ensureLanguageServerAvailable";
import { resolveInTestFolder } from "../support/resolveInTestFolder";
import { testLog } from "../support/testLog";
import { testWithLanguageServerAndRealFunctionMetadata } from "../support/testWithLanguageServer";

suite("Linked templates functional tests", () => {
    // <TC> in strings will be replaced with ${testCase}
    function tcString(s: string, testCase: string): string {
        return s.replace(/<TC>/g, testCase);
    }

    // <TC> in strings will be replaced with ${testCase}
    function tcDiagnostics(ed: ExpectedDiagnostics, testCase: string): ExpectedDiagnostics {
        if (ed.length === 0) {
            return [];
        } else if (typeof ed[0] === 'string') {
            return (<string[]>ed).map((s: string) => tcString(<string>s, testCase));
        } else {
            return (<IExpectedDiagnostic[]>ed).map((d: IExpectedDiagnostic) => {
                const d2 = Object.assign({}, d, { message: tcString(d.message, testCase) });
                return d2;
            });
        }
    }

    async function waitForGraphAvailable(mainTemplate: string, childTemplate: string): Promise<void> {
        // tslint:disable-next-line: typedef promise-must-complete // false positive
        await new Promise<void>(resolve => {
            const disposable = notifyTemplateGraphAvailable(e => {
                if (Uri.parse(e.rootTemplateUri).fsPath === mainTemplate) {
                    testLog.writeLine(`Graph notification available for ${mainTemplate}... Looking for child ${childTemplate}`);
                    const child = e.linkedTemplates.find(lt => Uri.parse(lt.fullUri).fsPath === childTemplate);
                    let ready: boolean;
                    if (child) {
                        switch (child.loadState) {
                            case LinkedFileLoadState.Loading:
                            case LinkedFileLoadState.NotLoaded:
                                testLog.writeLine(`...${child.originalPath}: load state = ${child.loadState}, therefore not ready yet`);
                                // Still loading
                                ready = false;
                                break;

                            case LinkedFileLoadState.LoadFailed:
                            case LinkedFileLoadState.NotSupported:
                            case LinkedFileLoadState.SuccessfullyLoaded:
                            case LinkedFileLoadState.TooDeep:
                                testLog.writeLine(`...${child.originalPath}: load state = ${child.loadState} => READY`);
                                // Load completed or succeeded
                                ready = true;
                                break;

                            default:
                                assertNever(child.loadState);
                        }
                    } else {
                        ready = false;
                        testLog.writeLine(`... child not found in graph`);
                    }

                    if (ready) {
                        testLog.writeLine(`...READY`);
                        disposable.dispose();
                        resolve();
                    } else {
                        testLog.writeLine(`... not ready`);
                    }
                }
            });
        });
    }

    // <TC> in strings will be replaced with ${testCase}
    function createLinkedTemplateTest(
        testCase: string,
        testDescription: string,
        options: {
            //CONSIDER: group into single object for mainTemplate
            mainTemplateFile: string;
            mainParametersFile: string;
            mainTemplateExpected: ExpectedDiagnostics;
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: This is a hack.  We need better way to determine when validation is completely done
            /**
             * If specified, wait for a diagnostic to match the following substring before continuing with checks
             */
            waitForDiagnosticSubstring?: string;

            linkedTemplates: {
                parentTemplateFile: string;
                linkedTemplateFile: string;
                expected: ExpectedDiagnostics;
                // If specified, wait for a diagnostic to match the following substring between continuing with checks
                waitForDiagnosticSubstring?: string;
            }[];
        }
    ): void {
        testWithLanguageServerAndRealFunctionMetadata(
            `${testCase} ${testDescription}`,
            async () => {
                const mainTemplatePath = resolveInTestFolder(tcString(options.mainTemplateFile, testCase));
                assert(mainTemplatePath);
                assert(options.mainParametersFile);

                startArmLanguageServerInBackground();
                const client = await ensureLanguageServerAvailable();
                client.onNotification(notifications.Diagnostics.codeAnalysisStarting, async (args: notifications.Diagnostics.ICodeAnalysisStartingArgs) => {
                    //testLog.writeLine(JSON.stringify(args, null, 2));
                });

                // Create promise to wait for child graphs to be available
                let waitForChildPromises: Promise<unknown>[] = [];
                for (const expectedLinkedTemplate of options.linkedTemplates) {
                    // Wait for child template's graph to be available
                    const childPath = resolveInTestFolder(tcString(expectedLinkedTemplate.linkedTemplateFile, testCase));
                    const parentPath = resolveInTestFolder(tcString(expectedLinkedTemplate.parentTemplateFile, testCase));
                    waitForChildPromises.push(waitForGraphAvailable(parentPath, childPath));
                }
                const waitAllForChildPromises = Promise.all(waitForChildPromises);

                // Open and test diagnostics for the main template file
                testLog.writeLine("Testing diagnostics in main template.");
                // tslint:disable-next-line: no-any
                await testDiagnostics(
                    mainTemplatePath,
                    {
                        parametersFile: tcString(options.mainParametersFile, testCase),
                        waitForDiagnosticsFilter: async (results): Promise<boolean> => {
                            await waitAllForChildPromises;
                            if (options.waitForDiagnosticSubstring) {
                                // tslint:disable-next-line: no-non-null-assertion
                                return results.diagnostics.some(d => d.message.includes(options.waitForDiagnosticSubstring!));
                            }
                            return true;
                        },
                        transformResults: simplifyBadTypeResourceMessage
                    },
                    tcDiagnostics(options.mainTemplateExpected, testCase)
                );

                testLog.writeLine("Diagnostics in main template were correct.");

                // Test diagnostics (without opening them directly - that should have happened automatically) for the linked templates
                for (const linkedTemplate of options.linkedTemplates) {
                    const childPath = resolveInTestFolder(tcString(linkedTemplate.linkedTemplateFile, testCase));
                    const childUri = Uri.file(childPath);
                    try {
                        testLog.writeLine(`Testing diagnostics in ${linkedTemplate.linkedTemplateFile}`);
                        await testDiagnosticsFromUri(
                            childUri,
                            {
                                waitForDiagnosticsFilter: (results): boolean => {
                                    if (linkedTemplate.waitForDiagnosticSubstring) {
                                        // tslint:disable-next-line: no-non-null-assertion
                                        return results.diagnostics.some(d => d.message.includes(linkedTemplate.waitForDiagnosticSubstring!));
                                    }
                                    return true;
                                },
                                transformResults: simplifyBadTypeResourceMessage
                            },
                            tcDiagnostics(linkedTemplate.expected, testCase)
                        );
                    } catch (err) {
                        throw new Error(`Diagnostics did not match expected for linked template ${childPath}: ${parseError(err).message}`);
                    }
                }
            });
    }

    createLinkedTemplateTest(
        "tc01",
        "one level, no validation errors, child in subfolder, relative path starts with subfolder name",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
            ],
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                    expected: [
                        "Error: Undefined parameter reference: 'p3string-whoops' (arm-template (expressions)) [26,38]"
                    ]
                }
            ]
        }
    );

    createLinkedTemplateTest(
        "tc02",
        "expecting error: child not found",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            waitForDiagnosticSubstring: 'not found',
            mainTemplateExpected: [
                `Error: Template validation failed: Linked template file not found: `
                + `"${resolveInTestFolder('templates/linkedTemplates/<TC>/subfolder/child.json')}"`
                + ` (arm-template (validation)) [12,27]`
            ],
            linkedTemplates: [
            ]
        }
    );

    createLinkedTemplateTest(
        "tc03",
        "one level, no validation errors, child in subfolder, relative path starts with ./",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
            ],
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                    expected: [
                        "Error: Undefined parameter reference: 'p3string-whoops' (arm-template (expressions)) [26,38]"
                    ]
                }
            ]
        }
    );

    createLinkedTemplateTest(
        "tc04",
        "one level, no validation errors, child in subfolder, folder and filename contain spaces",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC> with spaces.json",
            mainParametersFile: "<TC> with spaces.parameters.json",
            mainTemplateExpected: [
                "Error: The following parameters do not have values: \"p2string\" (arm-template (expressions)) [16,33-16,33]"
            ],
            // CONSIDER: why is this necessary?
            waitForDiagnosticSubstring: "The following parameters do not have values",
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC> with spaces.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder with spaces/child with spaces.json",
                    expected: [
                        "Error: Undefined parameter reference: 'p3string-whoops' (arm-template (expressions)) [36,38]",
                        "Warning: The parameter 'p2string' is never used. (arm-template (expressions)) [12,9]",
                        "Warning: The parameter 'p3string' is never used. (arm-template (expressions)) [15,9]",
                        "Warning: Value must be one of the following values: {...} (arm-template (schema)) [28,13]",
                    ],
                    // CONSIDER: Why is this necessary?
                    waitForDiagnosticSubstring: "Value must be one"
                }
            ]
        }
    );

    // tslint:disable-next-line: no-suspicious-comment
    /* TODO: Can't deploy to test yet
    createLinkedTemplateTest(
        "tc05",
        "backslashes in path",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>\\<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
            ],
            linkedTemplates: [
                {

                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                    expected: [
                        "Error: Undefined parameter reference: 'p3string-whoops' (arm-template (expressions)) [26,38]"
                    ]
                }
            ]
        }
    );*/

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Hangs sometimes
    createLinkedTemplateTest(
        "tc06",
        "Parameter type mismatch error",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            // waitForDiagnosticSubstring is needed because the error is given during a re-validation, not immediately, so hard to know how long
            //   to wait
            waitForDiagnosticSubstring: "Template parameter JToken type is not valid",
            mainTemplateExpected: [
                "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'Integer'. Actual 'String'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [15,27] [The error occurred in a linked template near here] [12,21]"
            ],
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                    expected: [
                        "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [12,9-12,19]",
                        "Warning: The parameter 'stringParam' is never used. (arm-template (expressions)) [5,9-5,22]",
                    ]
                }
            ]
        }
    );

    createLinkedTemplateTest(
        "tc07",
        "2 levels deep, error in parameters to 2nd level, only top level has a parameter file - we only traverse to child1, not child2",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
            ],
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child1.json",
                    expected: [
                        "Warning: The variable 'unusedVar' is never used. (arm-template (expressions)) [5,9]",
                    ]
                }
            ]
        }
    );

    createLinkedTemplateTest(
        "tc08",
        "2 levels deep, error in parameters to 2nd level, child1.json also has a parameter file - child2 gets traversed via the opened child1 (since child1 has a param file)",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
            ],
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child1.json",
                    expected: [
                        "Warning: The variable 'unusedVar' is never used. (arm-template (expressions)) [5,9]",
                        "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'Integer'. Actual 'String'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [14,27] [The error occurred in a linked template near here] [12,21]",
                    ]
                },
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child1.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child2.json",
                    expected: [
                        "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [12,9-12,19]",
                        "Warning: The parameter 'stringParam' is never used. (arm-template (expressions)) [5,9-5,22]",
                    ]
                }
            ]
        }
    );

    createLinkedTemplateTest(
        "tc09",
        "two calls to same linked template, second call has an error",
        {
            mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
                "Error: Template validation failed: Template parameter JToken type is not valid. Expected 'Integer'. Actual 'String'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [31,27] [The error occurred in a linked template near here] [5,21]",
            ],
            waitForDiagnosticSubstring: "Template validation failed",
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                    expected: [
                        "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [5,9-5,19]",
                    ]
                }
            ]
        }
    );

    suite("Parameter validation", () => {

        createLinkedTemplateTest(
            "tc10",
            "missing and extra parameters (validation)",
            {
                mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                mainParametersFile: "<TC>.parameters.json",
                mainTemplateExpected: [
                    "Error: Template validation failed: The template parameters 'extraParam' in the parameters file are not valid; they are not present in the original template and can therefore not be provided at deployment time. The only supported parameters for this template are 'intParam, stringParam'. Please see https://aka.ms/arm-deploy/#parameter-file for usage details. (arm-template (validation)) [19,27] [The error occurred in a linked template near here] [1,1]",
                    'Error: The following parameters do not have values: "stringParam" (arm-template (expressions)) [24,17]',

                    "Warning: The variable 'v3' is never used. (arm-template (expressions)) [12,9]",
                ],
                waitForDiagnosticSubstring: 'Template validation failed',
                linkedTemplates: [
                    {
                        parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                        linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                        expected: [
                            "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [5,9-5,19]",
                            "Warning: The parameter 'stringParam' is never used. (arm-template (expressions)) [8,9-8,22]",
                        ]
                    }
                ]
            }
        );

        createLinkedTemplateTest(
            "tc11",
            "Missing parameters - no 'parameters' object under linked template parameters",
            {
                mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                mainParametersFile: "<TC>.parameters.json",
                mainTemplateExpected: [
                    'Error: The following parameters do not have values: "intParam", "stringParam" (arm-template (expressions)) [21,33-21,33]',
                    "Warning: The variable 'v1' is never used. (arm-template (expressions)) [10,9-10,13]",
                    "Warning: The variable 'v2' is never used. (arm-template (expressions)) [11,9-11,13]"
                ],
                waitForDiagnosticSubstring: 'following parameters do not have values',
                linkedTemplates: [
                    {
                        parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                        linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                        expected: [
                            "Warning: The parameter 'intParam' is never used. (arm-template (expressions)) [5,9-5,19]",
                            "Warning: The parameter 'stringParam' is never used. (arm-template (expressions)) [8,9-8,22]",
                        ]
                    }
                ]
            }
        );

        createLinkedTemplateTest(
            "tc12",
            "Verify correct scope of expressions, variables, parameters",
            {
                mainTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                mainParametersFile: "<TC>.parameters.json",
                mainTemplateExpected: [
                    // Expect no errors in the main template
                ],
                linkedTemplates: [
                    {
                        parentTemplateFile: "templates/linkedTemplates/<TC>/<TC>.json",
                        linkedTemplateFile: "templates/linkedTemplates/<TC>/subfolder/child.json",
                        expected: [
                            "Warning: The parameter 'childIntParam' is never used. (arm-template (expressions)) [5,9-5,24]",
                            "Warning: The parameter 'childStringParam' is never used. (arm-template (expressions)) [8,9-8,27]",
                            "Warning: The parameter 'location' is never used. (arm-template (expressions)) [11,9-11,19]",
                            "Warning: The variable 'childVar1' is never used. (arm-template (expressions)) [19,9-19,20]"
                        ]
                    }
                ]
            }
        );
    });

    createLinkedTemplateTest(
        "tc13",
        "An array index is out of bounds in the child template due to the parameter value passed in",
        {
            mainTemplateFile: "templates/linkedTemplates/tc13-badarrayindex-in-child/<TC>.json",
            mainParametersFile: "<TC>.parameters.json",
            mainTemplateExpected: [
                "Error: Template validation failed: The template resource '[variables('arrayVar')[parameters('childIntParam')]]' at line '15' and column '9' is not valid: The language expression property array index '1' is out of bounds.. Please see https://aka.ms/arm-template-expressions for usage details. (arm-template (validation)) [28,27] [The error occurred in a linked template near here] [15,9]",
            ],
            waitForDiagnosticSubstring: "property array index",
            linkedTemplates: [
                {
                    parentTemplateFile: "templates/linkedTemplates/tc13-badarrayindex-in-child/<TC>.json",
                    linkedTemplateFile: "templates/linkedTemplates/tc13-badarrayindex-in-child/subfolder/child13.json",
                    expected: [
                        // Should be no errors in the child because it's loaded without the context of the parameters passed in
                        // from the parent.
                    ]
                }
            ]
        }
    );
});
