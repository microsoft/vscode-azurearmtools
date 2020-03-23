// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-http-string no-suspicious-comment
// tslint:disable:no-non-null-assertion

// WARNING: At the breakpoint, the extension will be in an inactivate state (i.e., if you make changes in the editor, diagnostics,
//   formatting, etc. will not be updated until you F5 again)
const DEBUG_BREAK_AFTER_INSERTING_SNIPPET = false;

import * as assert from 'assert';
import * as fse from 'fs-extra';
import { ITestCallbackContext } from 'mocha';
import * as path from 'path';
import { commands, Diagnostic, Selection, Uri, window, workspace } from "vscode";
import { DeploymentTemplate, getVSCodePositionFromPosition } from '../../extension.bundle';
import { delay } from '../support/delay';
import { getDiagnosticsForDocument, sources, testFolder } from '../support/diagnostics';
import { getTempFilePath } from "../support/getTempFilePath";
import { testWithLanguageServer } from '../support/testWithLanguageServer';

let resourceTemplate: string = `{
    "resources": [
        // Insert here: resource
    ],
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "variables": {
        // Insert here: variable
    },
    "parameters": {
        // Insert here: parameter
    },
    "outputs": {
        // Insert here: output
    },
    "functions": [{
        "namespace": "udf",
        "members": {
            // Insert here: user function
        }
    }]
}`;

let emptyTemplate: string = `
// Insert here: empty
`;

//
// These provide some snippet-specific instructions that can't be handled by the general test logic
//

// Snippets marked with true will have their test skipped
const overrideSkipTests: { [name: string]: boolean } = {
    "Azure Resource Manager (ARM) Template": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573
    "Azure Resource Manager (ARM) Template Subscription": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573
    "Azure Resource Manager (ARM) Template Management Group": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573
    "Azure Resource Manager (ARM) Template Tenant": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573

    "Azure Resource Manager (ARM) Parameters Template": true, // TODO: Blocked by https://dev.azure.com/devdiv/DevDiv/_boards/board/t/ARM%20Template%20Authoring/Stories/?workitem=1005573

    "Tag Section": true // Needs comma for no errors, and not complicated, just ignore
};

// Override the template file text to start with before inserting the snippet - default is resourceTemplate
const overrideTemplateForSnippet: { [name: string]: string } = {
    // These are template file templates, so the starting file contents should be empty
    "Azure Resource Manager (ARM) Template": emptyTemplate,
    "Azure Resource Manager (ARM) Template Subscription": emptyTemplate,
    "Azure Resource Manager (ARM) Template Management Group": emptyTemplate,
    "Azure Resource Manager (ARM) Template Tenant": emptyTemplate,

    // This is the params file template, so the starting file contents should be empty
    "Azure Resource Manager (ARM) Parameters Template": emptyTemplate,

    "User Function Namespace": `{
        "resources": [],
        "$schema": "http://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "functions": [
            // Insert here: namespace
        ]
    }`
};

// Override where to insert the snippet during the test - default is to insert with the "Resources" section, at "Insert here: resource"
const overrideInsertPosition: { [name: string]: string } = {
    "Azure Resource Manager (ARM) Template": "// Insert here: empty",
    "Azure Resource Manager (ARM) Parameters Template": "// Insert here: empty",
    Variable: "// Insert here: variable",
    Parameter: "// Insert here: parameter",
    Output: "// Insert here: output",
    "User Function": "// Insert here: user function",
    "User Function Namespace": "// Insert here: namespace"
};

// Override expected errors/warnings for the snippet test - default is none
const overrideExpectedDiagnostics: { [name: string]: string[] } = {
    "Azure Resource Manager (ARM) Parameters Template":
        [
            "Template validation failed: Required property 'resources' not found in JSON. Path '', line 5, position 1."
            //"Missing required property resources"
        ],
    Variable: [
        "The variable 'variable1' is never used."
    ],
    Parameter: [
        "The parameter 'parameter1' is never used."
    ],
    "User Function": [
        "Template validation failed: The template function 'function-name' at line '19' and column '30' is not valid. The function name contains invalid characters '-'. Please see https://aka.ms/arm-template/#functions for usage details.",
        "The user-defined function 'udf.function-name' is never used.",
        "The parameter 'parameter-name' of function 'udf.function-name' is never used."
    ],
    "User Function Namespace": [
        "Template validation failed: The template function at line '7' and column '45' is not valid. The function namespace 'namespace-name' contains invalid characters '-'. Please see https://aka.ms/arm-template/#functions for usage details.",
        "The user-defined function 'namespace-name.function-name' is never used.",
        "The parameter 'parameter-name' of function 'namespace-name.function-name' is never used."
    ],
    "Automation Certificate": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationCertificate1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Credential": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationCredential' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '73' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Job Schedule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationJobSchedule1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Runbook": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationRunbook1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '70' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Schedule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationSchedule1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '71' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Automation Variable": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'automationVariable1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '71' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Cosmos DB Mongo Database": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'account-name/mongodb/database-name/collectionName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '4' and column '74' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "DNS Record": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'dnsRecord1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '50' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Network Security Group Rule": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'networkSecurityGroupRuleName' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '75' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Route Table Route": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'route-name' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '58' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "SQL Database Import": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'sqlDatabase1Import1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '64' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Web Deploy for Web App": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012620
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'Deploy-webApp1' for type 'Microsoft.WindowsAzure.ResourceStack.Frontdoor.Common.Entities.TemplateGenericProperty`1[System.String]' at line '5' and column '52' has incorrect segment lengths. A nested resource type must have identical number of segments as its resource name. A root resource type must have segment length one greater than its resource name. Please see https://aka.ms/arm-template/#resources for usage details."
    ],
    "Windows Virtual Machine": [
        // TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1012636
        // Full validation temporarily disabled, so we don't currently get this error
        // "Template validation failed: The template resource 'windowsVM1' at line '83' and column '9' is not valid: Unable to evaluate template language function 'resourceId': the type 'Microsoft.Storage/storageAccounts' requires '1' resource name argument(s). Please see https://aka.ms/arm-template-expressions/#resourceid for usage details.. Please see https://aka.ms/arm-template-expressions for usage details."
    ]
};

