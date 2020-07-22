// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * The kinds of snippets that could be inserted in a specific location in a template document
 *
 * It may be a known context or the name of the property owning the object or array where the snippet can
 * be added (e.g. "variables" or "outputs")
 */
export type SnippetContext = KnownSnippetContexts | string;

export enum KnownSnippetContexts {
    // No top-level JSON in the file
    emptyDocument = 'empty-document',

    resources = 'resources',
    // Parameter definitions, whether top-level or nested deployment
    parameterDefinitions = 'parameter-definitions',
    // Parameter values, whether top-level or nested deployment
    parameterValues = 'parameter-values',

    // User function parameter definitions
    userFuncParameterDefinitions = 'userfunc-parameter-definitions',
}
