// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as path from 'path';
import { QuickPickItem, Uri, window } from "vscode";
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { CaseInsensitiveMap } from './CaseInsensitiveMap';
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ExpressionType } from './ExpressionType';
import { ext } from './extensionVariables';
import { IParameterDefinition } from './IParameterDefinition';
import * as Json from "./JSON";
import * as TLE from './TLE';
import { assertNever } from './util/assertNever';
import { indentMultilineString, unindentMultilineString } from './util/multilineStrings';

export const defaultTabSize: number = 4;
export enum ContentKind {
    snippet = "snippet",
    text = "text"
}
export enum WhichParams {
    all = "all",
    required = "required"
}

export async function queryCreateParameterFile(actionContext: IActionContext, templateUri: Uri, template: DeploymentTemplate, tabSize: number = defaultTabSize): Promise<Uri> {
    const all = <QuickPickItem>{ label: "All parameters" };
    const required = <QuickPickItem>{ label: "Only required parameters", description: "Uses only parameters that have no default value in the template file" };

    const whichParamsResponse = await ext.ui.showQuickPick([all, required], {
        placeHolder: `Include which parameters from ${path.basename(templateUri.fsPath)}?`
    });
    const whichParams = whichParamsResponse === required ? WhichParams.required : WhichParams.all;
    actionContext.telemetry.properties.onlyRequiredParams = String(whichParams === WhichParams.required);

    const fileNameWithoutJsonC: string = path.basename(templateUri.fsPath)
        .replace(/\.[Jj][Ss][Oo][Nn][Cc]?$/, '');
    const defaultParamPath: string = path.join(
        path.dirname(templateUri.fsPath),
        `${fileNameWithoutJsonC}.parameters.json`);

    let newUri: Uri | undefined = await window.showSaveDialog({
        defaultUri: Uri.file(defaultParamPath),
        filters: {
            JSON: ['json', 'jsonc']
        }
    });
    if (!newUri) {
        throw new UserCancelledError();
    }

    let paramsObj: string = createParameterFileContents(template, tabSize, whichParams);
    await fse.writeFile(newUri.fsPath, paramsObj, {
        encoding: 'utf8'
    });

    return newUri;
}

export function createParameterFileContents(template: DeploymentTemplate, tabSize: number, whichParams: WhichParams): string {
    /* e.g.

    {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "parameter1": {
                "value": "value"
            }
        }
    }

    */

    const tab = makeIndent(tabSize);

    const params: CaseInsensitiveMap<string, string> = createParameters(template, tabSize, whichParams, ContentKind.text);
    const paramsContent = params.map((key, value) => value).join(`,${ext.EOL}`);

    // tslint:disable-next-line: prefer-template
    let contents = `{` + ext.EOL +
        `${tab}"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",` + ext.EOL +
        `${tab}"contentVersion": "1.0.0.0",` + ext.EOL +
        `${tab}"parameters": {` + ext.EOL;

    if (params.size > 0) {
        contents += indentMultilineString(paramsContent, tabSize * 2) + ext.EOL;
    }

    // tslint:disable-next-line: prefer-template
    contents += `${tab}}` + ext.EOL
        + `}`;

    return contents;
}

/**
 * Creates text for a property using information for that property in a template file
 * @param tabSize The number of spaces to indent at each level. The parameter text will start flush left
 */
export function createParametersFromTemplateParameters(template: DeploymentTemplate, parameters: IParameterDefinition[], kind: ContentKind, tabSize: number = defaultTabSize): string {
    let paramsAsText: string[] = [];
    for (let param of parameters) {
        const paramText = createParameterFromTemplateParameterCore(template, param, kind, tabSize); //asdftestpoint
        paramsAsText.push(paramText);
    }

    const text = paramsAsText.join(`,${ext.EOL}`);
    return replaceIndices(text);
}

/**
 * Creates text for a property using information for that property in a template file
 * @param tabSize The number of spaces to indent at each level. The parameter text will start flush left
 */
export function createParameterFromTemplateParameter(template: DeploymentTemplate, parameter: IParameterDefinition, kind: ContentKind, tabSize: number = defaultTabSize): string {
    const text = createParameterFromTemplateParameterCore(template, parameter, kind, tabSize);
    return replaceIndices(text);
}

function createParameterFromTemplateParameterCore(template: DeploymentTemplate, parameter: IParameterDefinition, kind: ContentKind, tabSize: number = defaultTabSize): string {

    /* e.g.

    "parameters": {
        "parameter2": {
            "value": "value"
        }
    }

    */

    let value: string | undefined;
    if (parameter.defaultValue) {
        // If the parameter has a default value that's not an expression, then use it as the
        // value in the param file
        const isExpression = parameter.defaultValue instanceof Json.StringValue &&
            TLE.isTleExpression(parameter.defaultValue.unquotedValue);
        if (!isExpression) {
            const defValueSpan = parameter.defaultValue.span;
            const defValue: string = template.documentText.slice(defValueSpan.startIndex, defValueSpan.afterEndIndex);
            value = unindentMultilineString(defValue, true);
        }
    }
    if (value === undefined) {
        value = getDefaultValueFromType(parameter.validType, tabSize, kind);
    }

    const valueIndentedAfterFirstLine: string = indentMultilineString(value.trimLeft(), tabSize).trimLeft();

    // tslint:disable-next-line:prefer-template
    return `"${parameter.nameValue.unquotedValue}": {` + ext.EOL
        + `${makeIndent(tabSize)}"value": ${valueIndentedAfterFirstLine}` + ext.EOL
        + `}`;
}

function getDefaultValueFromType(propType: ExpressionType | undefined, indent: number, kind: ContentKind): string {
    const isSnippet = kind === ContentKind.snippet;
    // tslint:disable-next-line: no-invalid-template-strings
    const value = isSnippet ? '${$$INDEX$$:value}' : 'value';
    const tab = ' '.repeat(indent);

    switch (propType) {
        case "array":
            return `[${ext.EOL}${tab}${value}${ext.EOL}]`;

        case "bool":
            return `false ${value}`; //asdf

        case "int":
            return `${value}`; //asdf

        case "object":
        case "secureobject":
            return `{${ext.EOL}${tab}${value}${ext.EOL}}`;

        case "securestring":
        case "string":
        case undefined:
            return `"${value}"`;

        default:
            assertNever(propType);
    }
}

function createParameters(template: DeploymentTemplate, tabSize: number, whichParams: WhichParams, kind: ContentKind): CaseInsensitiveMap<string, string> {
    const params: CaseInsensitiveMap<string, string> = new CaseInsensitiveMap<string, string>();
    const onlyRequiredParameters = whichParams === WhichParams.required;

    for (let paramDef of template.topLevelScope.parameterDefinitions) {
        if (!onlyRequiredParameters || !paramDef.defaultValue) {
            params.set(paramDef.nameValue.unquotedValue, createParameterFromTemplateParameter(template, paramDef, kind, tabSize));
        }
    }

    return params;
}

function makeIndent(tabSize: number): string {
    return ' '.repeat(tabSize);
}

function replaceIndices(snippetText: string): string {
    let index = 1;

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const newText = snippetText.replace('$$INDEX$$', String(index));
        if (newText === snippetText) {
            return snippetText;
        }

        snippetText = newText;
        ++index;
    }
}
