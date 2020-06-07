// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

import { diagnosticSources, IDeploymentParameterDefinition, IDeploymentTemplate, testDiagnostics } from "../support/diagnostics";
import { testWithLanguageServer } from "../support/testWithLanguageServer";

// Note: a lot of these come from TLE.test.ts, but this version goes through the vscode diagnostics and thus tests the language server
suite("Expressions functional tests", () => {
    // testName defaults to expression if left blank
    function testExpression(testName: string, expression: string, expected: string[]): void {
        testWithLanguageServer(testName || expression, async () => {
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

            function addVarIfUsed(varName: string, value: number | unknown[] | string | {}): void {
                if (expression.match(new RegExp(`variables\\s*\\(\\s*'${varName}'\\s*\\)`, "i"))) {
                    template.variables![varName] = value;
                }
            }

            function addParamIfUsed(paramName: string, definition: IDeploymentParameterDefinition): void {
                if (expression.match(new RegExp(`parameters\\s*\\(\\s*'${paramName}'\\s*\\)`, "i"))) {
                    template.parameters![paramName] = definition;
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
            template.resources[0]!.properties![`test`] = expression;

            await testDiagnostics(
                template,
                {
                    includeSources: [diagnosticSources.expressions],
                    includeRange: true
                },
                expected);
        });
    }

    function testLiteralExpression(literalExpression: string, expected: string[]): void {
        // Wrap the literal in 'concat' because the extension doesn't currently allow just literals
        // (https://github.com/microsoft/vscode-azurearmtools/issues/216)
        testExpression(`testLiteralExpression("${literalExpression}")`, `[concat(${literalExpression})]`, expected);
    }

    suite("general issues", () => {
        testExpression("Empty expression", "[]", [
            "Error: Expected a function or property expression. (arm-template (expressions))"
        ]);

        testExpression("Missing right bracket", "[", [
            "Error: Expected a right square bracket (']'). (arm-template (expressions))",
            "Error: Expected a function or property expression. (arm-template (expressions))"
        ]);

        testExpression("", "[concat('abc')", [
            "Error: Expected a right square bracket (']'). (arm-template (expressions))"
        ]);

        testExpression("string after function", "[deployment()'world']", [
            "Error: Expected the end of the string. (arm-template (expressions)) [10,30-10,37]"
        ]);

        testExpression("with several invalid literals", ".[]82348923asdglih   asl .,'", [
        ]);

        testExpression(
            "https://github.com/Microsoft/vscode-azurearmtools/issues/34",
            "[concat(reference(parameters('publicIpName')).dnsSettings.fqdn, ';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up')]",
            [
                // This should be the only error we get.  In particular, no errors with the escaped apostrophes
                "Error: Undefined parameter reference: 'publicIpName' (arm-template (expressions)) [10,46-10,60]"
            ]);
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
            // "[[one]two]" // -> string: "[one]two]"
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

    suite("string literals", () => {
        testLiteralExpression("''", []);
        testLiteralExpression("'hello'", []);
        testLiteralExpression(" '123' ", []);

        suite("Escaped apostrophes", () => {
            testLiteralExpression("'That''s it!'", []);
            testLiteralExpression("''''", []);
            testLiteralExpression("  ' '' '  ", []);
            testLiteralExpression("'''That''s all, \"folks\"!'''", []);

        });

        testLiteralExpression("'Bad apostrophe's'", [
            "Error: Expected a comma (','). (arm-template (expressions))",
            "Error: Expected a comma (','). (arm-template (expressions))",
            "Error: Expected a right square bracket (']'). (arm-template (expressions))",
        ]);

        suite("Escaped apostrophes", () => {
            testLiteralExpression("''", []);
            testLiteralExpression("'That''s it!'", []);
        });

        testLiteralExpression("'Bad apostrophe's'", [
            "Error: Expected a comma (','). (arm-template (expressions))",
            "Error: Expected a comma (','). (arm-template (expressions))",
            "Error: Expected a right square bracket (']'). (arm-template (expressions))",
        ]);
    });

    suite("numeric literals", () => {
        testLiteralExpression("123", []);
        testLiteralExpression("0", []);
        testLiteralExpression("-0", []);
        testLiteralExpression("1", []);
        testLiteralExpression("-1", []);
        testLiteralExpression("-1234", []);
        testLiteralExpression("1234", []);
        testLiteralExpression("7.8", []);
        testLiteralExpression("-3.14159265", []);

        /* CONSIDER: Should this be accepted?
        testLiteralExpression("+1234", []);
        testLiteralExpression("+0", []);
        */

        /* CONSIDER: I don't think this is valid, but it is accepted (colorization rejects it)
        testLiteralExpression("-.14159265", [
        ]);
        */
    });

    suite("Function calls", () => {
        suite("Missing left paren", () => {
            testExpression("", "[concat'abc')]", [
                "Error: Expected the end of the string. (arm-template (expressions)) [10,24-10,29]",
                "Error: Expected the end of the string. (arm-template (expressions)) [10,29-10,30]",
                "Error: Missing function argument list. (arm-template (expressions)) [10,18-10,24]"
            ]);

            testExpression("", "[concat 1,2)]", [
                'Error: Expected the end of the string. (arm-template (expressions)) [10,25-10,26]',
                'Error: Expected the end of the string. (arm-template (expressions)) [10,26-10,27]',
                'Error: Expected the end of the string. (arm-template (expressions)) [10,27-10,28]',
                'Error: Expected the end of the string. (arm-template (expressions)) [10,28-10,29]',
                'Error: Missing function argument list. (arm-template (expressions)) [10,18-10,24]'
            ]);
        });

        suite("Missing right paren", () => {
            testExpression("", "[concat('abc']", [
                "Error: Expected a right parenthesis (')'). (arm-template (expressions)) [10,30-10,31]"
            ]);
        });

        // No args
        testExpression("", "[deployment()]", []);

        // 1 arg
        testExpression("", "[string(1)]", []);

        // 2 args
        testExpression("", "[equals('abc','bc')]", []);
        testExpression("", "[ equals ( 'abc', 'bc' ) ]", []);

        // Missing comma
        testExpression("", "[equals('abc' 'bc')]", [
            "Error: Expected a comma (','). (arm-template (expressions)) [10,31-10,35]",
            "Error: The function 'equals' takes 2 arguments. (arm-template (expressions)) [10,18-10,36]"
        ]);

        // Expected 2 args, has zero
        testExpression("", "[equals()]", [
            "Error: The function 'equals' takes 2 arguments. (arm-template (expressions)) [10,18-10,26]"
        ]);

        // Expected 2 args, has one
        testExpression("", "[equals('a')]", [
            "Error: The function 'equals' takes 2 arguments. (arm-template (expressions)) [10,18-10,29]"
        ]);

        // Expected 2 args, has three
        testExpression("", "[equals('a', 'b', 'c')]", [
            "Error: The function 'equals' takes 2 arguments. (arm-template (expressions)) [10,18-10,39]"
        ]);

        // Unrecognized function name with arg
        testExpression("", "[parameter('arrayParam')]", [
            "Error: Unrecognized function name 'parameter'. (arm-template (expressions)) [10,18-10,27]"
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
                'Error: Undefined parameter reference: \'undefined\' (arm-template (expressions)) [10,29-10,40]'
            ]);
            testExpression("", "[variables('undefined')]", [
                "Error: Undefined variable reference: 'undefined' (arm-template (expressions)) [10,28-10,39]"
            ]);
            testExpression("", "[parameters('')]", [
                "Error: Undefined parameter reference: '' (arm-template (expressions)) [10,29-10,31]"
            ]);

            /* CONSIDER: This doesn't give any errors. Should it?
            testExpression("", "[parameters(1)]", [
            ]); */

            // No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.
            testExpression("with child property access from undefined variable reference", "[variables('undefVar').apples]", [
                "Error: Undefined variable reference: 'undefVar' (arm-template (expressions)) [10,28-10,38]"
            ]);

            // No errors should be reported for a property access to an undefined variable, because the top priority error for the developer to address is the undefined variable reference.
            testExpression("with grandchild property access from undefined variable reference", "[variables('undefVar').apples.bananas]", [
                "Error: Undefined variable reference: 'undefVar' (arm-template (expressions)) [10,28-10,38]"
            ]);

            testExpression("with child property access from variable reference to non-object variable", "[variables('intVar').apples]", [
                `Error: Property "apples" is not a defined property of "variables('intVar')". (arm-template (expressions))`]);

            testExpression("with grandchild property access from variable reference to non-object variable", "[variables('stringVar').apples.bananas]", [
                `Error: Property "apples" is not a defined property of "variables('stringVar')". (arm-template (expressions))`]);
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
        testExpression("", "[string(variables('arrayVar')[0])]", []);

        testExpression("", "[variables('arrayVar')[1][1]", [
            "Error: Expected a right square bracket (']'). (arm-template (expressions)) [10,45-10,46]"
        ]);
    });

    suite("Property access", () => {

        testExpression("", "[resourceGroup().name]", []);

        // Property access, missing period
        testExpression("", "[resourceGroup()name]", [
            "Error: Expected the end of the string. (arm-template (expressions)) [10,33-10,37]"
        ]);

        // Property access, quoted property name
        testExpression("", "[resourceGroup().'name']", [
            "Error: Expected a literal value. (arm-template (expressions)) [10,34-10,40]"
        ]);

        // Property access, numeric property name
        testExpression("", "[resourceGroup().1]", [
            "Error: Expected a literal value. (arm-template (expressions)) [10,34-10,35]"
        ]);

        // Property access, missing property name
        testExpression("", "[resourceGroup().]", [
            "Error: Expected a literal value. (arm-template (expressions)) [10,34-10,35]"
        ]);

        // Property access, two deep
        testExpression("", "[resourceGroup().name.length]", []);
    });

    suite("Miscellaneous and real scenarios", () => {
        testExpression("", "[concat(parameters('_artifactsLocation'), '/', '/scripts/azuremysql.sh', parameters('_artifactsLocationSasToken'))], )]", [
            'Error: Nothing should exist after the closing \']\' except for whitespace. (arm-template (expressions)) [10,132-10,133]',
            'Error: Nothing should exist after the closing \']\' except for whitespace. (arm-template (expressions)) [10,134-10,135]',
            'Error: Nothing should exist after the closing \']\' except for whitespace. (arm-template (expressions)) [10,135-10,136]',
            'Error: Undefined parameter reference: \'_artifactsLocation\' (arm-template (expressions)) [10,36-10,56]',
            'Error: Undefined parameter reference: \'_artifactsLocationSasToken\' (arm-template (expressions)) [10,101-10,129]'
        ]);
    });
});
