/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';

export const DEFAULT_TESTCASE_TIMEOUT_MS = 2 * 60 * 1000;

export const isWebpack: boolean = /^(false|0)?$/i.test(process.env.AZCODE_ARM_IGNORE_BUNDLE ?? '');

export const isWin32: boolean = os.platform() === 'win32';
export const isCaseSensitiveFileSystem: boolean = !isWin32;

export const basePath = path.join(__dirname, isWebpack ? "" : "..", "..");

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_SLOW_TESTS = !!/^(true|1)$/i.test(process.env.DISABLE_SLOW_TESTS || '');
console.log(`DISABLE_SLOW_TESTS = ${DISABLE_SLOW_TESTS}`);

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_LANGUAGE_SERVER: boolean = !!/^(true|1)$/i.test(process.env.DISABLE_LANGUAGE_SERVER || '') || DISABLE_SLOW_TESTS;
console.log(`DISABLE_LANGUAGE_SERVER = ${DISABLE_LANGUAGE_SERVER}`);

// This folder gets published as an artifact after the pipeline runs
export const logsFolder = path.join(basePath, 'logs');

export namespace testMessages {
    export function nestedTemplateNoValidation(templateName: string): string {
        return `Information: Nested template "${templateName}" will not have validation or parameter completion. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command).`;
    }

    export function linkedTemplateNoValidation(templateName: string): string {
        return `Information: Linked template "${templateName}" will not have validation or parameter completion. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command).`;
    }
}
