# Change Log

All notable changes to the "vscode-azurearmtools" extension will be documented in this file.

## Version 0.9.2 (2020-04-25)

### Changed

- Use .NET Install Tool for Extension Authors (ms-dotnettools.vscode-dotnet-runtime) to download and install .NET core runtime

## Version 0.9.1 (2020-04-20)

### Fixed

- There are problems with this document's schema impacting one or more items in the document (ignore invalid formats in schemas) [#570](https://github.com/microsoft/vscode-azurearmtools/issues/570)
- Use dotnet core v3.1

## Version 0.9.0 (2020-04-14)

### Added

- First round of support for parameter files
  * Specify a parameter file to associate with a template file
  * Parameter file will be used to enable additional validation
  * Create new parameter file from parameters within the template
- Support filtering for child resource type name and apiVersion values
- Template sorting (**implemented by Nils Hedström @nilshedstrom, thanks!**)
- Snippet improvements
  * apiVersions updated
  * various fixes and standardization
- Added more resource type icons for ARM TEMPLATE OUTLINE view (thanks Nils Hedström @nilshedstrom!) [#253](https://github.com/microsoft/vscode-azurearmtools/issues/253)
- Support for schema auto-completion inside nested templates

### Changed

- Now using a single output for extension and language server

### Fixed

- "Found more than 1 match" (oneOf error) in some ARM templates
- Reading schemas from .zip file does not work on Mac
- Arm Template Outline doesn't show up when you first open a file, but does when you tab back to it (thanks Nils Hedström @nilshedstrom!) [#470](https://github.com/microsoft/vscode-azurearmtools/issues/470)
- Snippets should follow the recommendations in https://github.com/Azure/azure-quickstart-templates/blob/master/1-CONTRIBUTION-GUIDE/best-practices.md [#456](https://github.com/microsoft/vscode-azurearmtools/issues/456)
- Not getting any completion for subscription().xxx [#526](https://github.com/microsoft/vscode-azurearmtools/issues/526)
- autocomplete list for child resources should be filtered based on the parent [#350](https://github.com/microsoft/vscode-azurearmtools/issues/350)
- autocomplete list for apiVersions on child resources is empty [#351](https://github.com/microsoft/vscode-azurearmtools/issues/351)
- Null ref exception in validation with empty doc or doc containing only a comment
- Add space after colon with IntelliSense [#460](https://github.com/microsoft/vscode-azurearmtools/issues/460)

## Version 0.8.5 (2020-03-30)

### Fixed

- "Error loading Schemas" [#536](https://github.com/microsoft/vscode-azurearmtools/issues/536)

## Version 0.8.4 (2020-02-05)

### Added

- Added new snippets for subscription, management group and tenant deployments scaffolding (`arm!s`, `arm!mg` and `arm!t`) [#449](https://github.com/microsoft/vscode-azurearmtools/issues/449)

### Fixed

- An error in loading ARM schemas from 2014 Preview [#438](https://github.com/microsoft/vscode-azurearmtools/issues/438)
- Fallback on cached schemas on Linux and MacOS
- arm! and armp! snippets are using old \$schema (thanks Nils Hedström @nilshedstrom!) [#432](https://github.com/microsoft/vscode-azurearmtools/issues/432)
- Fixed icons for "Functions" entry in treeview (thanks Nils Hedström @nilshedstrom!) [#427](https://github.com/microsoft/vscode-azurearmtools/pull/427)
- Assertion Failed when opening ARM Templates [#441](https://github.com/microsoft/vscode-azurearmtools/issues/441)
- Add optional customer survey
- Updated web-app and web-app-deploy schema to 2018-11-01 [#451](https://github.com/microsoft/vscode-azurearmtools/issues/451)
- "Format Document" and schema validation don't work against unsaved ARM templates [#464](https://github.com/microsoft/vscode-azurearmtools/issues/464)
- Error downloading dotnet - VERSION_ID: unbound variable [#422](https://github.com/microsoft/vscode-azurearmtools/issues/422)
- Engineering improvements

## Version 0.8.3 (2019-12-16)

### Fixed

- Cannot install extension with "'" in username/users path [#356](https://github.com/microsoft/vscode-azurearmtools/issues/356)
- Error updating \$schema if editor no longer has focus [#389](https://github.com/microsoft/vscode-azurearmtools/issues/389)
- Should only ask once per vscode session to upgrade \$schema if Not Now chosen [#391](https://github.com/microsoft/vscode-azurearmtools/issues/391)
- We shouldn't allow renaming built-in functions [#385](https://github.com/microsoft/vscode-azurearmtools/issues/385)
- Update API Version on Nested Deployment Snippet [#402](https://github.com/microsoft/vscode-azurearmtools/issues/402)
- Improve diagnostics for dotnet acquisition failures
- Added current schemas as cache in case schemas fail to download

### Added

- Intellisense support for additional runtime functions:
  - listAuthKeys
  - listClusterAdminCredential
  - listCredential
  - listQueryKeys
  - listSyncFunctionTriggerStatus
- New "Reload Cached Schemas" command
- Added six new resource icons (plus functions icons see [#421](https://github.com/microsoft/vscode-azurearmtools/issues/421)) for ARM Template Outline (thanks Nils Hedström @nilshedstrom!) [#417](https://github.com/microsoft/vscode-azurearmtools/pull/417)

## Version 0.8.2 (2019-11-08)

### Fixed

- Full template validation has been temporarily disabled until we can find a long-term solution for some bugs. This fixed:
  - Template validation error for evaluated variables [#380](https://github.com/microsoft/vscode-azurearmtools/issues/380)
  - Validation fails using int() with parameter
  - Validation error if you have a parameter of type "object" [regression from 0.7.0]

## Version 0.8.1 (2019-11-01)

### Added

- Support for variable iteration ("variable COPY blocks") [(ARM template variable copy block highlighting error #30)](https://github.com/microsoft/vscode-azurearmtools/issues/30), see https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-multiple#variable-iteration
- Added `azureResourceManagerTools.languageServer.dotnetExePath` setting to allow using an existing dotnet installation as a work-around for installation issues
- Added expression metadata for the environment() function [#344](https://github.com/microsoft/vscode-azurearmtools/pull/344)
- Do not validate schema against properties containing expressions
- ~~Added additional template validations~~ (temporarily disabled in 0.8.2)
  - ~~Language expression evaluation~~
  - ~~Dependency checks~~
  - ~~Template function checks~~
- Support for all root-level Azure schemas
- Completion for \$schema now shows only root-level schemas
- Query user to update to latest schema [#368](https://github.com/microsoft/vscode-azurearmtools/pull/368)
  - Can be completely disabled via `azureResourceManagerTools.checkForLatestSchema` setting
- Recognize deployment scope from the schema
  - .../deploymentTemplate.json# - resource group deployment
  - .../subscriptionDeploymentTemplate.json# - subscription deployment
  - .../managementGroupDeploymentTemplate.json# - management group deployment
  - .../tenantDeploymentTemplate.json# - tenant deployment
- Completion provider for ARM resource type names and apiVersions

### Fixed

- Fixed message "Exactly 1 match required, but found more than 1" which appears in some scenarios.

## Version 0.8.0 (2019-10-28)

### Added

- Greatly improved schema errors and completion
  - Our new language server now has a better understanding of Azure Resource Manager templates and can therefore provide a better error and completion experience beyond that provided using standard JSON validation
  - It now narrows down its schema validation based on the resource type and apiVersion properties of each resource.
  - No longer suggests changing the resource type if the apiVersion is not supported, or if a property is missing or invalid
  - Errors provide better guidance for what actually needs to be fixed in each resource to match the schema
  - Greatly improved completion speed
  - Greatly reduced memory usage
  - Note: The Azure schemas (which are read and interpreted by this extension) are undergoing continual improvement
- Full support for user-defined template functions [#122](https://github.com/microsoft/vscode-azurearmtools/issues/122). See Azure [documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-authoring-templates#functions).
  - Find References (namespaces, user functions, user function parameters)
  - Go to Definition
  - Expression completion
  - Parameter count validation
  - Rename user function parameters
  - Hover information
  - Signature help
- Added basic snippet support. This makes Sam Cogan's [Azure Resource Manager Snippets](https://marketplace.visualstudio.com/items?itemName=samcogan.arm-snippets) extension no longer necessary when using this extension. If you have snippet suggestions, you can add them to our [repo](https://github.com/microsoft/vscode-azurearmtools/issues).
- Hover information for JSON properties (outside of expressions)
- ~~Fewer false positives~~
  - ~~We now allow string values to be automatically coerced to non-string types as appropriate (e.g., "false" can be used in place of false), as the ARM backend allows~~
  - ~~We now allow non-string values to be automatically coerced to string as appropriate (e.g. false can be used in place of "false")~~
    (This change was reverted in favor of providing a clearer error message.)
- Add Find References for built-in template functions (e.g. click on "add" in an expression then right-click -> Find All References)

### Fixed

- Language server using lots of memory [#324](https://github.com/microsoft/vscode-azurearmtools/issues/324)
- Colorization of parameters and variables should be case-insensitive [#298](https://github.com/microsoft/vscode-azurearmtools/pull/298)
- Improved description for uniqueString [#309](https://github.com/microsoft/vscode-azurearmtools/issues/309)
- Updated dotnet core install scripts to latest versions from https://dot.net/v1/dotnet-install.sh and https://dot.net/v1/dotnet-install.ps1
- Lookup of object variable property names is now correctly case-insensitive
- JSON keys such as "Parameters" are now correctly case-insensitive
- Azure Resource Manager Template Server crashed on MacOS [#332](https://github.com/microsoft/vscode-azurearmtools/issues/332) - ~/.local/share folder will now be created if necessary

### Changed

- Added "(ARM)" to extension name (to "Azure Resource Manager (ARM) Tools" from "Azure Resource Manager Tools") for better discoverability

### Engineering Improvements

- Enabled strict null checking
- Lots of other code improvements

## Version 0.7.0 (2019-09-16)

### Added

- 0.7.0 contains the first release of a new language service that we are creating specifically for Azure Resource Manager deployment template files. Up to this point, the extension has been built on top of the built-in VS Code JSON language server. This has caused some problems, including:
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

## Changed

- Changed grammar scopes from '.json.arm' to '.json.arm-template' and '.tle.arm' to '.tle.arm-template'

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
  - [listSecrets and generic list\* functions not recognized](https://github.com/Microsoft/vscode-azurearmtools/issues/72)
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
