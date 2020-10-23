// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import * as assert from "assert";
import * as fse from "fs-extra";
import { ITestCallbackContext } from "mocha";
import { parseTemplate } from "./support/parseTemplate";
import { resolveInTestFolder } from "./support/resolveInTestFolder";

suite("Performance tests", () => {
    suite("warnings and errors performance", () => {
        test("Lots of variables", async function (this: ITestCallbackContext): Promise<Promise<void>> {
            // Takes less than a second on my local dev machine
            this.timeout(5000);

            const sourcePath = resolveInTestFolder('templates/performance/50params5000vars5refs.json');
            const templateContents = (await fse.readFile(sourcePath)).toString();
            const dt = await parseTemplate(templateContents);
            const warnings = dt.getWarnings();

            // Results to large for assert.equal to handle directly
            assert.strictEqual(warnings.length, 5000);
            assert.strictEqual(warnings[0].message, "The variable 'var1' is never used.");
        });
    });
});
