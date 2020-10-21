// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { templateKeys } from "./constants";
import { TemplateScope } from './documents/templates/scopes/TemplateScope';

export function getScopeDeploymentScopeFriendlyName(scope: TemplateScope): string {
    const schema = scope.rootObject?.getPropertyValue(templateKeys.schema)?.asStringValue?.unquotedValue;
    let schemaType: string;
    // tslint:disable-next-line: no-non-null-assertion
    const schemaLastSegment = (schema?.match(/([a-zA-Z.]+)#?$/) ?? [])[1]; //asdf should match whole string?
    switch (schemaLastSegment?.toLowerCase()) { // asdf
        case 'deploymenttemplate.json': schemaType = 'resource group'; break;
        case 'subscriptiondeploymenttemplate.json': schemaType = 'subscription'; break;
        default: schemaType = 'unknown';
    }
    return schemaType;
}
