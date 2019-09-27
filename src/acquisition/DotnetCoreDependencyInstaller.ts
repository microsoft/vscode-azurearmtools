/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { which } from 'shelljs';
import * as vscode from 'vscode';

// tslint:disable: prefer-template

const moreInfoUrl = 'https://aka.ms/dotnet-linux-prereqs';

export class DotnetCoreDependencyInstaller {
    private readonly platform: NodeJS.Platform = process.platform;

    public constructor(private _outputChannel: vscode.OutputChannel) {

    }

    public signalIndicatesMissingLinuxDependencies(signal: string | undefined | null): boolean {
        // If the dotnet does a SIGABRT on Linux this can mean that there are missing dependencies.
        // In fact, many signals can actually be an indicator of missing libraries on Linux as we have seen
        // SIGSEGV frequently as well. Checking the error stream is not accurate enough as on openSUSE15
        // we get a SIGABRT with no standard error output if libssl1_0_0 is missing (which it is vanilla).
        if (!!signal && this.platform === 'linux' &&
            ['SIGABRT',
                'SIGIOT',
                'SIGSYS',
                'SIGPIPE',
                'SIGSEGV',
                'SIGILL',
                'SIGBUS',
                'SIGPFE',
                'SIGSYS'].includes(signal)) {
            return true;
        }
        return false;
    }

    public async installLinuxDependencies(additionalLibs: { [key: string]: string } = {}, skipDotNetCore: boolean = false): Promise<Number> {
        const scriptRoot = path.join(__dirname, '..', 'install scripts');
        const shellCommand = this.getShellCommand();

        // Determine the distro
        const result = cp.spawnSync(shellCommand, [path.join(scriptRoot, 'determine-linux-distro.sh')]);
        // tslint:disable-next-line: strict-boolean-expressions
        if (!!result.status) {
            // tslint:disable-next-line: restrict-plus-operands
            this._outputChannel.appendLine('Failed to determine distro. Exit code: ' + result.status);
            return result.status;
        }
        const distro = result.stdout.toString().trim();
        this._outputChannel.appendLine('Found distro ' + distro);
        const additionalLibsKey = distro.toLowerCase(); // Always use lower case for this

        // Run the installer for the distro passing in any additional libs for it
        return await this.executeCommandInTerminal(
            'Linux dependency installer (.NET Core)',
            shellCommand,
            [path.join(scriptRoot, 'install-linux-prereqs.sh'),
                distro,
            (additionalLibs[additionalLibsKey] ? `"${additionalLibs[additionalLibsKey]}"` : ''),
            skipDotNetCore.toString(),
                moreInfoUrl]);
    }

    public async promptLinuxDependencyInstall(telemetryProperties: { [key: string]: string | undefined }, failureMessage: string, additionalLibs: { [key: string]: string } = {}, skipDotNetCore: boolean = false): Promise<boolean> {
        // tslint:disable-next-line:no-constant-condition
        while (true) {
            const response = await vscode.window.showErrorMessage(
                failureMessage + ' You may be missing key Linux libraries. Install them now?',
                'More Info',
                'Install',
                'Cancel');
            // tslint:disable-next-line: strict-boolean-expressions
            telemetryProperties.response = response || '';

            if (response === 'More Info') {
                // Don't return, user has to explicitly hit "cancel"
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(moreInfoUrl));
            } else if (response === 'Install') {
                const exitCode = await this.installLinuxDependencies(additionalLibs, skipDotNetCore);

                if (exitCode !== 0) {
                    const msg = (exitCode === 4 ?
                        'Your Linux distribution is not supported by the automated installer' :
                        'The dependency installer failed.');
                    // Terminal will pause for input on error so this is just an info message with a more info button
                    const failResponse = await vscode.window.showErrorMessage(
                        msg + ' Try installing dependencies manually.',
                        'More Info');
                    if (failResponse === 'More Info') {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(moreInfoUrl));
                    }
                    return false;
                }

                const reloadResponse = await vscode.window.showInformationMessage(
                    'The dependency installer has completed successfully. Reload to activate your extensions!',
                    'Reload Now');
                if (reloadResponse === 'Reload Now') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                return true;
            } else {
                // response === 'Cancel'
                return false;
            }

        }
    }

    private getShellCommand(): string {
        if (this.platform === 'win32') {
            return which('cmd').toString();
        }
        // Test for existence of bash which won't exist on the base Alpine Linux container, use sh instead there
        const shellCommand = which('bash');
        // shellCommand will be null if bash is not found
        // tslint:disable-next-line: strict-boolean-expressions
        return shellCommand ? shellCommand.toString() : which('sh').toString();
    }

    public async executeCommandInTerminal(name: string, command: string, args: string[] = [], promptAfterRun: boolean = false): Promise<number> {
        // tslint:disable-next-line:typedef
        return await new Promise<number>((resolve, reject) => {
            const fullCommand = `"${command}" ${(args.length > 0 ? ' "' + args.join('" "') + '"' : '')}`;
            // tslint:disable-next-line: restrict-plus-operands insecure-random
            const exitCodeFile = path.join(__dirname, '..', 'terminal-exit-code-' + Math.floor(Math.random() * 1000000));
            // tslint:disable-next-line:prefer-array-literal
            const commandList = new Array<string>();
            if (this.platform === 'win32') {
                // Note that "|| echo %ERRORLEVEL% >"" in this command sequence is a hack to get the exit code
                // from the executed command given VS Code terminal does not return it.
                commandList.push(
                    'cls',
                    `echo 0 > "${exitCodeFile}"`,
                    `${fullCommand} || echo %ERRORLEVEL% > "${exitCodeFile}"`
                );
                if (promptAfterRun) {
                    commandList.push('pause');
                }
            } else {
                // Note that "|| echo $? >" in this command sequence is a hack to get the exit code from the
                // executed command given VS Code terminal does not return it.
                commandList.push(
                    'clear',
                    `echo 0 > "${exitCodeFile}"`,
                    `${fullCommand} || echo $? > "${exitCodeFile}"`
                );
                if (promptAfterRun) {
                    commandList.push(
                        'echo "Press enter to close the terminal window."',
                        'sync',
                        'read'
                    );
                }
            }
            commandList.push('exit 0');
            const commandSequence = commandList.join(' && ');
            // Use a long name to reduce the chances of overlap with other extension installers
            const terminal = vscode.window.createTerminal(name);
            terminal.sendText(commandSequence, true);
            terminal.show(false);
            // If the scripts executes successfully, reload
            vscode.window.onDidCloseTerminal((terminalEvent) => {
                if (terminalEvent.name === terminal.name) {
                    // Hack to get exit code - VS Code terminal does not return it
                    try {
                        if (fs.existsSync(exitCodeFile)) {
                            const exitFile = fs.readFileSync(exitCodeFile).toString().trim();
                            fs.unlinkSync(exitCodeFile); // Delete file since we don't need it anymore
                            if (exitFile) {
                                const exitCode = parseInt(exitFile, 10);
                                if (exitCode === 0) {
                                    // NOOP
                                } else {
                                    // Possible that this is an expected exit code, so just a warning
                                    this._outputChannel.appendLine(`Non-zero exit code detected: ${exitCode}`);
                                }
                                resolve(exitCode);
                            } else {
                                const message = `Terminal "${name}" run resulted in empty exit file. Command likely did not execute successfully.`;
                                reject(new Error(message));
                            }
                        } else {
                            const message = `Terminal "${name}" did not generate an exit file. Command likely did not execute successfully.`;
                            reject(new Error(message));
                        }
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });
    }
}
