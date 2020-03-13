// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { QuickPickItem, Uri, window } from "vscode";
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { CaseInsensitiveMap } from './CaseInsensitiveMap';
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ExpressionType } from './ExpressionType';
import { ext } from './extensionVariables';
import { IParameterDefinition } from './IParameterDefinition';
import { assertNever } from './util/assertNever';
import { indentMultilineString, removeIndentation } from './util/multilineStrings';

const defaultIndent: number = 4;

export async function queryCreateParameterFile(actionContext: IActionContext, templateUri: Uri, template: DeploymentTemplate, indent: number = defaultIndent): Promise<Uri> {
    const all = <QuickPickItem>{ label: "All parameters" };
    const required = <QuickPickItem>{ label: "Only required parameters", description: "Uses only parameters that have no default value in the template file" };

    const whichParams = await ext.ui.showQuickPick([all, required], {
        placeHolder: `Include which parameters from ${path.basename(templateUri.fsPath)}?`
    });
    const onlyRequiredParams = whichParams === required;
    actionContext.telemetry.properties.onlyRequiredParams = String(onlyRequiredParams);

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

    let paramsObj: string = createParameterFileContents(template, indent, onlyRequiredParams);
    await fse.writeFile(newUri.fsPath, paramsObj, {
        encoding: 'utf8'
    });

    return newUri;
}

export function createParameterFileContents(template: DeploymentTemplate, indent: number, onlyRequiredParameters: boolean): string {
    /* e.g.

    {
        "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "parameter1": {
                "value": "value"
            }
        }
    }

    */

    const tab = makeIndent(indent);

    const params: CaseInsensitiveMap<string, string> = createParameters(template, indent, onlyRequiredParameters);
    const paramsContent = params.map((key, value) => value).join(`,${os.EOL}`);

    let contents = `{
${tab}"$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentParameters.json#",
${tab}"contentVersion": "1.0.0.0",
${tab}"parameters": {
`;

    if (params.size > 0) {
        contents += indentMultilineString(paramsContent, indent * 2) + os.EOL;
    }

    contents += `${tab}}
}`;

    return contents;
}

export function createParameterProperty(template: DeploymentTemplate, parameter: IParameterDefinition, indent: number = defaultIndent): string {
    /* e.g.

    "parameters": {
        "parameter2": {
            "value": "value"
        }
    }

    */

    let value: string = getDefaultValueFromType(parameter.validType, indent);
    if (parameter.defaultValue) {
        const defValueSpan = parameter.defaultValue.span;
        const defValue: string = template.documentText.slice(defValueSpan.startIndex, defValueSpan.afterEndIndex);
        value = removeIndentation(defValue, true);
    }

    const valueIndentedAfterFirstLine: string = indentMultilineString(value.trimLeft(), indent).trimLeft();

    // tslint:disable-next-line:prefer-template
    return `"${parameter.nameValue.unquotedValue}": {` + os.EOL
        + `${makeIndent(indent)}"value": ${valueIndentedAfterFirstLine}` + os.EOL
        + `}`;
}

// export async function addParameterToParameterFile(editor: TextEditor, template: DeploymentTemplate, parameter: IParameterDefinition): Promise<void> {
//     const parameterText: string = createParameterProperty(template, parameter, defaultIndent);
//     appendPropertyTextIntoObject(editor, parameterText);
// }

// function appendPropertyTextIntoObject(editor: TextEditor, text: string, jsonObject: Json.ObjectValue) {

// }

function getDefaultValueFromType(propType: ExpressionType | undefined, indent: number): string {
    const comment = "// TODO: Fill in parameter value";
    const tab = ' '.repeat(indent);

    switch (propType) {
        case "array":
            return `[${os.EOL}${tab}${comment}${os.EOL}]`;

        case "bool":
            return `false ${comment}`;

        case "int":
            return `0 ${comment}`;

        case "object":
        case "secureobject":
            return `{${os.EOL}${tab}${comment}${os.EOL}}`;

        case "securestring":
        case "string":
        case undefined:
            return `"" ${comment}`;

        default:
            assertNever(propType);
    }
}

function createParameters(template: DeploymentTemplate, indent: number, onlyRequiredParameters: boolean): CaseInsensitiveMap<string, string> {
    let params: CaseInsensitiveMap<string, string> = new CaseInsensitiveMap<string, string>();

    for (let paramDef of template.topLevelScope.parameterDefinitions) {
        if (!onlyRequiredParameters || !paramDef.defaultValue) {
            params.set(paramDef.nameValue.unquotedValue, createParameterProperty(template, paramDef, indent));
        }
    }

    return params;
}

function makeIndent(indent: number): string {
    return ' '.repeat(indent);
}
