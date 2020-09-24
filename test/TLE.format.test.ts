// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion

import * as assert from "assert";
import { TLE } from "../extension.bundle";

//asdf
// const tleSyntax = IssueKind.tleSyntax;
// const fakeId = Uri.file("https://fake-id");

suite("TLE format", () => {

    function parseExpression(stringValue: string): TLE.TleParseResult {
        return TLE.Parser.parse(stringValue);
    }

    suite("asdf", () => {
        function createFormatTest(testName: string, unquotedValue: string, indent: number, max: number, expected: string): void {
            const quotedValue = `"[${unquotedValue}]"`;
            test(`${testName} (${unquotedValue})`, () => {
                const parseResult = parseExpression(quotedValue).expression;
                const result = parseResult?.toString2(indent, max);
                assert.strictEqual(result, expected);
            });
        }

        suite("funcs with single literal arg - one line", () => { //asdf test when not
            createFormatTest(
                "parameters, single line",
                `parameters('a')`,
                0,
                40,
                `parameters('a')`
            );

            createFormatTest(
                "variables, single line",
                `variables('a')`,
                0,
                40,
                `variables('a')`
            );

            createFormatTest(
                'single string arg',
                `json('null')`,
                0,
                0,
                `json('null')`
            );

            createFormatTest(
                'single number arg',
                `json(-1.23)`,
                0,
                0,
                `json(-1.23)`
            );

            createFormatTest(
                'no args',
                `json()`,
                0,
                0,
                `json()`
            );

            createFormatTest(
                'single literal arg, UDF',
                `udf1.json()`,
                0,
                0,
                `udf1.json()`
            );

            createFormatTest(
                '',
                `copyIndex(1)`,
                0,
                40,
                `copyIndex(1)`
            );

            // new suite?
            createFormatTest(
                "otherwise always multiple lines",
                `concat('a', 'b')`,
                0,
                16,
                `concat(
    'a',
    'b')`
            );

            createFormatTest(
                "too short for max",
                `concat('a', 'b')`,
                0,
                15,
                `concat(
    'a',
    'b')`
            );

            createFormatTest(
                "full indent",
                `concat('a', 'b')`,
                0,
                15,
                `concat(
    'a',
    'b')`
            );

            createFormatTest(
                "full indent, nested params/vars",
                `concat(variables('a'), parameters('b'))`,
                0,
                0,
                `concat(
    variables('a'),
    parameters('b'))`
            );

            createFormatTest(
                "full indent, nested params/vars",
                `concat(variables('a'), parameters('b'))`,
                0,
                15,
                `concat(
    variables('a'),
    parameters('b'))`
            );

            createFormatTest(
                "full indent, nested params/vars, too few args",
                `concat(variables(), parameters())`,
                0,
                15,
                `concat(
    variables(),
    parameters())`
            );

            createFormatTest(
                "full indent, nested params, too many args",
                `concat(variables('a'), parameters('b', 'c'))`,
                0,
                15,
                `concat(
    variables('a'),
    parameters(
        'b',
        'c'))`
            );

            createFormatTest(
                "one nested func",
                `concat(concat('a'))`,
                0,
                100,
                `concat(
    concat(
        'a'))`
            );

        });

        createFormatTest(
            "other funcs always multiple lines",
            `concat('a', 'b')`,
            0,
            16,
            `concat(
    'a',
    'b')`
        );

        suite("array access", () => {
            createFormatTest(
                "simple int index",
                `variables('a')[0]`,
                0,
                16,
                `variables('a')[0]`
            );

            createFormatTest(
                "simple string index",
                `variables('a')['b']`,
                0,
                16,
                `variables('a')['b']`
            );

            createFormatTest(
                "no index",
                `variables('a')[]`,
                0,
                16,
                `variables('a')[]`
            );

            createFormatTest(
                "consecutive", //asdf repeat with non-literal args
                `variables('a')[0]['a']`,
                0,
                16,
                `variables('a')[0]['a']`
            );

            createFormatTest(
                "non-literal index",
                `variables('a')[variables('b')]`,
                0,
                16,
                `variables('a')[
    variables('b')]`
            );

            createFormatTest(
                "nested literal index",
                `variables('a')[variables('b')[0]]`,
                0,
                16,
                `variables('a')[
    variables('b')[0]]`,
            );

            createFormatTest(
                "nested non-literal index",
                `variables('a')[variables('b')[concat('c', 'd')]]`,
                0,
                16,
                `variables('a')[
    variables('b')[
        concat(
            'c',
            'd')]]`,
            );

            createFormatTest(
                "",
                `udf1.array('a', 'b')[0]`,
                0,
                16,
                `udf1.array(
    'a',
    'b')[0]` //asdf ?
            );

        });

        suite("real examples", () => {
            createFormatTest(
                '',
                `resourceId('Microsoft.Network/networkInterfaces', concat(variables('sourceNicName')))`,
                0,
                100,
                `resourceId(
    'Microsoft.Network/networkInterfaces',
    concat(
        variables('sourceNicName')))`
            );

            createFormatTest(
                '',
                `reference(variables('storageAccountName'), '2017-10-01').primaryEndpoints['blob']`,
                0,
                100,
                `reference(
    variables('storageAccountName'),
    '2017-10-01').primaryEndpoints['blob']`
            );

            createFormatTest(
                '',
                `concat('Microsoft.Compute/virtualMachines/', concat(variables('sourceServerName'),'/extensions/SqlIaasExtension'))`,
                0,
                100,
                `concat(
    'Microsoft.Compute/virtualMachines/',
    concat(
        variables('sourceServerName'),
        '/extensions/SqlIaasExtension'))`
            );
        });

        createFormatTest(
            '',
            `concat('powershell -ExecutionPolicy Unrestricted -File ', './', variables('scriptLocation'), ' ', variables('scriptParameters'))`,
            0,
            100,
            `concat(
    'powershell -ExecutionPolicy Unrestricted -File ',
    './',
    variables('scriptLocation'),
    ' ',
    variables('scriptParameters'))`
        );

        createFormatTest(
            '',
            `concat(variables('highProcessorUtilization_Name'),'_',parameters('locations')[copyIndex(concat(variables('highProcessorUtilization_Name'),'_Copy'))])`,
            0,
            100,
            `concat(
    variables('highProcessorUtilization_Name'),
    '_',
    parameters('locations')[
        copyIndex(
            concat(
                variables('highProcessorUtilization_Name'),
                '_Copy'))])`
        );

        createFormatTest(
            '',
            `if(parameters('createPublicIP'), variables('publicIpAddressId'), json('null'))`,
            0,
            100,
            `if(
                parameters('createPublicIP'),
                variables('publicIpAddressId'),
                json('null'))`
        );

        createFormatTest(
            'asdf',
            "resourceId('Microsoft.Network/virtualHubs/hubVirtualNetworkConnections', split(format('{0}/{1}_connection', variables('virtual_hub_cfg').name, variables('vnet_shared_services_cfg').name), '/')[0], split(format('{0}/{1}_connection', variables('virtual_hub_cfg').name, variables('vnet_shared_services_cfg').name), '/')[1])",
            0, 100,
            `resourceId(
    'Microsoft.Network/virtualHubs/hubVirtualNetworkConnections',
    split(
        format(
            '{0}/{1}_connection',
            variables('virtual_hub_cfg').name,
            variables('vnet_shared_services_cfg').name),
        '/')[0],
    split(
        format(
            '{0}/{1}_connection',
            variables('virtual_hub_cfg').name,
            variables('vnet_shared_services_cfg').name),
        '/')[1])`);

        //asdf "[parameters('locations')[copyIndex('CounterName')]]"
        //asdf "[concat('availabilitySet_',parameters('locations')[copyIndex(0)])]"
        //asdf  "[resourceId('Microsoft.Compute/availabilitySets',concat('availabilitySet_',parameters('locations')[copyIndex()]))]"
        //asdf "[if(not(empty(parameters('intLbBackEndPool'))),if(not(empty(parameters('pubLbBackEndPool'))),variables('pubIntlbPool'),variables('intlbPool')),json('null'))]"
        //ASDF  "[if(contains(parameters('vmName'),'dc'),if(equals(copyIndex(1),1),parameters('firstDcIP'),json('null')),json('null'))]"
        // asdf "[format('{0}/hubVirtualNetworkConnections/{1}_connection', resourceId('Microsoft.Network/virtualHubs', variables('virtual_hub_cfg').name), variables('vnet_shared_services_cfg').name)]"

        /*
        {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "locations": {
            "type": "array",
            "defaultValue": [
                "eastus",
                "eastus2"
            ]
        }
    },
    "variables": {
        "copy": [
            {
                "name": "CounterName",
                "count": "[length(parameters('locations'))]",
                "Input": "[parameters('locations')[copyIndex('CounterName')]]"
            }
        ]
    },
    "resources": [
        {
            "name": "[concat('availabilitySet_',parameters('locations')[copyIndex(0)])]",
            "type": "Microsoft.Compute/availabilitySets",
            "apiVersion": "2019-07-01",
            "location": "[resourceGroup().location]",
            "copy" : {
                "name" : "ASCopy",
                "count" : "[length(parameters('locations'))]"
            },
            "properties": {

            }
        }

    ],
    "outputs": {
        "output1": {
            "type": "array",
            "value": "[variables('CounterName')]"
        },
        "output2": {
            "type": "int",
            "value": "[length(variables('CounterName'))]"
        },
         "LocationsOutput": {
            "type": "array",
            "copy": {
                "count": "[length(parameters('locations'))]",
                "input": "[variables('CounterName')[copyIndex()]]"
            }
        },
        "MyAvailabilitysets": {
            "type": "array",
            "copy": {
                "count": "[length(parameters('locations'))]",
                "input": "[resourceId('Microsoft.Compute/availabilitySets',concat('availabilitySet_',parameters('locations')[copyIndex()]))]"
            }
        }
    }
}*/
    });

});
