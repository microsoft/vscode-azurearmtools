// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:promise-function-async max-line-length // Grandfathered in

import * as assert from "assert";
import * as path from 'path';
import * as vscode from "vscode";
import { AzureUserInput, callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, createTelemetryReporter, IActionContext, registerUIExtensionVariables, TelemetryProperties } from "vscode-azureextensionui";
import * as Completion from "./Completion";
import { armDeploymentLanguageId, configKeys, expressionsDiagnosticsCompletionMessage, expressionsDiagnosticsSource } from "./constants";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from "./extensionVariables";
import { Histogram } from "./Histogram";
import * as Hover from "./Hover";
import { IncorrectArgumentsCountIssue } from "./IncorrectArgumentsCountIssue";
import * as language from "./Language";
import { startArmLanguageServer } from "./languageclient/startArmLanguageServer";
import { PositionContext } from "./PositionContext";
import * as Reference from "./Reference";
import { Stopwatch } from "./Stopwatch";
import { armDeploymentDocumentSelector, mightBeDeploymentTemplate, shouldWatchDocument } from "./supported";
import * as TLE from "./TLE";
import { JsonOutlineProvider } from "./Treeview";
import { UnrecognizedFunctionIssue } from "./UnrecognizedFunctionIssue";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }): Promise<void> {
    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.outputChannel = vscode.window.createOutputChannel("ARM Tools");
    ext.ui = new AzureUserInput(context.globalState);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async (actionContext: IActionContext): Promise<void> => {
        actionContext.telemetry.properties.isActivationEvent = 'true';
        actionContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;
        actionContext.telemetry.properties.autoDetectJsonTemplates = String(vscode.workspace.getConfiguration('armTools').get<boolean>(configKeys.autoDetectJsonTemplates));

        context.subscriptions.push(new AzureRMTools(context));
    });
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}

export class AzureRMTools {
    private _diagnosticsCollection: vscode.DiagnosticCollection;
    private _deploymentTemplates: { [key: string]: DeploymentTemplate } = {};
    private _areDeploymentTemplateEventsHookedUp: boolean = false;

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
        const jsonOutline: JsonOutlineProvider = new JsonOutlineProvider(context);
        ext.jsonOutlineProvider = jsonOutline;
        context.subscriptions.push(vscode.window.registerTreeDataProvider("azurerm-vscode-tools.template-outline", jsonOutline));
        context.subscriptions.push(vscode.commands.registerCommand("azurerm-vscode-tools.treeview.goto", (range: vscode.Range) => jsonOutline.goToDefinition(range)));

