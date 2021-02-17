/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:promise-function-async max-line-length // Grandfathered in
// CONSIDER: Refactor this file
import * as path from 'path';
import * as vscode from "vscode";
import { AzureUserInput, callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, createAzExtOutputChannel, IActionContext, ITelemetryContext, registerCommand, registerUIExtensionVariables, TelemetryProperties } from "vscode-azureextensionui";
import { delay } from "../test/support/delay";
import { armTemplateLanguageId, configKeys, configPrefix, expressionsDiagnosticsCompletionMessage, expressionsDiagnosticsSource, globalStateKeys, outputChannelName } from "./constants";
import { DeploymentDocument, ResolvableCodeLens } from "./documents/DeploymentDocument";
import { DeploymentFileMapping } from "./documents/parameters/DeploymentFileMapping";
import { DeploymentParametersDoc } from "./documents/parameters/DeploymentParametersDoc";
import { IParameterDefinitionsSource } from "./documents/parameters/IParameterDefinitionsSource";
import { IParameterValuesSource } from "./documents/parameters/IParameterValuesSource";
import { IParameterValuesSourceProvider } from "./documents/parameters/IParameterValuesSourceProvider";
import { defaultTabSize } from './documents/parameters/parameterFileGeneration';
import { considerQueryingForParameterFile, getFriendlyPathToFile, openParameterFile, openTemplateFile, selectParameterFile } from "./documents/parameters/parameterFiles";
import { addMissingParameters } from "./documents/parameters/ParameterValues";
import { IReferenceSite, PositionContext } from "./documents/positionContexts/PositionContext";
import { TemplatePositionContext } from "./documents/positionContexts/TemplatePositionContext";
import { DeploymentTemplateDoc, IDocumentLinkInternal } from "./documents/templates/DeploymentTemplateDoc";
import { ExtractItem } from './documents/templates/ExtractItem';
import { getNormalizedDocumentKey } from './documents/templates/getNormalizedDocumentKey';
import { gotoResources } from './documents/templates/gotoResources';
import { getItemTypeQuickPicks, InsertItem } from "./documents/templates/insertItem";
import { assignTemplateGraphToDeploymentTemplate, INotifyTemplateGraphArgs, openLinkedTemplateFile } from './documents/templates/linkedTemplates/linkedTemplates';
import { allSchemas, getPreferredSchema } from './documents/templates/schemas';
import { getQuickPickItems, sortTemplate } from "./documents/templates/sortTemplate";
import { mightBeDeploymentParameters, mightBeDeploymentTemplate, setLangIdToArm, templateDocumentSelector, templateOrParameterDocumentSelector } from "./documents/templates/supported";
import { TemplateSectionType } from "./documents/templates/TemplateSectionType";
import { ext } from "./extensionVariables";
import { assert } from './fixed_assert';
import { IProvideOpenedDocuments } from './IProvideOpenedDocuments';
import * as TLE from "./language/expressions/TLE";
import { Issue } from "./language/Issue";
import * as Json from "./language/json/JSON";
import { ReferenceList } from "./language/ReferenceList";
import { Span } from "./language/Span";
import { notifyTemplateGraphAvailable, startArmLanguageServerInBackground } from "./languageclient/startArmLanguageServer";
import { showInsertionContext } from "./snippets/showInsertionContext";
import { SnippetManager } from "./snippets/SnippetManager";
import { survey } from "./survey";
import { CachedPromise } from "./util/CachedPromise";
import { escapeNonPaths } from "./util/escapeNonPaths";
import { expectTemplateDocument } from "./util/expectDocument";
import { getRenameError } from "./util/getRenameError";
import { Histogram } from "./util/Histogram";
import { NormalizedMap } from './util/NormalizedMap';
import { pathExists } from "./util/pathExists";
import { readUtf8FileWithBom } from "./util/readUtf8FileWithBom";
import { Stopwatch } from "./util/Stopwatch";
import { Cancellation } from "./util/throwOnCancel";
import { IncorrectArgumentsCountIssue } from "./visitors/IncorrectArgumentsCountIssue";
import { UnrecognizedBuiltinFunctionIssue } from "./visitors/UnrecognizedFunctionIssues";
import { IAddMissingParametersArgs, IGotoParameterValueArgs, IGotoResourcesArgs } from "./vscodeIntegration/commandArguments";
import { ConsoleOutputChannelWrapper } from "./vscodeIntegration/ConsoleOutputChannelWrapper";
import { IHoverInfo } from './vscodeIntegration/IHoverInfo';
import { RenameCodeActionProvider } from "./vscodeIntegration/RenameCodeActionProvider";
import { resetGlobalState } from "./vscodeIntegration/resetGlobalState";
import { setContext } from "./vscodeIntegration/setContext";
import { getFunctionParamUsage } from "./vscodeIntegration/signatureFormatting";
import { onCompletionActivated, toVsCodeCompletionItem } from "./vscodeIntegration/toVsCodeCompletionItem";
import { toVSCodeDiagnosticFromIssue } from './vscodeIntegration/toVSCodeDiagnosticFromIssue';
import { JsonOutlineProvider } from "./vscodeIntegration/Treeview";
import { getVSCodeRangeFromSpan } from "./vscodeIntegration/vscodePosition";

interface IErrorsAndWarnings {
    errors: Issue[];
    warnings: Issue[];
}

const invalidRenameError = "Only parameters, variables, user namespaces and user functions can be renamed.";

const echoOutputChannelToConsole: boolean = /^(true|1)?$/i.test(process.env.ECHO_OUTPUT_CHANNEL_TO_CONSOLE ?? '');

// This method is called when the extension is activated
// Your extension is activated the very first time the command is executed
export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }): Promise<void> {
    ext.context = context;
    ext.outputChannel = createAzExtOutputChannel(outputChannelName, configPrefix);
    ext.ui = new AzureUserInput(context.globalState);

    if (echoOutputChannelToConsole) {
        ext.outputChannel = new ConsoleOutputChannelWrapper(ext.outputChannel);
    }

    context.subscriptions.push(ext.completionItemsSpy);

    ext.deploymentFileMapping.value = new DeploymentFileMapping(ext.configuration);
    if (!ext.snippetManager.hasValue) {
        ext.snippetManager.value = SnippetManager.createDefault();
    }

    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async (actionContext: IActionContext): Promise<void> => {
        actionContext.telemetry.properties.isActivationEvent = 'true';
        actionContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        recordConfigValuesToTelemetry(actionContext);

        context.subscriptions.push(new AzureRMTools(context));
    });
}

function recordConfigValuesToTelemetry(actionContext: IActionContext): void {
    const config = ext.configuration;
    actionContext.telemetry.properties.autoDetectJsonTemplates =
        String(config.get<boolean>(configKeys.autoDetectJsonTemplates));

    const paramFiles = config.get<unknown[]>(configKeys.parameterFiles);
    actionContext.telemetry.properties[`${configKeys.parameterFiles}.length`] =
        String(paramFiles ? Object.keys(paramFiles).length : 0);

    recordConfigValue<boolean>(configKeys.checkForLatestSchema);
    recordConfigValue<boolean>(configKeys.checkForMatchingParameterFiles);
    recordConfigValue<boolean>(configKeys.enableCodeLens);
    recordConfigValue<boolean>(configKeys.codeLensForParameters);

    function recordConfigValue<T>(key: string): void {
        actionContext.telemetry.properties[key] = String(config.get<T>(key));
    }
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}

