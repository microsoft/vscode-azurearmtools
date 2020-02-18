// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { mayBeMatchingParamFile } from "../extension.bundle";

suite("ParameterFiles", () => {
    suite("mayBeMatchingParamFile", () => {
        function testIsLikelyMatch(expected: boolean, templateFileName: string, possibleParamFileName: string): void {
            test(`(${templateFileName}, ${possibleParamFileName})`, () => {
                const result = mayBeMatchingParamFile(templateFileName, possibleParamFileName);
                assert.equal(result, expected);
            });
        }

        testIsLikelyMatch(true, "template.json", "template.params.json");
        testIsLikelyMatch(true, "template.json", "template.parameters.json");

        testIsLikelyMatch(true, "template.json", "template.params.dev.json");
        testIsLikelyMatch(true, "template.json", "template.parameters.dev.json");

        testIsLikelyMatch(true, "template.json", "template.params.dev.whatever.json");
        testIsLikelyMatch(true, "template.json", "template.parameters.dev.json");

        testIsLikelyMatch(true, "TEMPlate.json", "template.params.dev.whatever.JSON");
        testIsLikelyMatch(true, "template.JSON", "Template.PARAMETERS.deV.Json");

        testIsLikelyMatch(true, "TEMPlate.json", "template.params.dev.whatever.JSONc");
        testIsLikelyMatch(true, "template.JSON", "Template.PARAMETERS.deV.JsonC");

        testIsLikelyMatch(true, "new-vm.template.json", "new-vm.params.json");
        testIsLikelyMatch(true, "new-vm.template.json", "new-vm.parameters.json");

        testIsLikelyMatch(false, "new-vm2.template.json", "new-vm.params.json");

        testIsLikelyMatch(true, "new-vm.template.json", "new-vm-parameters.json");
    });
});
