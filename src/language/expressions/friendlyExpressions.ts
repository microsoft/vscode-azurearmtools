// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------

import { isSingleQuoted, removeDoubleQuotes, removeSingleQuotes } from "../../util/strings";
import { isTleExpression } from "./isTleExpression";
import { Parser } from "./TLE";

/**
 * Given a JSON string that might or might not be a bracketed expression, return a friendly representation of that string
 *
 * @example 'Microsoft.sql/servers' => '"Microsoft.sql/servers"'
 * @example '[variables('v1')]' => '${v1}'
 * @example '[variables('v1')]' => '${v1}'
 */
export function getFriendlyExpressionFromJsonString(jsonString: string): string {
    // If it's an expression - starts and ends with [], but doesn't start with [[, and at least one character inside the []
    if (isTleExpression(jsonString)) {
        const quotedBracketedJsonString = `"${jsonString}"`;
        return getFriendlyExpressionFromTleExpressionCore(quotedBracketedJsonString);
    }

    // Not an expression, return as is
    return jsonString;
}

/**
 * Given a TLE expression (without the brackets), return a friendly representation of that string
 *
 * @example 'variables('v1')' => '${v1}'
 * @example 'concat(variables('a'), '/', parameters('b'))' => '"${a}/${b}"'
 * @example 'concat(variables('a'), '/', func())' => '[${a}/func()]'
 */
export function getFriendlyExpressionFromTleExpression(tleExpression: string): string {
    if (isSingleQuoted(tleExpression)) {
        // Just a string literal, e.g. "'my string'"
        return removeSingleQuotes(tleExpression);
    }

    // Otherwise it's an expression.  Add brackets so we can parse it.
    const quotedBracketedJsonString = `"[${tleExpression}]"`;
    return getFriendlyExpressionFromTleExpressionCore(quotedBracketedJsonString);
}

function getFriendlyExpressionFromTleExpressionCore(doubleQuotedBracketedJsonString: string): string {
    const pr = Parser.parse(doubleQuotedBracketedJsonString);
    if (pr.expression && pr.errors.length === 0) {
        const friendlyExpression = pr.expression.format({ friendly: true });
        if (isSingleQuoted(friendlyExpression)) {
            // Example:
            //   "'${virtualMachineName}/${diagnosticsExtensionName}'"
            //      => "${virtualMachineName}/${diagnosticsExtensionName}"
            return removeSingleQuotes(friendlyExpression);
        } else if (isParamOrVarInterpolation(friendlyExpression)) {
            // It's just a single param/var reference, return as is
            // Example:
            //   "${var1}"
            //     => "${var1}" (unchanged)
            return friendlyExpression;
        } else {
            // It's some other type of more complicated expression, return with brackets to make that clear
            // Example:
            //   "myFunctions.vmName(${virtualMachineName}, copyindex(1))"
            //     => "[myFunctions.vmName(${virtualMachineName}, copyindex(1))]"
            return `[${friendlyExpression}]`;
        }
    } else {
        // There are parse errors, so we can't rely on the parse results.  Instead, just do some quick string interpolation replacements,
        // remove the double quotes, keep the square brackets, and be done.
        // Example:
        //   "\"[variables('a')+variables('b')]\"" (invalid expression)
        //     => "[${a}+${b}]"
        const unquotedExpression = removeDoubleQuotes(doubleQuotedBracketedJsonString);
        // tslint:disable-next-line: no-invalid-template-strings
        return unquotedExpression.replace(/(\bvariables\b|\bparameters\b)\('([^']+)'\)/gi, '$${$2}');
    }
}
/**
 * Returns true only if the given expression is a parameter or variable interpolation such as "${var}"
 */
export function isParamOrVarInterpolation(s: string): boolean {
    return !!s.match(/^\${[^{}]+}$/);
}
