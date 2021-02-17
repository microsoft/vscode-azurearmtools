// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export function removeComments(json: string): string {
    return json.replace(/\s+\/\/.*/g, "");
}
