// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

/**
 * Allows the compiler to check for exhaustiveness (see https://www.typescriptlang.org/docs/handbook/advanced-types.html#union-types)
 *
 *     function assertNever(x: never): never {
 *         throw new Error("Unexpected object: " + x);
 *     }
 *    function area(s: Shape) {
 *         switch (s.kind) {
 *             case "square": return s.size * s.size;
 *             case "rectangle": return s.height * s.width;
 *             case "circle": return Math.PI * s.radius ** 2;
 *             default: return assertNever(s); // error here if there are missing cases
 *         }
 *     }
 *
 *     Here, assertNever checks that s is of type never — the type that’s left after all other cases have been removed. If you forget a case, then s will have a real type and you will get a type error. This method requires you to define an extra function, but it’s much more obvious when you forget it.
 */
export function assertNever(x: never): never {
    throw new Error(`Unexpected object: ${x}`);
}
