// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from 'assert';
import { Uri } from "vscode";
import { DeploymentFileMapping } from "../extension.bundle";
import { TestConfiguration } from "./support/TestConfiguration";

suite("DeploymentFileMapping", () => {
    const param1 = Uri.file("c:\\temp");
    const template1 = Uri.parse("http://1.json");

    test("a", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        await mapping.mapParameterFile(template1, param1);
        assert.equal(mapping.getParameterFile(template1), param1);
        assert.equal(mapping.getTemplateFile(param1), template1);
    });
});
