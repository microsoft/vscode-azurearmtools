// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { IProvideOpenedDocuments } from "../../../IProvideOpenedDocuments";
import { parseUri } from "../../../util/uri";
import { IParameterDefinition } from "../../parameters/IParameterDefinition";
import { DeploymentTemplateDoc } from "../DeploymentTemplateDoc";
import { ILinkedTemplateReference } from "./ILinkedTemplateReference";

export function getParameterDefinitionsFromLinkedTemplate(
    linkedTemplate: ILinkedTemplateReference,
    provideOpenDocuments: IProvideOpenedDocuments
): IParameterDefinition[] {
    let dt: DeploymentTemplateDoc | undefined;
    try {
        const uri = parseUri(linkedTemplate.fullUri);
        dt = provideOpenDocuments.getOpenedDeploymentTemplate(uri);
    } catch (error) {
        // Ignore poorly-formed URIs
    }

    return dt?.topLevelScope.parameterDefinitionsSource.parameterDefinitions.slice() // clone
        ?? [];
}
