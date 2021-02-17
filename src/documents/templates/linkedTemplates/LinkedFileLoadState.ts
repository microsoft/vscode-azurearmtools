// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

export enum LinkedFileLoadState {
    NotLoaded = 0,
    Loading = 1,
    SuccessfullyLoaded = 2,
    LoadFailed = 3,
    TooDeep = 4,
    NotSupported = 5,
}
