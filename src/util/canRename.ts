// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { DefinitionKind } from "../INamedDefinition";
import { IReferenceSite } from "../PositionContext";

/**
 * Checks if an IReferenceSite can be renamed.
 * If it can be renamed: undefined is returned.
 * If it cannot be renamed: An error message is returned.
 */
export function canRename(referenceSiteInfo: IReferenceSite): string | undefined {
    if (referenceSiteInfo.definition.definitionKind === DefinitionKind.BuiltinFunction) {
        return "Built-in functions cannot be renamed.";
    }
    return undefined;
}
