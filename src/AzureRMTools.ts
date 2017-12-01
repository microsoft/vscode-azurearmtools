// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// The module "vscode" contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const open = require("open");

import * as Completion from "./Completion";
import * as Hover from "./Hover";
import * as Json from "./JSON";
import * as language from "./Language";
import * as Reference from "./Reference";
import * as TLE from "./TLE";
import * as Telemetry from "./Telemetry";
import { Reporter } from "./VSCodeTelReporter";

import { AzureRMAssets } from "./AzureRMAssets";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { Histogram } from "./Histogram";
import { PositionContext } from "./PositionContext";
import { Stopwatch } from "./Stopwatch";
import { SurveyMetadata } from "./SurveyMetadata";
import { SurveySettings } from "./SurveySettings";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(new Reporter(context));
    context.subscriptions.push(new AzureRMTools());
}

// this method is called when your extension is deactivated
export function deactivate() {
}

export class AzureRMTools {
    private _jsonFileSubscriptions: vscode.Disposable;
    private _deploymentTemplateFileSubscriptions: vscode.Disposable;

    private _diagnosticsCollection: vscode.DiagnosticCollection;

    private _azureRMToolsConfiguration: AzureRMToolsConfiguration;
    private _autoSave: string;

    private _debugTelemetry: Telemetry.Endpoint;
    private _productionTelemetry: Telemetry.Endpoint;

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

    constructor() {
        this.loadConfiguration();

        this.log({
            eventName: "Extension Activated"
        });

        this.logOnError(() => {
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
        });
    }

    public dispose() {
        this.logOnError(() => {
            if (this._deploymentTemplateFileSubscriptions) {
                this._deploymentTemplateFileSubscriptions.dispose();
            }

            this._jsonFileSubscriptions.dispose();
        });

        this.log({
            eventName: "Extension Deactivated"
        });

        if (this._debugTelemetry) {
            this._debugTelemetry.close();
        }
        if (this._productionTelemetry) {
            this._productionTelemetry.close();
        }
    }

    private getDeploymentTemplate(document: vscode.TextDocument): DeploymentTemplate {
        let result: DeploymentTemplate = null;

        if (document) {
            result = this._deploymentTemplates[document.uri.toString()];
        }

        return result;
    }

    private updateDeploymentTemplate(document: vscode.TextDocument): void {
        if (document) {
            const documentUri: string = document.uri.toString();
            const lowerCasedDocumentUri: string = documentUri.toLowerCase();
            let foundDeploymentTemplate = false;

            if (document.getText() &&
                lowerCasedDocumentUri.endsWith(".json") &&
                !lowerCasedDocumentUri.startsWith("git-index:/")) {

                // If the documentUri is not in our dictionary of deployment templates, then we
                // know that this document was opened (as opposed to changed/updated).
                let stopwatch: Stopwatch;
                if (!this._deploymentTemplates[documentUri]) {
                    stopwatch = new Stopwatch();
                    stopwatch.start();
                }

                let deploymentTemplate = new DeploymentTemplate(document.getText(), documentUri);
                if (deploymentTemplate.hasValidSchemaUri()) {
                    const surveySettingsFilePath: string = path.join(os.homedir(), ".vscode", "azurerm", "surveyMetadata.json");
                    const surveySettings: SurveySettings = SurveySettings.fromFile(surveySettingsFilePath);

                    surveySettings.incrementDeploymentTemplatesOpenedOrCreated();

                    if (!surveySettings.deploymentTemplateFirstOpenedOrCreatedDateAndTime) {
                        surveySettings.deploymentTemplateFirstOpenedOrCreatedDateAndTime = Date.now();
                    }

                    if (surveySettings.showSurveyPrompts === undefined || surveySettings.showSurveyPrompts === null) {
                        surveySettings.showSurveyPrompts = true;
                    }

                    surveySettings.toFile(surveySettingsFilePath);

                    // If this is the first deployment template to be opened,
                    // then we need to register all of our deployment template
                    // editing tools with the editor. We don't do this when the
                    // extension is activated because we're concerned about the
                    // performance impact that might occur if these events
                    // are fired for all JSON files, not just deployment
                    // templates.
                    if (Object.keys(this._deploymentTemplates).length === 0) {
                        let deploymentTemplateFileSubscriptionsArray: vscode.Disposable[] = [];

                        vscode.window.onDidChangeTextEditorSelection(this.onTextSelectionChanged, this, deploymentTemplateFileSubscriptionsArray);

                        vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed, this, deploymentTemplateFileSubscriptionsArray);

                        const self: AzureRMTools = this;
                        const hoverProvider: vscode.HoverProvider = {
                            provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
                                return self.onProvideHover(document, position, token);
                            }
                        };
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerHoverProvider("json", hoverProvider));

                        const completionProvider: vscode.CompletionItemProvider = {
                            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> {
                                return self.onProvideCompletionItems(document, position, token);
                            }
                        };
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerCompletionItemProvider("json", completionProvider, "'", "[", "."));

                        const definitionProvider: vscode.DefinitionProvider = {
                            provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition {
                                return self.onProvideDefinition(document, position, token);
                            }
                        };
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerDefinitionProvider("json", definitionProvider));

