/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require('gulp');
const path = require('path');
const cp = require('child_process');

gulp.task('test', (cb) => {
    const env = process.env;
    env.DEBUGTELEMETRY = 1;
    env.MOCHA_reporter = 'mocha-junit-reporter';
    env.MOCHA_FILE = path.join(__dirname, 'test-results.xml');
    const cmd = cp.spawn('node', ['./node_modules/vscode/bin/test'], { stdio: 'inherit', env });
    cmd.on('close', (code) => {
        cb(code);
    });
});


