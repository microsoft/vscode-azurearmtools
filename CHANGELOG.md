# Change Log
All notable changes to the "vscode-azurearmtools" extension will be documented in this file.

## Version 0.7.0 (2019-09-16)
### Added
- 0.7.0 contains the first release of a new language service that we are creating specifically for Azure Resource Manager deployment template files.  Up to this point, the extension has been built on top of the built-in VS Code JSON language server.  This has caused some problems, including:
  1. Deployment templates allow comments, unlike standard JSON files
  1. Deployment templates allow multi-line strings
  1. Deployment templates use case-insensitive properties
  1. Deployment templates have looser type rules, allowing substitutions such as "true" and "false" instead of true and false
  1. The large schema files published for Azure resources cause poor validation performance
  1. The errors provided by standard JSON validation frequently provide poor suggestions for fixing (due to lack of knowledge of Azure Resource Manager-specific properties such as resource name and apiVersion)

The new language server aims to provide a better experience for deployment template creation and editing by alleviating many of the problems above.
This version addresses points 1-3 above (see [#fixed](#fixed-070) section). We intend to alleviate more of these problems in upcoming versions.
In addition, we are considering other improvements to the experience, such as:
1. Snippets
2. User-defined functions support
3. Copy loops support
If you would like to suggest additional features, or for other comments or problems, please enter a new issue at our [public repo](https://github.com/microsoft/vscode-azurearmtools/issues).

### Fixed<a id="fixed-070"></a>
- Comments are now supported (`//` and `/* */` styles)
- Multi-line strings are now supported
- Schema validation no longer reports false positives because of incorrectly-cased properties
Examples:
```json
  "parameters": {
    "dnsLabelPrefix": {
      "type": "String", << No longer flagged as incorrect
```
```json
    "resources": [
        {
            "type": "microsoft.network/networkInterfaces", << No longer flagged as incorrect
```
- Expressions in property names are not colorized [#225](https://github.com/microsoft/vscode-azurearmtools/issues/225)
- Intellisense completion for parameter object properties defined inside a defaultValue [#124](https://github.com/microsoft/vscode-azurearmtools/issues/124)
- Parameters color not correct if whitespace separates param name from parentheses [#239](https://github.com/microsoft/vscode-azurearmtools/issues/239)
- Does not correctly handle colorization when a string starts with a bracket but does not end with a bracket [#250](https://github.com/microsoft/vscode-azurearmtools/issues/250)

## Version 0.6.0 (2019-04-25)
### Added
- Expressions inside strings are now colorized
- Support subscription deployment templates [#188](https://github.com/Microsoft/vscode-azurearmtools/pull/188)
### Fixed
- Random notifications with "documentColumnIndex cannot be greater than the line's maximum index" [#193](https://github.com/Microsoft/vscode-azurearmtools/issues/193)
- Missing functions added:
  - newGuid, dateTime (may only be used as a defaultValue on a parameter) (thanks @sanjaiganesh!) [#183](https://github.com/Microsoft/vscode-azurearmtools/pull/183)
  - listConnectionStrings [#192](https://github.com/Microsoft/vscode-azurearmtools/issues/192)
  - listCredentials [#187](https://github.com/Microsoft/vscode-azurearmtools/issues/187)
  - format [#190](https://github.com/Microsoft/vscode-azurearmtools/issues/190)
- Support escaped apostrophe in strings [#199](https://github.com/Microsoft/vscode-azurearmtools/issues/34)
- Extension 'msazurermtools.azurerm-vscode-tools' uses a document selector without scheme [#94](https://github.com/Microsoft/vscode-azurearmtools/issues/94)
- Update dev readme [#220](https://github.com/Microsoft/vscode-azurearmtools/pull/220)

## 0.5.1 (2019-04-19)
### Fixed
- Extension does not load in older vscode versions:
    - https://github.com/Microsoft/vscode-azurearmtools/issues/206

## Version 0.5.0 (2019-02-26)
### Changed
- Changed view title from "JSON OUTLINE" to "ARM TEMPLATE OUTLINE" [#145](https://github.com/Microsoft/vscode-azurearmtools/issues/145)
- Add "Report Issue" button directly to error messages
### Fixed
- Improved start-up and installation performance
- Rename variable/parameter definition doesn't work if you don't rename double quotes [#63](https://github.com/Microsoft/vscode-azurearmtools/issues/63)
- Added `listAccountSas` [#125](https://github.com/Microsoft/vscode-azurearmtools/pull/125)
- Added `listAdminKeys` (on SearchService) and `listServiceSas` (on Storage) [#128](https://github.com/Microsoft/vscode-azurearmtools/pull/128)
- Updated text on `listKeys` to reflect 2016 and later apiVersion changes [#128](https://github.com/Microsoft/vscode-azurearmtools/pull/128)
- Allow for 1..n args on `and` and `or` [#159](https://github.com/Microsoft/vscode-azurearmtools/pull/159)
- Better handle asynchronous errors [#169](https://github.com/Microsoft/vscode-azurearmtools/pull/169)

## Version 0.4.2 (05/15/2018)
### Fixed:
- [JSON outline doesn"t show up if jsonc template opened before any json templates](https://github.com/Microsoft/vscode-azurearmtools/issues/106)

## Version 0.4.1 (05/07/2018)
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

## Version 0.4.0 (02/01/2018)
- Add JSON outline for ARM depolyment templates

## Version 0.3.8 (11/30/2017)
- Add support for guid TLE
- Bug fixes

## Version 0.3.7 (09/08/2017)
- Add support for if, and, or, not and json TLEs

## Version 0.3.6 (07/27/2017)
- Bug fix for autocompletion

## Version 0.3.5 (05/11/2017)
- Add new TLE function metadata

## Version 0.3.4 (01/27/2017)
- Update dependencies versions

## Version 0.3.3 (10/31/2016)
- Bug fixes

## Version 0.3.2 (06/15/2016)
- Bug fixes

## Version 0.3.1 (06/08/2016)
- Removed Resources link to License

## Version 0.3.0 (06/08/2016)
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

## Version 0.2.0 (05/23/2016)
- Add [Go to Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) for parameter and variable references
- Add [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) for variable and parameter definitions
- Various bug fixes and improved telemetry

## Version 0.1.2
- Add user survey prompt and make parameter and variable references case-insensitive

## Version 0.1.1
- Fix function, parameter, and variable IntelliSense

## Version 0.1.0
- Initial release