// Override whether to ignore schema validation - default is to perform schema validation - mark with "true" to ignore schema validation
// TODO: All items in this list indicate an error (either snippet or schema) and should eventually be removed
// TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/104239
// TODO: https://dev.azure.com/devdiv/DevDiv/_workitems/edit/1042393
const overrideIgnoreSchemaValidation: { [name: string]: boolean } = {
    /* TODO
     'Missing required property "kind"',
     'Value must be one of the following values: "2014-04-01"'
    */
    "Application Insights for Web Apps": true,

    /* TODO
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$'
    */
    "Automation Job Schedule": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must be a valid ISO 8601 datetime\r\n    string'
    */
    "Automation Schedule": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    object'
    */
    "Automation Module": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer'
    */
    "Azure Firewall": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must be one of the following values: "TCP", "UDP"\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    integer',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    number',
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    number'
    */
    "Container Group": true,

    /* TODO:
     +   'Value must be one of the following values: "2015-04-08"'
     */
    "Cosmos DB SQL Database": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB Mongo Database": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB Gremlin Database": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB Cassandra Namespace": true,

    /* TODO:
     +   'Value must be one of the following values: "2015-04-08"'
     */
    "Cosmos DB Cassandra Table": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB SQL Container": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB Gremlin Graph": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-04-08"'
    */
    "Cosmos DB Table Storage Table": true,

    /* TODO:
    +   'Value must be one of the following values: "2014-12-19-preview", "2015-06-01", "2016-10-01"'
    */
    KeyVault: true,

    /* TODO:
    +   'Value must be one of the following values: "2014-12-19-preview", "2015-06-01", "2016-10-01"'
    */
    "KeyVault Secret": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must be one of the following values: "Standard_A1", "Standard_A10", "Standard_A11", "Standard_A1_v2", "Standard_A2", "Standard_A2_v2", "Standard_A2m_v2", "Standard_A3", "Standard_A4", "Standard_A4_v2", "Standard_A4m_v2", "Standard_A5", "Standard_A6", "Standard_A7", "Standard_A8", "Standard_A8_v2", "Standard_A8m_v2", "Standard_A9", "Standard_B2ms", "Standard_B2s", "Standard_B4ms", "Standard_B8ms", "Standard_D1", "Standard_D11", "Standard_D11_v2", "Standard_D11_v2_Promo", "Standard_D12", "Standard_D12_v2", "Standard_D12_v2_Promo", "Standard_D13", "Standard_D13_v2", "Standard_D13_v2_Promo", "Standard_D14", "Standard_D14_v2", "Standard_D14_v2_Promo", "Standard_D15_v2", "Standard_D16_v3", "Standard_D16s_v3", "Standard_D1_v2", "Standard_D2", "Standard_D2_v2", "Standard_D2_v2_Promo", "Standard_D2_v3", "Standard_D2s_v3", "Standard_D3", "Standard_D32_v3", "Standard_D32s_v3", "Standard_D3_v2", "Standard_D3_v2_Promo", "Standard_D4", "Standard_D4_v2", "Standard_D4_v2_Promo", "Standard_D4_v3", "Standard_D4s_v3", "Standard_D5_v2", "Standard_D5_v2_Promo", "Standard_D64_v3", "Standard_D64s_v3", "Standard_D8_v3", "Standard_D8s_v3", "Standard_DS1", "Standard_DS11", "Standard_DS11_v2", "Standard_DS11_v2_Promo", "Standard_DS12", "Standard_DS12_v2", "Standard_DS12_v2_Promo", "Standard_DS13", "Standard_DS13-2_v2", "Standard_DS13-4_v2", "Standard_DS13_v2", "Standard_DS13_v2_Promo", "Standard_DS14", "Standard_DS14-4_v2", "Standard_DS14-8_v2", "Standard_DS14_v2", "Standard_DS14_v2_Promo", "Standard_DS15_v2", "Standard_DS1_v2", "Standard_DS2", "Standard_DS2_v2", "Standard_DS2_v2_Promo", "Standard_DS3", "Standard_DS3_v2", "Standard_DS3_v2_Promo", "Standard_DS4", "Standard_DS4_v2", "Standard_DS4_v2_Promo", "Standard_DS5_v2", "Standard_DS5_v2_Promo", "Standard_E16_v3", "Standard_E16s_v3", "Standard_E2_v3", "Standard_E2s_v3", "Standard_E32-16s_v3", "Standard_E32-8s_v3", "Standard_E32_v3", "Standard_E32s_v3", "Standard_E4_v3", "Standard_E4s_v3", "Standard_E64-16s_v3", "Standard_E64-32s_v3", "Standard_E64_v3", "Standard_E64s_v3", "Standard_E8_v3", "Standard_E8s_v3", "Standard_F1", "Standard_F16", "Standard_F16s", "Standard_F16s_v2", "Standard_F1s", "Standard_F2", "Standard_F2s", "Standard_F2s_v2", "Standard_F32s_v2", "Standard_F4", "Standard_F4s", "Standard_F4s_v2", "Standard_F64s_v2", "Standard_F72s_v2", "Standard_F8", "Standard_F8s", "Standard_F8s_v2", "Standard_G1", "Standard_G2", "Standard_G3", "Standard_G4", "Standard_G5", "Standard_GS1", "Standard_GS2", "Standard_GS3", "Standard_GS4", "Standard_GS4-4", "Standard_GS4-8", "Standard_GS5", "Standard_GS5-16", "Standard_GS5-8", "Standard_H16", "Standard_H16m", "Standard_H16mr", "Standard_H16r", "Standard_H8", "Standard_H8m", "Standard_L16s", "Standard_L32s", "Standard_L4s", "Standard_L8s", "Standard_M128-32ms", "Standard_M128-64ms", "Standard_M128ms", "Standard_M128s", "Standard_M64-16ms", "Standard_M64-32ms", "Standard_M64ms", "Standard_M64s", "Standard_NC12", "Standard_NC12s_v2", "Standard_NC12s_v3", "Standard_NC24", "Standard_NC24r", "Standard_NC24rs_v2", "Standard_NC24rs_v3", "Standard_NC24s_v2", "Standard_NC24s_v3", "Standard_NC6", "Standard_NC6s_v2", "Standard_NC6s_v3", "Standard_ND12s", "Standard_ND24rs", "Standard_ND24s", "Standard_ND6s", "Standard_NV12", "Standard_NV24", "Standard_NV6"\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$'
    */
    "Kubernetes Service Cluster": true,

    /* TODO:
     +   'Missing required property "protectedSettings"'
     */
    "Linux VM Custom Script": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^[a-z0-9]{3,26}$\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$'
    */
    "Media Services": true,

    /* TODO:
    +   'Value must be one of the following values: "Microsoft.HealthcareApis/services", "Microsoft.AppConfiguration/configurationStores", "Microsoft.Genomics/accounts", "Microsoft.Network/frontDoors", "Microsoft.Network/FrontDoorWebApplicationFirewallPolicies", "Microsoft.Cache/Redis", "Microsoft.Cache/Redis/firewallRules", "Microsoft.Cache/Redis/linkedServers", "Microsoft.Cache/Redis/patchSchedules", "Microsoft.Search/searchServices", "Microsoft.AnalysisServices/servers", "Microsoft.RecoveryServices/vaults", "Microsoft.RecoveryServices/vaults/certificates", "Microsoft.RecoveryServices/vaults/extendedInformation", "Microsoft.DocumentDB/databaseAccounts", "Microsoft.DocumentDB/databaseAccounts/apis/databases", "Microsoft.DocumentDB/databaseAccounts/apis/databases/collections", "Microsoft.DocumentDB/databaseAccounts/apis/databases/containers", "Microsoft.DocumentDB/databaseAccounts/apis/databases/graphs", "Microsoft.DocumentDB/databaseAccounts/apis/keyspaces", "Microsoft.DocumentDB/databaseAccounts/apis/keyspaces/tables", "Microsoft.DocumentDB/databaseAccounts/apis/tables", "Microsoft.KeyVault/vaults/secrets", "Microsoft.DevTestLab/labs", "Microsoft.DevTestLab/labs/artifactsources", "Microsoft.DevTestLab/labs/customimages", "Microsoft.DevTestLab/labs/formulas", "Microsoft.DevTestLab/labs/policysets/policies", "Microsoft.DevTestLab/labs/schedules", "Microsoft.DevTestLab/labs/virtualmachines", "Microsoft.DevTestLab/labs/virtualnetworks", "Microsoft.RecoveryServices/vaults/replicationAlertSettings", "Microsoft.RecoveryServices/vaults/replicationFabrics", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationNetworks/replicationNetworkMappings", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationProtectionContainers", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationProtectionContainers/replicationMigrationItems", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationProtectionContainers/replicationProtectedItems", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationProtectionContainers/replicationProtectionContainerMappings", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationRecoveryServicesProviders", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationStorageClassifications/replicationStorageClassificationMappings", "Microsoft.RecoveryServices/vaults/replicationFabrics/replicationvCenters", "Microsoft.RecoveryServices/vaults/replicationPolicies", "Microsoft.RecoveryServices/vaults/replicationRecoveryPlans", "Microsoft.Web/certificates", "Microsoft.Web/serverfarms", "Microsoft.DomainRegistration/domains", "Microsoft.DomainRegistration/domains/domainOwnershipIdentifiers", "Microsoft.CertificateRegistration/certificateOrders", "Microsoft.CertificateRegistration/certificateOrders/certificates", "Microsoft.Web/csrs", "Microsoft.Web/sites", "Microsoft.Web/sites/config", "Microsoft.Web/sites/deployments", "Microsoft.Web/sites/domainOwnershipIdentifiers", "Microsoft.Web/sites/hostNameBindings", "Microsoft.Web/sites/hybridconnection", "Microsoft.Web/sites/hybridConnectionNamespaces/relays", "Microsoft.Web/sites/instances/deployments", "Microsoft.Web/sites/premieraddons", "Microsoft.Web/sites/publiccertificates", "Microsoft.Web/sites/slots", "Microsoft.Web/sites/slots/config", "Microsoft.Web/sites/slots/deployments", "Microsoft.Web/sites/slots/domainOwnershipIdentifiers", "Microsoft.Web/sites/slots/hostNameBindings", "Microsoft.Web/sites/slots/hybridconnection", "Microsoft.Web/sites/slots/hybridConnectionNamespaces/relays", "Microsoft.Web/sites/slots/instances/deployments", "Microsoft.Web/sites/slots/premieraddons", "Microsoft.Web/sites/slots/publiccertificates", "Microsoft.Web/sites/slots/virtualNetworkConnections", "Microsoft.Web/sites/slots/virtualNetworkConnections/gateways", "Microsoft.Web/sites/sourcecontrols", "Microsoft.Web/sites/slots/sourcecontrols", "Microsoft.Web/sites/virtualNetworkConnections", "Microsoft.Web/sites/virtualNetworkConnections/gateways", "Microsoft.Web/hostingEnvironments", "Microsoft.Web/hostingEnvironments/workerPools", "Microsoft.Web/hostingEnvironments/multiRolePools", "Microsoft.Web/serverfarms/virtualNetworkConnections/gateways", "Microsoft.Web/serverfarms/virtualNetworkConnections/routes", "Microsoft.Kusto/clusters", "Microsoft.Kusto/clusters/databases", "Microsoft.Kusto/clusters/databases/dataconnections", "Microsoft.Kusto/clusters/AttachedDatabaseConfigurations", "Microsoft.Insights/alertrules", "Microsoft.Insights/components", "Microsoft.Insights/autoscalesettings", "Microsoft.Insights/webtests", "microsoft.visualstudio/account", "Microsoft.NotificationHubs/namespaces/notificationHubs", "Microsoft.NotificationHubs/namespaces/NotificationHubs/authorizationRules", "Microsoft.Network/trafficManagerProfiles", "Microsoft.Storage/storageAccounts", "Microsoft.Storage/storageAccounts/blobServices/containers", "Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies", "Microsoft.Storage/storageAccounts/managementPolicies", "Microsoft.Storage/storageAccounts/blobServices", "Microsoft.VMwareCloudSimple/dedicatedCloudNodes", "Microsoft.VMwareCloudSimple/dedicatedCloudServices", "Microsoft.VMwareCloudSimple/virtualMachines", "Microsoft.Compute/availabilitySets", "Microsoft.Compute/virtualMachines/extensions", "Microsoft.Compute/virtualMachineScaleSets", "Microsoft.KeyVault/vaults", "Microsoft.Scheduler/jobCollections", "Microsoft.NotificationHubs/namespaces", "Microsoft.NotificationHubs/namespaces/AuthorizationRules", "Microsoft.Compute/virtualMachines", "Microsoft.DataLakeStore/accounts", "Microsoft.DataLakeStore/accounts/firewallrules", "Microsoft.DataLakeStore/accounts/trustedidproviders", "Microsoft.DataLakeAnalytics/accounts", "Microsoft.DataLakeAnalytics/accounts/dataLakeStoreAccounts", "Microsoft.DataLakeAnalytics/accounts/storageAccounts", "Microsoft.DataLakeAnalytics/accounts/firewallRules", "Microsoft.DataLakeAnalytics/accounts/computePolicies", "Microsoft.CognitiveServices/accounts", "Microsoft.PowerBI/workspaceCollections", "Microsoft.PowerBIDedicated/capacities", "Microsoft.DataCatalog/catalogs", "Microsoft.ContainerService/containerServices", "Microsoft.Network/dnszones", "Microsoft.Network/dnszones/A", "Microsoft.Network/dnszones/AAAA", "Microsoft.Network/dnszones/CNAME", "Microsoft.Network/dnszones/MX", "Microsoft.Network/dnszones/NS", "Microsoft.Network/dnszones/PTR", "Microsoft.Network/dnszones/SOA", "Microsoft.Network/dnszones/SRV", "Microsoft.Network/dnszones/TXT", "Microsoft.Cdn/profiles", "Microsoft.Cdn/profiles/endpoints", "Microsoft.Cdn/profiles/endpoints/customDomains", "Microsoft.Cdn/profiles/endpoints/origins", "Microsoft.Batch/batchAccounts", "Microsoft.Batch/batchAccounts/applications", "Microsoft.Batch/batchAccounts/applications/versions", "Microsoft.Batch/batchAccounts/certificates", "Microsoft.Batch/batchAccounts/pools", "Microsoft.Logic/workflows", "Microsoft.Logic/integrationAccounts", "Microsoft.Logic/integrationAccounts/agreements", "Microsoft.Logic/integrationAccounts/certificates", "Microsoft.Logic/integrationAccounts/maps", "Microsoft.Logic/integrationAccounts/partners", "Microsoft.Logic/integrationAccounts/schemas", "Microsoft.Logic/integrationAccounts/assemblies", "Microsoft.Logic/integrationAccounts/batchConfigurations", "Microsoft.Web/connections", "Microsoft.Web/connectionGateways", "Microsoft.Web/customApis", "Microsoft.Scheduler/jobCollections/jobs", "Microsoft.MachineLearning/webServices", "Microsoft.MachineLearning/commitmentPlans", "Microsoft.MachineLearning/workspaces", "Microsoft.MachineLearningServices/workspaces", "Microsoft.MachineLearningServices/workspaces/computes", "Microsoft.MachineLearningExperimentation/accounts", "Microsoft.MachineLearningExperimentation/accounts/workspaces", "Microsoft.MachineLearningExperimentation/accounts/workspaces/projects", "Microsoft.Automation/automationAccounts", "Microsoft.Automation/automationAccounts/runbooks", "Microsoft.Automation/automationAccounts/modules", "Microsoft.Automation/automationAccounts/certificates", "Microsoft.Automation/automationAccounts/connections", "Microsoft.Automation/automationAccounts/variables", "Microsoft.Automation/automationAccounts/schedules", "Microsoft.Automation/automationAccounts/jobs", "Microsoft.Automation/automationAccounts/connectionTypes", "Microsoft.Automation/automationAccounts/compilationjobs", "Microsoft.Automation/automationAccounts/configurations", "Microsoft.Automation/automationAccounts/jobSchedules", "Microsoft.Automation/automationAccounts/nodeConfigurations", "Microsoft.Automation/automationAccounts/webhooks", "Microsoft.Automation/automationAccounts/credentials", "Microsoft.Automation/automationAccounts/watchers", "Microsoft.Automation/automationAccounts/softwareUpdateConfigurations", "Microsoft.Automation/automationAccounts/sourceControls", "Microsoft.Automation/automationAccounts/sourceControls/sourceControlSyncJobs", "Microsoft.Automation/automationAccounts/python2Packages", "Microsoft.Media/mediaServices", "Microsoft.Media/mediaServices/accountFilters", "Microsoft.Media/mediaServices/assets", "Microsoft.Media/mediaServices/assets/assetFilters", "Microsoft.Media/mediaServices/contentKeyPolicies", "Microsoft.Media/mediaServices/liveEvents", "Microsoft.Media/mediaServices/liveEvents/liveOutputs", "Microsoft.Media/mediaServices/streamingEndpoints", "Microsoft.Media/mediaServices/streamingLocators", "Microsoft.Media/mediaServices/streamingPolicies", "Microsoft.Media/mediaServices/transforms", "Microsoft.Media/mediaServices/transforms/jobs", "Microsoft.Devices/IotHubs", "Microsoft.Devices/IotHubs/eventHubEndpoints/ConsumerGroups", "Microsoft.Devices/provisioningServices", "Microsoft.ServiceFabric/clusters", "Microsoft.ServiceFabric/clusters/applications", "Microsoft.ServiceFabric/clusters/applications/services", "Microsoft.ServiceFabric/clusters/applicationTypes", "Microsoft.ServiceFabric/clusters/applicationTypes/versions", "Microsoft.Authorization/locks", "Microsoft.Resources/deployments", "Microsoft.Solutions/applianceDefinitions", "Microsoft.Solutions/appliances", "Microsoft.ApiManagement/service", "Microsoft.ApiManagement/service/apis", "Microsoft.ApiManagement/service/apis/operations", "Microsoft.ApiManagement/service/apis/operations/policies", "Microsoft.ApiManagement/service/apis/operations/tags", "Microsoft.ApiManagement/service/apis/policies", "Microsoft.ApiManagement/service/apis/releases", "Microsoft.ApiManagement/service/apis/schemas", "Microsoft.ApiManagement/service/apis/tagDescriptions", "Microsoft.ApiManagement/service/apis/tags", "Microsoft.ApiManagement/service/authorizationServers", "Microsoft.ApiManagement/service/backends", "Microsoft.ApiManagement/service/certificates", "Microsoft.ApiManagement/service/diagnostics", "Microsoft.ApiManagement/service/diagnostics/loggers", "Microsoft.ApiManagement/service/groups", "Microsoft.ApiManagement/service/groups/users", "Microsoft.ApiManagement/service/identityProviders", "Microsoft.ApiManagement/service/loggers", "Microsoft.ApiManagement/service/notifications", "Microsoft.ApiManagement/service/notifications/recipientEmails", "Microsoft.ApiManagement/service/notifications/recipientUsers", "Microsoft.ApiManagement/service/openidConnectProviders", "Microsoft.ApiManagement/service/policies", "Microsoft.ApiManagement/service/products", "Microsoft.ApiManagement/service/products/apis", "Microsoft.ApiManagement/service/products/groups", "Microsoft.ApiManagement/service/products/policies", "Microsoft.ApiManagement/service/products/tags", "Microsoft.ApiManagement/service/properties", "Microsoft.ApiManagement/service/subscriptions", "Microsoft.ApiManagement/service/tags", "Microsoft.ApiManagement/service/templates", "Microsoft.ApiManagement/service/users", "Microsoft.ApiManagement/service/apis/diagnostics", "Microsoft.ApiManagement/service/api-version-sets", "Microsoft.ApiManagement/service/apiVersionSets", "Microsoft.ApiManagement/service/caches", "Microsoft.Compute/disks", "Microsoft.Compute/snapshots", "Microsoft.Compute/images", "Microsoft.ContainerRegistry/registries", "Microsoft.ContainerRegistry/registries/replications", "Microsoft.ContainerRegistry/registries/webhooks", "Microsoft.ContainerRegistry/registries/buildTasks", "Microsoft.ContainerRegistry/registries/buildTasks/steps", "Microsoft.ContainerRegistry/registries/tasks", "Microsoft.Insights/actionGroups", "Microsoft.Insights/activityLogAlerts", "Microsoft.Network/publicIPAddresses", "Microsoft.Network/virtualNetworks", "Microsoft.Network/loadBalancers", "Microsoft.Network/networkSecurityGroups", "Microsoft.Network/networkInterfaces", "Microsoft.Network/routeTables", "Microsoft.Network/applicationGateways", "Microsoft.Network/connections", "Microsoft.Network/localNetworkGateways", "Microsoft.Network/virtualNetworkGateways", "Microsoft.Network/virtualNetworks/subnets", "Microsoft.Network/virtualNetworks/virtualNetworkPeerings", "Microsoft.Sql/servers", "Microsoft.Sql/servers/advisors", "Microsoft.Sql/servers/administrators", "Microsoft.Sql/servers/auditingPolicies", "Microsoft.Sql/servers/backupLongTermRetentionVaults", "Microsoft.Sql/servers/communicationLinks", "Microsoft.Sql/servers/connectionPolicies", "Microsoft.Sql/servers/databases", "Microsoft.Sql/servers/databases/advisors", "Microsoft.Sql/servers/databases/auditingPolicies", "Microsoft.Sql/servers/databases/backupLongTermRetentionPolicies", "Microsoft.Sql/servers/databases/connectionPolicies", "Microsoft.Sql/servers/databases/dataMaskingPolicies", "Microsoft.Sql/servers/databases/dataMaskingPolicies/rules", "Microsoft.Sql/servers/databases/extensions", "Microsoft.Sql/servers/databases/geoBackupPolicies", "Microsoft.Sql/servers/databases/securityAlertPolicies", "Microsoft.Sql/servers/databases/transparentDataEncryption", "Microsoft.Sql/servers/disasterRecoveryConfiguration", "Microsoft.Sql/servers/elasticPools", "Microsoft.Sql/servers/firewallRules", "Microsoft.Sql/managedInstances", "Microsoft.Sql/servers/databases/auditingSettings", "Microsoft.Sql/servers/databases/syncGroups", "Microsoft.Sql/servers/databases/syncGroups/syncMembers", "Microsoft.Sql/servers/encryptionProtector", "Microsoft.Sql/servers/failoverGroups", "Microsoft.Sql/servers/keys", "Microsoft.Sql/servers/syncAgents", "Microsoft.Sql/servers/virtualNetworkRules", "Microsoft.Sql/managedInstances/databases", "Microsoft.Sql/servers/auditingSettings", "Microsoft.Sql/servers/databases/extendedAuditingSettings", "Microsoft.Sql/servers/securityAlertPolicies", "Microsoft.Sql/managedInstances/databases/securityAlertPolicies", "Microsoft.Sql/managedInstances/securityAlertPolicies", "Microsoft.Sql/servers/databases/vulnerabilityAssessments/rules/baselines", "Microsoft.Sql/servers/databases/vulnerabilityAssessments", "Microsoft.Sql/managedInstances/databases/vulnerabilityAssessments/rules/baselines", "Microsoft.Sql/managedInstances/databases/vulnerabilityAssessments", "Microsoft.Sql/servers/vulnerabilityAssessments", "Microsoft.Sql/managedInstances/vulnerabilityAssessments", "Microsoft.Sql/servers/dnsAliases", "Microsoft.Sql/servers/extendedAuditingSettings", "Microsoft.Sql/servers/jobAgents", "Microsoft.Sql/servers/jobAgents/credentials", "Microsoft.Sql/servers/jobAgents/jobs", "Microsoft.Sql/servers/jobAgents/jobs/executions", "Microsoft.Sql/servers/jobAgents/jobs/steps", "Microsoft.Sql/servers/jobAgents/targetGroups", "Microsoft.StreamAnalytics/streamingjobs", "Microsoft.StreamAnalytics/streamingjobs/functions", "Microsoft.StreamAnalytics/streamingjobs/inputs", "Microsoft.StreamAnalytics/streamingjobs/outputs", "Microsoft.StreamAnalytics/streamingjobs/transformations", "Microsoft.TimeSeriesInsights/environments", "Microsoft.TimeSeriesInsights/environments/eventSources", "Microsoft.TimeSeriesInsights/environments/referenceDataSets", "Microsoft.TimeSeriesInsights/environments/accessPolicies", "Microsoft.ImportExport/jobs", "Microsoft.Network/dnsZones/CAA", "Microsoft.Migrate/projects", "Microsoft.Migrate/projects/groups", "Microsoft.Migrate/projects/groups/assessments", "Microsoft.AzureStack/registrations", "Microsoft.AzureStack/registrations/customerSubscriptions", "Microsoft.Compute/virtualMachineScaleSets/extensions", "Microsoft.DBforMariaDB/servers", "Microsoft.DBforMariaDB/servers/configurations", "Microsoft.DBforMariaDB/servers/databases", "Microsoft.DBforMariaDB/servers/firewallRules", "Microsoft.DBforMariaDB/servers/virtualNetworkRules", "Microsoft.DBforMariaDB/servers/securityAlertPolicies", "Microsoft.DBforMySQL/servers", "Microsoft.DBforMySQL/servers/configurations", "Microsoft.DBforMySQL/servers/databases", "Microsoft.DBforMySQL/servers/firewallRules", "Microsoft.DBforMySQL/servers/virtualNetworkRules", "Microsoft.DBforMySQL/servers/securityAlertPolicies", "Microsoft.DBforPostgreSQL/servers", "Microsoft.DBforPostgreSQL/servers/configurations", "Microsoft.DBforPostgreSQL/servers/databases", "Microsoft.DBforPostgreSQL/servers/firewallRules", "Microsoft.DBforPostgreSQL/servers/virtualNetworkRules", "Microsoft.DBforPostgreSQL/servers/securityAlertPolicies", "Microsoft.Network/expressRouteCircuits/authorizations", "Microsoft.Network/expressRouteCircuits/peerings", "Microsoft.Network/networkSecurityGroups/securityRules", "Microsoft.Network/routeTables/routes", "Microsoft.Network/expressRouteCircuits", "Microsoft.Network/applicationSecurityGroups", "Microsoft.Network/ddosProtectionPlans", "Microsoft.Network/expressRouteCrossConnections", "Microsoft.Network/azureFirewalls", "Microsoft.Network/expressRouteCircuits/peerings/connections", "Microsoft.Network/expressRouteCrossConnections/peerings", "Microsoft.Network/loadBalancers/inboundNatRules", "Microsoft.Network/networkWatchers", "Microsoft.Network/networkWatchers/connectionMonitors", "Microsoft.Network/networkWatchers/packetCaptures", "Microsoft.Network/routeFilters", "Microsoft.Network/routeFilters/routeFilterRules", "Microsoft.Network/virtualHubs", "Microsoft.Network/virtualWans", "Microsoft.Network/vpnGateways", "Microsoft.Network/vpnGateways/vpnConnections", "Microsoft.Network/vpnSites", "Microsoft.Network/publicIPPrefixes", "Microsoft.Network/serviceEndpointPolicies", "Microsoft.Network/serviceEndpointPolicies/serviceEndpointPolicyDefinitions", "Microsoft.Network/ExpressRoutePorts", "Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies", "Microsoft.Network/bastionHosts", "Microsoft.Network/ddosCustomPolicies", "Microsoft.Network/expressRouteGateways", "Microsoft.Network/expressRouteGateways/expressRouteConnections", "Microsoft.Network/natGateways", "Microsoft.Network/networkInterfaces/tapConfigurations", "Microsoft.Network/networkProfiles", "Microsoft.Network/p2svpnGateways", "Microsoft.Network/privateEndpoints", "Microsoft.Network/privateLinkServices", "Microsoft.Network/privateLinkServices/privateEndpointConnections", "Microsoft.Network/virtualNetworkTaps", "Microsoft.Network/virtualWans/p2sVpnServerConfigurations", "Microsoft.Network/firewallPolicies", "Microsoft.Network/firewallPolicies/ruleGroups", "Microsoft.Network/virtualRouters", "Microsoft.Network/virtualRouters/peerings", "Microsoft.Network/vpnServerConfigurations", "Microsoft.Network/ipGroups", "Microsoft.Network/virtualHubs/routeTables", "Microsoft.Network/privateDnsZones", "Microsoft.Network/privateDnsZones/virtualNetworkLinks", "Microsoft.Network/privateDnsZones/A", "Microsoft.Network/privateDnsZones/AAAA", "Microsoft.Network/privateDnsZones/CNAME", "Microsoft.Network/privateDnsZones/MX", "Microsoft.Network/privateDnsZones/PTR", "Microsoft.Network/privateDnsZones/SOA", "Microsoft.Network/privateDnsZones/SRV", "Microsoft.Network/privateDnsZones/TXT", "Microsoft.DataMigration/services", "Microsoft.DataMigration/services/projects", "Microsoft.Insights/components/pricingPlans", "Microsoft.Consumption/budgets", "Microsoft.Insights/metricAlerts", "Microsoft.EventGrid/topics", "Microsoft.EventGrid/eventSubscriptions", "Microsoft.EventGrid/domains", "Microsoft.EventGrid/domains/topics", "Microsoft.BatchAI/clusters", "Microsoft.BatchAI/fileServers", "Microsoft.BatchAI/jobs", "Microsoft.Insights/scheduledQueryRules", "Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers", "Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems", "Microsoft.RecoveryServices/vaults/backupPolicies", "Microsoft.RecoveryServices/vaults/backupstorageconfig", "Microsoft.RecoveryServices/vaults/backupFabrics/backupProtectionIntent", "Microsoft.ContainerInstance/containerGroups", "Microsoft.Compute/galleries", "Microsoft.Compute/galleries/images", "Microsoft.Compute/galleries/images/versions", "Microsoft.Compute/galleries/applications", "Microsoft.Compute/galleries/applications/versions", "Microsoft.Compute/hostGroups", "Microsoft.Compute/hostGroups/hosts", "Microsoft.IoTCentral/IoTApps", "Microsoft.Maps/accounts", "Microsoft.BatchAI/workspaces", "Microsoft.BatchAI/workspaces/clusters", "Microsoft.BatchAI/workspaces/experiments", "Microsoft.BatchAI/workspaces/experiments/jobs", "Microsoft.BatchAI/workspaces/fileServers", "Microsoft.Insights/ProactiveDetectionConfigs", "Microsoft.ContainerService/managedClusters", "Microsoft.OperationalInsights/workspaces/savedSearches", "Microsoft.OperationalInsights/workspaces/storageInsightConfigs", "Microsoft.OperationalInsights/workspaces", "Microsoft.OperationalInsights/workspaces/dataSources", "Microsoft.OperationalInsights/workspaces/linkedServices", "Microsoft.OperationalInsights/clusters", "Microsoft.OperationsManagement/ManagementConfigurations", "Microsoft.OperationsManagement/solutions", "Microsoft.Peering/peerings", "Microsoft.Peering/peeringServices", "Microsoft.Peering/peeringServices/prefixes", "Microsoft.StorSimple/managers", "Microsoft.StorSimple/managers/accessControlRecords", "Microsoft.StorSimple/managers/bandwidthSettings", "Microsoft.StorSimple/managers/devices/backupPolicies", "Microsoft.StorSimple/managers/devices/backupPolicies/schedules", "Microsoft.StorSimple/managers/devices/volumeContainers", "Microsoft.StorSimple/managers/devices/volumeContainers/volumes", "Microsoft.StorSimple/managers/storageAccountCredentials", "Microsoft.StorSimple/managers/certificates", "Microsoft.StorSimple/managers/devices/alertSettings", "Microsoft.StorSimple/managers/devices/backupScheduleGroups", "Microsoft.StorSimple/managers/devices/chapSettings", "Microsoft.StorSimple/managers/devices/fileservers", "Microsoft.StorSimple/managers/devices/fileservers/shares", "Microsoft.StorSimple/managers/devices/iscsiservers", "Microsoft.StorSimple/managers/devices/iscsiservers/disks", "Microsoft.StorSimple/managers/extendedInformation", "Microsoft.StorSimple/managers/storageDomains", "Microsoft.AAD/domainServices", "Microsoft.SignalRService/SignalR", "Microsoft.NetApp/netAppAccounts", "Microsoft.NetApp/netAppAccounts/capacityPools", "Microsoft.NetApp/netAppAccounts/capacityPools/volumes", "Microsoft.NetApp/netAppAccounts/capacityPools/volumes/snapshots", "Microsoft.ManagedIdentity/userAssignedIdentities", "Microsoft.HDInsight/clusters", "Microsoft.HDInsight/clusters/applications", "Microsoft.HDInsight/clusters/extensions", "Microsoft.Security/locations/jitNetworkAccessPolicies", "Microsoft.Security/pricings", "Microsoft.Security/securityContacts", "Microsoft.Security/workspaceSettings", "Microsoft.Security/autoProvisioningSettings", "Microsoft.Security/advancedThreatProtectionSettings", "Microsoft.Security/informationProtectionPolicies", "Microsoft.ManagedServices/registrationAssignments", "Microsoft.ManagedServices/registrationDefinitions", "Microsoft.BareMetal/crayServers", "Microsoft.ContainerService/managedClusters/agentPools", "Microsoft.Authorization/policyAssignments", "Microsoft.ServiceBus/namespaces", "Microsoft.ServiceBus/namespaces/AuthorizationRules", "Microsoft.ServiceBus/namespaces/queues", "Microsoft.ServiceBus/namespaces/queues/authorizationRules", "Microsoft.ServiceBus/namespaces/topics", "Microsoft.ServiceBus/namespaces/topics/authorizationRules", "Microsoft.ServiceBus/namespaces/topics/subscriptions", "Microsoft.ServiceBus/namespaces/disasterRecoveryConfigs", "Microsoft.ServiceBus/namespaces/migrationConfigurations", "Microsoft.ServiceBus/namespaces/networkRuleSets", "Microsoft.ServiceBus/namespaces/topics/subscriptions/rules", "Microsoft.ServiceBus/namespaces/ipfilterrules", "Microsoft.ServiceBus/namespaces/virtualnetworkrules", "Microsoft.EventHub/namespaces", "Microsoft.EventHub/namespaces/AuthorizationRules", "Microsoft.EventHub/namespaces/eventhubs", "Microsoft.EventHub/namespaces/eventhubs/authorizationRules", "Microsoft.EventHub/namespaces/eventhubs/consumergroups", "Microsoft.EventHub/namespaces/disasterRecoveryConfigs", "Microsoft.EventHub/namespaces/networkRuleSets", "Microsoft.EventHub/clusters", "Microsoft.EventHub/namespaces/ipfilterrules", "Microsoft.EventHub/namespaces/virtualnetworkrules", "Microsoft.Relay/namespaces", "Microsoft.Relay/namespaces/AuthorizationRules", "Microsoft.Relay/namespaces/HybridConnections", "Microsoft.Relay/namespaces/HybridConnections/authorizationRules", "Microsoft.Relay/namespaces/WcfRelays", "Microsoft.Relay/namespaces/WcfRelays/authorizationRules", "Microsoft.Web/sites/extensions", "Microsoft.Web/sites/functions", "Microsoft.Web/sites/functions/keys", "Microsoft.Web/sites/instances/extensions", "Microsoft.Web/sites/migrate", "Microsoft.Web/sites/networkConfig", "Microsoft.Web/sites/privateAccess", "Microsoft.Web/sites/siteextensions", "Microsoft.Web/sites/slots/extensions", "Microsoft.Web/sites/slots/functions", "Microsoft.Web/sites/slots/functions/keys", "Microsoft.Web/sites/slots/instances/extensions", "Microsoft.Web/sites/slots/networkConfig", "Microsoft.Web/sites/slots/privateAccess", "Microsoft.Web/sites/slots/siteextensions", "Microsoft.DataFactory/factories", "Microsoft.DataFactory/factories/datasets", "Microsoft.DataFactory/factories/integrationRuntimes", "Microsoft.DataFactory/factories/linkedservices", "Microsoft.DataFactory/factories/pipelines", "Microsoft.DataFactory/factories/triggers", "Microsoft.DataFactory/factories/dataflows", "Microsoft.DataFactory/factories/triggers/rerunTriggers", "Microsoft.AppPlatform/Spring", "Microsoft.AppPlatform/Spring/apps", "Microsoft.AppPlatform/Spring/apps/bindings", "Microsoft.AppPlatform/Spring/apps/deployments", "Sendgrid.Email/accounts", "Microsoft.Resources/links", "Microsoft.Authorization/roleAssignments", "Microsoft.Authorization/roleDefinitions"'
    */
    "MySQL Database": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-05-01-preview", "2015-06-15", "2016-03-30", "2018-04-01", "2018-06-01", "2018-07-01", "2019-04-01", "2019-06-01", "2019-07-01", "2019-08-01", "2019-09-01"'
    */
    "Network Security Group Rule": true,

    /* TODO:
    +   'Value must be one of the following values: "2018-07-01", "2019-04-01", "2019-06-01", "2019-07-01", "2019-08-01", "2019-09-01"'
    */
    "Public IP Prefix": true,

    /* TODO:
    +   'Value must be one of the following values: "2015-05-01-preview", "2015-06-15", "2016-03-30", "2018-04-01", "2018-06-01", "2018-07-01", "2019-04-01", "2019-06-01", "2019-07-01", "2019-08-01", "2019-09-01"'
    */
    "Route Table Route": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^.*\/import$\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$'
        */

    "SQL Database Import": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 3 not matched):\r\n    Missing required property "name"\r\n    Missing required property "type"\r\n    string'
    */
    "Traffic Manager Profile": true,

    /* TODO:
    +   'OneOf (Require 1 match, following 2 not matched):\r\n    Value must match the regular expression ^\\[([^\\[].*)?\\]$\r\n    boolean'
    */
    "VPN Virtual Network Gateway": true,

    /* TODO:
    +   'Value must be one of the following values: "2018-02-01", "2018-11-01"'
    */
    "Web Deploy for Web App": true,

    /* TODO:
    +   'Missing required property "protectedSettings"'
    */
    "Windows VM Custom Script": true,

    /* TODO:
    +   'Value must be one of the following types: string'
    */
    "Windows VM DSC PowerShell Script": true
};