                        const referenceProvider: vscode.ReferenceProvider = {
                            provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] {
                                return self.onProvideReferences(document, position, context, token);
                            }
                        };
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerReferenceProvider("json", referenceProvider));

                        const signatureHelpProvider: vscode.SignatureHelpProvider = {
                            provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp> {
                                return self.onProvideSignatureHelp(document, position, token);
                            }
                        };
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerSignatureHelpProvider("json", signatureHelpProvider, ',', '(', '\n'));

                        const renameProvider: vscode.RenameProvider = {
                            provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.WorkspaceEdit {
                                return self.onProvideRename(document, position, newName, token);
                            }
                        }
                        deploymentTemplateFileSubscriptionsArray.push(vscode.languages.registerRenameProvider("json", renameProvider));

                        this._diagnosticsCollection = vscode.languages.createDiagnosticCollection("azurermtle");
                        deploymentTemplateFileSubscriptionsArray.push(this._diagnosticsCollection);

                        this._deploymentTemplateFileSubscriptions = vscode.Disposable.from(...deploymentTemplateFileSubscriptionsArray);

                        if (surveySettings.showSurveyPrompts) {
                            AzureRMAssets.getSurveyMetadata()
                                .then((surveyMetadata: SurveyMetadata) => {
                                    if (surveyMetadata.shouldShowSurveyPrompt(surveySettings)) {
                                        const message: string = "We would like to collect your feedback on the Azure Resource Manager Tools extension. Please take a few minutes to fill out survey.";
                                        const options: string[] = ["Don't ask me again", "OK"]; // VS Code automatically inserts a "Close" option.

                                        vscode.window.showInformationMessage(message, ...options).then((selectedOption: string) => {
                                            surveySettings.previousSurveyPromptDateAndTime = Date.now();

                                            this.log({
                                                eventName: "Survey Prompt",
                                                selectedOption: selectedOption
                                            });

                                            if (selectedOption === "OK") {
                                                open(surveyMetadata.surveyLink);
                                            }
                                            else if (selectedOption === "Don't ask me again") {
                                                surveySettings.showSurveyPrompts = false;
                                            }

                                            surveySettings.toFile(surveySettingsFilePath);
                                        });
                                    }
                                })
                                .catch((error: any) => {
                                    this.logError("Failed To Get Survey Metadata", error);
                                });
                        }
                    }


                    this._deploymentTemplates[documentUri] = deploymentTemplate;
                    foundDeploymentTemplate = true;

                    // We only initialized the stopwatch if the deployment template was being
                    // opened. The stopwatch variable will not be initialized if the deployment
                    // template is being edited.
                    if (stopwatch) {
                        stopwatch.stop();
                        this.log({
                            eventName: "Deployment Template Opened",
                            documentSizeInCharacters: document.getText().length,
                            parseDurationInMilliseconds: stopwatch.duration.totalMilliseconds
                        });

                        const functionCountEvent: Telemetry.Event = {
                            eventName: "TLE Function Counts"
                        };
                        const functionCounts: Histogram = deploymentTemplate.functionCounts;
                        for (const functionName of functionCounts.keys) {
                            functionCountEvent[functionName] = functionCounts.get(functionName);
                        }
                        this.log(functionCountEvent);
                    }

                    deploymentTemplate.errors
                        .then((parseErrors: language.Issue[]) => {
                            const diagnostics: vscode.Diagnostic[] = [];

                            for (const error of parseErrors) {
                                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, error, vscode.DiagnosticSeverity.Error));
                            }

                            for (const warning of deploymentTemplate.warnings) {
                                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, warning, vscode.DiagnosticSeverity.Warning));
                            }

                            this._diagnosticsCollection.set(document.uri, diagnostics);
                        })
                        .catch((error: any) => {
                            this.logError("UnhandledError", error);
                        });
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
                this.closeDeploymentTemplate(document);
            }
        }
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
                this._deploymentTemplateFileSubscriptions.dispose();
                this._deploymentTemplateFileSubscriptions = null;
            }
        }
    }

    private onProvideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
        let result: Promise<vscode.Hover> = Promise.resolve(null);

        this.logOnError(() => {
            const deploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                if (context.hoverInfo) {
                    result = context.hoverInfo.then((hoverInfo: Hover.Info) => {
                        let hover: vscode.Hover = null;

                        if (hoverInfo) {
                            if (hoverInfo instanceof Hover.FunctionInfo) {
                                this.log({
                                    eventName: "Hover",
                                    hoverType: "TLE Function",
                                    tleFunctionName: hoverInfo.functionName
                                });
                            }
                            else if (hoverInfo instanceof Hover.ParameterReferenceInfo) {
                                this.log({
                                    eventName: "Hover",
                                    hoverType: "Parameter Reference"
                                });
                            }
                            else if (hoverInfo instanceof Hover.VariableReferenceInfo) {
                                this.log({
                                    eventName: "Hover",
                                    hoverType: "Variable Reference"
                                });
                            }

                            const hoverRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, hoverInfo.span);
                            hover = new vscode.Hover(hoverInfo.getHoverText(), hoverRange);
                        }

                        return hover;
                    });
                }
            }
        });

        return result.catch((error: any) => {
            this.logError("UnhandledError", error);
            return undefined;
        });
    }

    private onProvideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> {
        let result: Promise<vscode.CompletionList> = Promise.resolve(null);

        this.logOnError(() => {
            const deploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                if (context.completionItems) {

                    result = context.completionItems.then((completionItemArray: Completion.Item[]) => {
                        const completionItems: vscode.CompletionItem[] = [];
                        for (const completion of completionItemArray) {
                            const insertRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, completion.insertSpan);

                            const completionToAdd = new vscode.CompletionItem(completion.name);
                            completionToAdd.range = insertRange;
                            completionToAdd.insertText = new vscode.SnippetString(completion.insertText);
                            completionToAdd.detail = completion.detail;
                            completionToAdd.documentation = completion.description;

                            switch (completion.type) {
                                case Completion.Type.Function:
                                    completionToAdd.kind = vscode.CompletionItemKind.Function;
                                    break;

                                case Completion.Type.Parameter:
                                case Completion.Type.Variable:
                                    completionToAdd.kind = vscode.CompletionItemKind.Variable;
                                    break;

                                case Completion.Type.Property:
                                    completionToAdd.kind = vscode.CompletionItemKind.Field;
                                    break;

                                default:
                                    assert.fail(`Unrecognized Completion.Type: ${completion.type}`);
                                    break;
                            }

                            completionItems.push(completionToAdd);
                        }
                        return new vscode.CompletionList(completionItems, true);
                    });
                }
            }
        });

        return result.catch((error: any) => {
            this.logError("UnhandledError", error);
            return undefined;
        });
    }

    private onProvideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Location {
        let result: vscode.Location = null;

        this.logOnError(() => {
            const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                let definitionType: string = "no definition";
                if (context.parameterDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, context.parameterDefinition.span);
                    result = new vscode.Location(locationUri, definitionRange);
                    definitionType = "parameter";
                }
                else if (context.variableDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, context.variableDefinition.span);
                    result = new vscode.Location(locationUri, definitionRange);
                    definitionType = "variable";
                }

                this.log({
                    eventName: "Go To Definition",
                    definitionType: definitionType
                });
            }
        });

        return result;
    }

    private onProvideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] {
        const result: vscode.Location[] = [];

        this.logOnError(() => {
            const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                const references: Reference.List = context.references;
                if (references && references.length > 0) {
                    let referenceType: string;
                    switch (references.type) {
                        case Reference.Type.Parameter:
                            referenceType = "parameter";
                            break;

                        case Reference.Type.Variable:
                            referenceType = "variable";
                            break;

                        default:
                            assert.fail(`Unrecognized Reference.Type: ${references.type}`);
                            referenceType = "no reference type";
                            break;
                    }

                    this.log({
                        eventName: "Find References",
                        referenceType: referenceType
                    });

                    for (const span of references.spans) {
                        const referenceRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, span);
                        result.push(new vscode.Location(locationUri, referenceRange));
                    }
                }
            }
        });

        return result;
    }

    private onProvideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp> {
        let result: Promise<vscode.SignatureHelp> = null;

        this.logOnError(() => {
            const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                result = context.signatureHelp.then((functionSignatureHelp: TLE.FunctionSignatureHelp) => {
                    let signatureHelp: vscode.SignatureHelp = null;

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
        });

        return result.catch((error: any) => {
            this.logError("UnhandledError", error);
            return undefined;
        });
    }

    private onProvideRename(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.WorkspaceEdit {
        const result: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();

        this.logOnError(() => {
            const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
            if (deploymentTemplate) {
                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                const referenceList: Reference.List = context.references;
                if (referenceList) {
                    // When trying to rename a parameter or variable reference inside of a TLE, the
                    // textbox that pops up when you press F2 contains more than just the variable
                    // or parameter name. This next section of code parses out just the variable or
                    // parameter name.
                    const firstSingleQuoteIndex: number = newName.indexOf(`'`);
                    if (firstSingleQuoteIndex >= 0) {
                        const secondSingleQuoteIndex: number = newName.indexOf(`'`, firstSingleQuoteIndex + 1);
                        if (secondSingleQuoteIndex >= 0) {
                            newName = newName.substring(firstSingleQuoteIndex + 1, secondSingleQuoteIndex);
                        }
                        else {
                            newName = newName.substring(firstSingleQuoteIndex + 1);
                        }
                    }

                    const documentUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);

                    for (const referenceSpan of referenceList.spans) {
                        const referenceRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, referenceSpan);
                        result.replace(documentUri, referenceRange, newName);
                    }
                }
                else {
                    vscode.window.showInformationMessage("You can only rename parameters and variables.");
                }
            }
        });

        return result;
    }

    private onActiveTextEditorChanged(): void {
        this.logOnError(() => {
            let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                if (this.getDeploymentTemplate(activeEditor.document) === undefined) {
                    this.updateDeploymentTemplate(activeEditor.document);
                }
            }
        });
    }

    private onTextSelectionChanged(): void {
        this.logOnError(() => {
            let editor: vscode.TextEditor = vscode.window.activeTextEditor;
            if (editor) {
                let deploymentTemplate = this.getDeploymentTemplate(editor.document);
                if (deploymentTemplate) {
                    let position = editor.selection.anchor;
                    let context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                    let tleBraceHighlightIndexes: number[] = TLE.BraceHighlighter.getHighlightCharacterIndexes(context);

                    let braceHighlightRanges: vscode.Range[] = [];
                    for (let tleHighlightIndex of tleBraceHighlightIndexes) {
                        const highlightSpan = new language.Span(tleHighlightIndex + context.jsonTokenStartIndex, 1);
                        braceHighlightRanges.push(this.getVSCodeRangeFromSpan(deploymentTemplate, highlightSpan));
                    }

                    editor.setDecorations(this._braceHighlightDecorationType, braceHighlightRanges);
                }
            }
        });
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
        this.logOnError(() => {
            this.updateDeploymentTemplate(event.document);
        });
    }

    private onDocumentOpened(openedDocument: vscode.TextDocument): void {
        this.logOnError(() => {
            this.updateDeploymentTemplate(openedDocument);
        });
    }

    private onDocumentSaved(savedDocument: vscode.TextDocument): void {
        this.logOnError(() => {
            // The saved document is a deployment template if it shows up in our deployment
            // templates dictionary.
            if (this._deploymentTemplates[savedDocument.uri.toString()]) {
                this.log({
                    eventName: "Deployment Template Saved",
                    autoSave: this._autoSave
                });
            }
        });
    }

    private onDocumentClosed(closedDocument: vscode.TextDocument): void {
        this.logOnError(() => {
            this.closeDeploymentTemplate(closedDocument);
        });
    }

    private loadConfiguration(): void {
        const configuration = vscode.workspace.getConfiguration("azurermtools");
        this._azureRMToolsConfiguration = {
            debug: configuration.get("debug", false),
            enableTelemetry: configuration.get("enableTelemetry", false)
        };

        const filesConfiguration = vscode.workspace.getConfiguration("files");
        this._autoSave = filesConfiguration.get("autoSave", "off");
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

    private log(event: Telemetry.Event): void {
        if (this._azureRMToolsConfiguration.enableTelemetry) {
            if (this._azureRMToolsConfiguration.debug) {
                if (!this._debugTelemetry) {
                    this._debugTelemetry = new Telemetry.Console();
                }

                this._debugTelemetry.log(event);
            }
            else {
                if (!this._productionTelemetry) {
                    this._productionTelemetry = new Telemetry.PropertySetter(null, new Telemetry.VSCode());
                }

                this._productionTelemetry.log(event);
            }
        }
    }

    private logOnError(operation: () => void): void {
        assert(operation);

        try {
            operation();
        }
        catch (error) {
            this.logError("UnhandledError", error);
        }
    }

    private logError(eventName: string, error: any): void {
        const event: Telemetry.Event = {
            eventName: eventName,
            errorType: typeof error
        };

        if (error instanceof TypeError) {
            event["message"] = error.message;
            event["stack"] = error.stack;
        }
        else {
            for (const propertyName in error) {
                event[propertyName] = error[propertyName];
            }
        }

        this.log(event);
    }
}

interface AzureRMToolsConfiguration {
    debug: boolean;

    enableTelemetry: boolean;
}