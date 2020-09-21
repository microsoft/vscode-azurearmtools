// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

/**
 * An interface for an object that iterates through a sequence of values.
 */

export interface Iterator<T> {
    /**
     * Get whether or not this iterator has started iterating.
     */
    hasStarted(): boolean;

    /**
     * Get the iterator's current value, or undefined if the iterator doesn't have a current value.
     */
    current(): T | undefined;

    /**
     * Move this iterator to the next value in its sequnce. Return whether or not the iterator has a
     * current value after the move.
     */
    moveNext(): boolean;
}
