// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { isNullOrUndefined } from 'util';
import { ConfigurationTarget, Uri } from 'vscode';
import { configKeys } from '../../constants';
import { normalizeFilePath } from '../../util/normalizedPaths';
import { IConfiguration } from '../../vscodeIntegration/Configuration';
import { getRelativeParameterFilePath, resolveParameterFilePath } from './parameterFilePaths';

interface IMapping {
    // Path using same casing as specified (but /.. and double slashes normalized).
    // Therefore appropriate to show to the user
    resolvedTemplate: Uri;
    // Completely normalized, resolved path (i.e. lower-cased on Win32).
    // Therefore appropriate for use as a key
    normalizedTemplate: Uri;

    resolvedParams: Uri;
    normalizedParams: Uri;
}

export class DeploymentFileMapping {
    private _mapToParams: Map<string, IMapping> | undefined;
    private _mapToTemplates: Map<string, IMapping> | undefined;

    public constructor(private configuration: IConfiguration) { }

    public resetCache(): void {
        this._mapToParams = undefined;
        this._mapToTemplates = undefined;
    }

    private ensureMapsCreated(): void {
        if (this._mapToParams && this._mapToTemplates) {
            return;
        }

        this._mapToParams = new Map<string, IMapping>();
        this._mapToTemplates = new Map<string, IMapping>();

        const paramFiles: { [key: string]: unknown } | undefined =
            this.configuration.get<{ [key: string]: unknown }>(configKeys.parameterFiles)
            // tslint:disable-next-line: strict-boolean-expressions
            || {};
        if (typeof paramFiles === 'object') {
            for (let templatePath of Object.getOwnPropertyNames(paramFiles)) {
                let paramPathObject = paramFiles[templatePath];
                if (typeof paramPathObject !== 'string' || isNullOrUndefined(paramPathObject)) {
                    continue;
                }
                const paramPath: string = <string>paramPathObject;

                const resolvedTemplatePath = path.resolve(templatePath);
                const normalizedTemplatePath: string = normalizeFilePath(resolvedTemplatePath);

                if (path.isAbsolute(templatePath) && isFilePath(templatePath)) {
                    // Resolve parameter file relative to template file's folder
                    let resolvedParamPath: string = resolveParameterFilePath(normalizedTemplatePath, paramPath);
                    if (isFilePath(resolvedParamPath)) {
                        // If the user has an entry in both workspace and user settings, vscode combines the two objects,
                        //   with workspace settings overriding the user settings.
                        // If there are two entries differing only by case, allow the last one to win, because it will be
                        //   the workspace setting value.
                        // Therefore replacing any previous values found.
                        this._mapToParams.set(normalizedTemplatePath, {
                            resolvedTemplate: Uri.file(resolvedTemplatePath),
                            normalizedTemplate: Uri.file(normalizedTemplatePath),
                            resolvedParams: Uri.file(resolvedParamPath),
                            normalizedParams: Uri.file(normalizeFilePath(resolvedParamPath))
                        });
                    }
                }
            }
        }

        // Create reverse mapping
        for (let entry of this._mapToParams) {
            const mapping: IMapping = entry[1];
            this._mapToTemplates.set(mapping.normalizedParams.fsPath, mapping);
        }
    }

    /**
     * Given a template file, find the parameter file, if any, that the user currently has associated with it.
     */
    public getParameterFile(templateFileUri: Uri): Uri | undefined {
        this.ensureMapsCreated();
        const normalizedTemplatePath = normalizeFilePath(templateFileUri);
        const entry = this._mapToParams?.get(normalizedTemplatePath);
        return entry?.resolvedParams;
    }

    /**
     * Given a parameter file, find the template file, if any, that the user currently has associated with it.
     */
    public getTemplateFile(parameterFileUri: Uri): Uri | undefined {
        this.ensureMapsCreated();
        const normalizedParamPath = normalizeFilePath(parameterFileUri);
        const entry = this._mapToTemplates?.get(normalizedParamPath);
        return entry?.resolvedTemplate;
    }

    /**
     * Sets a mapping from a template file to a parameter file
     */
    public async mapParameterFile(templateUri: Uri, paramFileUri: Uri | undefined): Promise<void> {
        const relativeParamFilePath: string | undefined = paramFileUri ? getRelativeParameterFilePath(templateUri, paramFileUri) : undefined;
        const normalizedTemplatePath = normalizeFilePath(templateUri.fsPath);

        // We want to adjust the collection in the user settings, ignoring anything in the workspace settings
        let map = this.configuration
            .inspect<{ [key: string]: string | undefined }>(configKeys.parameterFiles)?.globalValue
            // tslint:disable-next-line: strict-boolean-expressions
            || {};

        if (typeof map !== 'object') {
            map = {};
        }

        // Copy existing entries that don't match (might be multiple entries with different casing, so can't do simple delete)
        const newMap: { [key: string]: string | undefined } = {};

        for (let templatePath of Object.getOwnPropertyNames(map)) {
            if (normalizeFilePath(templatePath) !== normalizedTemplatePath) {
                newMap[templatePath] = map[templatePath];
            }
        }

        // Add new entry
        if (paramFileUri) {
            newMap[normalizedTemplatePath] = relativeParamFilePath;
        }

        await this.configuration.update(configKeys.parameterFiles, newMap, ConfigurationTarget.Global);
        this.resetCache();
    }
}

function isFilePath(p: string): boolean {
    const resolved = path.resolve(p);
    return !!resolved.match(/[^./\\]/);
}
