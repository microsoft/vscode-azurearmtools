// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as path from "path";
import { assetsPath } from './constants';
import { ExpressionType } from './ExpressionType';
import { IFunctionMetadata, IFunctionParameterMetadata } from './IFunctionMetadata';

/**
 * An accessor class for the Azure RM storage account.
 */
// tslint:disable-next-line:no-unnecessary-class // Grandfathered in
export class AzureRMAssets {
    private static _functionsMetadataPromise: Promise<FunctionsMetadata> | undefined;

    // For test dependency injection only
    public static setFunctionsMetadata(metadataString: string): void {
        // tslint:disable-next-line:typedef
        AzureRMAssets._functionsMetadataPromise = new Promise<FunctionsMetadata>(async (resolve, reject) => {
            let array = BuiltinFunctionMetadata.fromString(metadataString);
            resolve(new FunctionsMetadata(array));
        });
    }

    public static async getFunctionsMetadata(): Promise<FunctionsMetadata> {
        if (!AzureRMAssets._functionsMetadataPromise) {
            // tslint:disable-next-line:typedef
            AzureRMAssets._functionsMetadataPromise = new Promise<FunctionsMetadata>(async (resolve, reject) => {
                try {
                    let uri = AzureRMAssets.getFunctionMetadataUri();
                    let contents = await AzureRMAssets.readFile(uri);
                    let array: BuiltinFunctionMetadata[] = BuiltinFunctionMetadata.fromString(contents);
                    resolve(new FunctionsMetadata(array));
                } catch (err) {
                    reject(err);
                }
            });
        }

        return await AzureRMAssets._functionsMetadataPromise;
    }

    public static async getFunctionMetadataFromName(functionName: string): Promise<BuiltinFunctionMetadata | undefined> {
        return (await this.getFunctionsMetadata()).findbyName(functionName);
    }

    public static async getFunctionMetadataFromPrefix(functionNamePrefix: string): Promise<BuiltinFunctionMetadata[]> {
        return (await this.getFunctionsMetadata()).filterByPrefix(functionNamePrefix);
    }

    /**
     * Get the URI to the file where the function metadata is stored.
     */
    private static getFunctionMetadataUri(): string {
        return AzureRMAssets.getLocalAssetUri("ExpressionMetadata.json");
    }

    private static getLocalAssetUri(assetFileName: string): string {
        return path.join(assetsPath, assetFileName);
    }

    private static async readFile(filePath: string): Promise<string> {
        return await fse.readFile(filePath, "utf8");
    }
}

/**
 * Metadata for all TLE (Template Language Expression) functions.
 */
export class FunctionsMetadata {
    public constructor(public readonly functionMetadata: BuiltinFunctionMetadata[]) {
    }

    public findbyName(functionName: string): BuiltinFunctionMetadata | undefined {
        const lowerCasedFunctionName: string = functionName.toLowerCase();
        return this.functionMetadata.find(func => func.lowerCaseName === lowerCasedFunctionName);
    }

    public filterByPrefix(functionNamePrefix: string): BuiltinFunctionMetadata[] {
        const lowerCasedPrefix: string = functionNamePrefix.toLowerCase();
        return this.functionMetadata.filter(func => func.lowerCaseName.startsWith(lowerCasedPrefix));
    }
}

/**
 * Metadata for a TLE (Template Language Expression) function.
 */
export class BuiltinFunctionMetadata implements IFunctionMetadata {
    private readonly _name: string;
    private readonly _lowerCaseName: string;
    private readonly _returnType: ExpressionType | null;

    constructor(
        name: string,
        private readonly _usage: string,
        private readonly _description: string,
        private readonly _minimumArguments: number,
        private readonly _maximumArguments: number,
        private readonly _returnValueMembers: string[]
    ) {
        // tslint:disable-next-line: strict-boolean-expressions
        this._name = name || '';
        this._lowerCaseName = this._name.toLowerCase();

        // CONSIDER: Our metadata doesn't currently give the return type
        // ... Except if it has value members, it must be an object
        this._returnType = this.returnValueMembers.length > 0 ? 'object' : null;
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

    public get parameters(): IFunctionParameterMetadata[] {
        const usage: string = this.usage;
        const leftParenthesisIndex: number = usage.indexOf("(");
        const rightParenthesisIndex: number = usage.indexOf(")");

        const parametersSubstring: string = usage.substr(leftParenthesisIndex + 1, rightParenthesisIndex - leftParenthesisIndex - 1);
        const result: IFunctionParameterMetadata[] = [];
        if (parametersSubstring) {
            for (const parameter of parametersSubstring.split(",")) {
                result.push({ name: parameter.trim(), type: null }); // CONSIDER: Our metadata doesn't currently give the parameter types
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

    public get returnType(): ExpressionType | null {
        return this._returnType;
    }

    public get returnValueMembers(): string[] {
        return this._returnValueMembers;
    }

    public static fromString(metadataString: string): BuiltinFunctionMetadata[] {
        let metadataJSON: FunctionMetadataContract;
        try {
            metadataJSON = <FunctionMetadataContract>JSON.parse(metadataString);
        } catch (e) {
            metadataJSON = { functionSignatures: [] };
        }
        return BuiltinFunctionMetadata.fromJSON(metadataJSON);
    }

    public static fromJSON(metadataJSON: FunctionMetadataContract): BuiltinFunctionMetadata[] {
        const result: BuiltinFunctionMetadata[] = [];

        // tslint:disable-next-line: strict-boolean-expressions
        if (metadataJSON && metadataJSON.functionSignatures) {
            for (const functionMetadata of metadataJSON.functionSignatures) {
                // tslint:disable-next-line: strict-boolean-expressions
                if (functionMetadata) {
                    const returnValueMembers: string[] = [];
                    if (functionMetadata.returnValueMembers) {
                        for (const returnValueMember of functionMetadata.returnValueMembers) {
                            returnValueMembers.push(returnValueMember.name);
                        }
                    }
                    returnValueMembers.sort();

                    result.push(new BuiltinFunctionMetadata(
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
    functionSignatures: {
        // These are validated via the ExpressionMetadata.schema.json file when editing ExpressionMetadata.json
        name: string;
        expectedUsage: string;
        description: string;
        minimumArguments: number;
        maximumArguments: number;
        returnValueMembers?: {
            name: string;
        }[];
    }[];
}
