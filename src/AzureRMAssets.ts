// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as path from "path";
import { assetsPath } from './constants';
import { ExpressionType } from './ExpressionType';
import { assert } from './fixed_assert';
import { IUsageInfo } from './Hover';
import { Behaviors, IFunctionMetadata, IFunctionParameterMetadata } from './IFunctionMetadata';
import { DefinitionKind, INamedDefinition } from './INamedDefinition';
import { StringValue } from './JSON';

export function isBuiltinFunctionDefinition(definition: INamedDefinition): definition is BuiltinFunctionMetadata {
    return definition.definitionKind === DefinitionKind.BuiltinFunction;
}

/**
 * An accessor class for the Azure RM storage account.
 */
// tslint:disable-next-line:no-unnecessary-class // Grandfathered in
export class AzureRMAssets {
    private static _functionsMetadata: FunctionsMetadata | undefined;

    // For test dependency injection only
    public static setFunctionsMetadata(metadataString: string | undefined): void {
        if (!metadataString) {
            // Reset so next call to getFunctionsMetadata will retrieve real data
            AzureRMAssets._functionsMetadata = undefined;
        } else {
            let array = BuiltinFunctionMetadata.fromString(metadataString);
            AzureRMAssets._functionsMetadata = new FunctionsMetadata(array);
        }
    }

    public static getFunctionsMetadata(): FunctionsMetadata {
        if (!AzureRMAssets._functionsMetadata) {
            let uri = AzureRMAssets.getFunctionMetadataUri();
            let contents = AzureRMAssets.readFile(uri);
            let array: BuiltinFunctionMetadata[] = BuiltinFunctionMetadata.fromString(contents);
            AzureRMAssets._functionsMetadata = new FunctionsMetadata(array);
        }

        return AzureRMAssets._functionsMetadata;
    }

    public static getFunctionMetadataFromName(functionName: string): BuiltinFunctionMetadata | undefined {
        return this.getFunctionsMetadata().findbyName(functionName);
    }

    public static getFunctionMetadataFromPrefix(functionNamePrefix: string): BuiltinFunctionMetadata[] {
        return this.getFunctionsMetadata().filterByPrefix(functionNamePrefix);
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

    private static readFile(filePath: string): string {
        return fse.readFileSync(filePath, "utf8");
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
// tslint:disable-next-line: no-bitwise
export class BuiltinFunctionMetadata implements IFunctionMetadata, INamedDefinition {
    // tslint:disable-next-line: no-unnecessary-field-initialization
    public readonly nameValue: StringValue | undefined = undefined;
    public definitionKind: DefinitionKind = DefinitionKind.BuiltinFunction;

    private readonly _name: string;
    private readonly _lowerCaseName: string;
    private readonly _returnType: ExpressionType | undefined;

    constructor(
        name: string,
        private readonly _usage: string,
        private readonly _description: string,
        private readonly _minimumArguments: number,
        private readonly _maximumArguments: number | undefined,
        private readonly _returnValueMembers: string[],
        private readonly _behaviors: Behaviors[] | undefined | null
    ) {
        assert(_maximumArguments !== null, "Use undefined, not null");

        // tslint:disable-next-line: strict-boolean-expressions
        this._name = name || '';
        this._lowerCaseName = this._name.toLowerCase();

        // CONSIDER: Our metadata doesn't currently give the return type
        // ... Except if it has value members, it must be an object
        this._returnType = this.returnValueMembers.length > 0 ? 'object' : undefined;
    }

    public get fullName(): string {
        return this._name;
    }

    public get unqualifiedName(): string {
        return this._name;
    }

    public get lowerCaseName(): string {
        return this._lowerCaseName;
    }

    public get usage(): string {
        return this.returnType ? `${this._usage} [${this.returnType}]` : this._usage;
    }

    public get usageInfo(): IUsageInfo {
        return {
            usage: this.usage,
            friendlyType: "function",
            description: this.description
        };
    }

    public get parameters(): IFunctionParameterMetadata[] {
        const usage: string = this.usage;
        const leftParenthesisIndex: number = usage.indexOf("(");
        const rightParenthesisIndex: number = usage.indexOf(")");

        const parametersSubstring: string = usage.substr(leftParenthesisIndex + 1, rightParenthesisIndex - leftParenthesisIndex - 1);
        const result: IFunctionParameterMetadata[] = [];
        if (parametersSubstring) {
            for (const parameter of parametersSubstring.split(",")) {
                result.push({ name: parameter.trim(), type: undefined }); // CONSIDER: Our metadata doesn't currently give the parameter types
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

    public get maximumArguments(): number | undefined {
        return this._maximumArguments;
    }

    public get returnType(): ExpressionType | undefined {
        return this._returnType;
    }

    public get returnValueMembers(): string[] {
        return this._returnValueMembers;
    }

    public hasBehavior(behavior: Behaviors): boolean {
        for (let b of this._behaviors ?? []) {
            if (b === behavior) {
                return true;
            }
        }

        return false;
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
                        functionMetadata.maximumArguments ?? undefined,
                        returnValueMembers,
                        functionMetadata.behaviors));
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
        maximumArguments: number | null;
        returnValueMembers?: {
            name: string;
        }[];
        behaviors: Behaviors[] | null;
    }[];
}
