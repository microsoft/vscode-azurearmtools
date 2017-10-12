// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";

import * as Hover from "../src/Hover";
import * as language from "../src/Language";
import * as TLE from "../src/TLE";

suite("Hover", () => {
    suite("Function", () => {
        test("constructor(tle.FunctionMetadata,Span)", () => {
            const fhi = new Hover.FunctionInfo("a", "b", "c", new language.Span(17, 7));
            assert.deepEqual("a", fhi.functionName);
            assert.deepEqual("**b**\nc", fhi.getHoverText());
            assert.deepEqual(new language.Span(17, 7), fhi.span);
        });
    });

    suite("ParameterReference", () => {
        suite("constructor(ParameterDefinition,Span)", () => {
            test("with description", () => {
                const prhi = new Hover.ParameterReferenceInfo("a", "b", new language.Span(2, 3));
                assert.deepEqual("**a** (parameter)\nb", prhi.getHoverText());
                assert.deepEqual(new language.Span(2, 3), prhi.span);
            });

            test("with undefined description", () => {
                const prhi = new Hover.ParameterReferenceInfo("a", undefined, new language.Span(2, 3));
                assert.deepEqual("**a** (parameter)", prhi.getHoverText());
                assert.deepEqual(new language.Span(2, 3), prhi.span);
            });
        });
    });

    suite("VariableReference", () => {
        test("constructor(VariableDefinition,Span)", () => {
            const prhi = new Hover.VariableReferenceInfo("a", new language.Span(2, 3));
            assert.deepEqual("**a** (variable)", prhi.getHoverText());
            assert.deepEqual(new language.Span(2, 3), prhi.span);
        });
    });
});