export class AzureRMTools implements IProvideOpenedDocuments {
    private readonly _diagnosticsCollection: vscode.DiagnosticCollection;
    private readonly _deploymentDocuments: Map<string, DeploymentDocument> = new Map<string, DeploymentDocument>();
    private readonly _filesAskedToUpdateSchemaThisSession: Set<string> = new Set<string>();
    private readonly _paramsStatusBarItem: vscode.StatusBarItem;
    private _areDeploymentTemplateEventsHookedUp: boolean = false;
    private _diagnosticsVersion: number = 0;
    private _mapping: DeploymentFileMapping = ext.deploymentFileMapping.value;
    private _codeLensChangedEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    // More information can be found about this definition at https://code.visualstudio.com/docs/extensionAPI/vscode-api#DecorationRenderOptions
    // Several of these properties are CSS properties. More information about those can be found at https://www.w3.org/wiki/CSS/Properties
    private readonly _braceHighlightDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
        borderWidth: "1px",
        borderStyle: "solid",
        light: {
            borderColor: "rgba(0, 0, 0, 0.2)",
            backgroundColor: "rgba(0, 0, 0, 0.05)"
        },
        dark: {
            borderColor: "rgba(128, 128, 128, 0.5)",
            backgroundColor: "rgba(128, 128, 128, 0.1)"
        }
    });

    // tslint:disable-next-line: max-func-body-length
    constructor(context: vscode.ExtensionContext) {
        const jsonOutline: JsonOutlineProvider = new JsonOutlineProvider(context);
        ext.jsonOutlineProvider = jsonOutline;
        context.subscriptions.push(vscode.window.registerTreeDataProvider("azurerm-vscode-tools.template-outline", jsonOutline));
        context.subscriptions.push(this.getRegisteredRenameCodeActionProvider());
        // For telemetry
        registerCommand("azurerm-vscode-tools.completion-activated", (actionContext: IActionContext, args: object) => {
            onCompletionActivated(actionContext, <{ [key: string]: string }>args);
        });
        registerCommand("azurerm-vscode-tools.treeview.goto", (_actionContext: IActionContext, range: vscode.Range) => {
            jsonOutline.revealRangeInEditor(range);
        });
        registerCommand("azurerm-vscode-tools.sortTemplate", async (_context: IActionContext, uri?: vscode.Uri, editor?: vscode.TextEditor) => {
            editor = editor || vscode.window.activeTextEditor;
            uri = uri || vscode.window.activeTextEditor?.document.uri;
            // If "Sort template..." was called from the context menu for ARM template outline
            if (typeof uri === "string") {
                uri = vscode.window.activeTextEditor?.document.uri;
            }
            if (uri && editor) {
                const sectionType = await ext.ui.showQuickPick(getQuickPickItems(), { placeHolder: 'What do you want to sort?' });
                await this.sortTemplate(sectionType.value, uri, editor);
            }
        });
        registerCommand("azurerm-vscode-tools.sortFunctions", async () => {
            await this.sortTemplate(TemplateSectionType.Functions);
        });
        registerCommand("azurerm-vscode-tools.sortOutputs", async () => {
            await this.sortTemplate(TemplateSectionType.Outputs);
        });
        registerCommand("azurerm-vscode-tools.sortParameters", async () => {
            await this.sortTemplate(TemplateSectionType.Parameters);
        });
        registerCommand("azurerm-vscode-tools.sortResources", async () => {
            await this.sortTemplate(TemplateSectionType.Resources);
        });
        registerCommand("azurerm-vscode-tools.sortVariables", async () => {
            await this.sortTemplate(TemplateSectionType.Variables);
        });
        registerCommand("azurerm-vscode-tools.sortTopLevel", async () => {
            await this.sortTemplate(TemplateSectionType.TopLevel);
        });
        registerCommand(
            "azurerm-vscode-tools.selectParameterFile", async (actionContext: IActionContext, sourceTemplateUri?: vscode.Uri) => {
                await selectParameterFile(actionContext, this._mapping, sourceTemplateUri);
            });
        registerCommand(
            "azurerm-vscode-tools.openParameterFile", async (_actionContext: IActionContext, sourceTemplateUri?: vscode.Uri) => {
                sourceTemplateUri = sourceTemplateUri ?? vscode.window.activeTextEditor?.document.uri;
                await openParameterFile(this._mapping, sourceTemplateUri, undefined);
            });
        registerCommand(
            "azurerm-vscode-tools.openTemplateFile", async (_actionContext: IActionContext, sourceParamUri?: vscode.Uri) => {
                sourceParamUri = sourceParamUri ?? vscode.window.activeTextEditor?.document.uri;
                await openTemplateFile(this._mapping, sourceParamUri, undefined);
            });
        registerCommand(
            "azurerm-vscode-tools.codeLens.openLinkedTemplateFile", async (_actionContext: IActionContext, linkedTemplateUri: vscode.Uri) => {
                await openLinkedTemplateFile(linkedTemplateUri);
            });
        registerCommand("azurerm-vscode-tools.insertItem", async (actionContext: IActionContext, uri?: vscode.Uri, editor?: vscode.TextEditor) => {
            editor = editor || vscode.window.activeTextEditor;
            uri = uri || vscode.window.activeTextEditor?.document.uri;
            // If "Sort template..." was called from the context menu for ARM template outline
            if (typeof uri === "string") {
                uri = vscode.window.activeTextEditor?.document.uri;
            }
            if (uri && editor) {
                const sectionType = await ext.ui.showQuickPick(getItemTypeQuickPicks(), { placeHolder: 'What do you want to insert?' });
                await this.insertItem(sectionType.value, actionContext, uri, editor);
            }
        });
        registerCommand("azurerm-vscode-tools.insertParameter", async (actionContext: IActionContext) => {
            await this.insertItem(TemplateSectionType.Parameters, actionContext);
        });
        registerCommand("azurerm-vscode-tools.insertVariable", async (actionContext: IActionContext) => {
            await this.insertItem(TemplateSectionType.Variables, actionContext);
        });
        registerCommand("azurerm-vscode-tools.insertOutput", async (actionContext: IActionContext) => {
            await this.insertItem(TemplateSectionType.Outputs, actionContext);
        });
        registerCommand("azurerm-vscode-tools.insertFunction", async (actionContext: IActionContext) => {
            await this.insertItem(TemplateSectionType.Functions, actionContext);
        });
        registerCommand("azurerm-vscode-tools.insertResource", async (actionContext: IActionContext) => {
            await this.insertItem(TemplateSectionType.Resources, actionContext);
        });

        // Code action commands
        registerCommand("azurerm-vscode-tools.codeAction.addAllMissingParameters", async (actionContext: IActionContext, source?: vscode.Uri, args?: IAddMissingParametersArgs) => {
            await this.addMissingParameters(actionContext, source, args, false);
        });
        registerCommand("azurerm-vscode-tools.codeAction.addMissingRequiredParameters", async (actionContext: IActionContext, source?: vscode.Uri, args?: IAddMissingParametersArgs) => {
            await this.addMissingParameters(actionContext, source, args, true);
        });
        registerCommand("azurerm-vscode-tools.codeAction.extractParameter", async (_context: IActionContext, uri?: vscode.Uri, editor?: vscode.TextEditor) => {
            editor = editor || vscode.window.activeTextEditor;
            uri = uri || vscode.window.activeTextEditor?.document.uri;
            if (editor) {
                let deploymentTemplate = this.getOpenedDeploymentTemplate(editor.document);
                if (!deploymentTemplate) {
                    return;
                }
                await new ExtractItem(ext.ui).extractParameter(editor, deploymentTemplate, _context);
            }
        });
        registerCommand("azurerm-vscode-tools.codeAction.extractVariable", async (_context: IActionContext, uri?: vscode.Uri, editor?: vscode.TextEditor) => {
            editor = editor || vscode.window.activeTextEditor;
            uri = uri || vscode.window.activeTextEditor?.document.uri;
            if (editor) {
                let deploymentTemplate = this.getOpenedDeploymentTemplate(editor.document);
                if (!deploymentTemplate) {
                    return;
                }
                await new ExtractItem(ext.ui).extractVariable(editor, deploymentTemplate, _context);
            }
        });

        // Code lens commands
        registerCommand(
            // Executed when the user clicks on a code lens for a parameter value
            "azurerm-vscode-tools.codeLens.gotoParameterValue",
            async (actionContext: IActionContext, args: IGotoParameterValueArgs) => {
                await this.onGotoParameterValue(actionContext, args);
            });
        registerCommand(
            // Executed when the user clicks on a code lens that shows the children or parent of a resource
            "azurerm-vscode-tools.codeLens.gotoResources",
            async (actionContext: IActionContext, args: IGotoResourcesArgs) => {
                await gotoResources(actionContext, args);
            });

        // Developer commands
        registerCommand("azurerm-vscode-tools.developer.resetGlobalState", resetGlobalState);
        registerCommand(
            "azurerm-vscode-tools.developer.showInsertionContext",
            async (actionContext: IActionContext) => {
                let editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
                if (editor) {
                    let position = editor.selection.anchor;
                    let pc: PositionContext | undefined = await this.getPositionContext(editor.document, position, Cancellation.cantCancel);
                    if (pc) {
                        showInsertionContext(pc);
                    }
                }
            });

        this._paramsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        ext.context.subscriptions.push(this._paramsStatusBarItem);

        vscode.window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this, context.subscriptions);
        vscode.workspace.onDidOpenTextDocument(this.onDocumentOpened, this, context.subscriptions);
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this, context.subscriptions);
        vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed, this, ext.context.subscriptions);
        vscode.workspace.onDidChangeConfiguration(
            async () => {
                this._mapping.resetCache();
                // tslint:disable-next-line: no-floating-promises
                this.updateEditorState();
                this._codeLensChangedEmitter.fire();
            },
            this,
            context.subscriptions);

        this._diagnosticsCollection = vscode.languages.createDiagnosticCollection("azurerm-tools-expressions");
        context.subscriptions.push(this._diagnosticsCollection);

        const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeDocument = activeEditor.document;
            this.updateOpenedDocument(activeDocument);
        }
    }

    private getRegisteredRenameCodeActionProvider(): vscode.Disposable {
        const metaData = { providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite] };
        const renameCodeActionProvider = new RenameCodeActionProvider(async (document, position): Promise<PositionContext | undefined> => await this.getPositionContext(document, position, Cancellation.cantCancel));
        return vscode.languages.registerCodeActionsProvider(templateOrParameterDocumentSelector, renameCodeActionProvider, metaData);
    }

    private async addMissingParameters(
        actionContext: IActionContext,
        // URI of the document containing the parameter *values* (if no args, this is the parameter file)
        source: vscode.Uri | undefined,
        args: IAddMissingParametersArgs | undefined,
        onlyRequiredParameters: boolean
    ): Promise<void> {
        source = source || vscode.window.activeTextEditor?.document.uri;
        const editor = vscode.window.activeTextEditor;
        const uri = source || editor?.document.uri;

        if (editor && uri && editor.document.uri.fsPath === uri.fsPath) {
            let parameterValues: IParameterValuesSource | undefined;
            let parameterDefinitions: IParameterDefinitionsSource | undefined;
            let parentParameterDefinitions: IParameterDefinitionsSource | undefined;

            if (!args) {
                // Called from edit context menu, source is the parameter file, since we don't have a context menu for it
                //   for parameter value sources in the template file
                let { doc, associatedDoc: template } = await this.getDeploymentDocAndAssociatedDoc(editor.document, Cancellation.cantCancel);
                if (doc instanceof DeploymentParametersDoc) {
                    parameterValues = doc.parameterValuesSource;
                    parameterDefinitions = expectTemplateDocument(template).topLevelScope.parameterDefinitionsSource;
                }
            } else {
                // Called from a code action, we should already have the parameter sources in the arguments
                parameterValues = args.parameterValuesSource;
                parameterDefinitions = args.parameterDefinitionsSource;
                parentParameterDefinitions = args.parentParameterDefinitionsSource;
            }

            if (parameterValues && parameterDefinitions) {
                await addMissingParameters(
                    parameterDefinitions,
                    parameterValues,
                    editor,
                    parentParameterDefinitions,
                    onlyRequiredParameters);
            }
        }
    }

    private async sortTemplate(sectionType: TemplateSectionType, documentUri?: vscode.Uri, editor?: vscode.TextEditor): Promise<void> {
        editor = editor || vscode.window.activeTextEditor;
        documentUri = documentUri || editor?.document.uri;
        if (editor && documentUri && editor.document.uri.fsPath === documentUri.fsPath) {
            let deploymentTemplate = this.getOpenedDeploymentTemplate(editor.document);
            await sortTemplate(deploymentTemplate, sectionType, editor);
        }
    }

    private async insertItem(sectionType: TemplateSectionType, context: IActionContext, documentUri?: vscode.Uri, editor?: vscode.TextEditor): Promise<void> {
        editor = editor || vscode.window.activeTextEditor;
        documentUri = documentUri || editor?.document.uri;
        if (editor && documentUri && editor.document.uri.fsPath === documentUri.fsPath) {
            let deploymentTemplate = this.getOpenedDeploymentTemplate(editor.document);
            await new InsertItem(ext.ui).insertItem(deploymentTemplate, sectionType, editor, context);
        }
    }

    public dispose(): void {
        callWithTelemetryAndErrorHandlingSync('dispose', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
        });
    }

    // Add the deployment doc to our list of opened deployment docs
    private setOpenedDeploymentDocument(documentUri: vscode.Uri, deploymentDocument: DeploymentDocument | undefined): void {
        assert(documentUri);
        const documentPathKey = getNormalizedDocumentKey(documentUri);

        if (deploymentDocument) {
            this._deploymentDocuments.set(documentPathKey, deploymentDocument);
        } else {
            this._deploymentDocuments.delete(documentPathKey);
        }

        this._codeLensChangedEmitter.fire();
    }

    private getOpenedDeploymentDocument(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentDocument | undefined {
        assert(documentOrUri);
        const uri = documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri;
        const documentPathKey = getNormalizedDocumentKey(uri);
        return this._deploymentDocuments.get(documentPathKey);
    }

    public getOpenedDeploymentTemplate(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentTemplateDoc | undefined {
        const file = this.getOpenedDeploymentDocument(documentOrUri);
        return file instanceof DeploymentTemplateDoc ? file : undefined;
    }

    private getOpenedDeploymentParameters(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentParametersDoc | undefined {
        const file = this.getOpenedDeploymentDocument(documentOrUri);
        return file instanceof DeploymentParametersDoc ? file : undefined;
    }

    /**
     * Analyzes a text document that has been opened, and handles it appropriately if
     * it's a deployment template or parameter file
     *
     * NOTE: This method is called for *every* file opened in vscode, so we
     * take extra care to avoid slowing down performance, especially if it's not
     * an ARM template or parameter file.
     */
    private updateOpenedDocument(textDocument: vscode.TextDocument): void {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: refactor
        // tslint:disable-next-line: cyclomatic-complexity max-func-body-length
        callWithTelemetryAndErrorHandlingSync('updateDeploymentDocument', (actionContext: IActionContext): void => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.properties.fileExt = path.extname(textDocument.fileName);

            assert(textDocument);
            const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
            const stopwatch = new Stopwatch();
            stopwatch.start();

            let treatAsDeploymentTemplate = false;
            let treatAsDeploymentParameters = false;
            const documentUri = textDocument.uri;

            if (textDocument.languageId === armTemplateLanguageId) {
                // Lang ID is set to arm-template, whether auto or manual, respect the setting
                treatAsDeploymentTemplate = true;
            }

            // If the documentUri is not in our dictionary of deployment templates, then either
            //   it's not a deployment file, or else this document was just opened (as opposed
            //   to changed/updated).
            // Note that it might have been opened, then closed, then reopened, or it
            //   might have had its schema changed in the editor to make it a deployment file.
            const isNewlyOpened: boolean = !this.getOpenedDeploymentDocument(documentUri);

            // Is it a deployment template file?
            let shouldParseFile = treatAsDeploymentTemplate || mightBeDeploymentTemplate(textDocument);
            if (shouldParseFile) {
                // Do a full parse
                let deploymentTemplate: DeploymentTemplateDoc = new DeploymentTemplateDoc(textDocument.getText(), documentUri);
                if (deploymentTemplate.hasArmSchemaUri()) {
                    treatAsDeploymentTemplate = true;
                }
                actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                if (treatAsDeploymentTemplate) {
                    this.ensureDeploymentDocumentEventsHookedUp();

                    this.setOpenedDeploymentDocument(documentUri, deploymentTemplate);
                    survey.registerActiveUse();

                    if (isNewlyOpened) {
                        // A deployment template has been opened (as opposed to having been tabbed to)

                        // Make sure the language ID is set to arm-template
                        if (textDocument.languageId !== armTemplateLanguageId) {
                            // The document will be reloaded, firing this event again with the new langid
                            setLangIdToArm(textDocument, actionContext);
                            return;
                        }
                    }

                    // Not waiting for return
                    // tslint:disable-next-line: no-floating-promises
                    this.reportDeploymentTemplateErrorsInBackground(textDocument, deploymentTemplate).then((errorsWarnings: IErrorsAndWarnings | undefined) => {
                        if (isNewlyOpened) {
                            // Telemetry for template opened
                            if (errorsWarnings) {
                                this.reportTemplateOpenedTelemetry(textDocument, deploymentTemplate, stopwatch, errorsWarnings);
                            }

                            // No guarantee that active editor is the one we're processing, ignore if not
                            if (editor && editor.document === textDocument) {
                                // Are they using an older schema?  Ask to update.
                                // tslint:disable-next-line: no-suspicious-comment
                                // TODO: Move to separate file
                                this.considerQueryingForNewerSchema(editor, deploymentTemplate);

                                // Is there a possibly-matching params file they might want to associate?
                                considerQueryingForParameterFile(this._mapping, textDocument);
                            }
                        }
                    });
                }
            }

            if (!treatAsDeploymentTemplate) {
                // Is it a parameter file?
                let shouldParseParameterFile = treatAsDeploymentTemplate || mightBeDeploymentParameters(textDocument);
                if (shouldParseParameterFile) {
                    // Do a full parse
                    let deploymentParameters: DeploymentParametersDoc = new DeploymentParametersDoc(textDocument.getText(), textDocument.uri);
                    if (deploymentParameters.hasParametersSchema()) {
                        treatAsDeploymentParameters = true;
                    }

                    // This could theoretically include time for parsing for a deployment template as well but isn't likely
                    actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                    if (treatAsDeploymentParameters) {
                        this.ensureDeploymentDocumentEventsHookedUp();
                        this.setOpenedDeploymentDocument(documentUri, deploymentParameters);
                        survey.registerActiveUse();

                        // tslint:disable-next-line: no-floating-promises
                        this.reportDeploymentParametersErrorsInBackground(textDocument, deploymentParameters).then(async (errorsWarnings) => {
                            if (isNewlyOpened && errorsWarnings) {
                                // A deployment template has been opened (as opposed to having been tabbed to)

                                // Telemetry for parameter file opened
                                await this.reportParameterFileOpenedTelemetry(textDocument, deploymentParameters, stopwatch, errorsWarnings);
                            }
                        });
                    }
                }
            }

            if (!treatAsDeploymentTemplate && !treatAsDeploymentParameters) {
                // If the document is not a deployment file, then we need
                // to remove it from our deployment file cache. It doesn't
                // matter if the document is a JSON file and was never a
                // deployment file, or if the document was a deployment
                // file and then was modified to no longer be a deployment
                // file (the $schema property changed to not be a
                // template/params schema). In either case, we should
                // remove it from our cache.
                this.closeDeploymentFile(textDocument);
            }

            // tslint:disable-next-line: no-floating-promises
            this.updateEditorState();
        });
    }

    private reportTemplateOpenedTelemetry(
        document: vscode.TextDocument,
        deploymentTemplate: DeploymentTemplateDoc,
        stopwatch: Stopwatch,
        errorsWarnings: IErrorsAndWarnings
    ): void {
        // tslint:disable-next-line: restrict-plus-operands
        const functionsInEachNamespace = deploymentTemplate.topLevelScope.namespaceDefinitions.map(ns => ns.members.length);
        // tslint:disable-next-line: restrict-plus-operands
        const totalUserFunctionsCount = functionsInEachNamespace.reduce((sum, count) => sum + count, 0);

        const issuesHistograph = new Histogram();
        for (const error of errorsWarnings.errors) {
            issuesHistograph.add(`extErr:${error.kind}`);
        }
        for (const warning of errorsWarnings.warnings) {
            issuesHistograph.add(`extWarn:${warning.kind}`);
        }

        callWithTelemetryAndErrorHandlingSync("Deployment Template Opened", (actionContext: IActionContext) => {
            actionContext.errorHandling.suppressDisplay = true;
            const props = actionContext.telemetry.properties;
            props.docLangId = document.languageId;
            props.docExtension = path.extname(document.fileName);

            const schemaUri = deploymentTemplate.schemaUri;
            const schemaVersionAndScope = (schemaUri?.match(/([-0-9a-zA-Z]+\/[a-zA-Z]+\.json)#?$/) ?? [])[1];
            props.schema = escapeNonPaths(
                restrictToAllowedListLC<allSchemas>(
                    schemaVersionAndScope,
                    [
                        '2019-08-01/tenantDeploymentTemplate.json',
                        '2018-05-01/subscriptionDeploymentTemplate.json',
                        '2014-04-01-preview/deploymentTemplate.json',
                        '2015-01-01/deploymentTemplate.json',
                        '2019-04-01/deploymentTemplate.json',
                        '2019-08-01/managementGroupDeploymentTemplate.json',
                        '2019-08-01/tenantDeploymentTemplate.json'
                    ]));
            props.schemaScheme = restrictToAllowedListLC((schemaUri?.match(/^https?/) ?? [])[0], ['http', 'https']);

            props.apiProfile = deploymentTemplate.apiProfile ?? "";
            props.issues = this.histogramToTelemetryString(issuesHistograph);

            const measurements = actionContext.telemetry.measurements;
            measurements.documentSizeInCharacters = document.getText().length;
            measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;
            measurements.lineCount = deploymentTemplate.lineCount;
            measurements.maxLineLength = deploymentTemplate.getMaxLineLength();
            measurements.paramsCount = deploymentTemplate.topLevelScope.parameterDefinitionsSource?.parameterDefinitions.length;
            measurements.varsCount = deploymentTemplate.topLevelScope.variableDefinitions.length;
            measurements.namespacesCount = deploymentTemplate.topLevelScope.namespaceDefinitions.length;
            measurements.userFunctionsCount = totalUserFunctionsCount;
            measurements.multilineStringCount = deploymentTemplate.getMultilineStringCount();
            measurements.commentCount = deploymentTemplate.getCommentCount();
            measurements.extErrorsCount = errorsWarnings.errors.length;
            measurements.extWarnCount = errorsWarnings.warnings.length;
            measurements.parameterFiles = this._mapping.getParameterFile(document.uri) ? 1 : 0;

            const getChildTemplatesInfo = deploymentTemplate.getChildTemplatesInfo();
            measurements.linkedTemplatesCount = getChildTemplatesInfo.linkedTemplatesCount;
            measurements.nestedInnerCount = getChildTemplatesInfo.nestedInnerCount;
            measurements.nestedOuterCount = getChildTemplatesInfo.nestedOuterCount;
        });

        this.logFunctionCounts(deploymentTemplate);
        this.logResourceUsage(deploymentTemplate);

        function restrictToAllowedListLC<T extends string>(s: string | undefined, allowedList: T[]): T | string {
            allowedList = allowedList.map(s2 => <T>s2.toLowerCase());
            if (s && allowedList.includes(<T>s.toLowerCase())) {
                return s;
            }

            return !!s ? "other" : '';
        }
    }

    private async reportParameterFileOpenedTelemetry(
        document: vscode.TextDocument,
        parameters: DeploymentParametersDoc,
        stopwatch: Stopwatch,
        errorsWarnings: IErrorsAndWarnings
    ): Promise<void> {
        const issuesHistograph = new Histogram();
        for (const error of errorsWarnings.errors) {
            issuesHistograph.add(`extErr:${error.kind}`);
        }
        for (const warning of errorsWarnings.warnings) {
            issuesHistograph.add(`extWarn:${warning.kind}`);
        }

        callWithTelemetryAndErrorHandlingSync('Parameter File Opened', (actionContext: IActionContext) => {
            actionContext.errorHandling.suppressDisplay = true;

            const props = actionContext.telemetry.properties;
            props.docLangId = document.languageId;
            props.docExtension = path.extname(document.fileName);
            props.schema = parameters.schemaUri ?? "";

            const measurements = actionContext.telemetry.measurements;
            measurements.documentSizeInCharacters = document.getText().length;
            measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;
            measurements.lineCount = parameters.lineCount;
            measurements.maxLineLength = parameters.getMaxLineLength();
            measurements.paramsCount = parameters.parameterValueDefinitions.length;
            measurements.commentCount = parameters.getCommentCount();
            measurements.templateFiles = this._mapping.getTemplateFile(document.uri) ? 1 : 0;
            measurements.extErrorsCount = errorsWarnings.errors.length;
            measurements.extWarnCount = errorsWarnings.warnings.length;
        });
    }

    private reportDeploymentDocumentErrors(
        textDocument: vscode.TextDocument,
        deploymentDocument: DeploymentDocument,
        associatedDocument: DeploymentDocument | undefined
    ): IErrorsAndWarnings {
        ++this._diagnosticsVersion;

        let errors: Issue[] = deploymentDocument.getErrors(associatedDocument);
        const diagnostics: vscode.Diagnostic[] = [];

        for (const error of errors) {
            diagnostics.push(toVSCodeDiagnosticFromIssue(deploymentDocument, error, vscode.DiagnosticSeverity.Error));
        }

        const warnings = deploymentDocument.getWarnings();
        for (const warning of warnings) {
            diagnostics.push(toVSCodeDiagnosticFromIssue(deploymentDocument, warning, vscode.DiagnosticSeverity.Warning));
        }

        let completionDiagnostic = this.getCompletedDiagnostic();
        if (completionDiagnostic) {
            diagnostics.push(completionDiagnostic);
        }

        this._diagnosticsCollection.set(textDocument.uri, diagnostics);

        return { errors, warnings };
    }

    private async reportDeploymentTemplateErrorsInBackground(
        textDocument: vscode.TextDocument,
        deploymentTemplate: DeploymentTemplateDoc
    ): Promise<IErrorsAndWarnings | undefined> {
        return await callWithTelemetryAndErrorHandling('reportDeploymentTemplateErrors', async (actionContext: IActionContext): Promise<IErrorsAndWarnings> => {
            actionContext.telemetry.suppressIfSuccessful = true;

            // Note: Associated parameters? Not currently used by getErrors
            const associatedParameters: DeploymentParametersDoc | undefined = undefined;
            return this.reportDeploymentDocumentErrors(textDocument, deploymentTemplate, associatedParameters);
        });
    }

    private async reportDeploymentParametersErrorsInBackground(
        textDocument: vscode.TextDocument,
        deploymentParameters: DeploymentParametersDoc
    ): Promise<IErrorsAndWarnings | undefined> {
        return await callWithTelemetryAndErrorHandling('reportDeploymentParametersErrors', async (actionContext: IActionContext): Promise<IErrorsAndWarnings> => {
            actionContext.telemetry.suppressIfSuccessful = true;

            const templateUri: vscode.Uri | undefined = this._mapping.getTemplateFile(deploymentParameters.documentUri);
            let template: DeploymentTemplateDoc | undefined;
            if (templateUri) {
                const templateFileExists = await pathExists(templateUri);
                actionContext.telemetry.properties.templateFileExists = String(templateFileExists);
                if (templateFileExists) {
                    template = await this.getOrReadDeploymentTemplate(templateUri);
                }
            }

            return this.reportDeploymentDocumentErrors(textDocument, deploymentParameters, template);
        });
    }

    private considerQueryingForNewerSchema(editor: vscode.TextEditor, deploymentTemplate: DeploymentTemplateDoc): void {
        // Only deal with saved files, because we don't have an accurate
        //   URI that we can track for unsaved files, and it's a better user experience.
        if (editor.document.uri.scheme !== 'file') {
            return;
        }

        // Only ask to upgrade once per session per file
        const document = editor.document;
        const documentPath = document.uri.fsPath;
        let queriedToUpdateSchema = this._filesAskedToUpdateSchemaThisSession.has(documentPath);
        if (queriedToUpdateSchema) {
            return;
        }

        this._filesAskedToUpdateSchemaThisSession.add(documentPath);

        const schemaValue: Json.StringValue | undefined = deploymentTemplate.schemaValue;
        // tslint:disable-next-line: strict-boolean-expressions
        const schemaUri: string | undefined = deploymentTemplate.schemaUri || undefined;
        const preferredSchemaUri: string | undefined = schemaUri && getPreferredSchema(schemaUri);
        const checkForLatestSchema = !!ext.configuration.get<boolean>(configKeys.checkForLatestSchema);

        if (preferredSchemaUri && schemaValue) {
            // tslint:disable-next-line: no-floating-promises // Don't wait
            callWithTelemetryAndErrorHandling('queryUpdateSchema', async (actionContext: IActionContext): Promise<void> => {
                actionContext.telemetry.properties.currentSchema = schemaUri;
                actionContext.telemetry.properties.preferredSchema = preferredSchemaUri;
                actionContext.telemetry.properties.checkForLatestSchema = String(checkForLatestSchema);

                if (!checkForLatestSchema) {
                    return;
                }

                // tslint:disable-next-line: strict-boolean-expressions
                const dontAskFiles = ext.context.globalState.get<string[]>(globalStateKeys.dontAskAboutSchemaFiles) || [];
                if (dontAskFiles.includes(documentPath)) {
                    actionContext.telemetry.properties.isInDontAskList = 'true';
                    return;
                }

                const yes: vscode.MessageItem = { title: "Use latest" };
                const notNow: vscode.MessageItem = { title: "Not now" };
                const neverForThisFile: vscode.MessageItem = { title: "Never for this file" };

                const response = await ext.ui.showWarningMessage(
                    `Warning: You are using a deprecrated schema version that is no longer maintained.  Would you like us to update "${path.basename(document.uri.path)}" to use the newest schema?`,
                    {
                        learnMoreLink: "https://aka.ms/vscode-azurearmtools-updateschema"
                    },
                    yes,
                    notNow,
                    neverForThisFile
                );
                actionContext.telemetry.properties.response = response.title;

                switch (response.title) {
                    case yes.title:
                        await this.replaceSchema(document.uri, deploymentTemplate, schemaValue.unquotedValue, preferredSchemaUri);
                        actionContext.telemetry.properties.replacedSchema = "true";
                        return;
                    case notNow.title:
                        return;
                    case neverForThisFile.title:
                        dontAskFiles.push(documentPath);
                        await ext.context.globalState.update(globalStateKeys.dontAskAboutSchemaFiles, dontAskFiles);
                        break;
                    default:
                        assert("queryUseNewerSchema: Unexpected response");
                        break;
                }
            });
        }
    }

    private async replaceSchema(uri: vscode.Uri, deploymentTemplate: DeploymentTemplateDoc, previousSchema: string, newSchema: string): Promise<void> {
        // Editor might have been closed or tabbed away from, so make sure it's visible
        const editor = await vscode.window.showTextDocument(uri);

        // The document might have changed since we asked, so find the $schema again
        const currentTemplate = new DeploymentTemplateDoc(editor.document.getText(), editor.document.uri);
        const currentSchemaValue: Json.StringValue | undefined = currentTemplate.schemaValue;
        if (currentSchemaValue && currentSchemaValue.unquotedValue === previousSchema) {
            const range = getVSCodeRangeFromSpan(currentTemplate, currentSchemaValue.unquotedSpan);
            await editor.edit(edit => {
                // Replace $schema value
                edit.replace(range, newSchema);
            });

            // Select what we just replaced
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.Default);
        } else {
            throw new Error("The document has changed, the $schema was not replaced.");
        }
    }

    private getCompletedDiagnostic(): vscode.Diagnostic | undefined {
        if (ext.addCompletedDiagnostic) {
            // Add a diagnostic to indicate expression validation is done (for testing)
            return {
                severity: vscode.DiagnosticSeverity.Information,
                message: `${expressionsDiagnosticsCompletionMessage}, version ${this._diagnosticsVersion}`,
                source: expressionsDiagnosticsSource,
                code: "",
                range: new vscode.Range(0, 0, 0, 0)
            };
        } else {
            return undefined;
        }
    }

    /**
     * Hook up events related to template files (as opposed to plain JSON files). This is only called when
     * actual template files are open, to avoid slowing performance when simple JSON files are opened.
     */
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Refactor
    private ensureDeploymentDocumentEventsHookedUp(): void {
        if (this._areDeploymentTemplateEventsHookedUp) {
            return;
        }
        this._areDeploymentTemplateEventsHookedUp = true;

        // tslint:disable-next-line: no-suspicious-comment
        // tslint:disable-next-line: max-func-body-length // TODO: Refactor
        callWithTelemetryAndErrorHandlingSync("ensureDeploymentTemplateEventsHookedUp", (actionContext: IActionContext) => {
            actionContext.telemetry.suppressIfSuccessful = true;

            vscode.window.onDidChangeTextEditorSelection(this.onTextSelectionChanged, this, ext.context.subscriptions);

            const hoverProvider: vscode.HoverProvider = {
                provideHover: async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> => {
                    return await this.onProvideHover(document, position, token);
                }
            };
            ext.context.subscriptions.push(vscode.languages.registerHoverProvider(templateDocumentSelector, hoverProvider));

            const codeLensProvider: vscode.CodeLensProvider = {
                onDidChangeCodeLenses: this._codeLensChangedEmitter.event,
                provideCodeLenses: (document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | undefined => {
                    return this.onProvideCodeLenses(document, token);
                },
                resolveCodeLens: async (codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens | undefined> => {
                    return await this.onResolveCodeLens(codeLens, token);
                }
            };
            ext.context.subscriptions.push(vscode.languages.registerCodeLensProvider(templateDocumentSelector, codeLensProvider));

            // Code actions provider
            const codeActionProvider: vscode.CodeActionProvider = {
                provideCodeActions: async (
                    textDocument: vscode.TextDocument,
                    range: vscode.Range | vscode.Selection,
                    context: vscode.CodeActionContext,
                    token: vscode.CancellationToken
                ): Promise<(vscode.Command | vscode.CodeAction)[] | undefined> => {
                    return await this.onProvideCodeActions(textDocument, range, context, token);
                }
            };
            ext.context.subscriptions.push(
                vscode.languages.registerCodeActionsProvider(
                    templateOrParameterDocumentSelector,
                    codeActionProvider,
                    {
                        providedCodeActionKinds: [
                            vscode.CodeActionKind.QuickFix,
                            vscode.CodeActionKind.RefactorExtract
                        ]
                    }
                ));

            // tslint:disable-next-line:no-suspicious-comment
            const completionProvider: vscode.CompletionItemProvider = {
                provideCompletionItems: async (
                    document: vscode.TextDocument,
                    position: vscode.Position,
                    token: vscode.CancellationToken,
                    context: vscode.CompletionContext
                ): Promise<vscode.CompletionList | undefined> => {
                    return await this.onProvideCompletions(document, position, token, context);
                },
                resolveCompletionItem: (item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.CompletionItem => {
                    return this.onResolveCompletionItem(item, token);
                }
            };
            ext.context.subscriptions.push(
                vscode.languages.registerCompletionItemProvider(
                    templateOrParameterDocumentSelector,
                    completionProvider,
                    "'",
                    "[",
                    ".",
                    '"',
                    '(',
                    ',',
                    ' ',
                    '{'
                ));

            // tslint:disable-next-line:no-suspicious-comment
            const definitionProvider: vscode.DefinitionProvider = {
                provideDefinition: async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | undefined> => {
                    return await this.onProvideDefinition(document, position, token);
                }
            };
            ext.context.subscriptions.push(
                vscode.languages.registerDefinitionProvider(
                    templateOrParameterDocumentSelector,
                    definitionProvider));

            const referenceProvider: vscode.ReferenceProvider = {
                provideReferences: async (document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): Promise<vscode.Location[] | undefined> => {
                    return this.onProvideReferences(document, position, context, token);
                }
            };
            ext.context.subscriptions.push(vscode.languages.registerReferenceProvider(templateOrParameterDocumentSelector, referenceProvider));

            const signatureHelpProvider: vscode.SignatureHelpProvider = {
                provideSignatureHelp: async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp | undefined> => {
                    return await this.onProvideSignatureHelp(document, position, token);
                }
            };
            ext.context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(templateDocumentSelector, signatureHelpProvider, ",", "(", "\n"));

            const renameProvider: vscode.RenameProvider = {
                provideRenameEdits: async (document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> => {
                    return await this.onProvideRename(document, position, newName, token);
                },
                prepareRename: async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> => {
                    return await this.prepareRename(document, position, token);
                }
            };
            ext.context.subscriptions.push(vscode.languages.registerRenameProvider(templateOrParameterDocumentSelector, renameProvider));

            const documentLinkProvider: vscode.DocumentLinkProvider = {
                provideDocumentLinks: async (document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[] | undefined> => {
                    return await this.provideDocumentLinks(document, token);
                },
                resolveDocumentLink: async (link: vscode.DocumentLink, token: vscode.CancellationToken): Promise<vscode.DocumentLink | undefined> => {
                    return await this.resolveDocumentLink(link, token);
                }
            };
            ext.context.subscriptions.push(
                vscode.languages.registerDocumentLinkProvider(templateDocumentSelector, documentLinkProvider));

            ext.context.subscriptions.push(notifyTemplateGraphAvailable(this.onTemplateGraphAvailable, this));
            ext.context.subscriptions.push(ext.languageServerStateChanged(this.onLanguageServerStateChanged, this));

            startArmLanguageServerInBackground();
        });
    }

    private async updateEditorState(): Promise<void> {
        let statusBarText: string | undefined;
        let isTemplateFile = false;
        let templateFileHasParamFile = false;
        let isParamFile = false;
        let paramFileHasTemplateFile = false;

        try {
            const activeDocument = vscode.window.activeTextEditor?.document;
            if (activeDocument) {
                const deploymentTemplate = this.getOpenedDeploymentDocument(activeDocument);
                if (deploymentTemplate instanceof DeploymentTemplateDoc) {
                    isTemplateFile = true;
                    let fullValidationOn: boolean;

                    const paramFileUri = this._mapping.getParameterFile(activeDocument.uri);
                    if (paramFileUri) {
                        templateFileHasParamFile = true;
                        const doesParamFileExist = await pathExists(paramFileUri);
                        statusBarText = `Parameter file: ${getFriendlyPathToFile(paramFileUri)}`;
                        fullValidationOn = true;
                        if (!doesParamFileExist) {
                            statusBarText += " $(error) Not found";
                            fullValidationOn = false;
                        }
                    } else {
                        statusBarText = "Select/Create parameter file to enable...";
                        fullValidationOn = false;
                    }

                    // Add message to indicate if full validation is disabled
                    statusBarText = fullValidationOn ?
                        `${statusBarText}` :
                        `$(warning) Full template validation off (parameters file or default values needed).  ${statusBarText}`;

                    this._paramsStatusBarItem.command = "azurerm-vscode-tools.selectParameterFile";
                    this._paramsStatusBarItem.text = statusBarText;
                } else if (deploymentTemplate instanceof DeploymentParametersDoc) {
                    // Current file is a parameter file
                    isParamFile = true;

                    const templateFileUri = this._mapping.getTemplateFile(activeDocument.uri);
                    if (templateFileUri) {
                        paramFileHasTemplateFile = true;
                        const doesTemplateFileExist = await pathExists(templateFileUri);
                        statusBarText = `Template file: ${getFriendlyPathToFile(templateFileUri)}`;
                        if (!doesTemplateFileExist) {
                            statusBarText += " $(error) Not found";
                        }
                    } else {
                        statusBarText = "No template file selected";
                    }

                    this._paramsStatusBarItem.command = "azurerm-vscode-tools.openTemplateFile";
                    this._paramsStatusBarItem.text = statusBarText;
                }
            }
        } finally {
            if (statusBarText) {
                this._paramsStatusBarItem.show();
            } else {
                this._paramsStatusBarItem.hide();
            }

            // tslint:disable-next-line: no-floating-promises
            setContext({
                isTemplateFile,
                hasParamFile: templateFileHasParamFile,
                isParamFile: isParamFile,
                hasTemplateFile: paramFileHasTemplateFile
            });
        }
    }

    /**
     * Logs telemetry with information about the functions used in a template. Only meaningful if called
     * in a relatively stable state, such as after first opening
     */
    private logFunctionCounts(deploymentTemplate: DeploymentTemplateDoc): void {
        // Don't wait for promise
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling("tle.stats", async (actionContext: IActionContext): Promise<void> => {
            actionContext.errorHandling.suppressDisplay = true;
            let properties: {
                functionCounts?: string;
                unrecognized?: string;
                incorrectArgs?: string;
            } & TelemetryProperties = actionContext.telemetry.properties;

            let issues: Issue[] = deploymentTemplate.getErrors(undefined);

            // Full function counts
            const functionCounts: Histogram = deploymentTemplate.getFunctionCounts();
            const functionsData: { [key: string]: number } = {};
            for (const functionName of functionCounts.keys) {
                functionsData[<string>functionName] = functionCounts.getCount(functionName);
            }
            properties.functionCounts = JSON.stringify(functionsData);

            // Missing function names and functions with incorrect number of arguments (useful for knowing
            //   if our expressionMetadata.json file is up to date)
            let unrecognized = new Set<string>();
            let incorrectArgCounts = new Set<string>();
            for (const issue of issues) {
                if (issue instanceof UnrecognizedBuiltinFunctionIssue) {
                    unrecognized.add(issue.functionName);
                } else if (issue instanceof IncorrectArgumentsCountIssue) {
                    // Encode function name as "funcname(<actual-args>)[<min-expected>..<max-expected>]"
                    let encodedName = `${issue.functionName}(${issue.actual})[${issue.minExpected}..${issue.maxExpected}]`;
                    incorrectArgCounts.add(encodedName);
                }
            }
            properties.unrecognized = AzureRMTools.convertSetToJson(unrecognized);
            properties.incorrectArgs = AzureRMTools.convertSetToJson(incorrectArgCounts);
        });
    }

    /**
     * Log information about which resource types and apiVersions are being used
     */
    private logResourceUsage(deploymentTemplate: DeploymentTemplateDoc): void {
        // Don't wait for promise
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling("schema.stats", async (actionContext: IActionContext): Promise<void> => {
            actionContext.errorHandling.suppressDisplay = true;
            let properties: {
                resourceCounts?: string;
            } & TelemetryProperties = actionContext.telemetry.properties;

            const resourceCounts: Histogram = deploymentTemplate.getResourceUsage();
            properties.resourceCounts = escapeNonPaths(this.histogramToTelemetryString(resourceCounts));
        });
    }

    private histogramToTelemetryString(histogram: Histogram): string {
        const data: { [key: string]: number } = {};
        for (const key of histogram.keys) {
            data[<string>key] = histogram.getCount(key);
        }
        return JSON.stringify(data);
    }

    private static convertSetToJson(s: Set<string>): string {
        // tslint:disable-next-line: strict-boolean-expressions
        if (!s.size) {
            return "";
        }
        let array: string[] = [];
        for (let item of s) {
            array.push(item);
        }
        return JSON.stringify(array);
    }

    private closeDeploymentFile(document: vscode.TextDocument): void {
        assert(document);
        this._diagnosticsCollection.delete(document.uri);
        this.setOpenedDeploymentDocument(document.uri, undefined);
    }

    private onProvideCodeLenses(textDocument: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | undefined {
        if (!ext.configuration.get<boolean>(configKeys.enableCodeLens)) {
            return undefined;
        }

        /**
         * A parameter value source provider using a parameter file. This is here just for convenient access to the
         * getOrReadTemplateParameters function.
         */
        class ParameterValuesSourceProviderFromParameterFile implements IParameterValuesSourceProvider {
            private _parameterValuesSource: CachedPromise<IParameterValuesSource> = new CachedPromise<IParameterValuesSource>();

            public constructor(
                private readonly parent: AzureRMTools,
                public readonly parameterFileUri: vscode.Uri) {
            }

            // Load parameter file asynchronously and expose its parameter values
            public async getValuesSource(): Promise<IParameterValuesSource> {
                return this._parameterValuesSource.getOrCachePromise(async () => {
                    const dp = await this.parent.getOrReadParametersFile(this.parameterFileUri);
                    return dp?.parameterValuesSource;
                });
            }
        }

        return callWithTelemetryAndErrorHandlingSync('ProvideCodeLenses', (actionContext: IActionContext): vscode.CodeLens[] | undefined => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            const doc = this.getOpenedDeploymentDocument(textDocument.uri);

            if (doc) {
                const dpUri = this._mapping.getParameterFile(doc.documentUri);
                let topLevelParametersProvider: ParameterValuesSourceProviderFromParameterFile | undefined;
                if (dpUri) {
                    // There is a parameter file, but we don't want to retrieve until we resolve
                    // the code lens because onProvideCodeLenses is supposed to return as quickly as possible.
                    topLevelParametersProvider = new ParameterValuesSourceProviderFromParameterFile(this, dpUri);
                }

                return doc.getCodeLenses(topLevelParametersProvider);
            }
        });
    }

    private async onResolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Promise<vscode.CodeLens | undefined> {
        return await callWithTelemetryAndErrorHandling('ResolveCodeLens', async (actionContext: IActionContext): Promise<vscode.CodeLens | undefined> => {
            actionContext.telemetry.suppressIfSuccessful = true;

            if (codeLens instanceof ResolvableCodeLens) {
                if (await codeLens.resolve()) {
                    assert(codeLens.command?.title, "CodeLens wasn't resolved");
                    return codeLens;
                }
            } else {
                assert.fail('Expected ResolvableCodeLens instance');
            }

            codeLens.command = {
                title: '',
                command: ''
            };
            return codeLens;
        });
    }

    private async onProvideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {
        return await callWithTelemetryAndErrorHandling('Hover', async (actionContext: IActionContext): Promise<vscode.Hover | undefined> => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            const properties = <TelemetryProperties & { hoverType?: string; tleFunctionName: string }>actionContext.telemetry.properties;

            const cancel = new Cancellation(token, actionContext);
            const { doc, associatedDoc } = await this.getDeploymentDocAndAssociatedDoc(document, cancel);
            if (doc) {
                const context = doc.getContextFromDocumentLineAndColumnIndexes(position.line, position.character, associatedDoc);
                const hoverInfos: IHoverInfo[] = context.getHoverInfo();
                if (hoverInfos.length > 0) {
                    properties.hoverTypes = hoverInfos.map(i => i.hoverType).join(',');
                    const markdownStrings = hoverInfos.map(hi => hi.getHoverText());
                    return new vscode.Hover(markdownStrings);
                }
            }

            return undefined;
        });
    }

    private async onProvideCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionList | undefined> {
        return await callWithTelemetryAndErrorHandling('provideCompletionItems', async (actionContext: IActionContext): Promise<vscode.CompletionList | undefined> => {
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.errorHandling.suppressDisplay = true;

            const cancel = new Cancellation(token, actionContext);

            const pc: PositionContext | undefined = await this.getPositionContext(document, position, cancel);
            if (pc) {
                const triggerCharacter = context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter
                    ? context.triggerCharacter
                    : undefined;
                const { items, triggerSuggest } = await pc.getCompletionItems(triggerCharacter, defaultTabSize);
                if (triggerSuggest) {
                    // The user typed the beginning of a parent object, open up the completions context menu because it's
                    // likely they want to use a snippet immediately
                    // tslint:disable-next-line: no-floating-promises
                    delay(1).then(async () => {
                        // First, add a newline to open up the {} or []
                        await vscode.commands.executeCommand('type', { text: '\n' });
                        vscode.commands.executeCommand('editor.action.triggerSuggest');
                    });
                    return undefined;
                } else {
                    const vsCodeItems = items.map(c => toVsCodeCompletionItem(pc.document, c, position));
                    ext.completionItemsSpy.postCompletionItemsResult(pc.document, items, vsCodeItems);
                    return new vscode.CompletionList(vsCodeItems, true);
                }
            }
        });
    }

    private onResolveCompletionItem(item: vscode.CompletionItem, _token: vscode.CancellationToken): vscode.CompletionItem {
        ext.completionItemsSpy.postCompletionItemResolution(item);
        return item;
    }

    private async onGotoParameterValue(actionContext: IActionContext, args: IGotoParameterValueArgs): Promise<void> {
        // Open the correct document
        const uri = args.inParameterFile?.parameterFileUri ?? args.inTemplateFile?.documentUri;
        assert(uri);
        let textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(textDocument);

        // Navigate to the correct range, if any
        const doc: DeploymentDocument | undefined = this.getOpenedDeploymentDocument(uri);
        let range: vscode.Range | undefined;
        if (args.inParameterFile && doc instanceof DeploymentParametersDoc) {
            const parameterValues = doc.parameterValuesSource;
            // If the parameter doesn't have a value to navigate to, then show the
            // properties section or beginning of the param file/nested template.
            const parameterName = args.inParameterFile.parameterName;
            const span =
                // First choice: Directly to the parameter's value
                (parameterName ? parameterValues.getParameterValue(parameterName)?.value?.span : undefined)
                // Second choice: To the "properties" section
                ?? parameterValues.parameterValuesProperty?.nameValue.span
                // Third choice: top of the file
                ?? new Span(0, 0);
            range = getVSCodeRangeFromSpan(doc, span);
        } else if (args.inTemplateFile && doc instanceof DeploymentTemplateDoc) {
            range = args.inTemplateFile.range;
        }

        if (range) {
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range);
        }
    }

    // CONSIDER: Cache when we have to read from disk, or better, load into text
    //   buffer instead
    /**
     * Given a document, get a DeploymentTemplate or DeploymentParameters instance from it, and then
     * find the appropriate associated document for it
     */
    private async getDeploymentDocAndAssociatedDoc(
        documentOrUri: vscode.TextDocument | vscode.Uri,
        cancel: Cancellation
    ): Promise<{ doc?: DeploymentTemplateDoc; associatedDoc?: DeploymentParametersDoc } | { doc?: DeploymentParametersDoc; associatedDoc?: DeploymentTemplateDoc }> {
        cancel.throwIfCancelled();

        const docUri = documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri;
        const doc = this.getOpenedDeploymentDocument(docUri);
        if (!doc) {
            // No reason to try reading from disk, if it's not in our opened list,
            // it can't be the one in the current text document
            return {};
        }

        if (doc instanceof DeploymentTemplateDoc) {
            const template: DeploymentTemplateDoc = doc;
            // It's a template file - find the associated parameter file, if any
            let params: DeploymentParametersDoc | undefined;
            const paramsUri: vscode.Uri | undefined = this._mapping.getParameterFile(docUri);
            if (paramsUri) {
                params = await this.getOrReadParametersFile(paramsUri);
                cancel.throwIfCancelled();
            }

            assert(doc instanceof DeploymentTemplateDoc);
            assert(!params || params instanceof DeploymentParametersDoc);
            return { doc: template, associatedDoc: params };
        } else if (doc instanceof DeploymentParametersDoc) {
            const params: DeploymentParametersDoc = doc;
            // It's a parameter file - find the associated template file, if any
            let template: DeploymentTemplateDoc | undefined;
            const templateUri: vscode.Uri | undefined = this._mapping.getTemplateFile(docUri);
            if (templateUri) {
                template = await this.getOrReadDeploymentTemplate(templateUri);
                cancel.throwIfCancelled();
            }

            return { doc: params, associatedDoc: template };
        } else {
            assert.fail("Unexpected doc type");
        }
    }

    /**
     * Given a document, get a DeploymentTemplate or DeploymentParameters instance from it, and then
     * create the appropriate context for it from the given position
     */
    private async getPositionContext(textDocument: vscode.TextDocument, position: vscode.Position, cancel: Cancellation): Promise<PositionContext | undefined> {
        cancel.throwIfCancelled();

        const { doc, associatedDoc } = await this.getDeploymentDocAndAssociatedDoc(textDocument, cancel);
        if (!doc) {
            return undefined;
        }

        cancel.throwIfCancelled();
        return doc.getContextFromDocumentLineAndColumnIndexes(position.line, position.character, associatedDoc);
    }

    /**
     * Given a deployment template URI, return the corresponding opened DeploymentTemplate for it.
     * If none, create a new one by reading the location from disk
     */
    private async getOrReadDeploymentTemplate(uri: vscode.Uri): Promise<DeploymentTemplateDoc> {
        // Is it already opened?
        const doc = this.getOpenedDeploymentTemplate(uri);
        if (doc) {
            assert(doc instanceof DeploymentTemplateDoc, "Expected DeploymentTemplateDoc");
            return doc;
        }

        // Nope, have to read it from disk
        const contents = await readUtf8FileWithBom(uri.fsPath);
        return new DeploymentTemplateDoc(contents, uri);
    }

    /**
     * Given a parameter file URI, return the corresponding opened DeploymentParameters for it.
     * If none, create a new one by reading the location from disk
     */
    private async getOrReadParametersFile(uri: vscode.Uri): Promise<DeploymentParametersDoc> {
        // Is it already opened?
        const doc = this.getOpenedDeploymentParameters(uri);
        if (doc) {
            assert(doc instanceof DeploymentParametersDoc, "Expected DeploymentParametersDoc");
            return doc;
        }

        // Nope, have to read it from disk
        // CONSIDER: Load it instead?
        const contents = await readUtf8FileWithBom(uri.fsPath);
        return new DeploymentParametersDoc(contents, uri);
    }

    private getDocTypeForTelemetry(doc: DeploymentDocument): string {
        if (doc instanceof DeploymentTemplateDoc) {
            return "template";
        } else if (doc instanceof DeploymentParametersDoc) {
            return "parameters";
        } else {
            assert.fail("Unexpected doc type");
        }
    }

    private async onProvideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | undefined> {
        return await callWithTelemetryAndErrorHandling('Go To Definition', async (actionContext: IActionContext): Promise<vscode.Location | undefined> => {
            const cancel = new Cancellation(token, actionContext);
            const pc: PositionContext | undefined = await this.getPositionContext(document, position, cancel);

            if (pc) {
                let properties = <TelemetryProperties &
                {
                    definitionType?: string;
                    docType?: string;
                }>actionContext.telemetry.properties;
                actionContext.errorHandling.suppressDisplay = true;
                properties.docType = this.getDocTypeForTelemetry(pc.document);

                const refInfo = pc.getReferenceSiteInfo(false);
                if (refInfo && refInfo.definition.nameValue) {
                    properties.definitionType = refInfo.definition.definitionKind;

                    return new vscode.Location(
                        refInfo.definitionDocument.documentUri,
                        getVSCodeRangeFromSpan(refInfo.definitionDocument, refInfo.definition.nameValue.span)
                    );
                }

                return undefined;
            }
        });
    }

    private async onProvideReferences(textDocument: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): Promise<vscode.Location[] | undefined> {
        return await callWithTelemetryAndErrorHandling('Find References', async (actionContext: IActionContext): Promise<vscode.Location[]> => {
            const cancel = new Cancellation(token, actionContext);
            const results: vscode.Location[] = [];
            const pc: PositionContext | undefined = await this.getPositionContext(textDocument, position, cancel);
            if (pc) {
                const references: ReferenceList | undefined = pc.getReferences();
                if (references && references.length > 0) {
                    actionContext.telemetry.properties.referenceType = references.kind;

                    for (const ref of references.references) {
                        const locationUri: vscode.Uri = ref.document.documentUri;
                        const referenceRange: vscode.Range = getVSCodeRangeFromSpan(ref.document, ref.span);
                        results.push(new vscode.Location(locationUri, referenceRange));
                    }
                }
            }

            return results;
        });
    }

    /**
     * Provide commands for the given document and range.
     *
     * @param textDocument The document in which the command was invoked.
     * @param range The selector or range for which the command was invoked. This will always be a selection if
     * there is a currently active editor.
     * @param context Context carrying additional information.
     * @param token A cancellation token.
     * @return An array of commands, quick fixes, or refactorings or a thenable of such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    private async onProvideCodeActions(
        textDocument: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<(vscode.Command | vscode.CodeAction)[] | undefined> {
        return await callWithTelemetryAndErrorHandling('Provide code actions', async (actionContext: IActionContext): Promise<(vscode.Command | vscode.CodeAction)[]> => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            const cancel = new Cancellation(token, actionContext);

            const { doc, associatedDoc } = await this.getDeploymentDocAndAssociatedDoc(textDocument, cancel);
            if (doc) {
                return doc.getCodeActions(associatedDoc, range, context);
            }

            return [];
        });
    }

    private async onProvideSignatureHelp(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp | undefined> {
        return await callWithTelemetryAndErrorHandling('provideSignatureHelp', async (actionContext: IActionContext): Promise<vscode.SignatureHelp | undefined> => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            const cancel = new Cancellation(token, actionContext);
            const pc: PositionContext | undefined = await this.getPositionContext(textDocument, position, cancel);
            if (pc) {
                let functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = pc.getSignatureHelp();
                let signatureHelp: vscode.SignatureHelp | undefined;

                if (functionSignatureHelp) {
                    const signatureInformation = new vscode.SignatureInformation(functionSignatureHelp.functionMetadata.usage, functionSignatureHelp.functionMetadata.description);
                    signatureInformation.parameters = [];
                    for (const param of functionSignatureHelp.functionMetadata.parameters) {
                        // Parameter label needs to be in the exact same format as in the function usage (including type, if you want it to get highlighted with the parameter name)
                        const paramUsage = getFunctionParamUsage(param.name, param.type);
                        const paramDocumentation = "";
                        signatureInformation.parameters.push(new vscode.ParameterInformation(paramUsage, paramDocumentation));
                    }

                    signatureHelp = new vscode.SignatureHelp();
                    signatureHelp.activeParameter = functionSignatureHelp.activeParameterIndex;
                    signatureHelp.activeSignature = 0;
                    signatureHelp.signatures = [signatureInformation];
                }

                return signatureHelp;
            }

            return undefined;
        });
    }

    /**
     * Optional function for resolving and validating a position *before* running rename. The result can
     * be a range or a range and a placeholder text. The placeholder text should be the identifier of the symbol
     * which is being renamed - when omitted the text in the returned range is used.
     *
     * *Note: * This function should throw an error or return a rejected thenable when the provided location
     * doesn't allow for a rename.
     *
     * @param textDocument The document in which rename will be invoked.
     * @param position The position at which rename will be invoked.
     * @param token A cancellation token.
     * @return The range or range and placeholder text of the identifier that is to be renamed. The lack of a result can signaled by returning `undefined` or `null`.
     */
    private async prepareRename(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> {
        return await callWithTelemetryAndErrorHandling('PrepareRename', async (actionContext) => {
            actionContext.errorHandling.rethrow = true;

            const cancel = new Cancellation(token, actionContext);
            const pc: PositionContext | undefined = await this.getPositionContext(textDocument, position, cancel);
            if (!token.isCancellationRequested && pc) {
                // Make sure the kind of item being renamed is valid
                const referenceSiteInfo: IReferenceSite | undefined = pc.getReferenceSiteInfo(true);
                let renameError = referenceSiteInfo && getRenameError(referenceSiteInfo);
                if (renameError) {
                    actionContext.errorHandling.suppressDisplay = true;
                    throw new Error(renameError);
                }

                if (referenceSiteInfo) {
                    // Get the correct span to replace, without any quotes
                    return getVSCodeRangeFromSpan(pc.document, referenceSiteInfo.unquotedReferenceSpan);
                }

                actionContext.errorHandling.suppressDisplay = true;
                throw new Error(invalidRenameError);
            }

            return undefined;
        });
    }

    private async onProvideRename(textDocument: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> {
        return await callWithTelemetryAndErrorHandling('Rename', async (actionContext) => {
            actionContext.errorHandling.rethrow = true;

            const cancel = new Cancellation(token, actionContext);
            const pc: PositionContext | undefined = await this.getPositionContext(textDocument, position, cancel);
            if (!token.isCancellationRequested && pc) {
                // Make sure the kind of item being renamed is valid
                const result: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                const referenceSiteInfo: IReferenceSite | undefined = pc.getReferenceSiteInfo(true);
                let renameError = referenceSiteInfo && getRenameError(referenceSiteInfo);
                if (renameError) {
                    throw new Error(renameError);
                }

                const referenceList: ReferenceList | undefined = pc.getReferences();
                if (referenceList) {
                    // When trying to rename a parameter or variable reference inside of a TLE, the
                    // textbox that pops up when you press F2 contains more than just the variable
                    // or parameter name. This next section of code parses out just the variable or
                    // parameter name.
                    // For instance, it might provide the textbox with the value "[parameters('location')]"
                    // We need to pull out the parameter name "location" (no quotes) from that
                    const firstSingleQuoteIndex: number = newName.indexOf("'");
                    if (firstSingleQuoteIndex >= 0) {
                        const secondSingleQuoteIndex: number = newName.indexOf("'", firstSingleQuoteIndex + 1);
                        if (secondSingleQuoteIndex >= 0) {
                            newName = newName.substring(firstSingleQuoteIndex + 1, secondSingleQuoteIndex);
                        } else {
                            newName = newName.substring(firstSingleQuoteIndex + 1);
                        }
                    }

                    // When trying to rename a parameter or variable definition, the textbox provided by vscode to
                    // the user is contained in double quotes.  Remove those.
                    newName = newName.replace(/^"(.*)"$/, '$1');

                    for (const ref of referenceList.references) {
                        const referenceRange: vscode.Range = getVSCodeRangeFromSpan(ref.document, ref.span);
                        result.replace(ref.document.documentUri, referenceRange, newName);
                    }
                } else {
                    throw new Error(invalidRenameError);
                }

                return result;
            }
        });
    }

    private async provideDocumentLinks(textDocument: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[] | undefined> {
        return await callWithTelemetryAndErrorHandling('provideDocumentLinks', async (actionContext) => {
            actionContext.errorHandling.rethrow = true;

            const dt = this.getOpenedDeploymentTemplate(textDocument);
            if (dt) {
                return dt.getDocumentLinks(actionContext);
            }

            return undefined;
        });
    }

    private async resolveDocumentLink(link: vscode.DocumentLink, token: vscode.CancellationToken): Promise<vscode.DocumentLink | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveDocumentLink', async (actionContext) => {
            actionContext.telemetry.suppressIfSuccessful = true;

            const internalLink = <IDocumentLinkInternal>link;
            const scope = internalLink.internal?.scope;
            if (scope && scope.linkedFileReferences && scope.linkedFileReferences.length > 0) {

                link.target = vscode.Uri.parse(scope.linkedFileReferences[0].fullUri);
            } else {
                // If we don't have info directly from the language server right now, use the fallback
                link.target = internalLink.internal?.fallbackTarget;
            }

            return link;
        });
    }

    private onActiveTextEditorChanged(editor: vscode.TextEditor | undefined): void {
        callWithTelemetryAndErrorHandlingSync('onActiveTextEditorChanged', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            let activeDocument: vscode.TextDocument | undefined = editor?.document;
            if (activeDocument) {
                if (!this.getOpenedDeploymentDocument(activeDocument)) {
                    this.updateOpenedDocument(activeDocument);
                }
            }

            // tslint:disable-next-line: no-floating-promises
            this.updateEditorState();
        });
    }

    private async onTextSelectionChanged(): Promise<void> {
        await callWithTelemetryAndErrorHandling('onTextSelectionChanged', async (actionContext: IActionContext): Promise<void> => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            let editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
            if (editor) {
                let position = editor.selection.anchor;
                let pc: PositionContext | undefined =
                    await this.getPositionContext(editor.document, position, Cancellation.cantCancel);
                if (pc && pc instanceof TemplatePositionContext) {
                    let tleBraceHighlightIndexes: number[] = TLE.BraceHighlighter.getHighlightCharacterIndexes(pc);

                    let braceHighlightRanges: vscode.Range[] = [];
                    for (let tleHighlightIndex of tleBraceHighlightIndexes) {
                        const highlightSpan = new Span(tleHighlightIndex + pc.jsonTokenStartIndex, 1);
                        braceHighlightRanges.push(getVSCodeRangeFromSpan(pc.document, highlightSpan));
                    }

                    editor.setDecorations(this._braceHighlightDecorationType, braceHighlightRanges);
                }
            }
        });
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        this.updateOpenedDocument(event.document);
    }

    private onDocumentOpened(openedDocument: vscode.TextDocument): void {
        this.updateOpenedDocument(openedDocument);
    }

    private onDocumentClosed(closedDocument: vscode.TextDocument): void {
        callWithTelemetryAndErrorHandlingSync('onDocumentClosed', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.errorHandling.suppressDisplay = true;

            this.closeDeploymentFile(closedDocument);
        });
    }

    /**
     * This event is fired when validation on a template finishes, and informs us of the the
     * linked templates referenced by that template
     */
    private onTemplateGraphAvailable(e: INotifyTemplateGraphArgs & ITelemetryContext): void {
        callWithTelemetryAndErrorHandlingSync("onTemplateGraphAvailable", (actionContext) => {
            actionContext.telemetry.suppressIfSuccessful = true;

            const rootTemplateUri = vscode.Uri.parse(e.rootTemplateUri);
            const rootTemplate = this.getOpenedDeploymentTemplate(rootTemplateUri);

            if (rootTemplate) {
                const loadedTemplatesMap: NormalizedMap<vscode.Uri, DeploymentTemplateDoc> = new NormalizedMap<vscode.Uri, DeploymentTemplateDoc>(
                    getNormalizedDocumentKey
                );
                for (const entry of this._deploymentDocuments) {
                    if (entry[1] instanceof DeploymentTemplateDoc) {
                        loadedTemplatesMap.set(entry[1].documentUri, entry[1]);
                    }
                }

                for (const doc of vscode.workspace.textDocuments) {
                    const rootTemplateKey = getNormalizedDocumentKey(vscode.Uri.parse(e.rootTemplateUri, true));
                    if (getNormalizedDocumentKey(doc.uri) === rootTemplateKey) {
                        assignTemplateGraphToDeploymentTemplate(e, rootTemplate, this);

                        // Re-validate
                        // tslint:disable-next-line: no-floating-promises // Don't wait
                        this.reportDeploymentTemplateErrorsInBackground(doc, rootTemplate);
                    }
                }

                // Cause code lenses to be re-calculated
                this._codeLensChangedEmitter.fire();
            }
        });
    }

    private onLanguageServerStateChanged(): void {
        this._codeLensChangedEmitter.fire();
    }

}
