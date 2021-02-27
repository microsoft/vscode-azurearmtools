// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Uri } from "vscode";
import { IProvideOpenedDocuments } from "../../../IProvideOpenedDocuments";
import { IParameterDefinition } from "../../parameters/IParameterDefinition";
import { DeploymentTemplateDoc } from "../DeploymentTemplateDoc";
import { ILinkedTemplateReference } from "./ILinkedTemplateReference";

export function getParameterDefinitionsFromLinkedTemplate(
    linkedTemplate: ILinkedTemplateReference,
    provideOpenDocuments: IProvideOpenedDocuments
): IParameterDefinition[] {
    let dt: DeploymentTemplateDoc | undefined;
    try {
        const uri = Uri.parse(linkedTemplate.fullUri, true);
        dt = provideOpenDocuments.getOpenedDeploymentTemplate(uri);
    } catch (error) {
        // Ignore poorly-formed URIs
    }

    return dt?.topLevelScope.parameterDefinitionsSource.parameterDefinitions.slice() // clone
        ?? [];
}
