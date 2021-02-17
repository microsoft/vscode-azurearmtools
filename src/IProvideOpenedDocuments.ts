// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Uri } from "vscode";
import { DeploymentTemplateDoc } from "./documents/templates/DeploymentTemplateDoc";

export interface IProvideOpenedDocuments {
    getOpenedDeploymentTemplate(documentOrUri: Uri): DeploymentTemplateDoc | undefined;
}
