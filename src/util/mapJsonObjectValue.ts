// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as Json from "../JSON";

/**
 * Calls a function on each property of a Json.ObjectValue and replaces that property
 * with the new one returned.
 * Does not traverse deeply into the object
 */
export function mapJsonObjectValue(objectValue: Json.ObjectValue, map: (prop: Json.Property) => Json.Property | Json.Property[]): Json.ObjectValue {
    let changed = false;
    const modifiedProps: Json.Property[] = [];

    for (let prop of objectValue.properties) {
        const newProp: Json.Property | Json.Property[] = map(prop);
        if (newProp instanceof Json.Property) {
            modifiedProps.push(newProp);
            if (newProp !== prop) {
                changed = true;
            }
        } else {
            // Returned an array of properties - add them all
            const newProperties: Json.Property[] = newProp;
            for (let propElement of newProperties) {
                modifiedProps.push(propElement);
            }
            changed = true;
        }
    }

    if (changed) {
        // Create a new object from the modified properties
        const modifiedObject = new Json.ObjectValue(objectValue.span, modifiedProps);
        return modifiedObject;
    } else {
        return objectValue;
    }
}
