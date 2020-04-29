// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { commands } from 'vscode';
import { assert } from '../fixed_assert';

// These contexts are used to drive when/enablement clauses in package.json

// Is current file a parameter file?
const isParameterFileContextName = `azurerm-vscode-tools-isParamFile`;

// Is a parameter file and has an associated template file?
const hasTemplateFileContextName = `azurerm-vscode-tools-hasTemplateFile`;

// Is a template file and has an associated parameter file?
const hasParameterFileContextName = `azurerm-vscode-tools-hasParamFile`;

export function setParameterFileContext(
    value: {
        isTemplateFile: boolean;
        hasParamFile: boolean;

        isParamFile: boolean;
        hasTemplateFile: boolean;
    }): void {
    assert(!(value.isTemplateFile && value.isParamFile));
    assert(!(!value.isTemplateFile && value.hasParamFile));
    assert(!(!value.isParamFile && value.hasTemplateFile));

    // Don't wait for return for any of these...

    // Temlate files...
    // Note: We don't need an "isTemplateFile" context because we have a specific langid for template files
    commands.executeCommand(
        'setContext',
        hasParameterFileContextName,
        value.isTemplateFile && value.hasParamFile);

    // Parameter files...
    commands.executeCommand(
        'setContext',
        isParameterFileContextName,
        value.isParamFile);
    commands.executeCommand(
        'setContext',
        hasTemplateFileContextName,
        value.hasTemplateFile);
}
