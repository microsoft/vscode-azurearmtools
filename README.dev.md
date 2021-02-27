# Azure Resource Manager (ARM) Tools
A JSON language extension to support Azure Resource Manager deployment templates and template language expressions.

## Developing the Extension

### Prerequisites
* [Install node.js](https://nodejs.org/en) [v5.5.0 or Higher]

* To **build** this extension from the command line, run `npm run build`.
* The language server is not open source, you will need to set the `azureResourceManagerTools.languageServer.path` setting in vscode (after F5'ing) to the location of the language server in an existing installed instance of the extension).
* To run this extension's **tests** from the command line, run `npm test`.
* To create a VSCode .vsix package for this extension, run `npm install -g vsce` and then 'npm run package' (this will not package the language server)
* To debug this extension, open in vscode, and run the "Launch Extension" configuration

## Related Links
See [Extending VS Code](https://code.visualstudio.com/docs/extensions/overview) for more information on how to create VS Code extensions.

See [TypeScriptLang.org](https://www.typescriptlang.org/) for more information on the TypeScript language.

See [Authoring Azure Resource Manager Templates](https://azure.microsoft.com/en-us/documentation/articles/resource-group-authoring-templates/) for more information on how to author Azure Resource Group Templates.

See [Template Language Expressions](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-functions/) for more information about how to use Template Language Expressions in your deployment templates.

See [Azure CLI](https://azure.microsoft.com/en-us/documentation/articles/xplat-cli-azure-resource-manager/) for more information about how to interact with Microsoft Azure from the command line.
