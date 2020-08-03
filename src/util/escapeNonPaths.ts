// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

export function escapeNonPaths(s: string): string {
    // Replaces '/' with '|', which keeps vscode from redacting telemetry data that looks like paths but are not.
    // NOTE: Make sure to use this function only on properties that you can could never contain user paths!
    return s.replace(/\//g, '|');
}
