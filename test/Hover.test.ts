// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from "assert";
import { Hover, Language } from "../extension.bundle";

suite("Hover", () => {
    suite("Function", () => {
        test("constructor(tle.FunctionMetadata,Span)", () => {
            const fhi = new Hover.FunctionInfo("a", "b", "c", new Language.Span(17, 7));
            assert.deepEqual("a", fhi.functionName);
            assert.deepEqual("**b**\nc", fhi.getHoverText());
            assert.deepEqual(new Language.Span(17, 7), fhi.span);
        });
    });

    suite("ParameterReference", () => {
        suite("constructor(ParameterDefinition,Span)", () => {
            test("with description", () => {
                const prhi = new Hover.ParameterReferenceInfo("a", "b", new Language.Span(2, 3));
                assert.deepEqual("**a** (parameter)\nb", prhi.getHoverText());
                assert.deepEqual(new Language.Span(2, 3), prhi.span);
            });

            test("with undefined description", () => {
                // tslint:disable-next-line:no-any
                const prhi = new Hover.ParameterReferenceInfo("a", <any>undefined, new Language.Span(2, 3));
                assert.deepEqual("**a** (parameter)", prhi.getHoverText());
                assert.deepEqual(new Language.Span(2, 3), prhi.span);
            });
        });
    });

    suite("VariableReference", () => {
        test("constructor(VariableDefinition,Span)", () => {
            const prhi = new Hover.VariableReferenceInfo("a", new Language.Span(2, 3));
            assert.deepEqual("**a** (variable)", prhi.getHoverText());
            assert.deepEqual(new Language.Span(2, 3), prhi.span);
        });
    });
});
