// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { Issue } from "../../language/Issue";
import { IssueKind } from "../../language/IssueKind";
import { compareApiVersions } from "../../util/compareApiVersions";
import { templateKeys } from ".././../constants";
import { IResource } from "./IResource";
import { TemplateScope } from "./scopes/TemplateScope";
import { isDeploymentResource } from "./scopes/templateScopes";

const minApiVersionForDeploymentWithRelativePath = '2020-10-01';

function visitResource(resource: IResource, issuesOut: Issue[]): void {
    const resourceObject = resource.resourceObject;
    if (isDeploymentResource(resourceObject)) {
        const relativePath = resourceObject.getPropertyValue(templateKeys.properties)?.asObjectValue
            ?.getPropertyValue(templateKeys.linkedDeploymentTemplateLink)?.asObjectValue
            ?.getPropertyValue(templateKeys.linkedDeploymentTemplateLinkRelativePath);

        if (relativePath) {
            const apiVersion = resourceObject.getPropertyValue(templateKeys.resourceApiVersion)?.asStringValue;
            const apiVersionValue = apiVersion?.unquotedValue.toLocaleLowerCase();
            if (apiVersion && apiVersionValue && compareApiVersions(apiVersionValue, minApiVersionForDeploymentWithRelativePath) < 0) {
                issuesOut.push(new Issue(
                    apiVersion.span,
                    `RelativePath for deployment requires an apiVersion of ${minApiVersionForDeploymentWithRelativePath} or higher`,
                    IssueKind.errResRelativePathApiVersion
                ));
            }
        }
    }
}

export function analyzeResources(scope: TemplateScope): Issue[] {
    const issues: Issue[] = [];

    for (const resource of scope.resources) {
        visitResource(resource, issues);
    }

    return issues;
}
