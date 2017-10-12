// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as http from "http";

import { HttpClient } from "./HttpClient";
import { SurveyMetadata } from "./SurveyMetadata";

/**
 * An accessor class for the Azure RM storage account.
 */
export class AzureRMAssets {
    private static _versionRedirects: Promise<VersionRedirect[]>;
    private static _currentVersionRedirectUri: Promise<string>;
    private static _surveyMetadataUri: Promise<string>;
    private static _surveyMetadata: Promise<SurveyMetadata>;
    private static _functionMetadataUri: Promise<string>;
    private static _functionMetadata: Promise<FunctionMetadata[]>;

    /**
     * Indicates which version container in the storage account the extension will use for its
     * metadata.
     */
    public static get currentPublishVersion(): string {
        return "azuresdk-3.0.0";
    }

    public static getFunctionMetadata(): Promise<FunctionMetadata[]> {
        if (AzureRMAssets._functionMetadata === undefined) {
            AzureRMAssets._functionMetadata = AzureRMAssets.getFunctionMetadataUri()
                .then(HttpClient.get)
                .then(FunctionMetadata.fromString);
        }
        return AzureRMAssets._functionMetadata;
    }

    public static getFunctionMetadataWithName(functionName: string): Promise<FunctionMetadata> {
        return AzureRMAssets.getFunctionMetadata()
            .then((functionMetadataArray: FunctionMetadata[]) => {
                let result: FunctionMetadata = null;

                const lowerCasedFunctionName: string = functionName.toLowerCase();
                for (const functionMetadata of functionMetadataArray) {
                    if (functionMetadata.name && functionMetadata.name.toLowerCase() === lowerCasedFunctionName) {
                        result = functionMetadata;
                        break;
                    }
                }

                return result;
            });
    }

    public static getFunctionMetadataWithPrefix(functionNamePrefix: string): Promise<FunctionMetadata[]> {
        return AzureRMAssets.getFunctionMetadata()
            .then((functionMetadataArray: FunctionMetadata[]) => {
                const result: FunctionMetadata[] = [];

                const lowerCasedPrefix: string = functionNamePrefix.toLowerCase();
                for (const functionMetadata of functionMetadataArray) {
                    if (functionMetadata.name && functionMetadata.name.toLowerCase().startsWith(lowerCasedPrefix)) {
                        result.push(functionMetadata);
                    }
                }

                return result;
            });
    }

    /**
     * Get the URI to the file where the function metadata is stored.
     */
    public static getFunctionMetadataUri(): Promise<string> {
        if (AzureRMAssets._functionMetadataUri === undefined) {
            AzureRMAssets._functionMetadataUri = AzureRMAssets.getAssetUri("ExpressionMetadata.json");
        }
        return AzureRMAssets._functionMetadataUri;
    }

    private static getAssetUri(assetFileName: string): Promise<string> {
        return AzureRMAssets.getCurrentVersionRedirectUri()
            .then((versionRedirectUri: string) => {
                return versionRedirectUri + (versionRedirectUri.endsWith("/") ? "" : "/") + assetFileName;
            });
    }

    public static getSurveyMetadata(): Promise<SurveyMetadata> {
        if (AzureRMAssets._surveyMetadata === undefined) {
            AzureRMAssets._surveyMetadata = AzureRMAssets.getSurveyMetadataUri()
                .then(SurveyMetadata.fromUrl);
        }
        return AzureRMAssets._surveyMetadata;
    }

    public static getSurveyMetadataUri(): Promise<string> {
        if (AzureRMAssets._surveyMetadataUri === undefined) {
            AzureRMAssets._surveyMetadataUri = AzureRMAssets.getAssetUri("SurveyMetadata.json");
        }
        return AzureRMAssets._surveyMetadataUri;
    }

