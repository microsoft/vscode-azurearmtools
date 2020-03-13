// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from "assert";
import { DeploymentParameters, ParameterValueDefinition } from "../extension.bundle";

suite("DeploymentParameters", () => {
    //asdf
    // function findReferences(dt: DeploymentParameters, definitionKind: DefinitionKind, definitionName: string, scope: TemplateScope): ReferenceList {
    //     // tslint:disable-next-line: no-unnecessary-initializer
    //     let definition: INamedDefinition | undefined;

    //     // tslint:disable-next-line: switch-default
    //     switch (definitionKind) {
    //         case DefinitionKind.BuiltinFunction:
    //             break;
    //         case DefinitionKind.Namespace:
    //             break;
    //         case DefinitionKind.Parameter:
    //             definition = scope.getParameterDefinition(definitionName);
    //             break;
    //         case DefinitionKind.UserFunction:
    //             break;
    //         case DefinitionKind.Variable:
    //             definition = scope.getVariableDefinition(definitionName);
    //             break;
    //         default:
    //             assert.fail("Test scenario NYI");
    //     }

    //     if (!definition) {
    //         return new ReferenceList(definitionKind, []);
    //     }

    //     return dt.findReferences(definition!);
    // }

    suite("constructor(string)", () => {
        test("Empty stringValue", () => {
            const dt = new DeploymentParameters("", "id");
            assert.deepStrictEqual("", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("Non-JSON stringValue", () => {
            const dt = new DeploymentParameters("I'm not a JSON file", "id");
            assert.deepStrictEqual("I'm not a JSON file", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with number parameters definition", () => {
            const dt = new DeploymentParameters("{ 'parameters': 21 }", "id");
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with empty object parameters definition", () => {
            const dt = new DeploymentParameters("{ 'parameters': {} }", "id");
            assert.deepStrictEqual("{ 'parameters': {} }", dt.documentText);
            assert.deepStrictEqual("id", dt.documentId);
            assert.deepStrictEqual([], dt.parameterValues);
        });

        test("JSON stringValue with one parameter value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { 'value': 1 } } }", "id");
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.nameValue.toString(), "num");
            assert.deepStrictEqual(pd0.value?.toFriendlyString(), "1");
        });

        test("JSON stringValue with one parameter definition with null value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { 'value': null } } }", "id");
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value?.toFriendlyString(), "null");
        });

        test("JSON stringValue with one parameter definition with no value", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': { } } }", "id");
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value, undefined);
        });

        test("JSON stringValue with one parameter definition defined as a string", () => {
            const dt = new DeploymentParameters("{ 'parameters': { 'num': 'whoops' } } }", "id");
            const parameterValues: ParameterValueDefinition[] = dt.parameterValues;
            assert(parameterValues);
            assert.deepStrictEqual(parameterValues.length, 1);
            const pd0: ParameterValueDefinition = parameterValues[0];
            assert(pd0);
            assert.deepStrictEqual(pd0.value, undefined);
        });
    });

    //asdf
    // suite("findReferences(Reference.Type, string)", () => {
    //     test("with parameter type and no matching parameter definition", () => {
    //         const dt = new DeploymentParameters(`{ "parameters": { "pName": {} } }`, "id");
    //         const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "dontMatchMe", dt.topLevelScope);
    //         assert(list);
    //         assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
    //         assert.deepStrictEqual(list.spans, []);
    //     });

    //     test("with parameter type and matching parameter definition", () => {
    //         const dt = new DeploymentParameters(`{ "parameters": { "pName": {} } }`, "id");
    //         const list: ReferenceList = findReferences(dt, DefinitionKind.Parameter, "pName", dt.topLevelScope);
    //         assert(list);
    //         assert.deepStrictEqual(list.kind, DefinitionKind.Parameter);
    //         assert.deepStrictEqual(list.spans, [new Language.Span(19, 5)]);
    //     });

    //     test("with variable type and no matching variable definition", () => {
    //         const dt = new DeploymentParameters(`{ "variables": { "vName": {} } }`, "id");
    //         const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "dontMatchMe", dt.topLevelScope);
    //         assert(list);
    //         assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
    //         assert.deepStrictEqual(list.spans, []);
    //     });

    //     test("with variable type and matching variable definition", () => {
    //         const dt = new DeploymentParameters(`{ "variables": { "vName": {} } }`, "id");
    //         const list: ReferenceList = findReferences(dt, DefinitionKind.Variable, "vName", dt.topLevelScope);
    //         assert(list);
    //         assert.deepStrictEqual(list.kind, DefinitionKind.Variable);
    //         assert.deepStrictEqual(list.spans, [new Language.Span(18, 5)]);
    //     });

    // }); // findReferences

    //     let f = false;
    //     if (f) { //asdf
    //         suite("Incomplete JSON shouldn't cause crash", function (this: ISuiteCallbackContext): void {
    //             this.timeout(60000);

    //             async function exercisePositionContextAtEveryPointInTheDoc(json: string): Promise<void> {
    //                 await exercisePositionContextAtRandomPointsInTheDoc(json, json.length + 1); // length+1 so we include past the last character as a position
    //             }

    //             async function exercisePositionContextAtRandomPointsInTheDoc(json: string, numberOfIndicesToTest: number): Promise<void> {
    //                 if (numberOfIndicesToTest < 1) {
    //                     // Take it as a probability of doing a single sample
    //                     if (Math.random() > numberOfIndicesToTest) {
    //                         return;
    //                     }
    //                 }

    //                 for (let i = 0; i < numberOfIndicesToTest; ++i) {
    //                     let index = i;
    //                     if (numberOfIndicesToTest <= json.length) {
    //                         index = Math.floor(Math.random() * (json.length + 1)); // length+1 so we include past the last character as a position
    //                     }

    //                     // console.log(`Testing index ${index}`);
    //                     try {
    //                         // Just make sure nothing throws
    //                         let dp = new DeploymentParameters(json, "id");
    //                         let pc = dp.getContextFromDocumentCharacterIndex(index, undefined);
    //                         // pc.findReferences();
    //                         // pc.getSignatureHelp();
    //                         // pc.tleInfo;
    //                         pc.getReferenceSiteInfo();
    //                         pc.getHoverInfo();
    //                         pc.getCompletionItems();
    //                     } catch (err) {
    //                         throw new Error(`exercisePositionContextAtRandomPointsInTheDoc: Threw at index ${i}:\n${json.slice(i)}<***HERE***>${json.slice(i)}`);
    //                     }
    //                 }
    //             }

    //             const template: string =
    //                 `{
    //         "$schema": "http://schema.management.azure.com/schemas/2015-01-01/DeploymentParameters.json#",
    //         "contentVersion": "1.0.0.0",
    //         "parameters": {
    //             "location": { "type": "string" },
    //             "networkInterfaceName": {
    //                 "type": "string"
    //             },
    //         },
    //         "variables": {
    //             "vnetId": "[resourceId(resourceGroup().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
    //         },
    //         "resources": [
    //             {
    //                 "name": "[parameters('networkInterfaceName')]",
    //                 "type": "Microsoft.Network/networkInterfaces",
    //                 "apiVersion": "2018-10-01",
    //                 "location": "[parameters('location')]",
    //                 "dependsOn": [
    //                     "[concat('Microsoft.Network/networkSecurityGroups/', parameters('networkSecurityGroupName'))]",
    //                     "[concat('Microsoft.Network/virtualNetworks/', parameters('virtualNetworkName'))]",
    //                     "[concat('Microsoft.Network/publicIpAddresses/', parameters('publicIpAddressName'))]"
    //                 ],
    //                 "properties": {
    //                     "$test-commandToExecute": "[concat('cd /hub*/docker-compose; sudo docker-compose down -t 60; sudo -s source /set_hub_url.sh ', reference(parameters('publicIpName')).dnsSettings.fqdn, ';  sudo docker volume rm ''dockercompose_cert-volume''; sudo docker-compose up')]",
    //                     "ipConfigurations": [
    //                         {
    //                             "name": "ipconfig1",
    //                             "properties": {
    //                                 "subnet": {
    //                                     "id": "[variables('subnetRef')]"
    //                                 },
    //                                 "privateIPAllocationMethod": "Dynamic",
    //                                 "publicIpAddress": {
    //                                     "id": "[resourceId(resourceGroup().name, 'Microsoft.Network/publicIpAddresses', parameters('publicIpAddressName'))]"
    //                                 }
    //                             }
    //                         }
    //                     ]
    //                 },
    //                 "tags": {}
    //             }
    //         ],
    //         "outputs": {
    //             "adminUsername": {
    //                 "type": "string",
    //                 "value": "[parameters('adminUsername')]"
    //             }
    //         }
    //     }
    //     `;

    //             //     test("Malformed property name", async () => {
    //             //         const json = `
    //             // {
    //             //     "$schema": "http://schema.management.azure.com/schemas/2015-01-01/DeploymentParameters.json#",
    //             //     "contentVersion": "1.0.0.0",
    //             //     : {
    //             //         "nsgId": "something",
    //             //         "vnetId": "[resourceId(resourceGrou2p().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
    //             //         "subnetRef": "[concat(variables('vne2tId'), '/subnets/', parameters('subnetName'))]"
    //             //     }
    //             // }`;
    //             //         let dt = await parseTemplate(json);
    //             //         findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //         findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //         dt.getFunctionCounts();
    //             //     });

    //             //     test("Malformed property", async () => {
    //             //         const json = `
    //             // {
    //             //     "$schema": "http://schema.management.azure.com/schemas/2015-01-01/DeploymentParameters.json#",
    //             //     "contentVersion": "1.0.0.0",
    //             //     /*missing prop name and colon*/ {
    //             //         "nsgId": "something",
    //             //         "vnetId": "[resourceId(resourceGrou2p().name,'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
    //             //         "subnetRef": "[concat(variables('vne2tId'), '/subnets/', parameters('subnetName'))]"
    //             //     }
    //             // }`;
    //             //         let dt = await parseTemplate(json);
    //             //         findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //         findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //         dt.getFunctionCounts();
    //             //     });

    //             //     test("typing character by character", async function (this: ITestCallbackContext): Promise<void> {
    //             //         if (DISABLE_SLOW_TESTS) {
    //             //             this.skip();
    //             //             return;
    //             //         }

    //             //         // Just make sure nothing throws
    //             //         for (let i = 0; i < template.length; ++i) {
    //             //             let partialTemplate = template.slice(0, i);
    //             //             let dt = await parseTemplate(partialTemplate);
    //             //             findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //             findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //             dt.getFunctionCounts();

    //             //             await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
    //             //         }
    //             //     });

    //             //     test("typing backwards character by character", async function (this: ITestCallbackContext): Promise<void> {
    //             //         if (DISABLE_SLOW_TESTS) {
    //             //             this.skip();
    //             //             return;
    //             //         }

    //             //         // Just make sure nothing throws
    //             //         for (let i = 0; i < template.length; ++i) {
    //             //             let partialTemplate = template.slice(i);
    //             //             let dt = await parseTemplate(partialTemplate);
    //             //             findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //             findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //             dt.getFunctionCounts();

    //             //             await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
    //             //         }
    //             //     });

    //             //     test("try parsing the document with a single character deleted (repeat through the whole document)", async function (this: ITestCallbackContext): Promise<void> {
    //             //         if (DISABLE_SLOW_TESTS) {
    //             //             this.skip();
    //             //             return;
    //             //         }

    //             //         // Just make sure nothing throws
    //             //         for (let i = 0; i < template.length; ++i) {
    //             //             // Remove the single character at position i
    //             //             let partialTemplate = template.slice(0, i) + template.slice(i + 1);
    //             //             let dt = await parseTemplate(partialTemplate);
    //             //             findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //             findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //             dt.getFunctionCounts();

    //             //             await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
    //             //         }
    //             //     });

    //             //     test("exercise PositionContext at every point in the full json", async function (this: ITestCallbackContext): Promise<void> {
    //             //         if (DISABLE_SLOW_TESTS) {
    //             //             this.skip();
    //             //             return;
    //             //         }

    //             //         // Just make sure nothing throws
    //             //         await exercisePositionContextAtEveryPointInTheDoc(template);
    //             //     });

    //             //     test("Random modifications", async function (this: ITestCallbackContext): Promise<void> {
    //             //         if (DISABLE_SLOW_TESTS) {
    //             //             this.skip();
    //             //             return;
    //             //         }

    //             //         // Just make sure nothing throws
    //             //         let modifiedTemplate: string = template;

    //             //         for (let i = 0; i < 1000; ++i) {
    //             //             if (modifiedTemplate.length > 0 && Math.random() < 0.5) {
    //             //                 // Delete some characters
    //             //                 let position = Math.random() * (modifiedTemplate.length - 1);
    //             //                 let length = Math.random() * Math.max(5, modifiedTemplate.length);
    //             //                 modifiedTemplate = modifiedTemplate.slice(position, position + length);
    //             //             } else {
    //             //                 // Insert some characters
    //             //                 let position = Math.random() * modifiedTemplate.length;
    //             //                 let length = Math.random() * 5;
    //             //                 let s = randomBytes(length).toString();
    //             //                 modifiedTemplate = modifiedTemplate.slice(0, position) + s + modifiedTemplate.slice(position);
    //             //             }

    //             //             let dt = await parseTemplate(modifiedTemplate);
    //             //             findReferences(dt, DefinitionKind.Parameter, "adminUsername", dt.topLevelScope);
    //             //             findReferences(dt, DefinitionKind.Variable, "resourceGroup", dt.topLevelScope);
    //             //             dt.getFunctionCounts();

    //             //             await exercisePositionContextAtRandomPointsInTheDoc(template, 0.1);
    //             //         }
    //             //     });
    //             // }); //Incomplete JSON shouldn't cause crash

    //         });
    //     });
    // })

});
