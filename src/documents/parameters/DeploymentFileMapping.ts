// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { configKeys } from '../../constants';
import { ext } from '../../extensionVariables';
import { assert } from '../../fixed_assert';
import { CaseInsensitiveMap } from '../../util/CaseInsensitiveMap';
import { CaseSensitiveMap } from '../../util/CaseSensitiveMap';
import { caseAwareMapToObject, ICaseAwareMap } from '../../util/ICaseAwareMap';
import { normalizePath } from '../../util/normalizePath';
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
    // Mapping we've determined automatically, only remembered for the current session
    private readonly _automaticMappingsTemplateToParams: ICaseAwareMap<string, string> = createMap();

    private _mapToParams: ICaseAwareMap<string, IMapping> | undefined;
    private _mapToTemplates: ICaseAwareMap<string, IMapping> | undefined;

    public constructor(private configuration: IConfiguration) { }

    public clearCache(options?: { clearAutomaticMappings?: boolean }): void {
        this._mapToParams = undefined;
        this._mapToTemplates = undefined;
        if (options?.clearAutomaticMappings) {
            this._automaticMappingsTemplateToParams.clear();
        }
    }

    private ensureMapsCreated(): void {
        if (this._mapToParams && this._mapToTemplates) {
            return;
        }

        this._mapToParams = createMap();

        const paramFiles: { [key: string]: unknown } | undefined =
            // The Object.assign turns it into a regular object asdf
            Object.assign(
                {},
                caseAwareMapToObject(this._automaticMappingsTemplateToParams),
                this.configuration.get<{ [key: string]: unknown }>(configKeys.parameterFiles) ?? {}
            );
        if (typeof paramFiles === 'object') {
            for (let templatePath of Object.getOwnPropertyNames(paramFiles)) {
                let paramPathAsObject = paramFiles[templatePath] ?? '';
                if (typeof paramPathAsObject !== 'string') {
                    continue;
                }
                const paramPath: string = <string>paramPathAsObject;

                const resolvedTemplatePath = path.resolve(templatePath);
                const normalizedTemplatePath: string = normalizePath(resolvedTemplatePath);

                if (path.isAbsolute(templatePath) && isFilePath(templatePath)) {
                    // Resolve parameter file relative to template file's folder
                    let resolvedParamPath: string | undefined = !!paramPath ? resolveParameterFilePath(normalizedTemplatePath, paramPath) : undefined;
                    if (resolvedParamPath && isFilePath(resolvedParamPath)) {
                        // If the user has an entry in both workspace and user settings, vscode combines the two objects,
                        //   with workspace settings overriding the user settings.
                        // If there are two entries differing only by case, allow the last one to win, because it will be
                        //   the workspace setting value.
                        // Therefore replacing any previous values found.
                        this._mapToParams.set(normalizedTemplatePath, {
                            resolvedTemplate: Uri.file(resolvedTemplatePath),
                            normalizedTemplate: Uri.file(normalizedTemplatePath),
                            resolvedParams: Uri.file(resolvedParamPath),
                            normalizedParams: Uri.file(normalizePath(resolvedParamPath))
                        });
                    } else {
                        this._mapToParams.delete(normalizedTemplatePath); //asdf testpoint
                    }
                }
            }
        }

        // Create reverse mapping
        this._mapToTemplates = createMap();
        for (let entry of this._mapToParams.entries()) {
            const mapping: IMapping = entry[1];
            this._mapToTemplates.set(mapping.normalizedParams.fsPath, mapping);
        }
    }

    /**
     * Given a template file, find the parameter file, if any, that the user currently has associated with it, or undefined if none
     */
    public getParameterFile(templateFileUri: Uri): Uri | undefined {
        this.ensureMapsCreated();
        const normalizedTemplatePath = normalizePath(templateFileUri);
        const entry = this._mapToParams?.get(normalizedTemplatePath);
        const result: Uri | undefined = entry?.resolvedParams;
        assert.notStrictEqual(result?.fsPath, '');
        return result;
    }

    /**
     * Given a parameter file, find the template file, if any, that the user currently has associated with it, or undefined if none
     */
    public getTemplateFile(parameterFileUri: Uri): Uri | undefined {
        this.ensureMapsCreated();
        const normalizedParamPath = normalizePath(parameterFileUri);
        const entry = this._mapToTemplates?.get(normalizedParamPath);
        const result: Uri | undefined = entry?.resolvedTemplate;
        assert.notStrictEqual(result?.fsPath, '');
        return result;
    }

    /**
     * Sets a mapping from a template file to a parameter file
     */
    public async mapParameterFile(
        templateUri: Uri,
        /**
         * '' indicates to not use any parameter file (only allowed for saveInSettings=true)
         * undefined means to go back to automatically finding a parameter file (if setting azureResourceManagerTools.checkForMatchingParameterFiles is enabled) (only allowed for saveInSettings=true)
         */
        paramFileUri: Uri | '' | undefined,
        options: {
            /**
             * If true, the mapping is saved in user settings. Otherwise the mapping is valid only for this session of VS Code
             */
            saveInSettings: boolean;
        } //asdf
    ): Promise<void> { //asdf temp/saved settings should override each other including case-insensitive   asdf null overrides temp
        const relativeParamFilePath: string | undefined = paramFileUri instanceof Uri ? getRelativeParameterFilePath(templateUri, paramFileUri) : paramFileUri;
        const normalizedTemplatePath = normalizePath(templateUri.fsPath);

        if (options.saveInSettings) { //asdf comment on what map is
            // We want to adjust the collection in the user settings, ignoring anything in the workspace settings
            let mapObject = this.configuration.inspect<{ [key: string]: string | undefined }>(configKeys.parameterFiles)?.globalValue
                // tslint:disable-next-line: strict-boolean-expressions
                || {};
            if (typeof mapObject !== 'object') {
                mapObject = {};
            }

            // Remove any entries with the new path by copying existing entries that don't match (might be multiple entries with different casing or non-normalized, so can't do simple delete)
            const newMap = createMap();
            for (let templatePath of Object.getOwnPropertyNames(mapObject)) {
                if (normalizePath(templatePath) !== normalizedTemplatePath) {
                    newMap.set(templatePath, mapObject[templatePath]);
                }
            }

            if (relativeParamFilePath === undefined) {
                newMap.delete(normalizedTemplatePath); //asdf testpoint
            } else if (paramFileUri === '') {
                newMap.set(normalizedTemplatePath, ''); //asdf testpoint
            } else {
                // Add new entry
                newMap.set(normalizedTemplatePath, relativeParamFilePath);
            }

            // Update in settings
            const newMapAsObject = caseAwareMapToObject(newMap);
            await this.configuration.update(configKeys.parameterFiles, newMapAsObject, ConfigurationTarget.Global);
            this.clearCache();
        } else {
            if (relativeParamFilePath === undefined) {
                assert(false, 'relativeParamFilePath === undefined only allowed for saveInSettings=true');
                //delete newMap[normalizedTemplatePath]; //asdf testpoint
            } else if (relativeParamFilePath === '') {
                assert(false, 'paramFileUri === undefined only allowed for saveInSettings=true');
                //newMap[normalizedTemplatePath] = ''; //asdf testpoint
            } else {
                // Add new entry
                this._automaticMappingsTemplateToParams.set(normalizedTemplatePath, relativeParamFilePath);
                this.clearCache();
            }
        }
    }
}

function isFilePath(p: string): boolean {
    const resolved = path.resolve(p);
    return !!resolved.match(/[^./\\]/);
}

function createMap<TKey extends string, TValue>(): ICaseAwareMap<TKey, TValue> {
    if (ext.isFileSystemCaseSensitive) {
        return new CaseSensitiveMap<TKey, TValue>();
    } else {
        return new CaseInsensitiveMap<TKey, TValue>();
    }
}
