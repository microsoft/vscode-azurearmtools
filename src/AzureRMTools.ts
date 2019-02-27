// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:promise-function-async // Grandfathered in

import * as assert from "assert";
import opn = require("opn");
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { AzureUserInput, callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, createTelemetryReporter, IActionContext, IParsedError, parseError, registerUIExtensionVariables, TelemetryMeasurements, TelemetryProperties, UserCancelledError } from "vscode-azureextensionui";
import { AzureRMAssets } from "./AzureRMAssets";
import * as Completion from "./Completion";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from "./extensionVariables";
import { Histogram } from "./Histogram";
import * as Hover from "./Hover";
import { IncorrectArgumentsCountIssue } from "./IncorrectArgumentsCountIssue";
import * as language from "./Language";
import { PositionContext } from "./PositionContext";
import * as Reference from "./Reference";
import { Stopwatch } from "./Stopwatch";
import { isLanguageIdSupported, supportedDocumentSelector } from "./supported";
import { SurveyMetadata } from "./SurveyMetadata";
import { SurveySettings } from "./SurveySettings";
import * as TLE from "./TLE";
import { JsonOutlineProvider } from "./Treeview";
import { UnrecognizedFunctionIssue } from "./UnrecognizedFunctionIssue";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number, loadEndTime: number }): Promise<void> {
    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.outputChannel = vscode.window.createOutputChannel("Azure Resource Manager Tools");
    ext.ui = new AzureUserInput(context.globalState);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async function (this: IActionContext): Promise<void> {
        this.properties.isActivationEvent = 'true';
        this.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        context.subscriptions.push(new AzureRMTools(context));
    });
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}

type SurveyInfo = {
    settings: SurveySettings;
    filePath: string;
};

export class AzureRMTools {
    private _jsonFileSubscriptions: vscode.Disposable;
    private _deploymentTemplateFileSubscriptions: vscode.Disposable;

    private _diagnosticsCollection: vscode.DiagnosticCollection;

    private _azureRMToolsConfiguration: AzureRMToolsConfiguration;
    private _autoSave: string;

    private _deploymentTemplates: { [key: string]: DeploymentTemplate } = {};

    // More information can be found about this definition at https://code.visualstudio.com/docs/extensionAPI/vscode-api#DecorationRenderOptions
    // Several of these properties are CSS properties. More information about those can be found at https://www.w3.org/wiki/CSS/Properties
    private _braceHighlightDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
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

    constructor(context: vscode.ExtensionContext) {
        this.loadConfiguration();

        const jsonOutline: JsonOutlineProvider = new JsonOutlineProvider(context);
        ext.jsonOutlineProvider = jsonOutline;
        context.subscriptions.push(vscode.window.registerTreeDataProvider("json-outline", jsonOutline));
        context.subscriptions.push(vscode.commands.registerCommand("extension.treeview.goto", (range: vscode.Range) => jsonOutline.goToDefinition(range)));

        const jsonFileSubscriptionArray: vscode.Disposable[] = [];

        vscode.window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this, jsonFileSubscriptionArray);

        vscode.workspace.onDidChangeConfiguration(this.loadConfiguration, this, jsonFileSubscriptionArray);

