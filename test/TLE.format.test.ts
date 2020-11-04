// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion

import * as assert from "assert";
import { TLE } from "../extension.bundle";

suite("TLE format", () => {

    function parseExpression(stringValue: string): TLE.TleParseResult {
        return TLE.Parser.parse(stringValue);
    }

    function createTleFormatTest(
        testName: string,
        unquotedValue: string,
        expected: string
    ): void {
        const quotedValue = `"[${unquotedValue}]"`;
        test(`${testName} (${unquotedValue})`, () => {
            const parseResult = parseExpression(quotedValue);
            assert.strictEqual(parseResult.errors.length, 0, "Expected no errors");
            const result = parseResult.expression?.format({ multiline: { tabSize: 4 } });
            assert.strictEqual(result, expected);
        });
    }

    suite("funcs with single literal arg - one line", () => {
        createTleFormatTest(
            "parameters, single line",
            `parameters('a')`,
            `parameters('a')`
        );

        createTleFormatTest(
            "variables, single line",
            `variables('a')`,
            `variables('a')`
        );

        createTleFormatTest(
            'single string arg',
            `json('null')`,
            `json('null')`
        );

        createTleFormatTest(
            'single number arg',
            `json(-1.23)`,
            `json(-1.23)`
        );

        createTleFormatTest(
            'no args',
            `json()`,
            `json()`
        );

        createTleFormatTest(
            'single literal arg, UDF',
            `udf1.json()`,
            `udf1.json()`
        );

        createTleFormatTest(
            '',
            `copyIndex(1)`,
            `copyIndex(1)`
        );

        createTleFormatTest(
            "otherwise always multiple lines",
            `concat('a', 'b')`,
            `concat(
    'a',
    'b')`
        );

        createTleFormatTest(
            "nested params/vars",
            `concat(variables('a'), parameters('b'))`,
            `concat(
    variables('a'),
    parameters('b'))`
        );

        createTleFormatTest(
            "nested params/vars, too few args",
            `concat(variables(), parameters())`,
            `concat(
    variables(),
    parameters())`
        );

        createTleFormatTest(
            "nested params, too many args",
            `concat(variables('a'), parameters('b', 'c'))`,
            `concat(
    variables('a'),
    parameters(
        'b',
        'c'))`
        );

        createTleFormatTest(
            "one nested func",
            `concat(concat('a'))`,
            `concat(
    concat('a'))`
        );

    });

    createTleFormatTest(
        "other funcs always multiple lines",
        `concat('a', 'b')`,
        `concat(
    'a',
    'b')`
    );

    suite("array access", () => {
        createTleFormatTest(
            "simple int index",
            `variables('a')[0]`,
            `variables('a')[0]`
        );

        createTleFormatTest(
            "simple string index",
            `variables('a')['b']`,
            `variables('a')['b']`
        );

        createTleFormatTest(
            "no index",
            `variables('a')[]`,
            `variables('a')[]`
        );

        createTleFormatTest(
            "consecutive",
            `variables('a')[0]['a']`,
            `variables('a')[0]['a']`
        );

        createTleFormatTest(
            "non-literal index",
            `variables('a')[variables('b')]`,
            `variables('a')[
    variables('b')]`
        );

        createTleFormatTest(
            "nested literal index",
            `variables('a')[variables('b')[0]]`,
            `variables('a')[
    variables('b')[0]]`,
        );

        createTleFormatTest(
            "nested non-literal index",
            `variables('a')[variables('b')[concat('c', 'd')]]`,
            `variables('a')[
    variables('b')[
        concat(
            'c',
            'd')]]`,
        );

        createTleFormatTest(
            "",
            `udf1.array('a', 'b')[0]`,
            `udf1.array(
    'a',
    'b')[0]`
        );

    });

    suite("real examples", () => {
        createTleFormatTest(
            '',
            `resourceId('Microsoft.Network/networkInterfaces', concat(variables('sourceNicName')))`,
            `resourceId(
    'Microsoft.Network/networkInterfaces',
    concat(
        variables('sourceNicName')))`
        );

        createTleFormatTest(
            '',
            `reference(variables('storageAccountName'), '2017-10-01').primaryEndpoints['blob']`,
            `reference(
    variables('storageAccountName'),
    '2017-10-01').primaryEndpoints['blob']`
        );

        createTleFormatTest(
            '',
            `concat('Microsoft.Compute/virtualMachines/', concat(variables('sourceServerName'),'/extensions/SqlIaasExtension'))`,
            `concat(
    'Microsoft.Compute/virtualMachines/',
    concat(
        variables('sourceServerName'),
        '/extensions/SqlIaasExtension'))`
        );
    });

    createTleFormatTest(
        '',
        `concat('powershell -ExecutionPolicy Unrestricted -File ', './', variables('scriptLocation'), ' ', variables('scriptParameters'))`,
        `concat(
    'powershell -ExecutionPolicy Unrestricted -File ',
    './',
    variables('scriptLocation'),
    ' ',
    variables('scriptParameters'))`
    );

    createTleFormatTest(
        '',
        `copyIndex(concat(variables('highProcessorUtilization_Name'),'_Copy'))`,
        `copyIndex(
    concat(
        variables('highProcessorUtilization_Name'),
        '_Copy'))`
    );

    createTleFormatTest(
        'func call with multiple args inside property index #1',
        `func()[add(1, 2)]`,
        `func()[
    add(
        1,
        2)]`
    );

    createTleFormatTest(
        'func call with multiple args inside property index #2',
        `concat(variables('highProcessorUtilization_Name'),'_',parameters('locations')[add(0, 1)])`,
        `concat(
    variables('highProcessorUtilization_Name'),
    '_',
    parameters('locations')[
        add(
            0,
            1)])`
    );

    createTleFormatTest(
        'func call with multiple args inside property index #3',
        `concat(variables('highProcessorUtilization_Name'),'_',parameters('locations')[copyIndex(concat(variables('highProcessorUtilization_Name'),'_Copy'))])`,
        `concat(
    variables('highProcessorUtilization_Name'),
    '_',
    parameters('locations')[
        copyIndex(
            concat(
                variables('highProcessorUtilization_Name'),
                '_Copy'))])`
    );

    createTleFormatTest(
        '',
        `if(parameters('createPublicIP'), variables('publicIpAddressId'), json('null'))`,
        `if(
    parameters('createPublicIP'),
    variables('publicIpAddressId'),
    json('null'))`
    );

    createTleFormatTest(
        '',
        "resourceId('Microsoft.Network/virtualHubs/hubVirtualNetworkConnections', split(format('{0}/{1}_connection', variables('virtual_hub_cfg').name, variables('vnet_shared_services_cfg').name), '/')[0], split(format('{0}/{1}_connection', variables('virtual_hub_cfg').name, variables('vnet_shared_services_cfg').name), '/')[1])",
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
});
