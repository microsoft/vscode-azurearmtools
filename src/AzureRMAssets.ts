// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-use-before-declare

import * as fse from 'fs-extra';
import * as path from "path";

/**
 * An accessor class for the Azure RM storage account.
 */
// tslint:disable-next-line:no-unnecessary-class // Grandfathered in
export class AzureRMAssets {
    private static _functionsMetadataPromise: Promise<FunctionsMetadata>;

    // For test dependency injection only
    public static setFunctionsMetadata(metadataString: string): void {
        AzureRMAssets._functionsMetadataPromise = new Promise<FunctionsMetadata>(async (resolve, reject) => {
            let array = FunctionMetadata.fromString(metadataString);
            resolve(new FunctionsMetadata(array));
        });
    }

    public static async getFunctionsMetadata(): Promise<FunctionsMetadata> {
        if (!AzureRMAssets._functionsMetadataPromise) {
            AzureRMAssets._functionsMetadataPromise = new Promise<FunctionsMetadata>(async (resolve, reject) => {
                try {
                    let uri = AzureRMAssets.getFunctionMetadataUri();
                    let contents = await AzureRMAssets.readFile(uri);
                    let array: FunctionMetadata[] = FunctionMetadata.fromString(contents);
                    resolve(new FunctionsMetadata(array));
                } catch (err) {
                    reject(err);
                }
            });
        }

        return await AzureRMAssets._functionsMetadataPromise;
    }

    public static async getFunctionMetadataFromName(functionName: string): Promise<FunctionMetadata> {
        return (await this.getFunctionsMetadata()).findbyName(functionName);
    }

    public static async getFunctionMetadataFromPrefix(functionNamePrefix: string): Promise<FunctionMetadata[]> {
        return (await this.getFunctionsMetadata()).filterByPrefix(functionNamePrefix);
    }

    /**
     * Get the URI to the file where the function metadata is stored.
     */
    private static getFunctionMetadataUri(): string {
        return AzureRMAssets.getLocalAssetUri("ExpressionMetadata.json");
    }

    private static getLocalAssetUri(assetFileName: string): string {
        // Relative to dist
        return path.join(__filename, "..", "..", "assets", assetFileName);
    }

    private static async readFile(filePath: string): Promise<string> {
        return await fse.readFile(filePath, "utf8");
    }
}

/**
 * Metadata for all TLE (Template Language Expression) functions.
 */
export class FunctionsMetadata {
    public constructor(public readonly functionMetadata: FunctionMetadata[]) {
    }

    public findbyName(functionName: string): FunctionMetadata | undefined {
        const lowerCasedFunctionName: string = functionName.toLowerCase();
        return this.functionMetadata.find(func => func.lowerCaseName === lowerCasedFunctionName);
    }

    public filterByPrefix(functionNamePrefix: string): FunctionMetadata[] {
        const result: FunctionMetadata[] = [];
        const lowerCasedPrefix: string = functionNamePrefix.toLowerCase();
        return this.functionMetadata.filter(func => func.lowerCaseName.startsWith(lowerCasedPrefix));
    }
}

/**
 * Metadata for a TLE (Template Language Expression) function.
 */
export class FunctionMetadata {
    private _name: string;
    private _lowerCaseName: string;

    constructor(
        name: string,
        private _usage: string,
        private _description: string,
        private _minimumArguments: number,
        private _maximumArguments: number,
        private _returnValueMembers: string[]
    ) {
        this._name = name || '';
        this._lowerCaseName = this._name.toLowerCase();
    }

    public get name(): string {
        return this._name;
    }

    public get lowerCaseName(): string {
        return this._lowerCaseName;
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
        } catch (e) {
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

interface FunctionMetadataContract {
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
