// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { IUsageInfo } from "./Hover";
import * as Json from "./JSON";

export enum DefinitionKind {
    Parameter = "Parameter",
    Variable = "Variable",
    Namespace = "Namespace",
    UserFunction = "UserFunction",
    BuiltinFunction = "BuiltinFunction",

    // Parameter files
    ParameterValue = "ParameterValue",
}

/**
 * Represents any definition with a StringValue that represents its name (e.g., parameter definition, user namespace definition)
 */
export interface INamedDefinition {
    definitionKind: DefinitionKind;
    nameValue?: Json.StringValue;   // Undefined if the definition is not defined inside the template (e.g. built-in functions)
    usageInfo: IUsageInfo;
}
