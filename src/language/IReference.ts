// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { IJsonDocument } from "../documents/templates/IJsonDocument";
import { Span } from "./Span";

export interface IReference {
    document: IJsonDocument;
    span: Span;
}
