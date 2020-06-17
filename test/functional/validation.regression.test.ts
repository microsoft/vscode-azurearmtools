// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:object-literal-key-quotes no-http-string max-func-body-length

import { diagnosticSources, testDiagnostics, testDiagnosticsFromFile } from "../support/diagnostics";
import { testWithLanguageServer, testWithLanguageServerAndRealFunctionMetadata } from "../support/testWithLanguageServer";

suite("Validation regression tests", () => {
    testWithLanguageServer("Template validation error for evaluated variables (https://github.com/microsoft/vscode-azurearmtools/issues/380)", async () =>
        await testDiagnostics(
            {
                "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                "contentVersion": "1.0.0.0",
                "parameters": {
                    "Environment": {
                        "type": "string",
                        "metadata": {
                            "description": "Name of the Environment"
                        }
                    }
                },
                "variables": {
                    "PRD": {
                        "WebPorts": [
                            "8510",
                            "8520",
                            "8530",
                            "8540",
                            "8550",
                            "8560"
                        ]
                    },
                    "TST": {
                        "WebPorts": [
                            "8010",
                            "8020",
                            "8030",
                            "8040",
                            "8050",
                            "8060",
                            "8510",
                            "8520",
                            "8530",
                            "8540",
                            "8550",
                            "8560"
                        ]
                    },
                    "NSGRules": {
                        "WEBNSGRule": [
                            {
                                "name": "[concat('Allow-In-',variables(parameters('Environment')).WebPort[1],'-To-Web')]",
                                "properties": {
                                    "access": "Allow",
                                    "direction": "Inbound",
                                    "priority": 101,
                                    "protocol": "*",
                                    "sourcePortRange": "*",
                                    "sourceAddressPrefix": "VirtualNetwork",
                                    "destinationAddressPrefix": "VirtualNetwork",
                                    "destinationPortRange": "[variables(parameters('Environment')).WebPort[1]]"
                                }
                            }
                        ]
                    }
                },
                "resources": []
            },
            {
            },
            [
                // Expected No validation errors

                // Unrelated errors:
                "Warning: The variable 'PRD' is never used. (arm-template (expressions))",
                "Warning: The variable 'TST' is never used. (arm-template (expressions))",
                "Warning: The variable 'NSGRules' is never used. (arm-template (expressions))"])
    );

    testWithLanguageServerAndRealFunctionMetadata(
        'validation fails using int() with parameter (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016832)',
        async () =>
            testDiagnosticsFromFile(
                'templates/portal/new-vmscaleset1.json',
                {
                    includeRange: true
                },
                [
                    // Expected no backend validation errors

                    // Unrelated errors:

                    // tslint:disable-next-line: no-suspicious-comment
                    // TODO: https://github.com/microsoft/vscode-azurearmtools/issues/673
                    "Error: Expected a comma (','). (arm-template (expressions))",

                    // Expected schema errors:
                    `Warning: Value must be one of the following types: boolean (arm-template (schema))`
                ]
            )
    );

    testWithLanguageServer(
        'Validation error if you have a parameter of type "object" [regression from 0.7.0] (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016824)',
        async () =>
            testDiagnostics(
                {
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "backupPolicyName": {
                            "type": "object"
                        },
                        "s": {
                            "type": "string"
                        },
                        "ss": {
                            "type": "securestring"
                        },
                        "i": {
                            "type": "int"
                        },
                        "b": {
                            "type": "bool"
                        },
                        "so": {
                            "type": "secureobject"
                        },
                        "a": {
                            "type": "array"
                        }
                    },
                    "resources": [
                    ],
                    "outputs": {
                        "oo": {
                            "type": "object",
                            "value": "[parameters('backupPolicyName')]"
                        },
                        "os": {
                            "type": "string",
                            "value": "[parameters('s')]"
                        },
                        "oss": {
                            "type": "securestring",
                            "value": "[parameters('ss')]"
                        }
                        ,
                        "oi": {
                            "type": "int",
                            "value": "[parameters('i')]"
                        }
                        ,
                        "b": {
                            "type": "bool",
                            "value": "[parameters('b')]"
                        },
                        "oso": {
                            "type": "secureObject",
                            "value": "[parameters('so')]"
                        },
                        "oa": {
                            "type": "array",
                            "value": "[parameters('a')]"
                        }
                    }
                },
                {},
                []
            )
    );

    testWithLanguageServer(
        'Validation error if you have a parameter of type "object" [regression from 0.7.0] (https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1016824)',
        async () =>
            testDiagnostics(
                {
                    "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "builtInRoleType": {
                            "type": "string",
                            "allowedValues": [
                                "Owner",
                                "Contributor",
                                "Reader"
                            ],
                            "maxLength": 10,
                            "minLength": 9
                        }
                    },
                    "resources": [
                    ],
                    "outputs": {
                        "o": {
                            "type": "string",
                            "value": "[parameters('builtInRoleType')]"
                        }
                    }
                },
                {},
                []));
    testWithLanguageServerAndRealFunctionMetadata(
        "https://github.com/microsoft/vscode-azurearmtools/issues/672 - shouldn't cause hang",
        async () => {
            await testDiagnostics(
                {
                    "contentVersion": "1.0.0.0",
                    "parameters": {
                        "workbookDisplayName": {
                            "type": "string",
                            "defaultValue": "VM CPU Usage",
                            "metadata": {
                                "description": "The friendly name for the workbook that is used in the Gallery or Saved List.  This name must be unique within a resource group."
                            }
                        },
                        "workbookType": {
                            "type": "string",
                            "defaultValue": "workbook",
                            "metadata": {
                                "description": "The gallery that the workbook will been shown under. Supported values include workbook, tsg, etc. Usually, this is 'workbook'"
                            }
                        },
                        "workbookSourceId": {
                            "type": "string",
                            "defaultValue": "azure monitor",
                            "metadata": {
                                "description": "The id of resource instance to which the workbook will be associated"
                            }
                        },
                        "workbookId": {
                            "type": "string",
                            "defaultValue": "[newGuid()]",
                            "metadata": {
                                "description": "The unique guid for this workbook instance"
                            }
                        }
                    },
                    "resources": [
                        {
                            "name": "[parameters('workbookId')]",
                            "type": "microsoft.insights/workbooks",
                            "location": "[resourceGroup().location]",
                            "apiVersion": "2018-06-17-preview",
                            "dependsOn": [],
                            "kind": "shared",
                            "properties": {
                                "displayName": "[parameters('workbookDisplayName')]",
                                "serializedData": "{\"version\":\"Notebook/1.0\",\"items\":[{\"type\":9,\"content\":{\"version\":\"KqlParameterItem/1.0\",\"crossComponentResources\":[\"{Subscription}\"],\"parameters\":[{\"id\":\"1ca69445-60fc-4806-b43d-ac7e6aad630a\",\"version\":\"KqlParameterItem/1.0\",\"name\":\"Subscription\",\"type\":6,\"isRequired\":true,\"multiSelect\":true,\"quote\":\"'\",\"delimiter\":\",\",\"query\":\"where type =~ 'microsoft.compute/virtualmachines'\\r\\n\\t| summarize Count = count() by subscriptionId\\r\\n\\t| order by Count desc\\r\\n\\t| extend Rank = row_number()\\r\\n\\t| project value = subscriptionId, label = subscriptionId, selected = Rank == 1\",\"crossComponentResources\":[\"value::all\"],\"typeSettings\":{\"additionalResourceOptions\":[],\"showDefault\":false},\"queryType\":1,\"resourceType\":\"microsoft.resourcegraph/resources\",\"value\":[\"/subscriptions/dc7268a4-ce20-41df-abd3-1b2a6ccfae95\"]},{\"id\":\"e94aafa3-c5d9-4523-89f0-4e87aa754511\",\"version\":\"KqlParameterItem/1.0\",\"name\":\"VirtualMachines\",\"label\":\"Virtual Machines\",\"type\":5,\"isRequired\":true,\"multiSelect\":true,\"quote\":\"'\",\"delimiter\":\",\",\"query\":\"where type =~ 'microsoft.compute/virtualmachines'\\n\\t| order by name asc\\n\\t| extend Rank = row_number()\\n\\t| project value = id, label = id, selected = Rank <= 25\",\"crossComponentResources\":[\"{Subscription}\"],\"typeSettings\":{\"resourceTypeFilter\":{\"microsoft.compute/virtualmachines\":true},\"additionalResourceOptions\":[\"value::all\"],\"showDefault\":false},\"queryType\":1,\"resourceType\":\"microsoft.resourcegraph/resources\",\"value\":[\"value::all\"]},{\"id\":\"c4b69c01-2263-4ada-8d9c-43433b739ff3\",\"version\":\"KqlParameterItem/1.0\",\"name\":\"TimeRange\",\"type\":4,\"typeSettings\":{\"selectableValues\":[{\"durationMs\":300000,\"createdTime\":\"2018-08-06T23:52:38.870Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":900000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":1800000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":3600000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":14400000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":43200000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":86400000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":172800000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":259200000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false},{\"durationMs\":604800000,\"createdTime\":\"2018-08-06T23:52:38.871Z\",\"isInitialTime\":false,\"grain\":1,\"useDashboardTimeRange\":false}],\"allowCustom\":null},\"value\":{\"durationMs\":604800000},\"label\":\"Time Range\",\"resourceType\":\"microsoft.insights/components\"},{\"id\":\"83eda9a9-8850-4fce-ad6b-aeb230f6471c\",\"version\":\"KqlParameterItem/1.0\",\"name\":\"Message\",\"type\":1,\"query\":\"where type == 'microsoft.compute/virtualmachines' \\r\\n| summarize Selected = countif(id in ({VirtualMachines:value})), Total = count()\\r\\n| extend Selected = iff(Selected > 200, 200, Selected)\\r\\n| project Message = strcat('# ', Selected, ' / ', Total)\",\"crossComponentResources\":[\"{Subscription}\"],\"isHiddenWhenLocked\":true,\"queryType\":1,\"resourceType\":\"microsoft.resourcegraph/resources\"}],\"style\":\"above\",\"queryType\":1,\"resourceType\":\"microsoft.resourcegraph/resources\"},\"name\":\"parameters - 1\"},{\"type\":1,\"content\":{\"json\":\"{Message}\\r\\n_Virtual machines_\"},\"name\":\"text - 5\",\"styleSettings\":{\"margin\":\"20px 0 20px 0\"}},{\"type\":10,\"content\":{\"chartId\":\"workbookdb19a8d8-91af-44ea-951d-5ffa133b2ebe\",\"version\":\"MetricsItem/2.0\",\"size\":4,\"chartType\":0,\"metricScope\":0,\"resourceIds\":[\"{VirtualMachines}\"],\"timeContext\":{\"durationMs\":0},\"timeContextFromParameter\":\"TimeRange\",\"resourceType\":\"microsoft.compute/virtualmachines\",\"resourceParameter\":\"VirtualMachines\",\"metrics\":[{\"namespace\":\"microsoft.compute/virtualmachines\",\"metric\":\"microsoft.compute/virtualmachines--Percentage CPU\",\"aggregation\":4}],\"gridSettings\":{\"formatters\":[{\"columnMatch\":\"microsoft.compute/virtualmachines--Percentage CPU\",\"formatter\":1,\"numberFormat\":{\"unit\":1,\"options\":null}},{\"columnMatch\":\"Subscription\",\"formatter\":5},{\"columnMatch\":\"Name\",\"formatter\":13,\"formatOptions\":{\"linkTarget\":\"Resource\"}}],\"rowLimit\":10000,\"labelSettings\":[{\"columnId\":\"microsoft.compute/virtualmachines--Percentage CPU\",\"label\":\"Percentage CPU (Average)\"},{\"columnId\":\"microsoft.compute/virtualmachines--Percentage CPU Timeline\",\"label\":\"Percentage CPU Timeline\"}]},\"sortBy\":[]},\"conditionalVisibility\":{\"parameterName\":\"1\",\"comparison\":\"isEqualTo\",\"value\":\"2\"},\"name\":\"CPU data\"},{\"type\":3,\"content\":{\"version\":\"KqlItem/1.0\",\"query\":\"{\\\"version\\\":\\\"Merge/1.0\\\",\\\"merges\\\":[{\\\"id\\\":\\\"4e6b78ae-e9b4-4fd7-8162-3665f7d44b76\\\",\\\"mergeType\\\":\\\"table\\\",\\\"leftTable\\\":\\\"CPU data\\\"}],\\\"projectRename\\\":[{\\\"originalName\\\":\\\"[CPU data].Subscription\\\",\\\"mergedName\\\":\\\"Subscription\\\"},{\\\"originalName\\\":\\\"[CPU data].Name\\\",\\\"mergedName\\\":\\\"Name\\\"},{\\\"originalName\\\":\\\"[CPU data].microsoft.compute/virtualmachines--Percentage CPU\\\",\\\"mergedName\\\":\\\"Percentage CPU (Average)\\\",\\\"fromId\\\":\\\"unknown\\\"},{\\\"originalName\\\":\\\"[CPU data].microsoft.compute/virtualmachines--Percentage CPU Timeline\\\",\\\"mergedName\\\":\\\"Percentage CPU Timeline\\\",\\\"fromId\\\":\\\"unknown\\\"},{\\\"originalName\\\":\\\"[Added column]\\\",\\\"mergedName\\\":\\\"Text\\\",\\\"fromId\\\":null,\\\"isNewItem\\\":true,\\\"newItemData\\\":[{\\\"condition\\\":\\\"Percentage CPU (Average) is empty  Result is -\\\",\\\"newColumnContext\\\":{\\\"leftColumn\\\":\\\"Percentage CPU (Average)\\\",\\\"operator\\\":\\\"is Empty\\\",\\\"rightValType\\\":\\\"column\\\",\\\"resultValType\\\":\\\"static\\\",\\\"resultVal\\\":\\\"-\\\"}},{\\\"condition\\\":\\\"Default\\\",\\\"newColumnContext\\\":{\\\"operator\\\":\\\"Default\\\",\\\"rightValType\\\":\\\"column\\\",\\\"resultValType\\\":\\\"column\\\",\\\"resultVal\\\":\\\"Percentage CPU (Average)\\\"}}]},{\\\"originalName\\\":\\\"[Added column]\\\",\\\"mergedName\\\":\\\"Value\\\",\\\"fromId\\\":null,\\\"isNewItem\\\":true,\\\"newItemData\\\":[{\\\"condition\\\":\\\"Percentage CPU (Average) is empty  Result is 0\\\",\\\"newColumnContext\\\":{\\\"leftColumn\\\":\\\"Percentage CPU (Average)\\\",\\\"operator\\\":\\\"is Empty\\\",\\\"rightValType\\\":\\\"column\\\",\\\"resultValType\\\":\\\"static\\\",\\\"resultVal\\\":\\\"0\\\"}},{\\\"condition\\\":\\\"Default\\\",\\\"newColumnContext\\\":{\\\"operator\\\":\\\"Default\\\",\\\"rightValType\\\":\\\"column\\\",\\\"resultValType\\\":\\\"column\\\",\\\"resultVal\\\":\\\"Percentage CPU (Average)\\\"}}]},{\\\"originalName\\\":\\\"[CPU data].microsoft.compute/virtualmachines--Percentage CPU\\\"},{\\\"originalName\\\":\\\"[CPU data].microsoft.compute/virtualmachines--Percentage CPU Timeline\\\"},{\\\"originalName\\\":\\\"[CPU data].Percentage CPU (Average)\\\"},{\\\"originalName\\\":\\\"[CPU data].Percentage CPU Timeline\\\"}]}\",\"size\":2,\"title\":\"CPU usage\",\"queryType\":7,\"visualization\":\"graph\",\"graphSettings\":{\"type\":2,\"topContent\":{\"columnMatch\":\"Name\",\"formatter\":13,\"formatOptions\":{\"linkTarget\":\"Resource\",\"showIcon\":false}},\"centerContent\":{\"columnMatch\":\"Text\",\"formatter\":12,\"formatOptions\":{\"linkTarget\":\"WorkbookTemplate\",\"linkIsContextBlade\":true,\"showIcon\":true,\"workbookContext\":{\"componentIdSource\":\"column\",\"componentId\":\"Name\",\"resourceIdsSource\":\"column\",\"resourceIds\":\"Name\",\"templateIdSource\":\"static\",\"templateId\":\"Community-Workbooks/Virtual Machines/Virtual machine details\",\"typeSource\":\"static\",\"type\":\"workbook\",\"gallerySource\":\"static\",\"gallery\":\"microsoft.compute/virtualmachines\"}},\"numberFormat\":{\"unit\":1,\"options\":{\"style\":\"decimal\",\"maximumFractionDigits\":1}}},\"hivesContent\":{\"columnMatch\":\"Subscription\",\"formatter\":15,\"formatOptions\":{\"linkTarget\":null,\"showIcon\":true}},\"nodeIdField\":\"Name\",\"nodeSize\":null,\"staticNodeSize\":100,\"colorSettings\":{\"nodeColorField\":\"Value\",\"type\":4,\"heatmapPalette\":\"greenRed\",\"heatmapMin\":0,\"heatmapMax\":100},\"groupByField\":\"Subscription\",\"hivesMargin\":5}},\"name\":\"CPU heatmap merge control\"},{\"type\":1,\"content\":{\"json\":\"💡 _Click on the CPU usage metric in a cell to see more details about the virtual machine_\\r\\n<br />\"},\"name\":\"text - 4\"},{\"type\":1,\"content\":{\"json\":\"<br />\"},\"name\":\"text - 14\"}],\"isLocked\":false}",
                                "version": "1.0",
                                "sourceId": "[parameters('workbookSourceId')]",
                                "category": "[parameters('workbookType')]"
                            }
                        }
                    ],
                    "outputs": {
                        "workbookId": {
                            "type": "string",
                            "value": "[resourceId( 'microsoft.insights/workbooks', parameters('workbookId'))]"
                        }
                    },
                    "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#"
                },
                {
                    ignoreSources: [diagnosticSources.schema],
                },
                []
            );
        });
});
