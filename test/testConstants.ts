/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { basePath } from "../extension.bundle";

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_SLOW_TESTS = !!/^(true|1)$/i.test(process.env.DISABLE_SLOW_TESTS || '');
console.log(`DISABLE_SLOW_TESTS = ${DISABLE_SLOW_TESTS}`);

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_LANGUAGE_SERVER: boolean = !!/^(true|1)$/i.test(process.env.DISABLE_LANGUAGE_SERVER || '') || DISABLE_SLOW_TESTS;
console.log(`DISABLE_LANGUAGE_SERVER = ${DISABLE_LANGUAGE_SERVER}`);

// This folder gets published as an artifact after the pipeline runs
export const logsFolder = path.join(basePath, 'logs');
