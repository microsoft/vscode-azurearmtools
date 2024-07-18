/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable: prefer-template

// NOTE: This is used by gulp and should avoid referencing other code if possible

import * as path from 'path';
import * as common from '../extension.bundle';
import { writeToLog } from './support/testLog';

export const DEFAULT_TESTCASE_TIMEOUT_MS = common.DEFAULT_TESTCASE_TIMEOUT_MS;

export const basePath = common.basePath
export const assetsPath = common.assetsPath;
export const iconsPath = common.iconsPath

export const isWin32 = common.isWin32;

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_SLOW_TESTS = !!/^(true|1)$/i.test(process.env.DISABLE_SLOW_TESTS || '');
writeToLog(`DISABLE_SLOW_TESTS = ${DISABLE_SLOW_TESTS}`);

// tslint:disable-next-line: strict-boolean-expressions
export const DISABLE_LANGUAGE_SERVER: boolean = !!/^(true|1)$/i.test(process.env.DISABLE_LANGUAGE_SERVER || '') || DISABLE_SLOW_TESTS;
writeToLog(`DISABLE_LANGUAGE_SERVER = ${DISABLE_LANGUAGE_SERVER}`);

// This folder gets published as an artifact after the pipeline runs
export const logsFolder = path.join(basePath, 'logs');

export const newParamValueCompletionLabel = `new-parameter-value`;
export const newParamValueCompletionLabelWithQuotes = `"${newParamValueCompletionLabel}"`;

export namespace testMessages {
    export function nestedTemplateNoValidation(templateName: string, range?: string): string {
        return `Information: Nested template "${templateName}" will not have validation or parameter completion. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command).`
            + (range ? ` (arm-template (expressions)) ${range}` : "");
    }

    export function linkedTemplateNoValidation(templateName: string, range?: string): string {
        return `Information: Linked template "${templateName}" will not have validation or parameter completion. To enable, either add default values to all top-level parameters or add a parameter file ("Select/Create Parameter File" command).`
            + (range ? ` (arm-template (expressions)) ${range}` : "");
    }
}