interface ISnippet {
    prefix: string;
    body: string[];
    description?: string;
}

suite("Snippets functional tests", () => {
    suite("all snippets", () => {
        createSnippetTests("armsnippets.jsonc");
    });

    function createSnippetTests(snippetsFile: string): void {
        suite(snippetsFile, () => {
            const snippetsPath = path.join(testFolder, '..', 'assets', snippetsFile);
            const snippets = <{ [name: string]: ISnippet }>fse.readJsonSync(snippetsPath);
            // tslint:disable-next-line:no-for-in forin
            for (let snippetName in snippets) {
                testWithLanguageServer(`snippet: ${snippetName}`, async function (this: ITestCallbackContext): Promise<void> {
                    await testSnippet(this, snippetsPath, snippetName, snippets[snippetName]);
                });
            }
        });
    }

    async function testSnippet(testCallbackContext: ITestCallbackContext, snippetsPath: string, snippetName: string, snippet: ISnippet): Promise<void> {
        if (overrideSkipTests[snippetName]) {
            testCallbackContext.skip();
            return;
        }

        validateSnippet();

        const template = overrideTemplateForSnippet[snippetName] !== undefined ? overrideTemplateForSnippet[snippetName] : resourceTemplate;
        // tslint:disable-next-line: strict-boolean-expressions
        const expectedDiagnostics = (overrideExpectedDiagnostics[snippetName] || []).sort();
        // tslint:disable-next-line: strict-boolean-expressions
        const snippetInsertComment: string = overrideInsertPosition[snippetName] || "// Insert here: resource";
        const snippetInsertIndex: number = template.indexOf(snippetInsertComment);
        assert(snippetInsertIndex >= 0, `Couldn't find location to insert snippet (looking for "${snippetInsertComment}")`);
        const snippetInsertPos = getVSCodePositionFromPosition(new DeploymentTemplate(template, Uri.file("fake template")).getContextFromDocumentCharacterIndex(snippetInsertIndex, undefined).documentPosition);

        const tempPath = getTempFilePath(`snippet ${snippetName}`, '.azrm');

        fse.writeFileSync(tempPath, template);

        let doc = await workspace.openTextDocument(tempPath);
        await window.showTextDocument(doc);

        // Wait for first set of diagnostics to finish.
        await getDiagnosticsForDocument(doc, {});
        const initialDocText = window.activeTextEditor!.document.getText();

        // Start waiting for next set of diagnostics (so it picks up the current completion versions)
        let diagnosticsPromise: Promise<Diagnostic[]> = getDiagnosticsForDocument(
            doc,
            {
                waitForChange: true,
                ignoreSources: (overrideIgnoreSchemaValidation[snippetName]) ? [sources.schema] : []
            });

        // Insert snippet
        window.activeTextEditor!.selection = new Selection(snippetInsertPos, snippetInsertPos);
        await delay(1);

        await commands.executeCommand('editor.action.insertSnippet', {
            name: snippetName
        });

        // Wait for diagnostics to finish
        let diagnostics: Diagnostic[] = await diagnosticsPromise;

        if (DEBUG_BREAK_AFTER_INSERTING_SNIPPET) {
            // tslint:disable-next-line: no-debugger
            debugger;
        }

        const docTextAfterInsertion = window.activeTextEditor!.document.getText();
        validateDocumentWithSnippet();

        let messages = diagnostics.map(d => d.message).sort();
        assert.deepStrictEqual(messages, expectedDiagnostics);

        // // NOTE: Even though we request the editor to be closed,
        // // there's no way to request the document actually be closed,
        // //   and when you open it via an API, it doesn't close for a while,
        // //   so the diagnostics won't go away
        // // See https://github.com/Microsoft/vscode/issues/43056
        await commands.executeCommand("undo");
        fse.unlinkSync(tempPath);
        await commands.executeCommand('workbench.action.closeAllEditors');

        // Look for common errors in the snippet
        function validateSnippet(): void {
            const snippetText = JSON.stringify(snippet, null, 4);

            errorIfTextMatches(snippetText, /\$\$/, `Instead of $$ in snippet, use \\$`);
            errorIfTextMatches(snippetText, /\${[^0-9]/, "Snippet placeholder is missing the numeric id, makes it look like a variable to vscode");
        }

        function validateDocumentWithSnippet(): void {
            assert(initialDocText !== docTextAfterInsertion, "No insertion happened?  Document didn't change.");
        }

        function errorIfTextMatches(text: string, regex: RegExp, errorMessage: string): void {
            const match = text.match(regex);
            if (match) {
                assert(false, `${errorMessage}.  At "${text.slice(match.index!, match.index! + 20)}..."`);
            }
        }
    }
});
