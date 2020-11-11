
// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ISchemaInfo } from "./ISchemaInfo";
import { DeploymentScopeKind } from "./scopes/DeploymentScopeKind";

const schemaInfos: ISchemaInfo[] = [
    {
        normalizedSchema: '2014-04-01-preview/deploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.resourceGroup,
        isDeprecated: true
    },
    {
        normalizedSchema: '2015-01-01/deploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.resourceGroup,
        isDeprecated: true
    },
    {
        normalizedSchema: '2019-04-01/deploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.resourceGroup,
        isDeprecated: false
    },
    {
        normalizedSchema: '2019-08-01/tenantDeploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.tenant,
        isDeprecated: false
    },
    {
        normalizedSchema: '2018-05-01/subscriptionDeploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.subscription,
        isDeprecated: false
    },
    {
        normalizedSchema: '2019-08-01/managementGroupDeploymentTemplate.json',
        deploymentScopeKind: DeploymentScopeKind.managementGroup,
        isDeprecated: false
    },
];

let normalizedSchemaLCToSchemaInfoMap: Map<string, ISchemaInfo> | undefined;

/**
 * Finds the ISchemaInfo that matches the given schema, if any
 */
export function findSchemaInfo(schemaUri: string): ISchemaInfo | undefined {
    if (!normalizedSchemaLCToSchemaInfoMap) {
        normalizedSchemaLCToSchemaInfoMap = new Map<string, ISchemaInfo>();

        for (const si of schemaInfos) {
            normalizedSchemaLCToSchemaInfoMap.set(si.normalizedSchema.toLowerCase(), si);
        }
    }

    const extractedSchema = extractSchemaWithoutHttpOrHash(schemaUri);
    return extractedSchema ? normalizedSchemaLCToSchemaInfoMap.get(extractedSchema.toLowerCase()) : undefined;
}

/**
 * Given a schema value, removes the HTTP/S: prefix and the optional "#" affix
 *
 * E.g., given "https://2019-08-01/tenantDeploymentTemplate.json#" returns "2019-08-01/tenantDeploymentTemplate.json"
 */
function extractSchemaWithoutHttpOrHash(schema: string): string | undefined {
    const matches = isArmSchemaRegex.exec(schema);
    const extractedSchema: string | undefined = matches ? matches[1] : undefined;
    return extractedSchema;
}

export type deprecatedSchemas =
    '2014-04-01-preview/deploymentTemplate.json'
    | '2015-01-01/deploymentTemplate.json';

export type currentSchemas =
    | '2019-04-01/deploymentTemplate.json'
    | '2019-08-01/tenantDeploymentTemplate.json'
    | '2018-05-01/subscriptionDeploymentTemplate.json'
    | '2019-08-01/managementGroupDeploymentTemplate.json'
    | '2019-08-01/tenantDeploymentTemplate.json'
    ;

export type allSchemas = deprecatedSchemas | currentSchemas;

const containsArmSchemaRegexString =
    `https?:\/\/schema\.management\.azure\.com\/schemas\/([^"\/]+\/[a-zA-Z]*[dD]eploymentTemplate\.json)#?`;
const containsArmSchemaRegex = new RegExp(containsArmSchemaRegexString, 'i');
const isArmSchemaRegex = new RegExp(`^${containsArmSchemaRegexString}$`, 'i');

const containsParametersSchemaRegexString =
    `https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/[a-zA-Z]*[dD]eploymentParameters\.json#?`;
const containsParametersSchemaRegex = new RegExp(containsParametersSchemaRegexString, 'i');
const isParametersSchemaRegex = new RegExp(`^${containsParametersSchemaRegexString}$`, 'i');

export function containsArmSchema(json: string): boolean {
    return !!json && containsArmSchemaRegex.test(json);
}

export function isArmSchema(schema: string | undefined | null): boolean {
    return !!schema && isArmSchemaRegex.test(schema);
}

export function containsParametersSchema(json: string): boolean {
    return !!json && containsParametersSchemaRegex.test(json);
}

export function isParametersSchema(json: string | undefined | null): boolean {
    return !!json && isParametersSchemaRegex.test(json);
}

// Current root schemas:
// Resource group:
//   https://schema.management.azure.com/schemas/2014-04-01-preview/deploymentTemplate.json#
//   https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#
//   https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#
// Subscription:
//   https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#
// Management Group:
//   https://schema.management.azure.com/schemas/2019-08-01/managementGroupDeploymentTemplate.json#
// Tenant:
//   https://schema.management.azure.com/schemas/2019-08-01/tenantDeploymentTemplate.json#

/**
 * Given a schema, returns the recommended one (most recent) for the same scope.
 * If the schema is not valid or there is no better schema, returns undefined
 */
export function getPreferredSchema(schema: string): string | undefined {
    // Being very specific about which old schemas we match, because if they come out with a newer schema, we don't
    // want to start suggesting an older one just because we don't recognize the new one

    if (schema.match(/https?:\/\/schema\.management\.azure\.com\/schemas\/(2014-04-01-preview|2015-01-01)\/deploymentTemplate.json#?/i)) {
        return "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#";
    }

    // No other scopes currently have more recent schemas
    return undefined;
}
