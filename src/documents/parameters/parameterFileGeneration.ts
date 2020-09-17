// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as path from 'path';
import { QuickPickItem, Uri, window } from "vscode";
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { isTleExpression } from "../../language/expressions/isTleExpression";
import * as Json from "../../language/json/JSON";
import { assertNever } from '../../util/assertNever';
import { CaseInsensitiveMap } from '../../util/CaseInsensitiveMap';
import { indentMultilineString, unindentMultilineString } from '../../util/multilineStrings';
import { ExpressionType } from '../templates/ExpressionType';
import { TemplateScope } from '../templates/scopes/TemplateScope';
import { IParameterDefinition } from './IParameterDefinition';
import { IParameterDefinitionsSource } from './IParameterDefinitionsSource';

export const defaultTabSize: number = 4;

export async function queryCreateParameterFile(actionContext: IActionContext, scope: TemplateScope, tabSize: number = defaultTabSize): Promise<Uri> {
    const all = <QuickPickItem>{ label: "All parameters" };
    const required = <QuickPickItem>{ label: "Only required parameters", description: "Uses only parameters that have no default value in the template file" };
    const templateUri = scope.document.documentUri;

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

    let paramsObj: string = createParameterFileContents(scope, tabSize, onlyRequiredParams);
    await fse.writeFile(newUri.fsPath, paramsObj, {
        encoding: 'utf8'
    });

    return newUri;
}

export function createParameterFileContents(scope: TemplateScope, tabSize: number, onlyRequiredParameters: boolean): string {
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

    const params: CaseInsensitiveMap<string, string> = createParameters(scope, tabSize, onlyRequiredParameters);
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
export function createParameterFromTemplateParameter(parameterDefinitionsSource: IParameterDefinitionsSource, parameter: IParameterDefinition, tabSize: number = defaultTabSize): string {
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
            isTleExpression(parameter.defaultValue.unquotedValue);
        if (!isExpression) {
            const defValueSpan = parameter.defaultValue.span;
            const defValue: string = parameterDefinitionsSource.document.documentText.slice(defValueSpan.startIndex, defValueSpan.afterEndIndex);
            value = unindentMultilineString(defValue, true);
        }
    }
    if (value === undefined) {
        value = getDefaultValueFromType(parameter.validType, tabSize);
    }

    const valueIndentedAfterFirstLine: string = indentMultilineString(value.trimLeft(), tabSize).trimLeft();

    // tslint:disable-next-line:prefer-template
    return `"${parameter.nameValue.unquotedValue}": {` + ext.EOL
        + `${makeIndent(tabSize)}"value": ${valueIndentedAfterFirstLine}` + ext.EOL
        + `}`;
}

function getDefaultValueFromType(propType: ExpressionType | undefined, indent: number): string {
    const comment = "// TODO: Fill in parameter value";
    const tab = ' '.repeat(indent);

    switch (propType) {
        case "array":
            return `[${ext.EOL}${tab}${comment}${ext.EOL}]`;

        case "bool":
            return `false ${comment}`;

        case "int":
            return `0 ${comment}`;

        case "object":
        case "secureobject":
            return `{${ext.EOL}${tab}${comment}${ext.EOL}}`;

        case "securestring":
        case "string":
        case undefined:
            return `"" ${comment}`;

        default:
            assertNever(propType);
    }
}

function createParameters(scope: TemplateScope, tabSize: number, onlyRequiredParameters: boolean): CaseInsensitiveMap<string, string> {
    let params: CaseInsensitiveMap<string, string> = new CaseInsensitiveMap<string, string>();

    for (let paramDef of scope.parameterDefinitions) {
        if (!onlyRequiredParameters || !paramDef.defaultValue) {
            params.set(paramDef.nameValue.unquotedValue, createParameterFromTemplateParameter(scope, paramDef, tabSize));
        }
    }

    return params;
}

function makeIndent(tabSize: number): string {
    return ' '.repeat(tabSize);
}
