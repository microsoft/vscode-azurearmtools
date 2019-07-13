// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string

import { armToolsSource, IDeploymentParameterDefinition, IDeploymentTemplate, testDiagnostics } from "../support/diagnostics";

// Note: a lot of these come from TLE.test.ts, but this version goes through the vscode diagnostics and thus tests the language server
suite("Expressions functional tests", () => {
    // testName defaults to expression if left blank
    async function testExpression(testName: string, expression: string, expected: string[]): Promise<void> {
        test(testName || expression, async () => {
            let template: IDeploymentTemplate = {
                $schema: "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.0.0.0",
                resources: [
                    {
                        name: "resource1",
                        type: "some type",
                        apiVersion: "xxx",
                        location: "westus",
                        properties: {
                        }
                    }
                ],
                variables: {
                },
                parameters: {
                }
            };

            function addVarIfUsed(varName: string, value: unknown) {
                if (expression.match(new RegExp(`variables\\s*\\(\\s*'${varName}'\\s*\\)`, "i"))) {
                    template.variables[varName] = value;
                }
            }

            function addParamIfUsed(paramName: string, definition: IDeploymentParameterDefinition) {
                if (expression.match(new RegExp(`parameters\\s*\\(\\s*'${paramName}'\\s*\\)`, "i"))) {
                    template.parameters[paramName] = definition
                }
            }

            addVarIfUsed("stringVar", "hello");
            addVarIfUsed("intVar", "321");
            addVarIfUsed("arrayVar", [1, 2, [3, 4, 5]]);

            addParamIfUsed("intParam", {
                type: "int"
            });
            addParamIfUsed("arrayParam", {
                type: "array",
                defaultValue: [1, 2, 3]
            });
            addParamIfUsed("objParam", {
                type: "object",
                defaultValue: {
                    abc: 1,
                    def: "def",
                    ghi: [1, 2, 3],
                    jkl: { a: "hello" }
                }
            });

            // Add a property with the expression as the value
            template.resources[0].properties[`test`] = expression;

            await testDiagnostics(
                template,
                {
                    includeSources: [armToolsSource],
                    includeRange: true
                },
                expected);
        });
    }

    async function testLiteralExpression(literalExpression: string, expected: string[]): Promise<void> {
        // Wrap the literal in 'concat' because the extension doesn't currently allow just literals
        // (https://github.com/microsoft/vscode-azurearmtools/issues/216)
        testExpression(`testLiteralExpression("${literalExpression}")`, `[concat(${literalExpression})]`, expected);
    }

    suite("general issues", async () => {
        testExpression("Empty expression", "[]", [
            "Error: Expected a function or property expression. (ARM Tools)"
        ]);

        testExpression("Missing right bracket", "[", [
            "Error: Expected a right square bracket (']'). (ARM Tools)",
            "Error: Expected a function or property expression. (ARM Tools)"
        ]);

        testExpression("", "[concat('abc')", [
            "Error: Expected a right square bracket (']'). (ARM Tools)"
        ]);

        testExpression("string after function", "[deployment()'world']", [
        ]);


        testExpression("with several invalid literals", ".[]82348923asdglih   asl .,'", [
        ]);

        testExpression("https://github.com/Microsoft/vscode-azurearmtools/issues/34",
            "[concat(reference(parameters('publicIpName')).dnsSettings.fqdn, ';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up')]",
            []);
    });

    suite("Plain strings vs expressions", () => {
        // Inferred rules by experimenting with deployments
        // See https://github.com/microsoft/vscode-azurearmtools/issues/250

        suite("1: Starts with [ but doesn't end with ] -> consider a string, don't change", () => {
            /* TODO: Needs to be fixed: https://github.com/microsoft/vscode-azurearmtools/issues/250
            // "[one]two" // -> string: "[one]two"
            testExpression("[abc]withsuffix", []);
            */

            /* TODO: Needs to be fixed: https://github.com/microsoft/vscode-azurearmtools/issues/250
            // testExpression("[abc", []);
            */

            // -> string: "[[one]two"
            testExpression("", "[[one]two", []);
        });

        suite("2: Starts with [[ -> replace first [[ with [, consider a string", () => {
            // "[[one]" // -> string: "[one]"
            testExpression("", "[[one]", []);
            "[[one]two]" // -> string: "[one]two]"
            testExpression("", "[[one]two]", []);
            // "[[[one]two]" // -> string: "[[one]two]"
            testExpression("", "[[[one]two]", []);
            testExpression("", "[[abc", []);
            testExpression("", "[[[abc", []);
        });

        suite("3: Starts with [ (and ends with ]) -> expression", () => {
            // "one" // -> string: "one"
            testExpression("", "[concat('')]", []);
        });

        suite("4: Anything else is a string", () => {
            /* TODO: Needs to be fixed: https://github.com/microsoft/vscode-azurearmtools/issues/250
            // " [one]" // -> string
            testExpression("Starts with whitespace", " [one]", []);
            */

            /* TODO: Needs to be fixed: https://github.com/microsoft/vscode-azurearmtools/issues/250
            // "[one] " // -> string
            testExpression("Ends with whitespace", "[one] ", []);
            */
        });


        testExpression("", "]", []);
    });

    suite("string literals", async () => {
        testLiteralExpression("''", []);
        testLiteralExpression("'hello'", []);
        testLiteralExpression(" '123' ", []);

        suite("Escaped apostrophes", () => {
            testLiteralExpression("'That''s it!'", []);
            testLiteralExpression("''''", []);
            testLiteralExpression("  ' '' '  ", []);
            testLiteralExpression("['''That is all, folks!''']", []);

        });

        testLiteralExpression("'Bad apostrophe's'", [
            "Error: Expected a comma (','). (ARM Tools)",
            "Error: Expected a comma (','). (ARM Tools)",
            "Error: Expected a right square bracket (']'). (ARM Tools)",
        ]);

        suite("numeric literals", async () => {
            testLiteralExpression("123", []);
            testLiteralExpression("0", []);
            testLiteralExpression("-0", []);
            testLiteralExpression("+0", []);
            testLiteralExpression("1", []);
            testLiteralExpression("-1", []);
            testLiteralExpression("-1234", []);
            testLiteralExpression("1234", []);
            testLiteralExpression("+1234", []);
            testLiteralExpression("7.8", []);
            testLiteralExpression("-3.14159265", []);

            testLiteralExpression(".14159265", [

            ]);
            testLiteralExpression("-.14159265", [

            ]);
        });

        suite("Escaped apostrophes", () => {
            testLiteralExpression("''", []);
            testLiteralExpression("'That''s it!'", []);
        });

        testLiteralExpression("'Bad apostrophe's'", [
            "Error: Expected a comma (','). (ARM Tools)",
            "Error: Expected a comma (','). (ARM Tools)",
            "Error: Expected a right square bracket (']'). (ARM Tools)",
        ]);
    });

    suite("Functions", () => {
        suite("Missing left paren", () => {
            testExpression("", "[concat'abc')]", [
            ]);

            testExpression("", "[concat 1,2)]", [
            ]);
        });

        suite("Missing right paren", () => {
            testExpression("", "[concat('abc']", [
            ]);
        });

        // No args
        testExpression("", "[deployment()]", []);

        // 1 arg
        testExpression("", "[empty(1)]", []);

        // 2 args
        testExpression("", "[endsWith('abc','bc')]", []);
        testExpression("", "[ endsWith ( 'abc', 'bc' ) ]", []);

        // Missing comma
        testExpression("", "[endsWith('abc' 'bc')]", [

        ]);

        // Expected 2 args, has zero
        testExpression("", "[endsWith()]", [
        ]);

        // Expected 2 args, has one
        testExpression("", "[endsWith('a')]", [
        ]);

        // Expected 2 args, has three
        testExpression("", "[endsWith('a', 'b', 'c')]", [
        ]);

        // Unrecognized function name with arg
        testExpression("", "[parameter('arrayParam')]", [

        ]);
    });

    suite("Variables/Parameters", () => {
        // Variables
        testExpression("", "[variables('arrayVar')]", []);

        // Parameters
        testExpression("", "[parameters('arrayParam')]", []);

        /* CONSIDER: Doesn't currently pass (the expression itself gives no errors, but we get a warning that intParam is never used)
        testExpression("", "[PARAmeters('intParam')]", []);
        */

        suite("Undefined parameters/variables", () => {
            testExpression("", "[parameters('undefined')]", [
                'Error: Undefined parameter reference: \'undefined\' (ARM Tools) [10,29-10,40]'
            ]);
            testExpression("", "[variables('undefined')]", [
                "Error: Undefined variable reference: 'undefined' (ARM Tools) [10,28-10,39]"
            ]);
            testExpression("", "[parameters('')]", [
                "Error: Undefined parameter reference: '' (ARM Tools) [10,29-10,31]"
            ]);

            /* CONSIDER: This doesn't give any errors. Should it?
            testExpression("", "[parameters(1)]", [
            ]); */

            // No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.
            testExpression("with child property access from undefined variable reference", "[variables('undefVar').apples]", []);

            // No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.
            testExpression("with grandchild property access from undefined variable reference", "[variables('undefVar').apples.bananas]", []);

            testExpression("with child property access from variable reference to non-object variable", "[variables('intVar').apples]", [
                `Error: Property "apples" is not a defined property of "variables('intVar')". (ARM Tools)`]);

            testExpression("with grandchild property access from variable reference to non-object variable", "[variables('stringVar').apples.bananas]", [
                `Error: Property "apples" is not a defined property of "variables('stringVar')". (ARM Tools)`]);
        });

    });

    suite("Array/Object access", () => {
        testExpression("", "[parameters('arrayParam')[0]]", []);
        testExpression("", "[variables('arrayVar')[parameters('intParam')]]", []);
        testExpression("", "[variables('arrayVar')[1][1]]", []);
        testExpression("", "[variables('arrayVar')[add(12,3)]]", []);

        // Object access
        testExpression("", "[parameters('objParam').abc]", []);
        testExpression("", "[ parameters ( 'objParam' ) . abc ]", []);

        // Object and array access
        testExpression("", "[parameters('objParam').abc[2]]", []);

        // Array argument
        testExpression("", "[empty(variables('arrayVar')[0])]", []);

        testExpression("", "[variables('arrayVar')[1][1]", [
            "Error: Expected a right square bracket (']'). (ARM Tools) [10,45-10,46]"
        ]);
    });

    suite("Property access", () => {

        testExpression("", "[resourceGroup().name]", []);

        // Property access, missing period
        testExpression("", "[resourceGroup()name]", [
            "Error: Expected the end of the string. (ARM Tools) [10,33-10,37]"
        ]);

        // Property access, quoted property name
        testExpression("", "[resourceGroup().'name']", [
            "Error: Expected a literal value. (ARM Tools) [10,34-10,40]"
        ]);

        // Property access, numeric property name
        testExpression("", "[resourceGroup().1]", [
            "Error: Expected a literal value. (ARM Tools) [10,34-10,35]"
        ]);

        // Property access, missing property name
        testExpression("", "[resourceGroup().]", [
            "Error: Expected a literal value. (ARM Tools) [10,34-10,35]"
        ]);

        // Property access, two deep
        testExpression("", "[resourceGroup().name.length]", []);
    });

    suite("Miscellaneous and real scenarios", () => {
        testExpression("", "[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]", [
            'Error: Nothing should exist after the closing \']\' except for whitespace. (ARM Tools) [10,132-10,133]',
            'Error: Nothing should exist after the closing \']\' except for whitespace. (ARM Tools) [10,134-10,135]',
            'Error: Nothing should exist after the closing \']\' except for whitespace. (ARM Tools) [10,135-10,136]',
            'Error: Undefined parameter reference: \'_artifactsLocation\' (ARM Tools) [10,36-10,56]',
            'Error: Undefined parameter reference: \'_artifactsLocationSasToken\' (ARM Tools) [10,101-10,129]'
        ]);
    });
});
