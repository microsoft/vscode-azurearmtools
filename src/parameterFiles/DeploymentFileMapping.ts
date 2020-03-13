// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { IConfiguration } from '../Configuration';
import { configKeys } from '../constants';
import { normalizePath } from '../util/normalizePath';
import { getFriendlyPathToParameterFile } from './parameterFiles';

export class DeploymentFileMapping {
    public constructor(private configuration: IConfiguration) { }

    /**
     * Given a template file, find the parameter file, if any, that the user currently has associated with it
     */
    public getParameterFile(templateFileUri: Uri): Uri | undefined {
        const paramFiles: { [key: string]: string } | undefined =
            this.configuration.get<{ [key: string]: string }>(configKeys.parameterFiles)
            // tslint:disable-next-line: strict-boolean-expressions
            || {};
        if (typeof paramFiles === 'object') {
            const normalizedTemplatePath = normalizePath(templateFileUri.fsPath);
            let paramFile: Uri | undefined;

            // Can't do a simple lookup because need to be case-insensitivity tolerant on Win32
            for (let fileNameKey of Object.getOwnPropertyNames(paramFiles)) {
                const normalizedFileName: string | undefined = normalizePath(fileNameKey);
                if (normalizedFileName === normalizedTemplatePath) {
                    if (typeof paramFiles[fileNameKey] === 'string') {
                        // Resolve relative to template file's folder
                        let resolvedPath = path.resolve(path.dirname(templateFileUri.fsPath), paramFiles[fileNameKey]);

                        // If the user has an entry in both workspace and user settings, vscode combines the two objects,
                        //   with workspace settings overriding the user settings.
                        // If there are two entries differing only by case, allow the last one to win, because it will be
                        //   the workspace setting value
                        paramFile = !!resolvedPath ? Uri.file(resolvedPath) : undefined;
                    }
                }
            }

            return paramFile;
        }

        return undefined;
    }

    //asdf
    public getTemplateFile(parameterFileUri: Uri): Uri | undefined {
        const paramFiles: { [key: string]: string } | undefined =
            this.configuration.get<{ [key: string]: string }>(configKeys.parameterFiles)
            // tslint:disable-next-line: strict-boolean-expressions
            || {};
        if (typeof paramFiles === 'object') {
            const normalizedTargetParamPath = normalizePath(parameterFileUri.fsPath);
            let templateFile: Uri | undefined;

            // Can't do a simple lookup because need to be case-insensitivity tolerant on Win32
            for (let fileNameKey of Object.getOwnPropertyNames(paramFiles)) {
                const paramFileName = paramFiles[fileNameKey]; // asdf can this be undefined?
                if (typeof paramFileName !== "string") {
                    continue;
                }

                // Resolve relative to template file's folder
                let resolvedPath = path.resolve(path.dirname(parameterFileUri.fsPath), paramFileName);
                const normalizedParamPath: string = normalizePath(resolvedPath);

                // If the user has an entry in both workspace and user settings, vscode combines the two objects,
                //   with workspace settings overriding the user settings.
                // If there are two entries differing only by case, allow the last one to win, because it will be
                //   the workspace setting value

                if (normalizedParamPath === normalizedTargetParamPath) {
                    templateFile = !!fileNameKey ? Uri.file(fileNameKey) : undefined;
                }
            }

            return templateFile;
        }

        return undefined;
    }

    /**
     * Sets a mapping from a template file to a parameter file
     */
    public async mapParameterFile(templateUri: Uri, paramFileUri: Uri | undefined): Promise<void> {
        const relativeParamFilePath: string | undefined = paramFileUri ? getFriendlyPathToParameterFile(templateUri, paramFileUri) : undefined;
        const normalizedTemplatePath = normalizePath(templateUri.fsPath);

        // We only want the values in the user settings
        const map = this.configuration
            .inspect<{ [key: string]: string | undefined }>(configKeys.parameterFiles)?.globalValue
            // tslint:disable-next-line: strict-boolean-expressions
            || {};

        if (typeof map !== 'object') {
            return;
        }

        // Copy existing entries that don't match (might be multiple entries with different casing, so can't do simple delete)
        const newMap: { [key: string]: string | undefined } = {};

        for (let templatePath of Object.getOwnPropertyNames(map)) {
            if (normalizePath(templatePath) !== normalizedTemplatePath) {
                newMap[templatePath] = map[templatePath];
            }
        }

        // Add new entry
        if (paramFileUri) {
            newMap[templateUri.fsPath] = relativeParamFilePath;
        }

        await this.configuration.update(configKeys.parameterFiles, newMap, ConfigurationTarget.Global);
    }
}
