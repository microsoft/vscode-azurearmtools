// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: no-invalid-template-strings max-func-body-length

import * as assert from "assert";
import { getFriendlyExpressionFromJsonString, getFriendlyExpressionFromTleExpression } from "../extension.bundle";

suite("friendly expressions", () => {
    suite("getFriendlyExpressionFromTleExpression", () => {
        function createFriendlyExpressionTest(
            tleExpression: string, // e.g. "'abc'" or "concat('a', 'b')"
            expected: string | undefined
        ): void {
            test(tleExpression, () => {
                let keepTestNameInClosure = tleExpression;
                keepTestNameInClosure = keepTestNameInClosure;

                const actual = getFriendlyExpressionFromTleExpression(tleExpression);
                assert.deepStrictEqual(actual, expected);
            });
        }

        suite("Just string literal", () => {
            createFriendlyExpressionTest("''", "");
            createFriendlyExpressionTest("'string'", "string");
            createFriendlyExpressionTest("'${a}'", "${a}");
            createFriendlyExpressionTest("'variables(\'a\')'", "variables(\'a\')");
        });

        suite("Just int", () => {
            createFriendlyExpressionTest("1", '[1]');
        });

        suite("Expressions with errors - just return original, plus var/par interpolation", () => {
            createFriendlyExpressionTest("", '[]');
            createFriendlyExpressionTest("a", "[a]");
            createFriendlyExpressionTest("parameter('a')", `[parameter('a')]`);
            createFriendlyExpressionTest("parameterss('a')", "[parameterss('a')]");
            createFriendlyExpressionTest("(variables('a')+parameters('abc'))", "[(${a}+${abc})]");
            createFriendlyExpressionTest("concat(a)", "[concat(a)]");
            createFriendlyExpressionTest("concat(a, 1)", "[concat(a, 1)]");
            createFriendlyExpressionTest("concat(variables('a'), , 1)", "[concat(${a}, , 1)]");
        });

        suite("concat", () => {
            createFriendlyExpressionTest("concat('a')", 'a');
            createFriendlyExpressionTest("concat(1)", '[1]');
            createFriendlyExpressionTest("concat(1, 2)", '[concat(1, 2)]');
        });

        suite("just a param or just a var", () => {
            createFriendlyExpressionTest("parameters('a')", "${a}");
            createFriendlyExpressionTest("variables('a')", "${a}");
            createFriendlyExpressionTest("PARAMETERS('a')", "${a}");
            createFriendlyExpressionTest("VARIABLES('a')", "${a}");
        });

        suite("If it's not a concat or just a var/param, then return with brackets", () => {
            createFriendlyExpressionTest("add(1, 2)", "[add(1, 2)]");
            createFriendlyExpressionTest("add(1, concat(add(1, 2)))", "[add(1, add(1, 2))]");
        });

        suite("concat strings", () => {
            createFriendlyExpressionTest("concat('a', 'b')", 'ab');
            createFriendlyExpressionTest("concat(variables('sqlServer'), 'a')", '${sqlServer}a');
            createFriendlyExpressionTest("concat(variables('a'),'b',variables('abc'))", '${a}b${abc}');
            createFriendlyExpressionTest("concat(variables('sqlServer'), '/', variables('firewallRuleName2'))", '${sqlServer}/${firewallRuleName2}');
        });

        suite("concat other things", () => {
            createFriendlyExpressionTest("concat('a', 1)", "[concat('a', 1)]");
            createFriendlyExpressionTest("concat(1, 'a')", "[concat(1, 'a')]");
            createFriendlyExpressionTest("concat(1, 'a', variables('b'))", "[concat(1, 'a${b}')]");
            createFriendlyExpressionTest("concat('a', 'b', 1)", "[concat('ab', 1)]");
            createFriendlyExpressionTest("concat('a', 1, 'b', 2)", "[concat('a', 1, 'b', 2)]");
            createFriendlyExpressionTest("concat(1, parameters('a'), 'b', 2, 3)", "[concat(1, '${a}b', 2, 3)]");
            createFriendlyExpressionTest("concat(1, 2)", "[concat(1, 2)]");
            createFriendlyExpressionTest("concat(concat(1, 2), concat(3, 4), 5)", "[concat(concat(1, 2), concat(3, 4), 5)]");
            createFriendlyExpressionTest("concat('a', variables('b'))", "a${b}");
            createFriendlyExpressionTest("concat(variables('a'), 'b')", "${a}b");
            createFriendlyExpressionTest("concat(variables('a'), 'b', 1)", "[concat('${a}b', 1)]");
            createFriendlyExpressionTest("concat(variables('a'), 1, 'b')", "[concat(${a}, 1, 'b')]");
            createFriendlyExpressionTest("concat(variables('a'), parameters('b'), 'c ')", "${a}${b}c ");
            createFriendlyExpressionTest("concat(1, 'a')", "[concat(1, 'a')]");
            createFriendlyExpressionTest("concat('a', 'b', 1)", "[concat('ab', 1)]");
            createFriendlyExpressionTest("concat('a', 1, 'b', 2)", "[concat('a', 1, 'b', 2)]");
        });

        suite("from nested concat", () => {
            createFriendlyExpressionTest("concat(concat(variables('a')))", "${a}");
            createFriendlyExpressionTest("concat(concat('variables(''a'')'))", 'variables(\'\'a\'\')');
            createFriendlyExpressionTest("concat('a', concat('b'), concat('c'))", 'abc');
        });

        createFriendlyExpressionTest("format('{0}/default/logs', variables('storageAccountName'))", "[format('{0}/default/logs', ${storageAccountName})]");
        createFriendlyExpressionTest("concat(parameters('virtualMachineName'),'/', variables('diagnosticsExtensionName'))", "${virtualMachineName}/${diagnosticsExtensionName}");

        suite("Shouldn't concat when an expression is an interpolated string with property index", () => {
            createFriendlyExpressionTest(
                "concat(parameters('vmProperties').property, 'Another string')",
                // Should *not* be "${vmProperties}.propertyAnother string" with Deployment tacked on to the expression
                "[concat(${vmProperties}.property, 'Another string')]"
            );
            createFriendlyExpressionTest(
                "concat(parameters('vmProperties')[copyIndex()].name,'Deployment')",
                // Should *not* be "${vmProperties}[copyIndex()].nameDeployment" with Deployment tacked on to the expression
                "[concat(${vmProperties}[copyIndex()].name, 'Deployment')]"
            );
        });

        suite("from child-resources/children-nested.json", () => {
            createFriendlyExpressionTest("resourceGroup().location", "[resourceGroup().location]");
            createFriendlyExpressionTest("uniqueString(resourceGroup().id)", "[uniqueString(resourceGroup().id)]");
        });

        suite("from 101-sql-logical-server.json", () => {
            createFriendlyExpressionTest("concat(variables('storageName'), '/Microsoft.Authorization/', variables('uniqueRoleGuid') )", '${storageName}/Microsoft.Authorization/${uniqueRoleGuid}');
            createFriendlyExpressionTest("resourceGroup().name", "[resourceGroup().name]");
            createFriendlyExpressionTest("tolower(concat('sqlva', variables('uniqueStorage')))", "[tolower('sqlva${uniqueStorage}')]");
        });

        suite("from copy-in-outputs3.json", () => {
            createFriendlyExpressionTest("concat(parameters('rgNamePrefix'),'-',parameters('rgEnvList')[copyIndex()])", '${rgNamePrefix}-${rgEnvList}[copyIndex()]');
            createFriendlyExpressionTest("concat('nic-', copyIndex())", "[concat('nic-', copyIndex())]");
            createFriendlyExpressionTest("array(json('[\"one\",\"two\",\"three\"]'))[copyIndex()]", "[array(json('[\"one\",\"two\",\"three\"]'))[copyIndex()]]");
        });

        createFriendlyExpressionTest("if(parameters('globalRedundancy'), 'Standard_GRS', 'Standard_LRS')", "[if(${globalRedundancy}, 'Standard_GRS', 'Standard_LRS')]");
        createFriendlyExpressionTest("format('{0}/default/logs', variables('storageAccountName'))", "[format('{0}/default/logs', ${storageAccountName})]");

        suite("from icons.json", () => {
            createFriendlyExpressionTest("myFunctions.vmName(parameters('virtualMachineName'),copyindex(1))", "[myFunctions.vmName(${virtualMachineName}, copyindex(1))]");
            createFriendlyExpressionTest("myFunctions.diskName(parameters('virtualMachineName'),copyindex(1))", "[myFunctions.diskName(${virtualMachineName}, copyindex(1))]");
            createFriendlyExpressionTest("myFunctions.nicName(parameters('virtualMachineName'),copyindex(1))", "[myFunctions.nicName(${virtualMachineName}, copyindex(1))]");
        });

        suite("from keyvalue-with-param.json", () => {
            createFriendlyExpressionTest("concat('sql-', uniqueString(resourceGroup().id, 'sql'))", "[concat('sql-', uniqueString(resourceGroup().id, 'sql'))]");
        });

        createFriendlyExpressionTest("concat(parameters('storagePrefix'), uniqueString(resourceGroup().id))", "[concat(${storagePrefix}, uniqueString(resourceGroup().id))]");
        createFriendlyExpressionTest("concat(parameters('storagePrefix'), uniqueString(parameters('secondSubscriptionID'), parameters('secondResourceGroup')))", "[concat(${storagePrefix}, uniqueString(${secondSubscriptionID}, ${secondResourceGroup}))]");

        suite("from outofbounds1.json", () => {
            createFriendlyExpressionTest("parameters('vmNames')[0]", "[${vmNames}[0]]");
            createFriendlyExpressionTest("concat(parameters('projectName'),'sqlsrv/',variables('rdsDBName'))", '${projectName}sqlsrv/${rdsDBName}');
        });
    });

    suite("getFriendlyExpressionFromTleExpression", () => {
        function createFriendlyJsonTest(
            jsonString: string, // e.g. "abc" or "[concat('a', 'b')]"
            expected: string | undefined
        ): void {
            test(jsonString, () => {
                let keepTestNameInClosure = jsonString;
                keepTestNameInClosure = keepTestNameInClosure;

                const actual = getFriendlyExpressionFromJsonString(jsonString);
                assert.deepStrictEqual(actual, expected);
            });
        }

        suite("Plain strings", () => {
            createFriendlyJsonTest("Microsoft.Storage/storageAccounts/providers/roleAssignments", 'Microsoft.Storage/storageAccounts/providers/roleAssignments');
            createFriendlyJsonTest("AllowAllWindowsAzureIps", 'AllowAllWindowsAzureIps');
            createFriendlyJsonTest("2019-06-01-preview", '2019-06-01-preview');

            createFriendlyJsonTest("[[parameters('subnetName')]", `[[parameters('subnetName')]`);
        });

        suite("expressions", () => {
            createFriendlyJsonTest("[parameters('a')]", "${a}");
            createFriendlyJsonTest("[parameters('vmNames')[0]]", "[${vmNames}[0]]");
        });

        suite("invalid expressions", () => {
            createFriendlyJsonTest("[a]", "[a]");
            createFriendlyJsonTest("[foo / parameters('vmNames')[0]]", "[foo / ${vmNames}[0]]");
            createFriendlyJsonTest("[1 PARAMETERS('a')]", "[1 ${a}]");
            createFriendlyJsonTest("[1PARAMETERS('a')]", "[1PARAMETERS('a')]");
            createFriendlyJsonTest("[variablesNot('a')]", "[variablesNot('a')]");
        });
    });

});
