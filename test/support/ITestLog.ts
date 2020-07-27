// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export interface ITestLog {
    writeLine(message: string): void;
    toString(): string;
}
