# Change Log

All notable changes to the "vscode-azurearmtools" extension will be documented in this file.

## Version 0.15.5 (2021-11-15)
Due to technical issues originating with a recent change in Azure schemas, we haven't been able to update our schemas for a while. This release fixes that issue.

### Added

-  Service bus and blob container snippets [#1379](https://github.com/microsoft/vscode-azurearmtools/issues/1379)
-  Add definitions for `items()`, `tenant()` and `managementGroup()` functions [#1397](https://github.com/microsoft/vscode-azurearmtools/issues/1397)


### Fixed
- Add support to pick up schemas again (due to breaking change in schemas) [#1324](https://github.com/microsoft/vscode-azurearmtools/issues/1324)
- Microsoft.Web/sites out of date [#1396](https://github.com/microsoft/vscode-azurearmtools/issues/1396)
- Microsoft.Authorization/policyAssignments latest API unavailable. [#1384](https://github.com/microsoft/vscode-azurearmtools/issues/1384)
- Microsoft.Authorization/roleAssignments is unrecognized [#1366](https://github.com/microsoft/vscode-azurearmtools/issues/1366)
- Microsoft.Web/hostingEnvironments most apiVersions not recognized [#1344](https://github.com/microsoft/vscode-azurearmtools/issues/1344)


## Version 0.15.4 (2021-10-07)

### Fixed

- Using scaffolding snippets in empty JSON file should not require CTRL+SPACE [#1390](https://github.com/microsoft/vscode-azurearmtools/issues/1390)
## Version 0.15.3 (2021-09-27)

### Added

- Added notification message about availability of Bicep extension (can choose to never see again) [#1304](https://github.com/microsoft/vscode-azurearmtools/issues/1304)

### Updated

- Updated snippet apiVersion values [#1357](https://github.com/microsoft/vscode-azurearmtools/issues/1357), [#1373](https://github.com/microsoft/vscode-azurearmtools/issues/1373)

### Fixed

- ARM tools snippet completions show up in bicepconfig.json files [#1307](https://github.com/microsoft/vscode-azurearmtools/issues/1307)
- Note in "providers" template function description that it has been deprecated [#1356](https://github.com/microsoft/vscode-azurearmtools/issues/1356)

### Engineering

- Updated to TypeScript 4
- Test improvements
- Improvements to error telemetry from language server
- Moved reource snippets to individual template files to make editing and proofing easier [#1370](https://github.com/microsoft/vscode-azurearmtools/issues/1370)

## Version 0.15.2

### Updated

- Updated schemas
- Updated function metadata [#1311](https://github.com/microsoft/vscode-azurearmtools/issues/1311)

### Fixed

- Correct minor typo for `deprecrated` (thanks Jack Blower @ElvenSpellmaker!) [#1301](https://github.com/microsoft/vscode-azurearmtools/issues/1301)
## Version 0.15.1

### Added

- Added icons for loadbalancer, virtual machine scaleset, and service fabric resources (thanks Jason Gilbertson @jagilber!) [#1255](https://github.com/microsoft/vscode-azuraissues/1255)
- Understand new top-level "scope" property [#967](https://github.com/microsoft/vscode-azurearmtools/issues/967)

### Fixed

- Find references for a nested template parameter incorrectly finds matches in the parameter file [#1269](https://github.com/microsoft/vscode-azurearmtools/issues/1269)
- Show apiVersions in reverse chronological order [#1279](https://github.com/microsoft/vscode-azurearmtools/issues/1279)
- Clicking F12 while on a parameter definition should show all refs but instead says "no definition found" [#1267](https://github.com/microsoft/vscode-azurearmtools/issues/1267)

### Maintenance
- Telemetry to better understand which resource types and apiVersions do not have schemas [#1250](https://github.com/microsoft/vscode-azurearmtools/issues/1250)
- Retrieve list of valid schemas and apiVersions from the language server for future features [#1258](https://github.com/microsoft/vscode-azurearmtools/issues/1258)

## Version 0.15.0 (2021-03-08)

### Added

- Support for linked templates validation and parameter completion
  - `templateLink.relativePath` (requires apiVersion 2020-06-01 or higher of Microsoft.Resources/deployments for template specs, 2020-10-01 for direct deployment)
  - `templateLink.uri`
  - `deployment().properties.templateLink.uri`
  - See README.md for more information
  - `"parametersLink"` is not supported (but `"parameters"` is)
  - Experiences include:
    - Validation of linked templates using the value of parameter values supplied to the template
    - Parameter validation (missing, extra, type mismatch)
    - "Light-bulb" and snippet support to fill in parameter values for a linked template
    - CTRL-click on relativePath value or click on code lens to navigate to linked template
    - Can navigate to URI-based linked templates
  - Requires full template validation to be enabled (either all top-level parameters have a default value or else a parameter file is selected)
- Enable full template validation if all top-level parameters have default values, even if no parameter file has been specified [#1217](https://github.com/microsoft/vscode-azurearmtools/issues/1217)
- Show warning notification when the azureResourceManagerTools.languageServer.dotnetExePath setting is in use [#1181](https://github.com/microsoft/vscode-azurearmtools/issues/1181), [#1180](https://github.com/microsoft/vscode-azurearmtools/issues/1180)
- Schemas updated

### Fixed
  - Clearer notification when the extension is starting up and loading schemas [#463](https://github.com/microsoft/vscode-azurearmtools/issues/463)
  - Intellisense for AutoScaleSettings recommends "statistics" when it should be "statistic" [#1141](https://github.com/microsoft/vscode-azurearmtools/issues/1141)
  - Incorrect validation errors in user-defined functions when using recently added builtin functions (createObject etc.) [#1153](https://github.com/microsoft/vscode-azurearmtools/issues/1153)


## Version 0.14.1 (2021-02-05)

### Fixed
- Give warning if the wrong schema might be wrong for the deployment resources being used [#1055](https://github.com/microsoft/vscode-azurearmtools/issues/1055)
- Add support for pickZones() function (thanks Brian Golden @bgold09!) [#1130](https://github.com/microsoft/vscode-azurearmtools/issues/1130)
- Add mention of ARM Viewer to README [#1140](https://github.com/microsoft/vscode-azurearmtools/issues/1140)
- Upgrade Microsoft.Resources/deployments apiVersion to support relativePath property [#1137](https://github.com/microsoft/vscode-azurearmtools/issues/1137)
- Update schemas cache
- Split nested snippet into inner/outer [#1157](https://github.com/microsoft/vscode-azurearmtools/issues/1157)

## Version 0.14.0 (2020-11-10)

### Added

- New Feature: Extract to variable/parameter [#515](https://github.com/microsoft/vscode-azurearmtools/issues/515)
  - **Thanks to Nils Hedström @nilshedstrom for implementing this new feature!**
- Hover over an expression or a multi-line string to see a easy-to-read, formatted version of it [#1092](https://github.com/microsoft/vscodeissues/1092)

### Fixed

- createArray() now supports creating an empty array, update tooling to avoid false positive [#1050](https://github.com/microsoft/vscodeissues/1050)
- Extension causes high cpu load with large numbers of variables/parameters/resources [#1051](https://github.com/microsoft/vscode-azurearmtools/issues/1051)
- We should support getting references from the entire 'variables('xxx')' or params expression, not just inside 'xxx' [#1046](https://github.com/microsoft/vscode-azurearmtools/issues/1046)
- Stop displaying our own error message at the same time as .net extension [#1093](https://github.com/microsoft/vscode-azurearmtools/issues/1093)
- Validation error with resourceGroup() tags when using parameter file [#831](https://github.com/microsoft/vscode-azurearmtools/issues/831)
- dateTimeAdd() in certain scenarios gives a template validation error [#1056](https://github.com/microsoft/vscode-azurearmtools/issues/1056)
- Validation of template function "deployment" [#1060](https://github.com/microsoft/vscode-azurearmtools/issues/1060)

## Version 0.13.0 (2020-10-07)

### Added

- Completions for `dependsOn` array elements
- Intellisense improvements:
  - Fixed:
    - Completions cause entire current word to be deleted [#903](https://github.com/microsoft/vscode-azurearmtools/issues/903)
    - Tab completion of params/vars wipes out remainder of string [#349](https://github.com/microsoft/vscode-azurearmtools/issues/349)
    - Sparse filtering does not work for our expression Intellisense [#572](https://github.com/microsoft/vscode-azurearmtools/issues/572)
-  Child/parent code lenses for resources

### Changed

- If we find just a single matching parameter file, we now automatically use it without asking. It can be manually disassociated or associated with a different parameter file, and this behavior can be turned off via VS Code settings [#911](https://github.com/microsoft/vscode-azurearmtools/issues/911)
- ARM Template Outline view and Intellisense now use a more compact format for the name and type of resources that are expressions, based on the new string interpolation format for Bicep
- ARM Template Outline view now shows only the last segment of a resource's name
- ARM Template Outline view now also shows the last segment of a resource's type
- For a cleaner look, parameter code lenses just show "Using default value" for parameters with default values, and do not actually repeat the default value [#999](https://github.com/microsoft/vscode-azurearmtools/issues/999)

### Fixed

- Missing one warning in the error list after changing the property from "inner" to "outer" [#891](https://github.com/microsoft/vscode-azurearmtools/issues/891)
- Added location property to deployment() function metadata [#936](https://github.com/microsoft/vscode-azurearmtools/issues/936)
- "Cannot read property 'start' of undefined: TypeError: Cannot read property 'start' of undefined" in suites [#858](https://github.com/microsoft/vscodeissues/858)
- List function is not recognized [#949](https://github.com/microsoft/vscodeissues/949)
- Support for new template functions: createObject(), false(), true(), null()
- resourceId completion should pull from within the correct scope of resources [#775](https://github.com/microsoft/vscodeissues/775)
- Unable to remove file reference from parameter file to template file if template file is deleted [#952](https://github.com/microsoft/vscode-azurearmtools/issues/952)
- Using schema with http instead of https sets language to arm-template but schema Intellisense/validation don't work [#834](https://github.com/microsoft/vscode-azurearmtools/issues/834)

## Version 0.12.0

### Added

- Snippet contextualization [#654](https://github.com/microsoft/vscode-azurearmtools/issues/654)
  - Snippets now appear only in locations where they make sense
  - Automatically bring up snippets for new parameters, variables, outputs, etc. when the first double quote is typed
  - Automatically bring up snippets for new resources, user function parameters, etc. when the first curly brace is typed
- Support code lenses, errors, intellisense and code actions for nested templates, just like for parameter files [#837](https://github.com/microsoft/vscode-azurearmtools/issues/837)

### Fixed

- "filename.json does not appear to be an Azure Resource Manager deployment template file" [#838](https://github.com/microsoft/vscode-azurearmtools/issues/838)
- The notification information is inconsistent with the status bar "Select/Create Parameter File…" [#873](https://github.com/microsoft/vscode-azurearmtools/issues/873)
- Show error icon in pick list for current parameter file if not found [#693](https://github.com/microsoft/Sscode-azurearmtools/icon issues/693)
- Revision comparison shows unexpected problems [#601](https://github.com/microsoft/vscode-azurearmtools/issues/601)
- The ARM function listchannelwithkeys is not recognized as a valid function. [#846](https://github.com/microsoft/vscode-azurearmtools/issues/846)
- Error shows when selecting parameter file for an unsaved template file [#841](https://github.com/microsoft/vscode-azurearmtools/issues/841)
- Status bar doesn't show up when changing a file to arm-template [#839](https://github.com/microsoft/vscode-azurearmtools/issues/839)
- Assertion failure in parameter file with no "parameters" object if there are missing parameters [#829](https://github.com/microsoft/vscode-azurearmtools/issues/829)
- Adding in Resource Group snippet (thanks Ryan Yates @kilasuit!) [#726](https://github.com/microsoft/vscode-azurearmtools/issues/726)
- SetDiagnosticsFromTask for source 'arm-template (validation)' throws an exception during suites [#875](https://github.com/microsoft/vscode-azurearmtools/issues/875)
- Disable display of "documentColumnIndex (29) cannot be greater than the line's maximum index" assertion [#843](https://github.com/microsoft/vscode-azurearmtools/issues/843)
- "value cannot be null" when providing keyvault reference to a nested deployment parameter [#827](https://github.com/microsoft/vscode-azurearmtools/issues/827)
- Error message and !!MISSING: command!! messages in code lenses opening template file when params file missing [#810](https://github.com/microsoft/vscode-azurearmtools/issues/810)
- Error shows when selecting parameter file for an unsaved template file [#666](https://github.com/microsoft/vscode-azurearmtools/issues/666)
- Invalid location given for error when resource name evaluates to empty string [#816](https://github.com/microsoft/vscode-azurearmtools/issues/816)
- Using 'copy' in nested template variables triggered an template validation error [#730](https://github.com/microsoft/vscode-azurearmtools/issues/730)

## Version 0.11.0

### Added

- Better support for nested templates [#484](https://github.com/microsoft/vscode-azurearmtools/pull/484)
  - Support for inner-scoped expressions (expressionEvaluationOptions.scope = 'inner') for parameters, variables and user functions [#554](https://github.com/microsoft/vscode-azurearmtools/pull/554)
  - Fixed null reference exception with nested templates when a parameter file is used [#716](https://github.com/microsoft/vscode-azurearmtools/pull/716)
  - Code lenses mark nested and linked template and their effective expression scope
  - Warning about unreachable parameters/variables in a nested template with outer scope
- New code lenses show effective source and value of top-level parameters [#675](https://github.com/microsoft/vscode-azurearmtools/issues/675)
- First step taken to allow us to restrict snippets to appropriate locations in a template file [#789](https://github.com/microsoft/vscode-azurearmtools/pull/789)
- Unused parameters and variables are now displayed grayed out like unused code [#679](https://github.com/microsoft/vscode-azurearmtools/issues/679)
- Recognition for the listKeyValue function [#720](https://github.com/microsoft/vscode-azurearmtools/pull/720)

### Fixed

- 'Load Balancer Internal' snippet: incorrect placement of subnet for frontendIPConfigurations (thanks Anatoly Basharin @abasharin!) [#725](https://github.com/microsoft/vscode-azurearmtools/pull/725)
- Format document breaks when using multi-line functions [#435](https://github.com/microsoft/vscode-azurearmtools/issues/435)
- Made prompt for "Type a parameter name" more explanatory [#765](https://github.com/microsoft/vscode-azurearmtools/issues/765)
- Improvements for Insert Item... menu (thanks Nils Hedström @nilshedstrom!) [#670](https://github.com/microsoft/vscode-azurearmtools/issues/670)
- Fails to create a parameter file for arm template when encoded with UTF-8 BOM [#721](https://github.com/microsoft/vscode-azurearmtools/issues/721)
- Schema validation is not identifying correct location in nested templates [#625](https://github.com/microsoft/vscode-azurearmtools/issues/625)
- Shortened many schema-related warning messages [#623](https://github.com/microsoft/vscode-azurearmtools/issues/623)
- "Internal Error: Validation threw an exception" with assembly including linked templates [#773](https://github.com/microsoft/vscode-azurearmtools/issues/773)
- Completion list for "location" shows incorrect icons [#676](https://github.com/microsoft/vscode-azurearmtools/issues/676)
- Formatting: empty object blocks should be left alone, not expanded to multi-line [#753](https://github.com/microsoft/vscode-azurearmtools/issues/753)
- Template validation reports parameter value not specified when it uses a keyvault reference [#609](https://github.com/microsoft/vscode-azurearmtools/issues/609)
- Template with apiProfile not honored among resources [#635](https://github.com/microsoft/vscode-azurearmtools/issues/635)
- Microsoft.Logic/workflows snippet apiVersion references removed schema [#700](https://github.com/microsoft/vscode-azurearmtools/issues/700)

### Changed

- Made naming of linked template snippet consistent with the terminology in current [docs](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/linked-templates) and added a new snippet for nested templates [#744](https://github.com/microsoft/vscode-azurearmtools/issues/744)
- Updated schema cache [#790](https://github.com/microsoft/vscode-azurearmtools/issues/790)

## Version 0.10.0

### Added

- Improved parameter file support:
  - Completions for missing and new parameter values (type double quote or CTRL+SPACE)
  - Quick fix and code actions for adding missing parameter values
  - Rename parameters across template and parameter file
  - Go To Definition and Find References for parameters across both files

- Insert item... (variables, parameters, resources, functions, outputs) **implemented by Nils Hedström @nilshedstrom, thanks!**
Look for this in the editor context menu or the ARM Template Outline view!
- Completions for resourceId arguments based on resources found inside the template
- New `Application Gateway` and `Application Gateway and Firewall` snippets (thanks Emmanuel Auffray @ManuInNZ!)

### Changed

- Suggestion: Auto-complete should not insert "()" [#501](https://github.com/microsoft/vscode-azurearmtools/issues/501)
- Removed `arm-param-value` snippet in parameter files (replaced by new parameter auto-completions)
- Add lightbulbs to increase discoverability of parameter/variable renames **implemented by Nils Hedström @nilshedstrom, thanks!**

### Fixed

- Variable autocomplete does not show variables without quotes [#361](https://github.com/microsoft/vscode-azurearmtools/issues/361)
- Use latest schema version for ARM Template parameter file (thanks Wilfried Woivre @wilfriedwoivre!) [#622](https://github.com/microsoft/vscode-azurearmtools/issues/622)
- Ensure snippet resource definitions align with best practices doc [#525](https://github.com/microsoft/vscode-azurearmtools/issues/525)
- Snippets should use tabs instead of spaces so the editor can adjust the tabs to the current editor settings [#633](https://github.com/microsoft/vscode-azurearmtools/issues/633)
- dateTimeAdd function not recognized [#636](https://github.com/microsoft/vscode-azurearmtools/issues/636)
- Rename dialog should not include quotes (#660)(https://github.com/microsoft/vscode-azurearmtools/issues/660)
- Rename doesn't work on a variable/parameter with a hyphen [#661](https://github.com/microsoft/vscode-azurearmtools/issues/661)
- Template validation doesn't recognize 'environment()' function when full validation enabled [#531]((https://github.com/microsoft/vscode-azurearmtools/issues/531)
- Space after colon (:) removes IntelliSense Selection List [#482](https://github.com/microsoft/vscode-azurearmtools/issues/482)
- Pop up 2 dialogs when renaming a resource that can't be renamed [#407](https://github.com/microsoft/vscode-azurearmtools/issues/407)
- autocomplete of params/var replaces needed code [#127](https://github.com/microsoft/vscode-azurearmtools/issues/127)
- ARM template validation cannot handle "copy" in outputs section [#600](https://github.com/microsoft/vscode-azurearmtools/issues/600)
  - Note: Currently works only for resource group deployment, see [#695](https://github.com/microsoft/vscode-azurearmtools/issues/695)

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
