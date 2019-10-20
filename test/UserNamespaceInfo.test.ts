// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression no-non-null-assertion max-func-body-length

import * as assert from "assert";
import * as os from 'os';
import { HoverInfo, Language } from "../extension.bundle";
import { parseTemplate } from "./support/parseTemplate";

const fakeSpan = new Language.Span(0, 0);

suite("Hover.UserNamespaceInfo", () => {
    suite("getHoverText", () => {

        test("no members", async () => {
            const dt = await parseTemplate({
                $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
                contentVersion: "1.0.0.0",
                functions: [
                    {
                        namespace: "udf"
                    }
                ]
            });
            const info = new HoverInfo(
                dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
                fakeSpan);
            assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nNo members`);
        });
    });

    test("one member, no params", async () => {
        const dt = await parseTemplate({
            $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            contentVersion: "1.0.0.0",
            functions: [
                {
                    namespace: "udf",
                    members: {
                        date: {
                        }
                    }
                }
            ]
        });
        const info = new HoverInfo(
            dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
            fakeSpan);
        assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nMembers:\n* date()`);
    });

    test("one member, one param, no type", async () => {
        const dt = await parseTemplate({
            $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            contentVersion: "1.0.0.0",
            functions: [
                {
                    namespace: "udf",
                    members: {
                        date: {
                            parameters: [
                                { name: "param" }
                            ]
                        }
                    }
                }
            ]
        });
        const info = new HoverInfo(
            dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
            fakeSpan);
        assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nMembers:\n* date(param)`);
    });

    test("one member, one param", async () => {
        const dt = await parseTemplate({
            $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            contentVersion: "1.0.0.0",
            functions: [
                {
                    namespace: "udf",
                    members: {
                        date: {
                            parameters: [
                                {
                                    name: "param",
                                    type: "whatever"
                                }
                            ]
                        }
                    }
                }
            ]
        });
        const info = new HoverInfo(
            dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
            fakeSpan);
        assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nMembers:\n* date(param)`);
    });

    test("one member, two params", async () => {
        const dt = await parseTemplate({
            $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            contentVersion: "1.0.0.0",
            functions: [
                {
                    namespace: "udf",
                    members: {
                        date: {
                            parameters: [
                                {
                                    name: "param1",
                                    type: "STRING"
                                },
                                {
                                    name: "param2",
                                    type: "SecureString"
                                }
                            ]
                        }
                    }
                }
            ]
        });
        const info = new HoverInfo(
            dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
            fakeSpan);
        assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nMembers:\n* date(param1 [string], param2 [securestring])`);
    });

    test("two members", async () => {
        const dt = await parseTemplate({
            $schema: "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
            contentVersion: "1.0.0.0",
            functions: [
                {
                    namespace: "udf",
                    members: {
                        date: {
                            parameters: [
                                {
                                    name: "param1",
                                    type: "STRING"
                                },
                                {
                                    name: "param2",
                                    type: "SecureString"
                                }
                            ]
                        },
                        time: {
                            parameters: [
                                {
                                    name: "param",
                                    type: "STRING"
                                }
                            ]
                        }
                    }
                }
            ]
        });
        const info = new HoverInfo(
            dt.topLevelScope.getFunctionNamespaceDefinition("udf")!.usageInfo,
            fakeSpan);
        assert.equal(info.getHoverText(), `**udf**${os.EOL}*(user-defined namespace)*\n\nMembers:\n* date(param1 [string], param2 [securestring])\n* time(param [string])`);
    });
});
