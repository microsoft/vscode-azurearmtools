// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable: prefer-template

import * as assert from "assert";
import * as os from 'os';
import { HoverInfo, Span } from "../extension.bundle";

suite("Hover", () => {
    suite("HoverInfo", () => {
        test("with description", () => {
            const info = new HoverInfo(
                {
                    usage: "usage",
                    friendlyType: "type",
                    description: "description"
                },
                new Span(17, 7));
            assert.deepEqual(`**usage**${os.EOL}*(type)*${os.EOL}${os.EOL}description`, info.getHoverText());
            assert.deepEqual(new Span(17, 7), info.span);
        });

        test("no description", () => {
            const info = new HoverInfo(
                {
                    usage: "usage",
                    friendlyType: "type",
                    description: undefined
                },
                new Span(17, 7));
            assert.deepEqual(`**usage**${os.EOL}*(type)*`, info.getHoverText());
        });

        test("empty description", () => {
            const info = new HoverInfo(
                {
                    usage: "usage",
                    friendlyType: "type",
                    description: ""
                },
                new Span(17, 7));
            assert.deepEqual(`**usage**${os.EOL}*(type)*`, info.getHoverText());
        });
    });
});
