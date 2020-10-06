// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { Range } from "vscode";
import { emptyPosition } from "./emptyPosition";

export const emptyRange = new Range(emptyPosition, emptyPosition);
