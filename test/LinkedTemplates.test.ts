// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length no-unnecessary-class
// tslint:disable:no-non-null-assertion object-literal-key-quotes variable-name no-constant-condition

import { testDiagnosticsFromFile } from "./support/diagnostics";

suite("Linked templates", () => {
    suite("variables and parameters inside templateLink object refer to the parent's scope", () => {
        test('Regress #792: Regression from 0.10.0: top-level parameters not recognized in nested template properties', async () => {
            await testDiagnosticsFromFile(
                'templates/linked-templates-scope.json',
                {},
                [
                    // Should be no errors
                ]
            );
        });
    });
});
