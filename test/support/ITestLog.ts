// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export interface ITestLog {
    writeLine(message: string): void;
    writeLineIfLogCreated(message: string): void;
    toString(): string;
}
