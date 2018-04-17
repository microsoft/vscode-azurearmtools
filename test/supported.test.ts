// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Completion from "../src/Completion";
import * as language from "../src/Language";
import { isLanguageIdSupported } from "../src/supported";

suite("Supported", () => {
    test("isLanguageIdSupported", () => {
        assert.equal(isLanguageIdSupported('json'), true);
        assert.equal(isLanguageIdSupported('jsonc'), true);
        assert.equal(isLanguageIdSupported('JSON'), true);
        assert.equal(isLanguageIdSupported('JSONC'), true);

        assert.equal(isLanguageIdSupported('JSONC2'), false);
        assert.equal(isLanguageIdSupported('2JSONC'), false);
        assert.equal(isLanguageIdSupported(''), false);
        assert.equal(isLanguageIdSupported(undefined), false);
        assert.equal(isLanguageIdSupported(null), false);
    });
});