        vscode.window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this, context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(this.onDocumentOpened, this, context.subscriptions);
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this, context.subscriptions);

        this._diagnosticsCollection = vscode.languages.createDiagnosticCollection("arm-tools-expressions");
        context.subscriptions.push(this._diagnosticsCollection);

        const activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.updateDeploymentTemplate(activeEditor.document);
        }
    }

    public dispose(): void {
        callWithTelemetryAndErrorHandlingSync('dispose', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
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

        callWithTelemetryAndErrorHandlingSync('updateDeploymentTemplate', (actionContext: IActionContext): void => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.properties.fileExt = path.extname(document.fileName);

            let foundDeploymentTemplate = false;

            if (shouldWatchDocument(document)) {
                if (mightBeDeploymentTemplate(document)) {
                    // If the documentUri is not in our dictionary of deployment templates, then we
                    // know that this document was just opened (as opposed to changed/updated).
                    let stopwatch: Stopwatch;
                    const documentUri: string = document.uri.toString();
                    if (!this._deploymentTemplates[documentUri]) {
                        stopwatch = new Stopwatch();
                        stopwatch.start();
                    }

                    // Might be a deployment template, need to do a full parse to make sure
                    let deploymentTemplate: DeploymentTemplate = new DeploymentTemplate(document.getText(), documentUri);
                    if (deploymentTemplate.hasArmSchemaUri()) {
                        foundDeploymentTemplate = true;

                        this.ensureDeploymentTemplateEventsHookedUp();

                        this._deploymentTemplates[documentUri] = deploymentTemplate;

                        // We only initialized the stopwatch if the deployment template was being
                        // opened. The stopwatch variable will not be initialized if the deployment
                        // template is being edited.
                        if (stopwatch) {
                            // A deployment template has been opened (as opposed to having been tabbed to)

                            stopwatch.stop();

                            // Set the language ID to ARM deployment template
                            if (document.languageId !== armDeploymentLanguageId) {
                                vscode.languages.setTextDocumentLanguage(document, armDeploymentLanguageId);

                                // The document will be reloaded, firing this event again with the new langid
                                actionContext.telemetry.properties.switchedToArm = 'true';
                                actionContext.telemetry.properties.docLangId = document.languageId;
                                actionContext.telemetry.properties.docExtension = path.extname(document.fileName);
                                actionContext.telemetry.suppressIfSuccessful = false;
                                return;
                            }

                            ext.reporter.sendTelemetryEvent(
                                "Deployment Template Opened",
                                {
                                    docLangId: document.languageId,
                                    docExtension: path.extname(document.fileName),
                                },
                                {
                                    documentSizeInCharacters: document.getText().length,
                                    parseDurationInMilliseconds: stopwatch.duration.totalMilliseconds,
                                    lineCount: deploymentTemplate.lineCount,
                                    paramsCount: deploymentTemplate.parameterDefinitions.length,
                                    varsCount: deploymentTemplate.variableDefinitions.length,
                                    namespacesCount: deploymentTemplate.namespaceDefinitions.length
                                });

                            this.logFunctionCounts(deploymentTemplate);
                        }

                        this.reportDeploymentTemplateErrors(document, deploymentTemplate);
                    }
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
        });
    }

    private reportDeploymentTemplateErrors(document: vscode.TextDocument, deploymentTemplate: DeploymentTemplate): void {
        // Don't wait
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling('reportDeploymentTemplateErrors', async (actionContext: IActionContext): Promise<void> => {
            actionContext.telemetry.suppressIfSuccessful = true;

            let parseErrors: language.Issue[] = await deploymentTemplate.errors;
            const diagnostics: vscode.Diagnostic[] = [];

            for (const error of parseErrors) {
                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, error, vscode.DiagnosticSeverity.Error));
            }

            for (const warning of deploymentTemplate.warnings) {
                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, warning, vscode.DiagnosticSeverity.Warning));
            }

            if (ext.addCompletionDiagnostic) {
                // Add a diagnostic to indicate expression validation is done (for testing)
                diagnostics.push(<vscode.Diagnostic>{
                    severity: vscode.DiagnosticSeverity.Information,
                    message: expressionsDiagnosticsCompletionMessage,
                    source: expressionsDiagnosticsSource,
                    code: ""
                });
            }

            this._diagnosticsCollection.set(document.uri, diagnostics);
        });
    }

    /**
     * Hook up events related to template files (as opposed to plain JSON files). This is only called when
     * actual template files are open, to avoid slowing performance when simple JSON files are opened.
     */
    private ensureDeploymentTemplateEventsHookedUp(): void {
        if (this._areDeploymentTemplateEventsHookedUp) {
            return;
        }
        this._areDeploymentTemplateEventsHookedUp = true;

        vscode.window.onDidChangeTextEditorSelection(this.onTextSelectionChanged, this, ext.context.subscriptions);

        vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed, this, ext.context.subscriptions);

        const hoverProvider: vscode.HoverProvider = {
            provideHover: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> => {
                return this.onProvideHover(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerHoverProvider(armDeploymentDocumentSelector, hoverProvider));

        const completionProvider: vscode.CompletionItemProvider = {
            provideCompletionItems: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> => {
                return this.onProvideCompletionItems(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerCompletionItemProvider(armDeploymentDocumentSelector, completionProvider, "'", "[", "."));

        const definitionProvider: vscode.DefinitionProvider = {
            provideDefinition: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Definition => {
                return this.onProvideDefinition(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerDefinitionProvider(armDeploymentDocumentSelector, definitionProvider));

        const referenceProvider: vscode.ReferenceProvider = {
            provideReferences: (document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] => {
                return this.onProvideReferences(document, position, context, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerReferenceProvider(armDeploymentDocumentSelector, referenceProvider));

        const signatureHelpProvider: vscode.SignatureHelpProvider = {
            provideSignatureHelp: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.SignatureHelp> => {
                return this.onProvideSignatureHelp(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(armDeploymentDocumentSelector, signatureHelpProvider, ",", "(", "\n"));

        const renameProvider: vscode.RenameProvider = {
            provideRenameEdits: (document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.WorkspaceEdit => {
                return this.onProvideRename(document, position, newName, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerRenameProvider(armDeploymentDocumentSelector, renameProvider));

        startArmLanguageServer(ext.context);
    }

    /**
     * Logs telemetry with information about the functions used in a template. Only meaningful if called
     * in a relatively stable state, such as after first opening
     */
    private logFunctionCounts(deploymentTemplate: DeploymentTemplate): void {
        // Don't wait for promise
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling("tle.stats", async (actionContext: IActionContext): Promise<void> => {
            actionContext.errorHandling.suppressDisplay = true;
            let properties: {
                functionCounts?: string;
                unrecognized?: string;
                incorrectArgs?: string;
                [key: string]: string;
            } = actionContext.telemetry.properties;

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

    private getVSCodeDiagnosticFromIssue(deploymentTemplate: DeploymentTemplate, issue: language.Issue, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
        const range: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, issue.span);
        const message: string = issue.message;
        let diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = expressionsDiagnosticsSource;
        diagnostic.code = "";
        return diagnostic;
    }

    private closeDeploymentTemplate(document: vscode.TextDocument): void {
        if (document) {
            if (this._diagnosticsCollection) {
                this._diagnosticsCollection.delete(document.uri);
            }
            delete this._deploymentTemplates[document.uri.toString()];
        }
    }

    private async onProvideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
        const deploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return await callWithTelemetryAndErrorHandling('Hover', async (actionContext: IActionContext): Promise<vscode.Hover> => {
                actionContext.errorHandling.suppressDisplay = true;
                let properties = <TelemetryProperties & { hoverType?: string; tleFunctionName: string }>actionContext.telemetry.properties;

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

                        const hoverRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, hoverInfo.span);
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
            return await callWithTelemetryAndErrorHandling('provideCompletionItems', async (actionContext: IActionContext): Promise<vscode.CompletionList | undefined> => {
                let properties = <TelemetryProperties & { completionKind?: string }>actionContext.telemetry.properties;
                actionContext.telemetry.suppressIfSuccessful = true;
                actionContext.errorHandling.suppressDisplay = true;

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                let completionItemArray: Completion.Item[] = await context.getCompletionItems();
                const completionItems: vscode.CompletionItem[] = [];
                for (const completion of completionItemArray) {
                    const insertRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, completion.insertSpan);

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
            });
        }
    }

    private onProvideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Location {
        const deploymentTemplate: DeploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return callWithTelemetryAndErrorHandlingSync('Go To Definition', (actionContext: IActionContext): vscode.Location => {
                let properties = <TelemetryProperties & { definitionType?: string }>actionContext.telemetry.properties;
                actionContext.errorHandling.suppressDisplay = true;
                let result: vscode.Location = null;

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                let definitionType: string = "no definition";
                if (context.parameterDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, context.parameterDefinition.span);
                    result = new vscode.Location(locationUri, definitionRange);
                    definitionType = "parameter";
                } else if (context.variableDefinition) {
                    const locationUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);
                    const definitionRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, context.variableDefinition.span);
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
            return callWithTelemetryAndErrorHandlingSync('Find References', (actionContext: IActionContext): vscode.Location[] => {
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

                    actionContext.telemetry.properties.referenceType = referenceType;

                    for (const span of references.spans) {
                        const referenceRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, span);
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
            return await callWithTelemetryAndErrorHandling('provideSignatureHelp', async (actionContext: IActionContext): Promise<vscode.SignatureHelp | undefined> => {
                actionContext.errorHandling.suppressDisplay = true;

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

                    const documentUri: vscode.Uri = vscode.Uri.parse(deploymentTemplate.documentId);

                    for (const referenceSpan of referenceList.spans) {
                        const referenceRange: vscode.Range = this.getVSCodeRangeFromSpan(deploymentTemplate, referenceSpan);
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
        callWithTelemetryAndErrorHandlingSync('onActiveTextEditorChanged', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                if (this.getDeploymentTemplate(activeEditor.document) === undefined) {
                    this.updateDeploymentTemplate(activeEditor.document);
                }
            }
        });
    }

    private onTextSelectionChanged(): void {
        callWithTelemetryAndErrorHandlingSync('onTextSelectionChanged', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

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

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        this.updateDeploymentTemplate(event.document);
    }

    private onDocumentOpened(openedDocument: vscode.TextDocument): void {
        this.updateDeploymentTemplate(openedDocument);
    }

    private onDocumentClosed(closedDocument: vscode.TextDocument): void {
        callWithTelemetryAndErrorHandlingSync('onDocumentClosed', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.errorHandling.suppressDisplay = true;

            this.closeDeploymentTemplate(closedDocument);
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
