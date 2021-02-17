// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Uri } from "vscode";
import { IProvideOpenedDocuments } from "../../../IProvideOpenedDocuments";
import { IParameterDefinition } from "../../parameters/IParameterDefinition";
import { ILinkedTemplateReference } from "./ILinkedTemplateReference";

export function getParameterDefinitionsFromLinkedTemplate(
    linkedTemplate: ILinkedTemplateReference,
    provideOpenDocuments: IProvideOpenedDocuments
): IParameterDefinition[] {
    const dt = provideOpenDocuments.getOpenedDeploymentTemplate(Uri.parse(linkedTemplate.fullUri, true));
    return dt?.topLevelScope.parameterDefinitionsSource.parameterDefinitions.slice() // clone
        ?? [];
}
