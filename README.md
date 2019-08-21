# Azure Resource Manager ("ARM") Tools for Visual Studio Code (Preview)

[![Version](https://vsmarketplacebadge.apphb.com/version/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azurearmtools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=10)

This extension provides language support for Azure Resource Manager ("ARM") deployment templates and template language expressions.

## Features
- ARM Template Outline view for easy navigation through large templates
- Colorization for Template Language Expressions (TLE)
- IntelliSense for TLE expressions
    - [Built-in function names](https://go.microsoft.com/fwlink/?LinkID=733958)
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

## Using comments in JSON

- If you would like to use comments in your template files, you can use the jsonc ("JSON with comments") language mode.  Add the following to your user settings in VS code:

```json
    "files.associations": {
        // Use the following to allow comments inside .jsonc
        // (This will not be necessary after VS Code ships the fix for https://github.com/Microsoft/vscode/issues/48969)
        "*.jsonc": "jsonc"

        // Use the following to also allow comments inside .json file
        // "*.json": "jsonc"
    }
```

## To Install

Press F1 in VSCode, type "ext install" and then look for "Azure Resource Manager ('ARM') Tools".

## Related Links

- [VS Code Azure Resource Manager snippets and cross platform deployment scripts](https://go.microsoft.com/fwlink/?LinkID=733962)
- [Azure Quickstart Templates](https://go.microsoft.com/fwlink/?LinkID=734038)

## Contributing
There are several ways you can contribute to our [repo](https://github.com/Microsoft/vscode-azurearmtools):

- **Ideas, feature requests and bugs**: We are open to all ideas and we want to get rid of bugs! Use the [Issues](https://github.com/Microsoft/vscode-azurearmtools/issues) section to report a new issue, provide your ideas or contribute to existing threads.
- **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
- **Code**: Contribute bug fixes, features or design changes:
  - Clone the repository locally and open in VS Code.
  - Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  - Open the terminal (press `CTRL+`\`) and run `npm install`.
  - To build, press `F1` and type in `Tasks: Run Build Task`.
  - Debug: press `F5` to start debugging the extension.

### Legal
Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labelled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

### Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry
VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

[MIT](LICENSE.md)
