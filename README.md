# Azure Resource Manager Tools

This extension provides language support for Azure Resource Manager deployment templates and template language expressions.

## Features
- IntelliSense
    - [Template Language Expression (TLE) function names](https://go.microsoft.com/fwlink/?LinkID=733958)
    - [Parameter references](https://go.microsoft.com/fwlink/?LinkID=733959)
    - [Variable references](https://go.microsoft.com/fwlink/?LinkID=733960)
    - [resourceGroup() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#resourcegroup)
    - [subscription() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#subscription)
    - Properties of references to variables that are objects
- [Signature help](https://code.visualstudio.com/docs/editor/editingevolved#_parameter-hints) for TLE function parameters
- [Go To Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) for variable and parameter references
- [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) for variable and parameter definitions
- Find all references (Shift + F12) for variables and parameters
- Rename all references (F2) for variables and parameters
- [Hover](https://code.visualstudio.com/docs/editor/editingevolved#_hover) for parameter description
- [TLE brace matching](https://code.visualstudio.com/docs/editor/editingevolved#_bracket-matching)
- [Errors](https://code.visualstudio.com/docs/editor/editingevolved#_errors-warnings) for:
    - Undefined parameter references
    - Undefined variable references
    - Unrecognized TLE function names
    - [reference() function usage in variable definition](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#reference)
    - Incorrect number of arguments in TLE functions
- [Warnings](https://code.visualstudio.com/docs/editor/editingevolved#_errors-warnings) for:
    - Unused parameters
    - Unused variables

## To Install

Press F1 in VSCode, type "ext install" and then look for "Azure Resource Manager Tools".

## Feedback

Please post questions, comments, feature requests, or bugs at [UserVoice](https://go.microsoft.com/fwlink/?LinkID=733961).

## License and Privacy Statement

Please see our [EULA](https://go.microsoft.com/fwlink/?LinkID=734037) and [Privacy Statement](https://www.visualstudio.com/en-us/dn948229).

If you want to opt out of telemetry, you can do so by:
1. Opening VS Code
2. Select File > Preferences > User Settings
3. Change "azurermtools.enableTelemetry" value to false.

## Related Links

- [VS Code Azure Resource Manager snippets and cross platform deployment scripts](https://go.microsoft.com/fwlink/?LinkID=733962)
- [Azure Quickstart Templates](https://go.microsoft.com/fwlink/?LinkID=734038)

## Change Log

Version 0.3.7 (09/08/2017)
- Add support for if, and, or, not and json TLEs

Version 0.3.6 (07/27/2017)
- Bug fix for autocompletion

Version 0.3.5 (05/11/2017)
- Add new TLE function metadata

Version 0.3.4 (01/27/2017)
- Update dependencies versions

Version 0.3.3 (10/31/2016)
- Bug fixes

Version 0.3.2 (06/15/2016)
- Bug fixes

Version 0.3.1 (06/08/2016)
- Removed Resources link to License

Version 0.3.0 (06/08/2016)
- Add [resourceGroup() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#resourcegroup)
- Add [subscription() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#subscription)
- Add [signature help](https://code.visualstudio.com/docs/editor/editingevolved#_parameter-hints) for TLE function parameters
- Add find all references (Shift + F12) for variables and parameters
- Add rename all references (F2) for variables and parameters
- Add error for [reference() function usage in variable definition](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#reference)
- Add error for incorrect number of arguments in TLE functions
- Add warning for unused parameters
- Add warning for unused variables
- Add IntelliSense for properties of references to variables that are objects

Version 0.2.0 (05/23/2016)
- Add [Go to Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) for parameter and variable references
- Add [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) for variable and parameter definitions
- Various bug fixes and improved telemetry

Version 0.1.2
- Add user survey prompt and make parameter and variable references case-insensitive

Version 0.1.1
- Fix function, parameter, and variable IntelliSense 

Version 0.1.0
- Initial release