// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

// tslint:disable: max-func-body-length object-literal-key-quotes

import * as assert from "assert";
import { parseTemplate } from "./support/parseTemplate";

suite("analyzeResources Tests", () => {

    suite("errResRelativePathApiVersion", () => {
        function createResRelativePathApiVersionTest(apiVersion: string, expected: string[]): void {
            test(apiVersion, async () => {
                const dt = await parseTemplate({
                    "resources": [
                        {
                            "name": "linkedDeployment1",
                            "type": "Microsoft.Resources/deployments",
                            "apiVersion": apiVersion,
                            "properties": {
                                "mode": "Incremental",
                                "templateLink": {
                                    "relativePath": "child1.json",
                                    "contentVersion": "1.0.0.0"
                                },
                                "parameters": {
                                    "intParam": {
                                        "value": "abc"
                                    }
                                }
                            }
                        }
                    ]
                });
                const errors = dt.getErrors(undefined).concat(dt.getWarnings()).map(d => d.message);
                assert.deepStrictEqual(errors, expected);

            });
        }

        suite("Passing - apiVersion is high enough", () => {
            createResRelativePathApiVersionTest('2020-10-01', []);
            createResRelativePathApiVersionTest('2020-10-01-preview', []);
            createResRelativePathApiVersionTest('2020-10-02', []);
            createResRelativePathApiVersionTest('2020-11-02', []);
            createResRelativePathApiVersionTest('2021-01-01', []);
            createResRelativePathApiVersionTest('9999-01-01', []);
        });

        suite("Failing - apiVersion is too low", () => {
            createResRelativePathApiVersionTest('2020-09-30', ["RelativePath for deployment requires an apiVersion of 2020-10-01 or higher"]);
            createResRelativePathApiVersionTest('2020-09-30-preview', ["RelativePath for deployment requires an apiVersion of 2020-10-01 or higher"]);
            createResRelativePathApiVersionTest('2019-12-31', ["RelativePath for deployment requires an apiVersion of 2020-10-01 or higher"]);
            createResRelativePathApiVersionTest('201-12-31', ["RelativePath for deployment requires an apiVersion of 2020-10-01 or higher"]);
            createResRelativePathApiVersionTest('malformed', ["RelativePath for deployment requires an apiVersion of 2020-10-01 or higher"]);
        });
    });
});
