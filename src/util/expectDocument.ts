// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import { DeploymentDocument } from "../documents/DeploymentDocument";
import { DeploymentParametersDoc } from "../documents/parameters/DeploymentParametersDoc";
import { DeploymentTemplateDoc } from "../documents/templates/DeploymentTemplateDoc";

export function expectTemplateDocumentOrUndefined(associatedDocument: DeploymentDocument | undefined): DeploymentTemplateDoc | undefined {
    if (associatedDocument) {
        return expectTemplateDocument(associatedDocument);
    }

    return undefined;
}

export function expectTemplateDocument(associatedDocument: DeploymentDocument | undefined): DeploymentTemplateDoc {
    assert(!!associatedDocument, "Could not find associated template file");
    assert(!(associatedDocument instanceof DeploymentParametersDoc), `Expected associated document to be a template file, but it appears to be a parameter file`);
    assert(associatedDocument instanceof DeploymentTemplateDoc, `Expected associated document to be a template file`);
    return associatedDocument;
}

export function expectParameterDocumentOrUndefined(associatedDocument: DeploymentDocument | undefined): DeploymentParametersDoc | undefined {
    if (associatedDocument) {
        return expectParameterDocument(associatedDocument);
    }

    return undefined;
}

export function expectParameterDocument(associatedDocument: DeploymentDocument | undefined): DeploymentParametersDoc {
    assert(!!associatedDocument, "Could not find associated parameter file");
    assert(!(associatedDocument instanceof DeploymentTemplateDoc), `Expected associated document to be a parameter file, but it appears to be a template file`);
    assert(associatedDocument instanceof DeploymentParametersDoc, `Expected associated document to be a parameter file`);
    return associatedDocument;
}
