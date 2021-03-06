// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export enum IssueKind {
    tleSyntax = "tleSyntax",
    referenceInVar = "referenceInVar",
    unusedVar = "unusedVar",
    unusedParam = "unusedParam",
    unusedUdfParam = "unusedUdfParam",
    unusedUdf = "unusedUdf",
    badArgsCount = "badArgsCount",
    badFuncContext = "badFuncContext",
    undefinedFunc = "undefinedFunc",
    undefinedNs = "undefinedNs",
    undefinedUdf = "undefinedUdf",
    undefinedParam = "undefinedParam",
    undefinedVar = "undefinedVar",
    varInUdf = "varInUdf",
    undefinedVarProp = "undefinedVarProp",
    inaccessibleNestedScopeMembers = "inaccessibleNestedScopeMembers",
    incorrectScopeWarning = "incorrectScopeWarning",

    // Cannot validate nested/linked template because full validation is off
    cannotValidateNestedTemplate = "cannotValidateNestedTemplate",
    cannotValidateLinkedTemplate = "cannotValidateLinkedTemplate",

    // Parameter file issues
    params_templateFileNotFound = "params_templateFileNotFound",
    params_missingRequiredParam = "params_missingRequiredParam",

    // Resource issues
    errResRelativePathApiVersion = 'errResRelativePathApiVersion'
}