    public static getCurrentVersionRedirectUri(): Promise<string> {
        if (AzureRMAssets._currentVersionRedirectUri === undefined) {
            AzureRMAssets._currentVersionRedirectUri = new Promise((resolve, reject) => {
                AzureRMAssets.getVersionRedirects()
                    .then((versionRedirects: VersionRedirect[]) => {
                        let foundVersionRedirectForPublishVersion: boolean = false;
                        for (const versionRedirect of versionRedirects) {
                            if (versionRedirect.Version === AzureRMAssets.currentPublishVersion) {
                                foundVersionRedirectForPublishVersion = true;
                                resolve(versionRedirect.StorageContainerUri);
                                break;
                            }
                        }

                        if (!foundVersionRedirectForPublishVersion) {
                            reject({
                                message: `Could not find a version redirect for publish version '${AzureRMAssets.currentPublishVersion}'`
                            });
                        }
                    })
                    .catch((reason: any) => {
                        reject(reason);
                    });
            });
        }
        return AzureRMAssets._currentVersionRedirectUri;
    }

    public static getVersionRedirects(): Promise<VersionRedirect[]> {
        if (AzureRMAssets._versionRedirects === undefined) {
            AzureRMAssets._versionRedirects = new Promise((resolve, reject) => {
                HttpClient.get("https://azurermtoolsprod.blob.core.windows.net/redirects/versionRedirects.json")
                    .then((content: string) => {
                        try {
                            resolve(JSON.parse(content.trim()));
                        }
                        catch (e) {
                            reject({
                                message: "Could not parse the versionRedirects.json file.",
                                error: e
                            });
                        }
                    })
                    .catch((reason: any) => {
                        reject(reason);
                    });
            });
        }
        return AzureRMAssets._versionRedirects;
    }
}

export interface VersionRedirect {
    Version: string;
    StorageContainerUri: string;
}

/**
 * Metadata for a TLE function.
 */
export class FunctionMetadata {
    constructor(
        private _name: string,
        private _usage: string,
        private _description: string,
        private _minimumArguments: number,
        private _maximumArguments: number,
        private _returnValueMembers: string[]) {
    }

    public get name(): string {
        return this._name;
    }

    public get usage(): string {
        return this._usage;
    }

    public get parameters(): string[] {
        const usage: string = this.usage;
        const leftParenthesisIndex: number = usage.indexOf("(");
        const rightParenthesisIndex: number = usage.indexOf(")");

        const parametersSubstring: string = usage.substr(leftParenthesisIndex + 1, rightParenthesisIndex - leftParenthesisIndex - 1);
        const result: string[] = [];
        if (parametersSubstring) {
            for (const parameter of parametersSubstring.split(",")) {
                result.push(parameter.trim());
            }
        }

        return result;
    }

    public get description(): string {
        return this._description;
    }

    public get minimumArguments(): number {
        return this._minimumArguments;
    }

    public get maximumArguments(): number {
        return this._maximumArguments;
    }

    public get returnValueMembers(): string[] {
        return this._returnValueMembers;
    }

    public static fromString(metadataString: string): FunctionMetadata[] {
        let metadataJSON: FunctionMetadataContract;
        try {
            metadataJSON = JSON.parse(metadataString);
        }
        catch (e) {
            metadataJSON = {};
        }
        return FunctionMetadata.fromJSON(metadataJSON);
    }

    public static fromJSON(metadataJSON: FunctionMetadataContract): FunctionMetadata[] {
        const result: FunctionMetadata[] = [];

        if (metadataJSON && metadataJSON.functionSignatures) {
            for (const functionMetadata of metadataJSON.functionSignatures) {
                if (functionMetadata) {
                    const returnValueMembers: string[] = [];
                    if (functionMetadata.returnValueMembers) {
                        for (const returnValueMember of functionMetadata.returnValueMembers) {
                            returnValueMembers.push(returnValueMember.name);
                        }
                    }
                    returnValueMembers.sort();

                    result.push(new FunctionMetadata(
                        functionMetadata.name,
                        functionMetadata.expectedUsage,
                        functionMetadata.description,
                        functionMetadata.minimumArguments,
                        functionMetadata.maximumArguments,
                        returnValueMembers));
                }
            }
        }

        return result;
    }
}

export interface FunctionMetadataContract {
    functionSignatures?: {
        name?: string;
        expectedUsage?: string;
        description?: string;
        minimumArguments?: number;
        maximumArguments?: number;
        returnValueMembers?: {
            name?: string;
        }[];
    }[];
}