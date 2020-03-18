/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:promise-function-async max-line-length // Grandfathered in

import * as assert from "assert";
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from "vscode";
import { AzureUserInput, callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, createAzExtOutputChannel, createTelemetryReporter, IActionContext, registerCommand, registerUIExtensionVariables, TelemetryProperties, UserCancelledError } from "vscode-azureextensionui";
import { uninstallDotnet } from "./acquisition/dotnetAcquisition";
import { armTemplateLanguageId, configKeys, configPrefix, expressionsDiagnosticsCompletionMessage, expressionsDiagnosticsSource, extensionName, globalStateKeys } from "./constants";
import { DeploymentDoc } from "./DeploymentDoc";
import { DeploymentTemplate } from "./DeploymentTemplate";
import { ext } from "./extensionVariables";
import { Histogram } from "./Histogram";
import * as Hover from './Hover';
import { DefinitionKind } from "./INamedDefinition";
import { IncorrectArgumentsCountIssue } from "./IncorrectArgumentsCountIssue";
import * as Json from "./JSON";
import * as language from "./Language";
import { reloadSchemas } from "./languageclient/reloadSchemas";
import { startArmLanguageServer, stopArmLanguageServer } from "./languageclient/startArmLanguageServer";
import { DeploymentFileMapping } from "./parameterFiles/DeploymentFileMapping";
import { DeploymentParameters } from "./parameterFiles/DeploymentParameters";
import { DocumentPositionContext } from "./parameterFiles/DocumentPositionContext";
import { considerQueryingForParameterFile, getFriendlyPathToFile, openParameterFile, openTemplateFile, selectParameterFile } from "./parameterFiles/parameterFiles";
import { IReferenceSite, PositionContext } from "./PositionContext";
import { ReferenceList } from "./ReferenceList";
import { resetGlobalState } from "./resetGlobalState";
import { getPreferredSchema } from "./schemas";
import { getFunctionParamUsage } from "./signatureFormatting";
import { getQuickPickItems, sortTemplate, SortType } from "./sortTemplate";
import { Stopwatch } from "./Stopwatch";
import { mightBeDeploymentParameters, mightBeDeploymentTemplate, templateDocumentSelector, templateOrParameterDocumentSelector } from "./supported";
import { survey } from "./survey";
import * as TLE from "./TLE";
import { JsonOutlineProvider } from "./Treeview";
import { UnrecognizedBuiltinFunctionIssue } from "./UnrecognizedFunctionIssues";
import { normalizePath } from "./util/normalizePath";
import { onCompletionActivated, toVsCodeCompletionItem } from "./util/toVsCodeCompletionItem";
import { getVSCodeRangeFromSpan } from "./util/vscodePosition";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }): Promise<void> {
    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.outputChannel = createAzExtOutputChannel(extensionName, configPrefix);
    ext.ui = new AzureUserInput(context.globalState);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async (actionContext: IActionContext): Promise<void> => {
        actionContext.telemetry.properties.isActivationEvent = 'true';
        actionContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;
        actionContext.telemetry.properties.autoDetectJsonTemplates = String(vscode.workspace.getConfiguration(configPrefix).get<boolean>(configKeys.autoDetectJsonTemplates));

        context.subscriptions.push(new AzureRMTools(context));
    });
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}

export class AzureRMTools {
    private readonly _diagnosticsCollection: vscode.DiagnosticCollection;
    private readonly _deploymentDocs: Map<string, DeploymentDoc> = new Map<string, DeploymentDoc>();
    private readonly _filesAskedToUpdateSchemaThisSession: Set<string> = new Set<string>();
    private readonly _paramsStatusBarItem: vscode.StatusBarItem;
    private _areDeploymentTemplateEventsHookedUp: boolean = false;
    private _diagnosticsVersion: number = 0;
    private readonly _mapping: DeploymentFileMapping = new DeploymentFileMapping(ext.configuration);

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