        vscode.workspace.onDidOpenTextDocument(this.onDocumentOpened, this, jsonFileSubscriptionArray);
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this, jsonFileSubscriptionArray);
        vscode.workspace.onDidSaveTextDocument(this.onDocumentSaved, this, jsonFileSubscriptionArray);

        this._jsonFileSubscriptions = vscode.Disposable.from(...jsonFileSubscriptionArray);

        const activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.updateDeploymentTemplate(activeEditor.document);
        }
    }

    public dispose(): void {
        const me = this;
        callWithTelemetryAndErrorHandlingSync('dispose', function (this: IActionContext) {
            this.properties.isActivationEvent = 'true';
            this.suppressErrorDisplay = true;

            if (me._deploymentTemplateFileSubscriptions) {
                me._deploymentTemplateFileSubscriptions.dispose();
            }

            me._jsonFileSubscriptions.dispose();
        });
    }

    private getDeploymentTemplate(document: vscode.TextDocument): DeploymentTemplate {
        let result: DeploymentTemplate = null;

        if (document) {
            result = this._deploymentTemplates[document.uri.toString()];
        }

        return result;
    }

    private updateDeploymentTemplate(document: vscode.TextDocument): void {
        if (!document) {
            return;
        }

        const me = this;
        callWithTelemetryAndErrorHandlingSync('updateDeploymentTemplate', function (this: IActionContext) {
            this.suppressErrorDisplay = true;
            this.suppressTelemetry = true;
            this.properties.isActivationEvent = 'true';

            let foundDeploymentTemplate = false;

            if (document.getText() &&
                isLanguageIdSupported(document.languageId) &&
                document.uri.scheme === 'file') {

                const documentUri: string = document.uri.toString();

                // If the documentUri is not in our dictionary of deployment templates, then we
                // know that this document was opened (as opposed to changed/updated).
                let stopwatch: Stopwatch;
                if (!me._deploymentTemplates[documentUri]) {
                    stopwatch = new Stopwatch();
                    stopwatch.start();
                }

                let deploymentTemplate: DeploymentTemplate = new DeploymentTemplate(document.getText(), documentUri);
                if (deploymentTemplate.hasValidSchemaUri()) {
                    let surveyInfo: SurveyInfo = me.updateSurveySettingsFromOpeningTemplate();

                    // If this is the first deployment template to be opened,
                    // then we need to register all of our deployment template
                    // editing tools with the editor. We don't do this when the
                    // extension is activated because we're concerned about the
                    // performance impact that might occur if these events
                    // are fired for all JSON files, not just deployment
                    // templates.
                    if (Object.keys(me._deploymentTemplates).length === 0) {
                        me.hookDeploymentTemplateEvents(surveyInfo);
                    }

                    me._deploymentTemplates[documentUri] = deploymentTemplate;
                    foundDeploymentTemplate = true;

                    // We only initialized the stopwatch if the deployment template was being
                    // opened. The stopwatch variable will not be initialized if the deployment
                    // template is being edited.
                    if (stopwatch) {
                        stopwatch.stop();
                        ext.reporter.sendTelemetryEvent(
                            "Deployment Template Opened",
                            {
                            },
                            {
                                documentSizeInCharacters: document.getText().length,
                                parseDurationInMilliseconds: stopwatch.duration.totalMilliseconds
                            });

                        me.logFunctionCounts(deploymentTemplate);
                    }

                    me.reportDeploymentTemplateErrors(document, deploymentTemplate);
                }
            }

            if (!foundDeploymentTemplate) {
                // If the document is not a deployment template, then we need
                // to remove it from our deployment template cache. It doesn't
                // matter if the document is a JSON file and was never a
                // deployment template, or if the document was a deployment
                // template and then was modified to no longer be a deployment
                // template (the $schema property changed to not be a
                // deployment template schema). In either case, we should
                // remove the deployment template from our cache.
                me.closeDeploymentTemplate(document);
            }
        });
    }

    private reportDeploymentTemplateErrors(document: vscode.TextDocument, deploymentTemplate: DeploymentTemplate): void {
        const me = this;

        // Don't wait
        let dontWait = callWithTelemetryAndErrorHandling('reportDeploymentTemplateErrors', async function (this: IActionContext) {
            this.suppressTelemetry = true;

            let parseErrors: language.Issue[] = await deploymentTemplate.errors;
            const diagnostics: vscode.Diagnostic[] = [];

            // It's possible the _diagnosticsCollection could have been disposed while we were waiting for errors to get processed
            if (me._diagnosticsCollection) {
                for (const error of parseErrors) {
                    diagnostics.push(me.getVSCodeDiagnosticFromIssue(deploymentTemplate, error, vscode.DiagnosticSeverity.Error));
                }

                for (const warning of deploymentTemplate.warnings) {
                    diagnostics.push(me.getVSCodeDiagnosticFromIssue(deploymentTemplate, warning, vscode.DiagnosticSeverity.Warning));
                }

                me._diagnosticsCollection.set(document.uri, diagnostics);
            }
        });
    }

    /**
     * Update survey settings on disk and return the updated version
     */
    private updateSurveySettingsFromOpeningTemplate(): SurveyInfo {
        const filePath: string = path.join(os.homedir(), ".vscode", "azurerm", "surveyMetadata.json");
        const settings: SurveySettings = SurveySettings.fromFile(filePath);

        settings.incrementDeploymentTemplatesOpenedOrCreated();

        if (!settings.deploymentTemplateFirstOpenedOrCreatedDateAndTime) {
            settings.deploymentTemplateFirstOpenedOrCreatedDateAndTime = Date.now();
        }

        if (settings.showSurveyPrompts === undefined || settings.showSurveyPrompts === null) {
            settings.showSurveyPrompts = true;
        }

        settings.toFile(filePath);

        return { settings, filePath };
    }

    /**
     * Hook up events related to template files (as opposed to plain JSON files). This is only called when
     * actual template files are open, to avoid slowing performance when just JSON files are opened.
     * @param surveyInfo
     */
    private hookDeploymentTemplateEvents(surveyInfo: SurveyInfo): void {
        let deploymentTemplateFileSubscriptionsArray: vscode.Disposable[] = [];

        vscode.window.onDidChangeTextEditorSelection(this.onTextSelectionChanged, this, deploymentTemplateFileSubscriptionsArray);

        vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed, this, deploymentTemplateFileSubscriptionsArray);

        const self: AzureRMTools = this;
        const hoverProvider: vscode.HoverProvider = {
            provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
                return self.onProvideHover(document, position, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerHoverProvider(supportedDocumentSelector, hoverProvider));

        const completionProvider: vscode.CompletionItemProvider = {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> {
                return self.onProvideCompletionItems(document, position, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerCompletionItemProvider(supportedDocumentSelector, completionProvider, "'", "[", "."));

        const definitionProvider: vscode.DefinitionProvider = {
            provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition {
                return self.onProvideDefinition(document, position, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerDefinitionProvider(supportedDocumentSelector, definitionProvider));

        const referenceProvider: vscode.ReferenceProvider = {
            provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] {
                return self.onProvideReferences(document, position, context, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerReferenceProvider(supportedDocumentSelector, referenceProvider));

        const signatureHelpProvider: vscode.SignatureHelpProvider = {
            provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp> {
                return self.onProvideSignatureHelp(document, position, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerSignatureHelpProvider(supportedDocumentSelector, signatureHelpProvider, ",", "(", "\n"));

        const renameProvider: vscode.RenameProvider = {
            provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.WorkspaceEdit {
                return self.onProvideRename(document, position, newName, token);
            }
        };
        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerRenameProvider(supportedDocumentSelector, renameProvider));

        this._diagnosticsCollection = vscode.languages.createDiagnosticCollection("azurermtle");
        deploymentTemplateFileSubscriptionsArray.push(this._diagnosticsCollection);

        this._deploymentTemplateFileSubscriptions = vscode.Disposable.from(...deploymentTemplateFileSubscriptionsArray);

        if (surveyInfo.settings.showSurveyPrompts) {
            AzureRMAssets.getSurveyMetadata()
                .then((surveyMetadata: SurveyMetadata) => {
                    if (surveyMetadata.shouldShowSurveyPrompt(surveyInfo.settings)) {
                        const message: string = "We would like to collect your feedback on the Azure Resource Manager Tools extension. Please take a few minutes to fill out survey.";
                        const options: string[] = ["Don't ask me again", "OK"]; // VS Code automatically inserts a "Close" option.

                        vscode.window.showInformationMessage(message, ...options).then((selectedOption: string) => {
                            surveyInfo.settings.previousSurveyPromptDateAndTime = Date.now();

                            ext.reporter.sendTelemetryEvent('Survey Prompt', {
                                selectedOption: selectedOption
                            });

                            if (selectedOption === "OK") {
                                // tslint:disable-next-line:no-floating-promises
                                opn(surveyMetadata.surveyLink);
                            } else if (selectedOption === "Don't ask me again") {
                                surveyInfo.settings.showSurveyPrompts = false;
                            }

                            surveyInfo.settings.toFile(surveyInfo.filePath);
                        });
                    }
                })
                // tslint:disable-next-line:no-any
                .catch((error: any) => {
                    ext.reporter.sendTelemetryEvent("Failed To Get Survey Metadata", <TelemetryProperties>{ errorMessage: parseError(error).message });
                });
        }
    }

    private unhookDeploymentFileEvents(): void {
        // Dispose all registered events and services, including this._diagnosticsCollection
        if (this._deploymentTemplateFileSubscriptions) {
            this._deploymentTemplateFileSubscriptions.dispose();
            this._deploymentTemplateFileSubscriptions = null;
            this._diagnosticsCollection = null;
        }
    }

    /**
     * Logs telemetry with information about the functions used in a template. Only meaningful if called
     * in a relatively stable state, such as after first opening
     */
    private logFunctionCounts(deploymentTemplate: DeploymentTemplate): void {
        // Don't wait for promise
        let dummyPromise = callWithTelemetryAndErrorHandling("tle.stats", async function (this: IActionContext) {
            this.suppressErrorDisplay = true;
            let properties: {
                functionCounts?: string,
                unrecognized?: string,
                incorrectArgs?: string,
                [key: string]: string
            } = this.properties;

            // Full function counts
            //
            // Note: Due to the way DeploymentTemplate is implemented (see quotedStringToTleParseResultMap), string expressions which are exactly
            //   the same (e.g. 'prop1': '[add(1,2)]' and 'prop2': '[add(1,2)]') only get counted once, thus the functions inside them will only get
            //   counted once.
            const functionCounts: Histogram = deploymentTemplate.functionCounts;
            const functionsData = {};
            for (const functionName of functionCounts.keys) {
                functionsData[functionName] = functionCounts.getCount(functionName);
            }
            properties.functionCounts = JSON.stringify(functionsData);

            // Missing function names and functions with incorrect number of arguments
            let issues: language.Issue[] = await deploymentTemplate.errors;
            let unrecognized = new Set<string>();
            let incorrectArgCounts = new Set<string>();
            for (const issue of issues) {
                if (issue instanceof UnrecognizedFunctionIssue) {
                    unrecognized.add(issue.functionName);
                } else if (issue instanceof IncorrectArgumentsCountIssue) {
                    // Encode function name as "funcname(<actual-args>)[<min-expected>..<max-expected>]"
                    let encodedName = `${issue.functionName}(${issue.actual})[${issue.minExpected}..${issue.maxExpected}]`;
                    incorrectArgCounts.add(encodedName);
                }
            }
            properties.unrecognized = AzureRMTools.setToJson(unrecognized);
            properties.incorrectArgs = AzureRMTools.setToJson(incorrectArgCounts);
        });
    }

    private static setToJson(s: Set<string>): string {
        if (!s.size) {
            return "";
        }
        let array: string[] = [];
        for (let item of s) {
            array.push(item);
        }
        return JSON.stringify(array);
    }

    private getVSCodeDiagnosticFromIssue(deploymentTemplate: DeploymentTemplate, issue: language.Issue, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
        const range: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, issue.span);
        const message: string = issue.message;
        return new vscode.Diagnostic(range, message, severity);
    }

    private closeDeploymentTemplate(document: vscode.TextDocument): void {
        if (document) {
            if (this._diagnosticsCollection) {
                this._diagnosticsCollection.delete(document.uri);
            }
            delete this._deploymentTemplates[document.uri.toString()];

            // If this is the last deployment template open, then we can safely
            // unregister all of our deployment template events from the VS
            // Code editor. The events will be registered again when the next
            // deployment template is opened.
            if (Object.keys(this._deploymentTemplates).length === 0 && this._deploymentTemplateFileSubscriptions) {
                this.unhookDeploymentFileEvents();
            }
        }
    }

    private async onProvideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
        const deploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            const me = this;
            return await callWithTelemetryAndErrorHandling('Hover', async function (this: IActionContext) {
                let properties = <TelemetryProperties & { hoverType?: string; tleFunctionName: string; }>this.properties;

                const context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                if (context.hoverInfo) {
                    let hoverInfo: Hover.Info = await context.hoverInfo;
                    let hover: vscode.Hover = null;

                    if (hoverInfo) {
                        if (hoverInfo instanceof Hover.FunctionInfo) {
                            properties.hoverType = "TLE Function";
                            properties.tleFunctionName = hoverInfo.functionName;
                        } else if (hoverInfo instanceof Hover.ParameterReferenceInfo) {
                            properties.hoverType = "Parameter Reference";
                        } else if (hoverInfo instanceof Hover.VariableReferenceInfo) {
                            properties.hoverType = "Variable Reference";
                        }

                        const hoverRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, hoverInfo.span);
                        hover = new vscode.Hover(hoverInfo.getHoverText(), hoverRange);
                        return hover;
                    }
                }
            });
        }
    }

    private async onProvideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> {
        const deploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            const me = this;
            return await callWithTelemetryAndErrorHandling('provideCompletionItems', async function (this: IActionContext): Promise<vscode.CompletionList | undefined> {
                let properties = <TelemetryProperties & { completionKind?: string }>this.properties;
                this.suppressTelemetry = true;

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                if (context.completionItems) {
                    let completionItemArray: Completion.Item[] = await context.completionItems;
                    const completionItems: vscode.CompletionItem[] = [];
                    for (const completion of completionItemArray) {
                        const insertRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, completion.insertSpan);

                        const completionToAdd = new vscode.CompletionItem(completion.name);
                        completionToAdd.range = insertRange;
                        completionToAdd.insertText = new vscode.SnippetString(completion.insertText);
                        completionToAdd.detail = completion.detail;
                        completionToAdd.documentation = completion.description;

                        switch (completion.kind) {
                            case Completion.CompletionKind.Function:
                                completionToAdd.kind = vscode.CompletionItemKind.Function;
                                break;

                            case Completion.CompletionKind.Parameter:
                            case Completion.CompletionKind.Variable:
                                completionToAdd.kind = vscode.CompletionItemKind.Variable;
                                break;

                            case Completion.CompletionKind.Property:
                                completionToAdd.kind = vscode.CompletionItemKind.Field;
                                break;

                            default:
                                assert.fail(`Unrecognized Completion.Type: ${completion.kind}`);
                                break;
                        }
                        properties.completionKind = vscode.CompletionItemKind[completionToAdd.kind];

                        completionItems.push(completionToAdd);
                    }
                    return new vscode.CompletionList(completionItems, true);
                }
            });
        }
    }

    private onProvideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Location {
        const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            const me = this;
            return callWithTelemetryAndErrorHandlingSync('Go To Definition', function (this: IActionContext) {
                let properties = <TelemetryProperties & { definitionType?: string }>this.properties;
                let result: vscode.Location = null;

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                let definitionType: string = "no definition";
                if (context.parameterDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, context.parameterDefinition.span);
                    result = new vscode.Location(locationUri, definitionRange);
                    definitionType = "parameter";
                } else if (context.variableDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, context.variableDefinition.span);
                    result = new vscode.Location(locationUri, definitionRange);
                    definitionType = "variable";
                }

                properties.definitionType = definitionType;
                return result;
            });
        }
    }

    private onProvideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] {
        const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            const me = this;
            return callWithTelemetryAndErrorHandlingSync('Find References', function (this: IActionContext) {
                const results: vscode.Location[] = [];
                const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                const positionContext: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                const references: Reference.List = positionContext.references;
                if (references && references.length > 0) {
                    let referenceType: string;
                    switch (references.kind) {
                        case Reference.ReferenceKind.Parameter:
                            referenceType = "parameter";
                            break;

                        case Reference.ReferenceKind.Variable:
                            referenceType = "variable";
                            break;

                        default:
                            assert.fail(`Unrecognized Reference.Kind: ${references.kind}`);
                            referenceType = "no reference type";
                            break;
                    }

                    this.properties.referenceType = referenceType;

                    for (const span of references.spans) {
                        const referenceRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, span);
                        results.push(new vscode.Location(locationUri, referenceRange));
                    }
                }

                return results;
            });
        }
    }

    private async onProvideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp | undefined> {
        const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return await callWithTelemetryAndErrorHandling('provideSignatureHelp', async () => {
                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                let functionSignatureHelp: TLE.FunctionSignatureHelp = await context.signatureHelp;
                let signatureHelp: vscode.SignatureHelp;

                if (functionSignatureHelp) {

                    const signatureInformation = new vscode.SignatureInformation(functionSignatureHelp.functionMetadata.usage, functionSignatureHelp.functionMetadata.description);
                    signatureInformation.parameters = [];
                    for (const parameterName of functionSignatureHelp.functionMetadata.parameters) {
                        signatureInformation.parameters.push(new vscode.ParameterInformation(parameterName));
                    }

                    signatureHelp = new vscode.SignatureHelp();
                    signatureHelp.activeParameter = functionSignatureHelp.activeParameterIndex;
                    signatureHelp.activeSignature = 0;
                    signatureHelp.signatures = [signatureInformation];
                }

                return signatureHelp;
            });
        }
    }

    private onProvideRename(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.WorkspaceEdit {
        const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            const me = this;
            return callWithTelemetryAndErrorHandlingSync('Rename', () => {
                const result: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                const referenceList: Reference.List = context.references;
                if (referenceList) {
                    // When trying to rename a parameter or variable reference inside of a TLE, the
                    // textbox that pops up when you press F2 contains more than just the variable
                    // or parameter name. This next section of code parses out just the variable or
                    // parameter name.
                    // For instance, it might provide the textbox with the value "[parameters('location')]"
                    // We need to pull out the parameter name "location" (no quotes) from that
                    const firstSingleQuoteIndex: number = newName.indexOf(`'`);
                    if (firstSingleQuoteIndex >= 0) {
                        const secondSingleQuoteIndex: number = newName.indexOf(`'`, firstSingleQuoteIndex + 1);
                        if (secondSingleQuoteIndex >= 0) {
                            newName = newName.substring(firstSingleQuoteIndex + 1, secondSingleQuoteIndex);
                        } else {
                            newName = newName.substring(firstSingleQuoteIndex + 1);
                        }
                    }

                    // When trying to rename a parameter or variable definition, the textbox provided by vscode to
                    // the user is contained in double quotes.  Remove those.
                    newName = newName.replace(/^"(.*)"$/, '$1');

                    const documentUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);

                    for (const referenceSpan of referenceList.spans) {
                        const referenceRange: vscode.Range = me.getVSCodeRangeFromSpan(deploymentTemplate, referenceSpan);
                        result.replace(documentUri, referenceRange, newName);
                    }
                } else {
                    throw new Error('You can only rename parameters and variables.');
                }

                return result;
            });
        }
    }

    private onActiveTextEditorChanged(): void {
        const me = this;
        callWithTelemetryAndErrorHandlingSync('onActiveTextEditorChanged', function (this: IActionContext) {
            this.properties.isActivationEvent = 'true';
            this.suppressErrorDisplay = true;
            this.suppressTelemetry = true;

            let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                if (me.getDeploymentTemplate(activeEditor.document) === undefined) {
                    me.updateDeploymentTemplate(activeEditor.document);
                }
            }
        });
    }

    private onTextSelectionChanged(): void {
        const me = this;
        callWithTelemetryAndErrorHandlingSync('onTextSelectionChanged', function (this: IActionContext) {
            this.properties.isActivationEvent = 'true';
            this.suppressErrorDisplay = true;
            this.suppressTelemetry = true;

            let editor: vscode.TextEditor = vscode.window.activeTextEditor;
            if (editor) {
                let deploymentTemplate = me.getDeploymentTemplate(editor.document);
                if (deploymentTemplate) {
                    let position = editor.selection.anchor;
                    let context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                    let tleBraceHighlightIndexes: number[] = TLE.BraceHighlighter.getHighlightCharacterIndexes(context);

                    let braceHighlightRanges: vscode.Range[] = [];
                    for (let tleHighlightIndex of tleBraceHighlightIndexes) {
                        const highlightSpan = new language.Span(tleHighlightIndex + context.jsonTokenStartIndex, 1);
                        braceHighlightRanges.push(me.getVSCodeRangeFromSpan(deploymentTemplate, highlightSpan));
                    }

                    editor.setDecorations(me._braceHighlightDecorationType, braceHighlightRanges);
                }
            }
        });
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
        this.updateDeploymentTemplate(event.document);
    }

    private onDocumentOpened(openedDocument: vscode.TextDocument): void {
        this.updateDeploymentTemplate(openedDocument);
    }

    private onDocumentSaved(savedDocument: vscode.TextDocument): void {
        const me = this;
        callWithTelemetryAndErrorHandlingSync('onDocumentSaved', function (this: IActionContext) {
            this.properties.isActivationEvent = 'true';
            this.suppressTelemetry = true;

            // The saved document is a deployment template if it shows up in our deployment
            // templates dictionary.
            if (me._deploymentTemplates[savedDocument.uri.toString()]) {
                ext.reporter.sendTelemetryEvent("Deployment Template Saved", {
                    autoSave: me._autoSave
                });
            }
        });
    }

    private onDocumentClosed(closedDocument: vscode.TextDocument): void {
        const me = this;
        callWithTelemetryAndErrorHandlingSync('onDocumentClosed', function (this: IActionContext) {
            this.properties.isActivationEvent = 'true';
            this.suppressTelemetry = true;
            this.suppressErrorDisplay = true;

            me.closeDeploymentTemplate(closedDocument);
        });
    }

    private loadConfiguration(): void {
        callWithTelemetryAndErrorHandlingSync('loadConfiguration', () => {
            const configuration = vscode.workspace.getConfiguration("azurermtools");
            this._azureRMToolsConfiguration = {
                debug: configuration.get("debug", false),
                enableTelemetry: configuration.get("enableTelemetry", false)
            };

            const filesConfiguration = vscode.workspace.getConfiguration("files");
            this._autoSave = filesConfiguration.get("autoSave", "off");
        });
    }

    private getVSCodeRangeFromSpan(deploymentTemplate: DeploymentTemplate, span: language.Span): vscode.Range {
        assert(span);
        assert(deploymentTemplate);

        const startPosition: language.Position = deploymentTemplate.getContextFromDocumentCharacterIndex(span.startIndex).documentPosition;
        const vscodeStartPosition = new vscode.Position(startPosition.line, startPosition.column);

        const endPosition: language.Position = deploymentTemplate.getContextFromDocumentCharacterIndex(span.afterEndIndex).documentPosition;
        const vscodeEndPosition = new vscode.Position(endPosition.line, endPosition.column);

        return new vscode.Range(vscodeStartPosition, vscodeEndPosition);
    }
}

interface AzureRMToolsConfiguration {
    debug: boolean;

    enableTelemetry: boolean;
}
