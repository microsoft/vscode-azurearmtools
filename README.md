# Azure Resource Manager (ARM) Tools for Visual Studio Code (Preview)

[![Version](https://vsmarketplacebadge.apphb.com/version/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Installs](https://vsmarketplacebadge.apphb.com/installs-short/msazurermtools.azurerm-vscode-tools.svg)](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) [![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azurearmtools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=10)

The Azure Resource Manager (ARM) Tools for Visual Studio Code provides language support, resource snippets, and resource auto-completion to help you create and validate Azure Resource Manager templates. See the [Azure Resource Manager templates with Visual Studio Code quickstart](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/quickstart-create-templates-use-visual-studio-code?tabs=CLI) for a guided tutorial experience.

![ARM Tools creating web app](./images/arm-tools.gif)

## Language Server

  - Azure Resource Manager template language server for providing ARM template language completion, validation, and error guidance.
  - Resources are validated against Azure schemas, which provide validation based on resource type and apiVersion.
  - ARM Template Outline view for easy navigation through large templates
  - Colorization for Template Language Expressions (TLE)
  - Analyze and validate JSON syntax, JSON schema conformance, and string expressions.

## Parameter files

Template files can be mapped to a parameter file for an enhanced authoring and validation experience. To do so use the parameter file control in the Visual Studio Code status bar, or use the right-click contextual menu on an ARM template. Once a parameter file has been mapped, the following features are available.

  - Full validation across both the template and parameter file
  - Open an associated parameter file from a template
  - Add all missing parameters to the parameter file and parameter auto-completion
  - Rename parameters and all references across both the template and mapped parameter file
  - Find and goto all references of a parameter across both the template and mapped parameter file

![Associate a parameters file with template and create parameters file](./images/params-support.gif)

## Snippets

Snippets for deployment template scaffolding and 70+ Azure resources.

| Snippet | Description |
|---|---|
| `arm!` | Adds the framework for a full deployment template file for resource group deployments. |
|`arm!s` | Adds the framework for a full deployment template file for subscription deployments. |
| `arm!mg` | Adds the framework for a full deployment template file for management group deployments. |
| `arm!t` | Adds the framework for a full deployment template file for tenant deployments. |
| `armp!` | Adds the framework for a full deployment template parameters file. |
| `arm-param` | Adds a parameter to a template. |
| `arm-variable` | Adds a variable to a template. |
| `arm-userfunc` | Adds a user function to a template. |
| `arm-userfunc-namespace` | Adds a user function namespace to a template. |
| `arm-` | Displays 70+ snippets for creating Azure resources. For example, type `arm-ubuntu` to add all five resources necessary for a basic Ubuntu virtual machine. |

## Insert Item

In addition to adding snippets from the code editor, the Insert Item feature can be used to insert new parameters, user-defined functions, variables, resources, and outputs. To do so right-click on the template in the code editor, select **Insert Item** and follow the on-screen prompts.

![Inserting an item into an Azure Resource Manager template](./images/insert-item.png)

You can also right-click on any element in the ARM Template Outline view to initiate the insert item process.

![Inserting an item into an Azure Resource Manager template](./images/insert-item-outline.png)

## Intellisense

  - [Built-in functions](https://go.microsoft.com/fwlink/?LinkID=733958)
  - [Parameter references](https://go.microsoft.com/fwlink/?LinkID=733959)
  - [Variable references](https://go.microsoft.com/fwlink/?LinkID=733960)
  - [resourceGroup() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#resourcegroup)
  - [subscription() properties](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/#subscription)
  - [resourceId() function](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/template-functions-resource#resourceid)
  - Properties of references to variables that are objects

## Other features

  - [Signature help](https://code.visualstudio.com/docs/editor/editingevolved#_parameter-hints) for TLE function parameters
  - [Go To Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) for variable and parameter references
  - [Peek](https://code.visualstudio.com/docs/editor/editingevolved#_peek) for variable and parameter definitions
  - Find all references (Shift + F12) for variables and parameters
  - Rename (F2) variables and parameters and their references
  - [Hover](https://code.visualstudio.com/docs/editor/editingevolved#_hover) for parameter description
  - [TLE brace matching](https://code.visualstudio.com/docs/editor/editingevolved#_bracket-matching)
  - User-defined template functions, see Azure [documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-authoring-templates#functions)
  - Variable iteration ("copy blocks"), see Azure [documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-multiple#variable-iteration)
  - Sort template and template sections alphabetically

## Extension configurations

You may be interested in adjusting the following extension configurations. These can be configured in [VS Code User Settings](https://code.visualstudio.com/docs/getstarted/settings).

**Auto-detect ARM Templates**

Enables auto-detection of deployment template files with the extension *.json or *.jsonc. If set to true (default), the editor language will automatically be set to Azure Resource Manager Template for any *.json/*.jsonc file which contains an appropriate Azure Resource Manager Template schema.

```
"azureResourceManagerTools.autoDetectJsonTemplates": true,
```

**Detect latest root schema**

Check if the root schema for deployment templates is using an out-of-date version and suggest updating it to the latest version.

```
"azureResourceManagerTools.checkForLatestSchema": true,
```

**Parameter files**

Check if an opened template file has a matching params file and prompt to create a mapping.

```
"azureResourceManagerTools.checkForMatchingParameterFiles": true,
```

Parameter file mappings are stored in the `azureResourceManagerTools.parameterFiles` user setting.

```
"azureResourceManagerTools.parameterFiles": {}
```

## Automatic Detection of deployment template files

By default, the extension recognizes a .json or .jsonc file as a deployment template file based on the \$schema specified in the file (for instance, `https://schema.management.azure.com/schemas/2018-05-01/deploymentTemplate.json#`) and will switch the editor language to "Azure Resource Manager Template" automatically. If you do not want that behavior, you can set the `azureResourceManagerTools.autoDetectJsonTemplates` setting to false and use the below methods to determine which files to treat as deployment templates.

Besides automatic detection, you can also use the `files.associations` setting to set up your own specific mappings based on specific files paths or patterns to mark them as deployment templates, e.g.

```json
"files.associations": {
    "*.azrm.json": "arm-template" // Treat these files as deployment templates
}
```

## Troubleshooting

Use the following wiki article to help troubleshoot these known issues.

- [Could not find/download: ".NET Core Runtime" with version = 2.2.5](https://github.com/microsoft/vscode-azurearmtools/wiki/Troubleshooting-DotNet-Acquisition)
- [Unrecognized Resource API Version](https://github.com/microsoft/vscode-azurearmtools/wiki/Unrecognized-Resource-API-Version)

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

## Legal

Before we can accept your pull request you will need to sign a **Contribution License Agreement**. All you need to do is to submit a pull request, then the PR will get appropriately labeled (e.g. `cla-required`, `cla-norequired`, `cla-signed`, `cla-already-signed`). If you already signed the agreement we will continue with reviewing the PR, otherwise, the system will tell you how you can sign the CLA. Once you sign the CLA all future PR's will be labeled as `cla-signed`.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Telemetry

VS Code collects usage data and sends it to Microsoft to help improve our products and services. Read our [privacy statement](https://go.microsoft.com/fwlink/?LinkID=528096&clcid=0x409) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## License

The source code in our [public repository](https://github.com/Microsoft/vscode-azurearmtools) is licensed under the [MIT license](LICENSE.md) and may be locally built and used in accordance with this license.

When the extension is [published](https://marketplace.visualstudio.com/items?itemName=msazurermtools.azurerm-vscode-tools) to the VS Code Marketplace, it is bundled with the Azure Resource Manager language service binaries. The extension as bundled and published this way is licensed under a traditional Microsoft product license.
