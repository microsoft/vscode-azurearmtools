# Change Log
All notable changes to the "vscode-azurearmtools" extension will be documented in this file.

Version 0.4.1 (05/07/2018)

- Added support for [JSONC](README.md#using-comments-inside-JSON)
- Improved labeling in JSON outline, similar to Visual Studio
  - Use displayName tag for label of resources when available
  - Shorten labels when possible (e.g. parameters['abc'] -> &lt;abc&gt;)
- Engineering improvements (tests, lint, telemetry)
- Bug fixes:
  - [Unhandled exception: Cannot read property 'catch' of null inside non-template JSON files](https://github.com/Microsoft/vscode-azurearmtools/issues/35)
  - [Incorrect number of parameters is not detected if function name differs in case](https://github.com/Microsoft/vscode-azurearmtools/issues/64)
  - [reference TLE signature intellisense out of date](https://github.com/Microsoft/vscode-azurearmtools/issues/32)
  - [CopyIndex with 2 arguments is considered an error](https://github.com/Microsoft/vscode-azurearmtools/issues/48)
  - [Unrecognized function name 'listCallbackUrl'](https://github.com/Microsoft/vscode-azurearmtools/issues/59)
  - [listSecrets and generic list* functions not recognized](https://github.com/Microsoft/vscode-azurearmtools/issues/72)
  - [listPackage function metadata is missing a description](https://github.com/Microsoft/vscode-azurearmtools/issues/69)

Version 0.4.0 (02/01/2018)
- Add JSON outline for ARM depolyment templates

Version 0.3.8 (11/30/2017)
- Add support for guid TLE
- Bug fixes

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
