
// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

const containsArmSchemaRegexString =
    `https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/[a-zA-Z]*[dD]eploymentTemplate\.json#?`;
const containsArmSchemaRegex = new RegExp(containsArmSchemaRegexString, 'i');
const isArmSchemaRegex = new RegExp(`^${containsArmSchemaRegexString}$`, 'i');

const containsParametersSchemaRegexString =
    `https?:\/\/schema\.management\.azure\.com\/schemas\/[^"\/]+\/[a-zA-Z]*[dD]eploymentParameters\.json#?`;
const containsParametersSchemaRegex = new RegExp(containsParametersSchemaRegexString, 'i');
const isParametersSchemaRegex = new RegExp(`^${containsParametersSchemaRegexString}$`, 'i');

export function containsArmSchema(json: string): boolean {
    return !!json && containsArmSchemaRegex.test(json);
}

export function isArmSchema(json: string | undefined | null): boolean {
    return !!json && isArmSchemaRegex.test(json);
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