    constructor(context: vscode.ExtensionContext) {
        const jsonOutline: JsonOutlineProvider = new JsonOutlineProvider(context);
        ext.jsonOutlineProvider = jsonOutline;
        context.subscriptions.push(vscode.window.registerTreeDataProvider("azurerm-vscode-tools.template-outline", jsonOutline));

        registerCommand("azurerm-vscode-tools.treeview.goto", (_actionContext: IActionContext, range: vscode.Range) => jsonOutline.goToDefinition(range));
        registerCommand("azurerm-vscode-tools.completion-activated", (actionContext: IActionContext, args: object) => {
            onCompletionActivated(actionContext, args);
        });
        registerCommand('azurerm-vscode-tools.uninstallDotnet', async () => {
            await stopArmLanguageServer();
            await uninstallDotnet();
        });
        registerCommand("azurerm-vscode-tools.reloadSchemas", async () => {
            await reloadSchemas();
        });
        registerCommand("azurerm-vscode-tools.sortTemplate", async (_context: IActionContext, uri?: vscode.Uri, editor?: vscode.TextEditor) => {
            editor = editor || vscode.window.activeTextEditor;
            uri = uri || vscode.window.activeTextEditor?.document.uri;
            // If "Sort template..." was called from the context menu for ARM template outline
            if (typeof uri === "string") {
                uri = vscode.window.activeTextEditor?.document.uri;
            }
            if (uri && editor) {
                const sortType = await ext.ui.showQuickPick(getQuickPickItems(), { placeHolder: 'What do you want to sort?' });
                await this.sortTemplate(sortType.value, uri, editor);
            }
        });
        registerCommand("azurerm-vscode-tools.sortFunctions", async () => {
            await this.sortTemplate(SortType.Functions);
        });
        registerCommand("azurerm-vscode-tools.sortOutputs", async () => {
            await this.sortTemplate(SortType.Outputs);
        });
        registerCommand("azurerm-vscode-tools.sortParameters", async () => {
            await this.sortTemplate(SortType.Parameters);
        });
        registerCommand("azurerm-vscode-tools.sortResources", async () => {
            await this.sortTemplate(SortType.Resources);
        });
        registerCommand("azurerm-vscode-tools.sortVariables", async () => {
            await this.sortTemplate(SortType.Variables);
        });
        registerCommand("azurerm-vscode-tools.sortTopLevel", async () => {
            await this.sortTemplate(SortType.TopLevel);
        });
        registerCommand(
            "azurerm-vscode-tools.selectParameterFile", async (actionContext: IActionContext, source?: vscode.Uri) => {
                await selectParameterFile(actionContext, this._mapping, source);
            });
        registerCommand(
            "azurerm-vscode-tools.openParameterFile", async (_actionContext: IActionContext, source?: vscode.Uri) => {
                source = source ?? vscode.window.activeTextEditor?.document.uri;
                await openParameterFile(this._mapping, source, undefined);
            });
        // registerCommand( asdf
        //     "azurerm-vscode-tools.selectTemplateFile", async (actionContext: IActionContext, source?: vscode.Uri) => {
        //         //asdf await selectParameterFile(actionContext, this._mapping, source);
        //     });
        registerCommand(
            "azurerm-vscode-tools.openTemplateFile", async (_actionContext: IActionContext, source?: vscode.Uri) => {
                source = source ?? vscode.window.activeTextEditor?.document.uri;
                await openTemplateFile(this._mapping, source, undefined);
            });
        registerCommand("azurerm-vscode-tools.resetGlobalState", resetGlobalState);

        this._paramsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        ext.context.subscriptions.push(this._paramsStatusBarItem);

        vscode.window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this, context.subscriptions);
        vscode.workspace.onDidOpenTextDocument(this.onDocumentOpened, this, context.subscriptions);
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged, this, context.subscriptions);
        vscode.workspace.onDidChangeConfiguration(
            async () => {
                this._mapping.resetCache();
                // tslint:disable-next-line: no-floating-promises
                this.updateStatusBar();
            },
            this,
            context.subscriptions);

        this._diagnosticsCollection = vscode.languages.createDiagnosticCollection("azurerm-tools-expressions");
        context.subscriptions.push(this._diagnosticsCollection);

        const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeDocument = activeEditor.document;
            this.updateDeploymentDoc(activeDocument);
        }
    }

    private async sortTemplate(sortType: SortType, documentUri?: vscode.Uri, editor?: vscode.TextEditor): Promise<void> {
        editor = editor || vscode.window.activeTextEditor;
        documentUri = documentUri || editor?.document.uri;
        if (editor && documentUri && editor.document.uri.fsPath === documentUri.fsPath) {
            let deploymentTemplate = this.getDeploymentTemplate(editor.document);
            await sortTemplate(deploymentTemplate, sortType, editor);
        }
    }

    public dispose(): void {
        callWithTelemetryAndErrorHandlingSync('dispose', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
        });
    }

    private setDeploymentDoc(documentUri: vscode.Uri, deploymentDoc: DeploymentDoc | undefined): void {
        assert(documentUri);
        const normalizedPath = normalizePath(documentUri);
        if (deploymentDoc) {
            this._deploymentDocs.set(normalizedPath, deploymentDoc);
        } else {
            this._deploymentDocs.delete(normalizedPath);
        }
    }

    private getDeploymentDoc(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentDoc | undefined {
        assert(documentOrUri);
        const uri = documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri;
        const normalizedPath = normalizePath(uri);
        return this._deploymentDocs.get(normalizedPath);
    }

    private getDeploymentTemplate(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentTemplate | undefined {
        const file = this.getDeploymentDoc(documentOrUri);
        return file instanceof DeploymentTemplate ? file : undefined;
    }

    /*
    private getDeploymentParameters(documentOrUri: vscode.TextDocument | vscode.Uri): DeploymentParameters | undefined {
        const file = this.getDeploymentDoc(documentOrUri);
        return file instanceof DeploymentParameters ? file : undefined;
    }
    */

    // tslint:disable-next-line:no-suspicious-comment
    // TODO: refactor
    // tslint:disable-next-line:max-func-body-length
    private updateDeploymentDoc(document: vscode.TextDocument): void {
        // tslint:disable-next-line:max-func-body-length cyclomatic-complexity
        callWithTelemetryAndErrorHandlingSync('updateDeploymentDocument', (actionContext: IActionContext): void => {
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.properties.fileExt = path.extname(document.fileName);

            assert(document);
            const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
            const stopwatch = new Stopwatch();
            stopwatch.start();

            let treatAsDeploymentTemplate = false;
            let treatAsDeploymentParameters = false;
            const documentUri = document.uri;

            if (document.languageId === armTemplateLanguageId) {
                // Lang ID is set to arm-template, whether auto or manual, respect the setting
                treatAsDeploymentTemplate = true;
            }

            // If the documentUri is not in our dictionary of deployment templates, then either
            //   it's not a deployment file, or else this document was just opened (as opposed
            //   to changed/updated).
            // Note that it might have been opened, then closed, then reopened, or it
            //   might have had its schema changed in the editor to make it a deployment file.
            const isNewlyOpened: boolean = !this.getDeploymentDoc(documentUri);

            // Is it a deployment template file?
            let shouldParseFile = treatAsDeploymentTemplate || mightBeDeploymentTemplate(document);
            if (shouldParseFile) {
                // Do a full parse
                let deploymentTemplate: DeploymentTemplate = new DeploymentTemplate(document.getText(), documentUri);
                if (deploymentTemplate.hasArmSchemaUri()) {
                    treatAsDeploymentTemplate = true;
                }
                actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                if (treatAsDeploymentTemplate) {
                    this.ensureDeploymentDocEventsHookedUp();
                    this.setDeploymentDoc(documentUri, deploymentTemplate);

                    if (isNewlyOpened) {
                        // A deployment template has been opened (as opposed to having been tabbed to)

                        // Make sure the language ID is set to arm-template
                        if (document.languageId !== armTemplateLanguageId) {
                            // The document will be reloaded, firing this event again with the new langid
                            AzureRMTools.setLanguageToArm(document, actionContext);
                            return;
                        }

                        // Telemetry for template opened
                        // tslint:disable-next-line: no-floating-promises // Don't wait
                        this.reportTemplateOpenedTelemetry(document, deploymentTemplate, stopwatch);

                        // No guarantee that active editor is the one we're processing, ignore if not
                        if (editor && editor.document === document) {
                            // Are they using an older schema?  Ask to update.
                            // tslint:disable-next-line: no-suspicious-comment
                            // TODO: Move to separate file
                            this.considerQueryingForNewerSchema(editor, deploymentTemplate);

                            // Is there a possibly-matching params file they might want to associate?
                            considerQueryingForParameterFile(this._mapping, document);
                        }
                    }

                    this.reportDeploymentTemplateErrors(document, deploymentTemplate);
                    survey.registerActiveUse();
                }
            }

            if (!treatAsDeploymentTemplate) {
                // Is it a parameter file?
                let shouldParseParameterFile = treatAsDeploymentTemplate || mightBeDeploymentParameters(document);
                if (shouldParseParameterFile) {
                    // Do a full parse
                    let deploymentParameters: DeploymentParameters = new DeploymentParameters(document.getText(), document.uri);
                    if (deploymentParameters.hasParametersUri()) {
                        treatAsDeploymentParameters = true;
                    }

                    // This could theoretically include time for parsing for a deployment template as well but isn't likely
                    actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                    if (treatAsDeploymentParameters) {
                        this.ensureDeploymentDocEventsHookedUp();
                        this.setDeploymentDoc(documentUri, deploymentParameters);

                        if (isNewlyOpened) {
                            // A deployment template has been opened (as opposed to having been tabbed to)

                            // Telemetry for parameter file opened
                            // tslint:disable-next-line: no-floating-promises // Don't wait
                            this.reportParameterFileOpenedTelemetry(document, deploymentParameters, stopwatch);

                            // No guarantee that active editor is the one we're processing, ignore if not
                            if (editor && editor.document === document) {
                                //asdf match to parent?
                                // Is there a possibly-matching params file they might want to associate?
                                //considerQueryingForParameterFile(document);
                            }
                        }

                        survey.registerActiveUse();
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
                    this.closeDeploymentFile(document);
                }

                // tslint:disable-next-line: no-floating-promises
                this.updateStatusBar();
            }
        });
    }

    private static setLanguageToArm(document: vscode.TextDocument, actionContext: IActionContext): void {
        vscode.languages.setTextDocumentLanguage(document, armTemplateLanguageId);

        actionContext.telemetry.properties.switchedToArm = 'true';
        actionContext.telemetry.properties.docLangId = document.languageId;
        actionContext.telemetry.properties.docExtension = path.extname(document.fileName);
        actionContext.telemetry.suppressIfSuccessful = false;
    }

    private async reportTemplateOpenedTelemetry(
        document: vscode.TextDocument,
        deploymentTemplate: DeploymentTemplate,
        stopwatch: Stopwatch
    ): Promise<void> {
        // tslint:disable-next-line: restrict-plus-operands
        const functionsInEachNamespace = deploymentTemplate.topLevelScope.namespaceDefinitions.map(ns => ns.members.length);
        // tslint:disable-next-line: restrict-plus-operands
        const totalUserFunctionsCount = functionsInEachNamespace.reduce((sum, count) => sum + count, 0);

        const issuesHistograph = new Histogram();
        const errors = await deploymentTemplate.errorsPromise;
        const warnings = deploymentTemplate.warnings;
        for (const error of errors) {
            issuesHistograph.add(`extErr:${error.kind}`);
        }
        for (const warning of deploymentTemplate.warnings) {
            issuesHistograph.add(`extWarn:${warning.kind}`);
        }

        ext.reporter.sendTelemetryEvent(
            "Deployment Template Opened",
            {
                docLangId: document.languageId,
                docExtension: path.extname(document.fileName),
                // tslint:disable-next-line: strict-boolean-expressions
                schema: deploymentTemplate.schemaUri || "",
                // tslint:disable-next-line: strict-boolean-expressions
                apiProfile: deploymentTemplate.apiProfile || "",
                issues: this.histogramToTelemetryString(issuesHistograph)
            },
            {
                documentSizeInCharacters: document.getText().length,
                parseDurationInMilliseconds: stopwatch.duration.totalMilliseconds,
                lineCount: deploymentTemplate.lineCount,
                maxLineLength: deploymentTemplate.getMaxLineLength(),
                paramsCount: deploymentTemplate.topLevelScope.parameterDefinitions.length,
                varsCount: deploymentTemplate.topLevelScope.variableDefinitions.length,
                namespacesCount: deploymentTemplate.topLevelScope.namespaceDefinitions.length,
                userFunctionsCount: totalUserFunctionsCount,
                multilineStringCount: deploymentTemplate.getMultilineStringCount(),
                commentCount: deploymentTemplate.getCommentCount(),
                extErrorsCount: errors.length,
                extWarnCount: warnings.length,
                linkedParameterFiles: this._mapping.getParameterFile(document.uri) ? 1 : 0
            });

        this.logFunctionCounts(deploymentTemplate);
        this.logResourceUsage(deploymentTemplate);
    }

    private async reportParameterFileOpenedTelemetry(
        document: vscode.TextDocument,
        deploymentParameters: DeploymentParameters,
        stopwatch: Stopwatch
    ): Promise<void> {
        ext.reporter.sendTelemetryEvent(
            "Parameter File Opened",
            {
                docLangId: document.languageId,
                docExtension: path.extname(document.fileName),
                schema: deploymentParameters.schemaUri ?? ""
            },
            {
                documentSizeInCharacters: document.getText().length,
                parseDurationInMilliseconds: stopwatch.duration.totalMilliseconds,
                lineCount: deploymentParameters.lineCount,
                maxLineLength: deploymentParameters.getMaxLineLength(),
                paramsCount: deploymentParameters.parametersObjectValue?.length ?? 0,
                commentCount: deploymentParameters.getCommentCount(),
                linkedTemplateFiles: this._mapping.getTemplateFile(document.uri) ? 1 : 0
            });
    }

    private reportDeploymentTemplateErrors(document: vscode.TextDocument, deploymentTemplate: DeploymentTemplate): void {
        // Don't wait
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling('reportDeploymentTemplateErrors', async (actionContext: IActionContext): Promise<void> => {
            actionContext.telemetry.suppressIfSuccessful = true;

            ++this._diagnosticsVersion;

            let parseErrors: language.Issue[] = await deploymentTemplate.errorsPromise;
            const diagnostics: vscode.Diagnostic[] = [];

            for (const error of parseErrors) {
                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, error, vscode.DiagnosticSeverity.Error));
            }

            for (const warning of deploymentTemplate.warnings) {
                diagnostics.push(this.getVSCodeDiagnosticFromIssue(deploymentTemplate, warning, vscode.DiagnosticSeverity.Warning));
            }

            let completionDiagnostic = this.getCompletedDiagnostic();
            if (completionDiagnostic) {
                diagnostics.push(completionDiagnostic);
            }

            this._diagnosticsCollection.set(document.uri, diagnostics);
        });
    }

    private considerQueryingForNewerSchema(editor: vscode.TextEditor, deploymentTemplate: DeploymentTemplate): void {
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
        const checkForLatestSchema = !!vscode.workspace.getConfiguration(configPrefix).get<boolean>(configKeys.checkForLatestSchema);

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
                    `Would you like to use the latest schema for deployment template "${path.basename(document.uri.path)}" (note: some tools may be unable to process the latest schema)?`,
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

    private async replaceSchema(uri: vscode.Uri, deploymentTemplate: DeploymentTemplate, previousSchema: string, newSchema: string): Promise<void> {
        // Editor might have been closed or tabbed away from, so make sure it's visible
        const editor = await vscode.window.showTextDocument(uri);

        // The document might have changed since we asked, so find the $schema again
        const currentTemplate = new DeploymentTemplate(editor.document.getText(), editor.document.uri);
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
    private ensureDeploymentDocEventsHookedUp(): void {
        if (this._areDeploymentTemplateEventsHookedUp) {
            return;
        }
        this._areDeploymentTemplateEventsHookedUp = true;

        vscode.window.onDidChangeTextEditorSelection(this.onTextSelectionChanged, this, ext.context.subscriptions);

        vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed, this, ext.context.subscriptions);

        const hoverProvider: vscode.HoverProvider = {
            provideHover: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover | undefined => {
                return this.onProvideHover(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerHoverProvider(templateDocumentSelector, hoverProvider));

        // Code actions provider
        const codeActionProvider: vscode.CodeActionProvider = {
            provideCodeActions: async (
                document: vscode.TextDocument,
                range: vscode.Range | vscode.Selection,
                context: vscode.CodeActionContext,
                token: vscode.CancellationToken
            ): Promise<(vscode.Command | vscode.CodeAction)[] | undefined> => {
                return await this.onProvideCodeActions(document, range, context, token);
            }
        };
        ext.context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                templateOrParameterDocumentSelector,
                codeActionProvider,
                {
                    providedCodeActionKinds: [
                        vscode.CodeActionKind.QuickFix //asdf
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
                return await this.onProvideCompletions(document, position, token);
            }
        };
        ext.context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                templateOrParameterDocumentSelector,
                completionProvider,
                "'", "[", ".", '"'
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
        ext.context.subscriptions.push(vscode.languages.registerReferenceProvider(templateDocumentSelector, referenceProvider));

        const signatureHelpProvider: vscode.SignatureHelpProvider = {
            provideSignatureHelp: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.SignatureHelp | undefined => {
                return this.onProvideSignatureHelp(document, position, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(templateDocumentSelector, signatureHelpProvider, ",", "(", "\n"));

        const renameProvider: vscode.RenameProvider = {
            provideRenameEdits: async (document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> => {
                return await this.onProvideRename(document, position, newName, token);
            }
        };
        ext.context.subscriptions.push(vscode.languages.registerRenameProvider(templateDocumentSelector, renameProvider));

        // tslint:disable-next-line:no-floating-promises // Don't wait
        startArmLanguageServer();
    }

    private async updateStatusBar(): Promise<void> {
        const activeDocument = vscode.window.activeTextEditor?.document;
        if (activeDocument) {
            const deploymentTemplate = this.getDeploymentDoc(activeDocument);
            if (deploymentTemplate instanceof DeploymentTemplate) {
                const paramFileUri = this._mapping.getParameterFile(activeDocument.uri);
                if (paramFileUri) {
                    const doesParamFileExist = await fse.pathExists(paramFileUri?.fsPath);
                    let text = `Parameters: ${getFriendlyPathToFile(paramFileUri)}`;
                    if (!doesParamFileExist) {
                        text += " $(error) Not found";
                    }
                    this._paramsStatusBarItem.text = text;
                } else {
                    this._paramsStatusBarItem.text = "Select Parameter File...";
                }
                this._paramsStatusBarItem.command = "azurerm-vscode-tools.selectParameterFile";
                this._paramsStatusBarItem.show();
                return;
            } else if (deploymentTemplate instanceof DeploymentParameters) {
                const templateFileUri = this._mapping.getTemplateFile(activeDocument.uri);
                if (templateFileUri) {
                    const doesTemplateFileExist = await fse.pathExists(templateFileUri?.fsPath);
                    let text = `Template file: ${getFriendlyPathToFile(templateFileUri)}`;
                    if (!doesTemplateFileExist) {
                        text += " $(error) Not found";
                    }
                    this._paramsStatusBarItem.text = text;
                } else {
                    this._paramsStatusBarItem.hide();
                    return;
                    //this._paramsStatusBarItem.text = "Select Template File...";
                }
                this._paramsStatusBarItem.command = "azurerm-vscode-tools.openTemplateFile";
                this._paramsStatusBarItem.show();
                return;
            }
        }

        this._paramsStatusBarItem.hide();
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
            } & TelemetryProperties = actionContext.telemetry.properties;

            let issues: language.Issue[] = await deploymentTemplate.errorsPromise;

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
    private logResourceUsage(deploymentTemplate: DeploymentTemplate): void {
        // Don't wait for promise
        // tslint:disable-next-line: no-floating-promises
        callWithTelemetryAndErrorHandling("schema.stats", async (actionContext: IActionContext): Promise<void> => {
            actionContext.errorHandling.suppressDisplay = true;
            let properties: {
                resourceCounts?: string;
            } & TelemetryProperties = actionContext.telemetry.properties;

            const resourceCounts: Histogram = deploymentTemplate.getResourceUsage();
            properties.resourceCounts = this.histogramToTelemetryString(resourceCounts);
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

    private getVSCodeDiagnosticFromIssue(deploymentTemplate: DeploymentTemplate, issue: language.Issue, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
        const range: vscode.Range = getVSCodeRangeFromSpan(deploymentTemplate, issue.span);
        const message: string = issue.message;
        let diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = expressionsDiagnosticsSource;
        diagnostic.code = "";
        return diagnostic;
    }

    private closeDeploymentFile(document: vscode.TextDocument): void {
        assert(document);
        this._diagnosticsCollection.delete(document.uri);
        this.setDeploymentDoc(document.uri, undefined);
    }

    private onProvideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover | undefined {
        const deploymentTemplate = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return callWithTelemetryAndErrorHandlingSync('Hover', (actionContext: IActionContext): vscode.Hover | undefined => {
                actionContext.errorHandling.suppressDisplay = true;
                const properties = <TelemetryProperties & { hoverType?: string; tleFunctionName: string }>actionContext.telemetry.properties;

                const context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                const hoverInfo: Hover.HoverInfo | undefined = context.getHoverInfo();

                if (hoverInfo) {
                    properties.hoverType = hoverInfo.friendlyType;
                    const hoverRange: vscode.Range = getVSCodeRangeFromSpan(deploymentTemplate, hoverInfo.span);
                    const hover = new vscode.Hover(hoverInfo.getHoverText(), hoverRange);
                    return hover;
                }

                return undefined;
            });
        }
    }

    private async onProvideCompletions(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList | undefined> {
        return await callWithTelemetryAndErrorHandlingSync('provideCompletionItems', async (actionContext: IActionContext): Promise<vscode.CompletionList | undefined> => {
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.errorHandling.suppressDisplay = true;

            const pc: DocumentPositionContext | undefined = await this.getDocumentPositionContext(document, position);
            if (pc) {
                const completionItems: vscode.CompletionItem[] =
                    pc.getCompletionItems()
                        .map(completion => toVsCodeCompletionItem(pc.document, completion));
                return new vscode.CompletionList(completionItems, true);
            }

            return undefined;
        });
    }

    private async getDocumentPositionContext(document: vscode.TextDocument, position: vscode.Position): Promise<DocumentPositionContext | undefined> {
        const doc = this.getDeploymentDoc(document);
        if (!doc) {
            return undefined;
        }

        if (doc instanceof DeploymentTemplate) {
            return doc.getContextFromDocumentLineAndColumnIndexes(
                position.line,
                position.character);
        } else if (doc instanceof DeploymentParameters) {
            // It's a parameter file - find the associated template file, if any
            let template: DeploymentTemplate | undefined;
            const templateUri: vscode.Uri | undefined = this._mapping.getTemplateFile(document.uri);
            if (templateUri) {
                // Is it already opened?
                template = this.getDeploymentTemplate(templateUri);
                if (!template) {
                    // Nope, have to read it from disk asdf error handling
                    const contents = (await fse.readFile(templateUri.fsPath, { encoding: 'utf8' })).toString();
                    template = new DeploymentTemplate(contents, templateUri);
                }
            }

            return doc.getContextFromDocumentLineAndColumnIndexes(
                position.line,
                position.character,
                template);
        } else {
            assert.fail("Unexpected doc type");
        }
    }

    private getDocTypeForTelemetry(doc: DeploymentDoc): string {
        if (doc instanceof DeploymentTemplate) {
            return "template";
        } else if (doc instanceof DeploymentParameters) {
            return "parameters";
        } else {
            assert.fail("Unexpected doc type");
        }
    }

    private async onProvideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | undefined> {
        return callWithTelemetryAndErrorHandling('Go To Definition', async (actionContext: IActionContext): Promise<vscode.Location | undefined> => {
            const pc: DocumentPositionContext | undefined = await this.getDocumentPositionContext(document, position);
            if (pc) {
                let properties = <TelemetryProperties &
                {
                    definitionType?: string;
                    docType?: string;
                }>actionContext.telemetry.properties;
                actionContext.errorHandling.suppressDisplay = true;
                properties.docType = this.getDocTypeForTelemetry(pc.document);

                const refInfo = pc.getReferenceSiteInfo();
                if (refInfo && refInfo.definition.nameValue) {
                    properties.definitionType = refInfo.definition.definitionKind;

                    return new vscode.Location(
                        refInfo.definitionDoc.documentId,
                        getVSCodeRangeFromSpan(refInfo.definitionDoc, refInfo.definition.nameValue.span)
                    );
                }

                return undefined;
            }
        });
    }

    private onProvideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.Location[] | undefined {
        const deploymentTemplate: DeploymentTemplate | undefined = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return callWithTelemetryAndErrorHandlingSync('Find References', (actionContext: IActionContext): vscode.Location[] => {
                const results: vscode.Location[] = [];
                const locationUri: vscode.Uri = deploymentTemplate.documentId;
                const positionContext: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                const references: ReferenceList | undefined = positionContext.getReferences();
                if (references && references.length > 0) {
                    actionContext.telemetry.properties.referenceType = references.kind;

                    for (const span of references.spans) {
                        const referenceRange: vscode.Range = getVSCodeRangeFromSpan(deploymentTemplate, span);
                        results.push(new vscode.Location(locationUri, referenceRange));
                    }
                }

                return results;
            });
        }
    }

    /**
     * Provide commands for the given document and range.
     *
     * @param document The document in which the command was invoked.
     * @param range The selector or range for which the command was invoked. This will always be a selection if
     * there is a currently active editor.
     * @param context Context carrying additional information.
     * @param token A cancellation token.
     * @return An array of commands, quick fixes, or refactorings or a thenable of such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    private async onProvideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<(vscode.Command | vscode.CodeAction)[] | undefined> {
        return await callWithTelemetryAndErrorHandling('Provide code actions', async (actionContext: IActionContext): Promise<(vscode.Command | vscode.CodeAction)[]> => {
            actionContext.errorHandling.suppressDisplay = true;

            if (token.isCancellationRequested) {
                throw new UserCancelledError();
            }

            const pc: DocumentPositionContext | undefined = await this.getDocumentPositionContext(document, range.start);

            if (token.isCancellationRequested) {
                throw new UserCancelledError();
            }

            if (pc) {
                return await pc.getCodeActions(range, context);
            }

            return [];
        });
    }

    private onProvideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.SignatureHelp | undefined {
        const deploymentTemplate: DeploymentTemplate | undefined = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return callWithTelemetryAndErrorHandlingSync('provideSignatureHelp', (actionContext: IActionContext): vscode.SignatureHelp | undefined => {
                actionContext.errorHandling.suppressDisplay = true;

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);

                let functionSignatureHelp: TLE.FunctionSignatureHelp | undefined = context.getSignatureHelp();
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
            });
        }
    }

    private async onProvideRename(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> {
        const deploymentTemplate: DeploymentTemplate | undefined = this.getDeploymentTemplate(document);
        if (deploymentTemplate) {
            return await callWithTelemetryAndErrorHandling('Rename', async () => {
                const result: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();

                const context: PositionContext = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                const referenceSiteInfo: IReferenceSite | undefined = context.getReferenceSiteInfo();
                if (referenceSiteInfo && referenceSiteInfo.definition.definitionKind === DefinitionKind.BuiltinFunction) {
                    throw new Error("Built-in functions cannot be renamed.");
                }

                const referenceList: ReferenceList | undefined = context.getReferences();
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

                    const documentUri: vscode.Uri = deploymentTemplate.documentId;

                    for (const referenceSpan of referenceList.spans) {
                        const referenceRange: vscode.Range = getVSCodeRangeFromSpan(deploymentTemplate, referenceSpan);
                        result.replace(documentUri, referenceRange, newName);
                    }
                } else {
                    throw new Error('Only parameters, variables, user namespaces and user functions can be renamed.');
                }

                return result;
            });
        }
    }

    private onActiveTextEditorChanged(editor: vscode.TextEditor | undefined): void {
        callWithTelemetryAndErrorHandlingSync('onActiveTextEditorChanged', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            let activeDocument: vscode.TextDocument | undefined = editor?.document;
            if (activeDocument) {
                if (!this.getDeploymentDoc(activeDocument)) {
                    this.updateDeploymentDoc(activeDocument);
                }
            }

            // tslint:disable-next-line: no-floating-promises
            this.updateStatusBar();
        });
    }

    private onTextSelectionChanged(): void {
        callWithTelemetryAndErrorHandlingSync('onTextSelectionChanged', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
            actionContext.telemetry.suppressIfSuccessful = true;

            let editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
            if (editor) {
                let deploymentTemplate = this.getDeploymentTemplate(editor.document);
                if (deploymentTemplate) {
                    let position = editor.selection.anchor;
                    let context = deploymentTemplate.getContextFromDocumentLineAndColumnIndexes(position.line, position.character);
                    let tleBraceHighlightIndexes: number[] = TLE.BraceHighlighter.getHighlightCharacterIndexes(context);

                    let braceHighlightRanges: vscode.Range[] = [];
                    for (let tleHighlightIndex of tleBraceHighlightIndexes) {
                        const highlightSpan = new language.Span(tleHighlightIndex + context.jsonTokenStartIndex, 1);
                        braceHighlightRanges.push(getVSCodeRangeFromSpan(deploymentTemplate, highlightSpan));
                    }

                    editor.setDecorations(this._braceHighlightDecorationType, braceHighlightRanges);
                }
            }
        });
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        this.updateDeploymentDoc(event.document);
    }

    private onDocumentOpened(openedDocument: vscode.TextDocument): void {
        this.updateDeploymentDoc(openedDocument);
    }

    private onDocumentClosed(closedDocument: vscode.TextDocument): void {
        callWithTelemetryAndErrorHandlingSync('onDocumentClosed', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.telemetry.suppressIfSuccessful = true;
            actionContext.errorHandling.suppressDisplay = true;

            this.closeDeploymentFile(closedDocument);
        });
    }
}
