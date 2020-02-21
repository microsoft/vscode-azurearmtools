# Azure Resource Manager (ARM) Tools for Visual Studio Code (Preview)

[![Version](https://vsmarketplacebadge.apphb.com/version/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azurearmtools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=10)

The Azure Resource Manage (ARM) Tools for Visual Studio Code provids language support, resource snipppets, and resource auto-completion to help you create and validate Azure Resource Manager templates.

![ARM Tools creating web app](./images/arm-tools.gif)

## Features

- Azure Resource Manager template language server for providing ARM template specific language completion, validation, and error guidance.
- ARM template resources are validated against Azure schemas which narrow down validation based on the resource type and apiVersion properties for each resource.
- ARM Template Outline view for easy navigation through large templates
- Colorization for Template Language Expressions (TLE)
- Analyze and validate JSON syntax, JSON schema conformance for Azure resources, string expressions issues that would affect deployment

## Intellisense

  - [Built-in function names](https://go.microsoft.com/fwlink/?LinkID=733958)
  - [Parameter references](https://go.microsoft.com/fwlink/?LinkID=733959)
  - [Variable references](https://go.microsoft.com/fwlink/?LinkID=733960)
  - [resourceGroup() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#resourcegroup)
  - [subscription() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#subscription)
  - Properties of references to variables that are objects

## Other features:

  - [Signature help](https://code.visualstudio.com/docs/editor/editingevolved#_parameter-hints) for TLE function parameters
  - [Go To Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) for variable and parameter references
  - [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) for variable and parameter definitions
  - Find all references (Shift + F12) for variables and parameters
  - Rename all references (F2) for variables and parameters
  - [Hover](https://code.visualstudio.com/docs/editor/editingevolved#_hover) for parameter description
  - [TLE brace matching](https://code.visualstudio.com/docs/editor/editingevolved#_bracket-matching)
  - Rename parameters and variables
  - User-defined template functions, see Azure [documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-authoring-templates#functions)
  - Variable iteration ("copy blocks"), see Azure [documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-multiple#variable-iteration)

## Snippets

Type `arm` in the editor to see the available snippets

- `arm!` - Adds the framework for a full deployment template file for resource group deployments
- `arm!s` - Adds the framework for a full deployment template file for subscription deployments
- `arm!mg` - Adds the framework for a full deployment template file for management group deployments
- `arm!t` - Adds the framework for a full deployment template file for tenant deployments
- `armp!` - Adds the framework for a full deployment template parameters file

      Then you can use the `arm-param-value` snippet to add new parameter values for deployment

  - For existing Azure Resource Manage Template files
    - `arm-param`, `arm-variable`, `arm-userfunc`, `arm-userfunc-namespace`
      Add new parameters, variables, user functions and user namespaces.
    - Resources - type `arm-` to see the other 70+ snippets for creating new resources of various types. For example, type `arm-ubuntu` to add all five resources necessary for a basic Ubuntu virtual machine.


## Troubleshooting



## Automatic Detection of deployment template files

By default, the extension recognizes a .json or .jsonc file as a deployment template file based on the \$schema specified in the file (for instance, `https://schema.management.azure.com/schemas/2018-05-01/deploymentTemplate.json#`) and will switch the editor language to "Azure Resource Manager Template" automatically. If you do not want that behavior, you can set the `azureResourceManagerTools.autoDetectJsonTemplates` setting to false and use the below methods to determine which files to treat as deployment templates.

Besides automatic detection, you can also use the `files.associations` setting to set up your own specific mappings based on specific files paths or patterns to mark them as deployment templates, e.g.

```json
    "files.associations": {
        "*.azrm.json": "arm-template" // Treat these files as deployment templates
    }
```

## Related Links

- [VS Code Azure Resource Manager snippets and cross-platform deployment scripts](https://go.microsoft.com/fwlink/?LinkID=733962)
- [Azure Quickstart Templates](https://go.microsoft.com/fwlink/?LinkID=734038)

## Contributing

There are several ways you can contribute to our [repo](https://github.com/Microsoft/vscode-azurearmtools):

- **Ideas, feature requests, and bugs**: We are open to all ideas and we want to get rid of bugs! Use the [Issues](https://github.com/Microsoft/vscode-azurearmtools/issues) section to report a new issue, provide your ideas or contribute to existing threads.
- **Documentation**: Found a typo or strangely worded sentences? Submit a PR!
- **Snippets**: Have a fix for a snippet or a new snippet idea? File an [Issue](https://github.com/Microsoft/vscode-azurearmtools/issues) or submit a PR!
  - See [our snippets file for ARM templates](https://github.com/microsoft/vscode-azurearmtools/blob/master/assets/armsnippets.jsonc)
- **Code**: Contribute bug fixes, features or design changes:
  - Clone the repository locally and open in VS Code.
  - Install [TSLint for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=eg2.tslint).
  - Open the terminal (press `CTRL+`\`) and run `npm install`.
  - To build, press `F1` and type in `Tasks: Run Build Task`.
  - Debug: press `F5` to start debugging the extension.

### Legal

Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labeled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise, the system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

The source code in our [public repository](https://github.com/Microsoft/vscode-azurearmtools) is licensed under the [MIT license](LICENSE.md). The public source code currently contains functionality related to the parsing and validation of template expression strings but does not contain functionality related to JSON parsing and validation or backend template validation.

The extension as it is built-in Azure DevOps and [published](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) to the VS Code Marketplace is a distribution of the public repository and is bundled with the Azure Resource Manager language service binaries. The published extension and language service binaries are licensed under a traditional Microsoft product license.
