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
import { formatText, IFormatTextOptions, prependToEachLine } from './util/multilineStrings';

export enum ContentKind {
    /**
     * Generates a snippet that can be inserted
     */
    snippet = "snippet",
    /**
     * Generates plain text that can be writen into a file or buffer
     */
    text = "text"
}

export enum ParamsToGenerate {
    all = "all",
    required = "required"
}

export async function queryCreateParameterFile(actionContext: IActionContext, templateUri: Uri, template: DeploymentTemplate, options: IFormatTextOptions): Promise<Uri> {
    const all = <QuickPickItem>{ label: "All parameters" };
    const required = <QuickPickItem>{ label: "Only required parameters", description: "Uses only parameters that have no default value in the template file" };

    const whichParamsResponse = await ext.ui.showQuickPick([all, required], {
        placeHolder: `Include which parameters from ${path.basename(templateUri.fsPath)}?`
    });
    const whichParams = whichParamsResponse === required ? ParamsToGenerate.required : ParamsToGenerate.all;
    actionContext.telemetry.properties.onlyRequiredParams = String(whichParams === ParamsToGenerate.required);

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

    let paramsObj: string = createParameterFileContents(template, options, whichParams);
    await fse.writeFile(newUri.fsPath, paramsObj, {
        encoding: 'utf8'
    });

    return newUri;
}

export function createParameterFileContents(template: DeploymentTemplate, options: IFormatTextOptions, whichParams: ParamsToGenerate): string {
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

    const params: CaseInsensitiveMap<string, string> = createParameters(template, options, whichParams, ContentKind.text);
    const paramsContent = params.map((key, value) => value).join(`,${ext.EOL}`);

    // tslint:disable-next-line: prefer-template
    let contents = `{` + ext.EOL +
        `\t"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",` + ext.EOL +
        `\t"contentVersion": "1.0.0.0",` + ext.EOL +
        `\t"parameters": {` + ext.EOL;

    if (params.size > 0) {
        contents += prependToEachLine(paramsContent, '\t\t') + ext.EOL; //asdf
    }

    // tslint:disable-next-line: prefer-template
    contents += `\t}` + ext.EOL
        + `}`;

    return formatText(contents, options);
}

/**
 * Creates text for a property using information for that property in a template file
 * @param tabSize The number of spaces to indent at each level. The parameter text will start flush left
 */
export function createParametersFromTemplateParameters(template: DeploymentTemplate, parameters: IParameterDefinition[], kind: ContentKind, options: IFormatTextOptions): string {
    let paramsAsText: string[] = [];
    for (let param of parameters) {
        const paramText = createParameterFromTemplateParameterCore(template, param, kind, options); //asdftestpoint
        paramsAsText.push(paramText);
    }

    const text = paramsAsText.join(`,${ext.EOL}`);
    return makeIndicesUnique(text);
}

/**
 * Creates text for a property using information for that property in a template file
 * @param tabSize The number of spaces to indent at each level. The parameter text will start flush left
 */
export function createParameterFromTemplateParameter(template: DeploymentTemplate, parameter: IParameterDefinition, kind: ContentKind, options: IFormatTextOptions): string {
    const text = createParameterFromTemplateParameterCore(template, parameter, kind, options);
    return makeIndicesUnique(text);
}

function createParameterFromTemplateParameterCore(template: DeploymentTemplate, parameter: IParameterDefinition, kind: ContentKind, options: IFormatTextOptions): string {

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
            TLE.isTleExpression(parameter.defaultValue.unquotedValue); //asdf testpoint
        if (!isExpression) {
            const defValueSpan = parameter.defaultValue.span; //asdf testpoint
            const defValue: string = template.documentText.slice(defValueSpan.startIndex, defValueSpan.afterEndIndex);
            // Reformat
            value = defValue;
            try {
                value = JSON.stringify(JSON.parse(value), null, '\t');
            } catch (err) {
                // Ignore errors
            }
        }
    }
    if (value === undefined) {
        value = getDefaultValueFromType(parameter.validType, kind);
    }

    const valueIndentedAfterFirstLine: string = prependToEachLine(value.trimLeft(), '\t').trimLeft(); //asdf

    // tslint:disable-next-line:prefer-template
    const result = `"${parameter.nameValue.unquotedValue}": {` + ext.EOL
        + `\t"value": ${valueIndentedAfterFirstLine}` + ext.EOL
        + `}`;

    return formatText(result, options);
}

function getDefaultValueFromType(propType: ExpressionType | undefined, kind: ContentKind): string {
    const isSnippet = kind === ContentKind.snippet; //asdf testpoint
    // tslint:disable-next-line: no-invalid-template-strings
    const value = isSnippet ? '${$$INDEX$$:value}' : 'value';

    switch (propType) {
        case "array":
            return `[${ext.EOL}\t${value}${ext.EOL}]`; //asdf testpoint

        case "bool":
            return `false ${value}`; //asdf //asdf testpoint

        case "int":
            return `${value}`; //asdf //asdf testpoint

        case "object":
        case "secureobject":
            return `{${ext.EOL}\t${value}${ext.EOL}}`; //asdf testpoint

        case "securestring":
        case "string":
        case undefined:
            return `"${value}"`;

        default:
            assertNever(propType);
    }
}

function createParameters(template: DeploymentTemplate, options: IFormatTextOptions, whichParams: ParamsToGenerate, kind: ContentKind): CaseInsensitiveMap<string, string> {
    const params: CaseInsensitiveMap<string, string> = new CaseInsensitiveMap<string, string>();
    const onlyRequiredParameters = whichParams === ParamsToGenerate.required;

    for (let paramDef of template.topLevelScope.parameterDefinitions) {
        if (!onlyRequiredParameters || !paramDef.defaultValue) {
            params.set(paramDef.nameValue.unquotedValue, createParameterFromTemplateParameter(template, paramDef, kind, options)); //asdf testpoint
        }
    }

    return params;
}

/**
 * Replace eaach occurrence of the string '$$INDEX$$' with a unique integer starting at 1
 */
function makeIndicesUnique(snippetText: string): string {
    let index = 1; //asdf testpoint

    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const newText = snippetText.replace('$$INDEX$$', String(index)); //asdf testpoint
        if (newText === snippetText) {
            return snippetText; //asdf testpoint
        }

        snippetText = newText; //asdf testpoint
        ++index;
    }
}
