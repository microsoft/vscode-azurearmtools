/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// tslint:disable:promise-function-async max-line-length // Grandfathered in

const COMPLETION_ITEM_PROVIDER = true

import * as path from 'path';
import * as vscode from "vscode";
import { AzureUserInput, callWithTelemetryAndErrorHandling as callWithTelemetryAndErrorHandlingOld, callWithTelemetryAndErrorHandlingSync, createAzExtOutputChannel, IActionContext, registerUIExtensionVariables, TelemetryProperties } from "vscode-azureextensionui";
import { delay } from "../test/support/delay";
import { armTemplateLanguageId, configKeys, configPrefix, documentSchemes, expressionsDiagnosticsCompletionMessage, expressionsDiagnosticsSource, globalStateKeys, outputChannelName } from "./constants";
import { DeploymentDocument } from "./documents/DeploymentDocument";
import { DeploymentFileMapping } from "./documents/parameters/DeploymentFileMapping";
import { DeploymentParametersDoc } from "./documents/parameters/DeploymentParametersDoc";
import { defaultTabSize } from './documents/parameters/parameterFileGeneration';
import { considerQueryingForParameterFile } from "./documents/parameters/parameterFiles";
import { PositionContext } from "./documents/positionContexts/PositionContext";
import { TemplatePositionContext } from "./documents/positionContexts/TemplatePositionContext";
import { DeploymentTemplateDoc } from "./documents/templates/DeploymentTemplateDoc";
import { getNormalizedDocumentKey } from './documents/templates/getNormalizedDocumentKey';
import { IJsonDocument } from './documents/templates/IJsonDocument';
import { assignTemplateGraphToDeploymentTemplate, INotifyTemplateGraphArgs } from './documents/templates/linkedTemplates/linkedTemplates';
import { allSchemas, getPreferredSchema } from './documents/templates/schemas';
import { mightBeDeploymentParameters, mightBeDeploymentTemplate, setLangIdToArm, templateOrParameterDocumentSelector } from "./documents/templates/supported";
import { ext } from "./extensionVariables";
import { assert } from './fixed_assert';
import { IProvideOpenedDocuments } from './IProvideOpenedDocuments';
import * as TLE from "./language/expressions/TLE";
import { Issue, IssueSeverity } from "./language/Issue";
import * as Json from "./language/json/JSON";
import { Span } from "./language/Span";
import { getAvailableResourceTypesAndVersions } from './languageclient/getAvailableResourceTypesAndVersions';
import { waitForLanguageServerAvailable } from "./languageclient/startArmLanguageServer";
import { SnippetManager } from "./snippets/SnippetManager";
import { TimedMessage } from './TimedMessage';
import { escapeNonPaths } from "./util/escapeNonPaths";
import { Histogram } from "./util/Histogram";
import { pathExists } from "./util/pathExists";
import { readUtf8FileWithBom } from "./util/readUtf8FileWithBom";
import { Stopwatch } from "./util/Stopwatch";
import { Cancellation } from "./util/throwOnCancel";
import { parseUri } from './util/uri';
import { IncorrectArgumentsCountIssue } from "./visitors/IncorrectArgumentsCountIssue";
import { UnrecognizedBuiltinFunctionIssue } from "./visitors/UnrecognizedFunctionIssues";
import { Item } from './vscodeIntegration/Completion';
import { ConsoleOutputChannelWrapper } from "./vscodeIntegration/ConsoleOutputChannelWrapper";
import { toVsCodeCompletionItem } from "./vscodeIntegration/toVsCodeCompletionItem";
import { toVSCodeDiagnosticFromIssue } from './vscodeIntegration/toVSCodeDiagnosticFromIssue';
import { JsonOutlineProvider } from "./vscodeIntegration/Treeview";
import { getVSCodeRangeFromSpan } from "./vscodeIntegration/vscodePosition";

async function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (context: IActionContext) => T | PromiseLike<T>): Promise<T | undefined> {
    console.log(callbackId);
    return await callWithTelemetryAndErrorHandlingOld(callbackId, callback);
}

interface IErrorsAndWarnings {
    errors: Issue[];
    warnings: Issue[];
}

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
    registerUIExtensionVariables(ext);

    //context.subscriptions.push(ext.completionItemsSpy);

    ext.deploymentFileMapping.value = new DeploymentFileMapping(ext.configuration);
    if (!ext.snippetManager.hasValue) {
        ext.snippetManager.value = SnippetManager.createDefault();
    }

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
    // Key is normalized URI
    private readonly _deploymentDocuments: Map<string, DeploymentDocument> = new Map<string, DeploymentDocument>();
    // Key is normalized URI
    private readonly _cachedTemplateGraphs: Map<string, INotifyTemplateGraphArgs> = new Map<string, INotifyTemplateGraphArgs>();
    private readonly _filesAskedToUpdateSchemaThisSession: Set<string> = new Set<string>();
    private readonly _paramsStatusBarItem: vscode.StatusBarItem;
    private _areDeploymentTemplateEventsHookedUp: boolean = false;
    private _diagnosticsVersion: number = 0;
    private _mapping: DeploymentFileMapping = ext.deploymentFileMapping.value;
    private _codeLensChangedEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    //private _linkedTemplateDocProviderChangedEmitter: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();
    private _bicepMessage: TimedMessage = new TimedMessage(
        globalStateKeys.messages.bicepMessagePostponedUntilTime,
        "debugBicepMessage",
        "Try Azure Bicep, the next generation of ARM templates, in VS Code",
        parseUri("https://aka.ms/bicep-install")
    );

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
        ext.provideOpenedDocuments = this;

        const jsonOutline: JsonOutlineProvider = new JsonOutlineProvider(context);
        ext.jsonOutlineProvider = jsonOutline;
        context.subscriptions.push(vscode.window.registerTreeDataProvider("azurerm-vscode-tools.template-outline", jsonOutline));

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

        // Hook up completion provider immediately because it also handles unsupported JSON files (for non-template JSON files)
        if (COMPLETION_ITEM_PROVIDER) {
            const completionProvider: vscode.CompletionItemProvider = {
                provideCompletionItems: async (
                    document: vscode.TextDocument,
                    position: vscode.Position,
                    token: vscode.CancellationToken,
                    ctx: vscode.CompletionContext
                ): Promise<vscode.CompletionList | undefined> => {
                    console.log("completionProvider");
                    return await this.onProvideCompletions(document, position, token, ctx);
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
        }

        const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (activeEditor) {
            const activeDocument = activeEditor.document;
            this.updateOpenedDocument(activeDocument);
        }

        // If the bicep extension is installed, don't ever show the "try bicep" message
        if (vscode.extensions.getExtension('ms-azuretools.vscode-bicep')) {
            // tslint:disable-next-line: no-floating-promises
            this._bicepMessage.neverShowAgain();
        }
    }
    public setStaticDocument(documentOrUri: vscode.Uri, content: string): void {
        throw new Error("Method not implemented.");
    }

    public dispose(): void {
        callWithTelemetryAndErrorHandlingSync('dispose', (actionContext: IActionContext): void => {
            actionContext.telemetry.properties.isActivationEvent = 'true';
            actionContext.errorHandling.suppressDisplay = true;
        });
    }

    // Add the deployment doc to our list of opened deployment docs
    public setOpenedDeploymentDocument(documentUri: vscode.Uri, deploymentDocument: DeploymentDocument | undefined): void {
        assert(documentUri);
        const documentPathKey = getNormalizedDocumentKey(documentUri);

        if (deploymentDocument) {
            this._deploymentDocuments.set(documentPathKey, deploymentDocument);

            if (deploymentDocument instanceof DeploymentTemplateDoc) {
                // Temporarily assign the cached value of the template graph to this template.  This will be overridden once the
                // new graph is received from the language server.
                const templateGraph = this._cachedTemplateGraphs.get(documentPathKey);
                if (templateGraph) {
                    assignTemplateGraphToDeploymentTemplate(templateGraph, deploymentDocument, this);

                    // tslint:disable-next-line: no-floating-promises
                    this.updateEditorState();
                }
            }
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
                let deploymentTemplate: DeploymentTemplateDoc = new DeploymentTemplateDoc(textDocument.getText(), documentUri, textDocument.version);
                if (deploymentTemplate.hasArmSchemaUri()) {
                    treatAsDeploymentTemplate = true;
                }
                actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                if (treatAsDeploymentTemplate) {
                    this.ensureDeploymentDocumentEventsHookedUp();

                    this.setOpenedDeploymentDocument(documentUri, deploymentTemplate);

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
                    let deploymentParameters: DeploymentParametersDoc = new DeploymentParametersDoc(textDocument.getText(), textDocument.uri, textDocument.version);
                    if (deploymentParameters.hasParametersSchema()) {
                        treatAsDeploymentParameters = true;
                    }

                    // This could theoretically include time for parsing for a deployment template as well but isn't likely
                    actionContext.telemetry.measurements.parseDurationInMilliseconds = stopwatch.duration.totalMilliseconds;

                    if (treatAsDeploymentParameters) {
                        this.ensureDeploymentDocumentEventsHookedUp();
                        this.setOpenedDeploymentDocument(documentUri, deploymentParameters);
                        //this.registerActiveUse();

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
            measurements.paramsWithDefaultCount = deploymentTemplate.topLevelScope.parameterDefinitionsSource?.parameterDefinitions
                .filter(pd => pd.defaultValue).length;
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
            measurements.linkedTemplatesUriCount = getChildTemplatesInfo.linkedTemplatesUriCount;
            measurements.linkedTemplatesRelativePathCount = getChildTemplatesInfo.linkedTemplatesRelativePathCount;

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
            assert(error.severity === IssueSeverity.Error, "Errors should have severity of Error");
            diagnostics.push(toVSCodeDiagnosticFromIssue(deploymentDocument, error, vscode.DiagnosticSeverity.Error));
        }

        const warnings = deploymentDocument.getWarnings();
        for (const warning of warnings) {
            assert(
                warning.severity === IssueSeverity.Warning || warning.severity === IssueSeverity.Information,
                "Warnings should have severity of Warning or Information");
            const severity = warning.severity === IssueSeverity.Information
                ? vscode.DiagnosticSeverity.Information :
                vscode.DiagnosticSeverity.Warning;
            diagnostics.push(toVSCodeDiagnosticFromIssue(deploymentDocument, warning, severity));
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
        return undefined;
        // return await callWithTelemetryAndErrorHandling('reportDeploymentTemplateErrors', async (actionContext: IActionContext): Promise<IErrorsAndWarnings> => {
        //     actionContext.telemetry.suppressIfSuccessful = true;

        //     // Note: Associated parameters? Not currently used by getErrors
        //     const associatedParameters: DeploymentParametersDoc | undefined = undefined;
        //     return this.reportDeploymentDocumentErrors(textDocument, deploymentTemplate, associatedParameters);
        // });
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
        if (editor.document.uri.scheme !== documentSchemes.file) {
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
                    `Warning: You are using a deprecated schema version that is no longer maintained.  Would you like us to update "${path.basename(document.uri.path)}" to use the newest schema?`,
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
        const currentTemplate = new DeploymentTemplateDoc(editor.document.getText(), editor.document.uri, editor.document.version);
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

            //startArmLanguageServerInBackground();
        });
    }

    private async updateEditorState(): Promise<void> {
        // let isWarning: boolean = false;
        // let statusBarText: string | undefined;
        // let isTemplateFile = false;
        // let templateFileHasParamFile = false;
        // let isParamFile = false;
        // let paramFileHasTemplateFile = false;

        // try {
        //     const activeDocument = vscode.window.activeTextEditor?.document;
        //     if (activeDocument) {
        //         const deploymentTemplate = this.getOpenedDeploymentDocument(activeDocument);
        //         if (deploymentTemplate instanceof DeploymentTemplateDoc) {
        //             isTemplateFile = true;

        //             const paramFileUri = this._mapping.getParameterFile(activeDocument.uri);
        //             if (paramFileUri) {
        //                 templateFileHasParamFile = true;
        //                 const doesParamFileExist = await pathExists(paramFileUri);
        //                 statusBarText = `Parameter file: ${getFriendlyPathToFile(paramFileUri)}`;
        //                 if (!doesParamFileExist) {
        //                     statusBarText += " $(error) Not found";
        //                 }
        //             } else {
        //                 statusBarText = "Select/Create parameter file...";
        //             }

        //             // Add message to indicate if full validation is disabled
        //             const fullValidationOn = deploymentTemplate.templateGraph?.fullValidationStatus.fullValidationEnabled ?? templateFileHasParamFile;
        //             isWarning = !fullValidationOn;
        //             statusBarText = isWarning ?
        //                 `$(warning) WARNING: Full template validation off. Add param file or top-level param defaults to enable.` :
        //                 statusBarText;

        //             this._paramsStatusBarItem.command = "azurerm-vscode-tools.selectParameterFile";
        //             this._paramsStatusBarItem.text = statusBarText;
        //         } else if (deploymentTemplate instanceof DeploymentParametersDoc) {
        //             // Current file is a parameter file
        //             isParamFile = true;

        //             const templateFileUri = this._mapping.getTemplateFile(activeDocument.uri);
        //             if (templateFileUri) {
        //                 paramFileHasTemplateFile = true;
        //                 const doesTemplateFileExist = await pathExists(templateFileUri);
        //                 statusBarText = `Template file: ${getFriendlyPathToFile(templateFileUri)}`;
        //                 if (!doesTemplateFileExist) {
        //                     statusBarText += " $(error) Not found";
        //                 }
        //             } else {
        //                 statusBarText = "No template file selected";
        //             }

        //             this._paramsStatusBarItem.command = "azurerm-vscode-tools.openTemplateFile";
        //             this._paramsStatusBarItem.text = statusBarText;
        //         }

        //         this._paramsStatusBarItem.color = isWarning ? new vscode.ThemeColor('problemsWarningIcon.foreground') : undefined;
        //     }
        // } finally {
        //     if (statusBarText) {
        //         this._paramsStatusBarItem.show();
        //     } else {
        //         this._paramsStatusBarItem.hide();
        //     }

        //     // tslint:disable-next-line: no-floating-promises
        //     setContext({
        //         isTemplateFile,
        //         hasParamFile: templateFileHasParamFile,
        //         isParamFile: isParamFile,
        //         hasTemplateFile: paramFileHasTemplateFile
        //     });
        // }
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

            await waitForLanguageServerAvailable();
            const availableResourceTypesAndVersions = await getAvailableResourceTypesAndVersions(deploymentTemplate.schemaUri ?? '');
            const [resourceCounts, invalidResourceCounts, invalidVersionCounts] = deploymentTemplate.getResourceUsage(availableResourceTypesAndVersions);
            properties.resourceCounts = escapeNonPaths(this.histogramToTelemetryString(resourceCounts));
            properties.invalidResources = escapeNonPaths(this.histogramToTelemetryString(invalidResourceCounts));
            properties.invalidVersions = escapeNonPaths(this.histogramToTelemetryString(invalidVersionCounts));
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

    private closeDeploymentFile(documentOrUri: vscode.TextDocument | vscode.Uri): void {
        assert(documentOrUri);
        const uri = documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri;
        this._diagnosticsCollection.delete(uri);
        this.setOpenedDeploymentDocument(uri, undefined);
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
            actionContext.telemetry.properties.langId = document.languageId;

            const cancel = new Cancellation(token, actionContext);

            const pc: PositionContext | undefined = await this.getPositionContext(document, position, cancel);
            let jsonDocument: IJsonDocument | undefined;
            let items: Item[] | undefined;
            if (pc) {
                jsonDocument = pc.document;
                const triggerCharacter = context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter
                    ? context.triggerCharacter
                    : undefined;
                let triggerSuggest: boolean | undefined;
                ({ items, triggerSuggest } = await pc.getCompletionItems(triggerCharacter, defaultTabSize));
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
                }
            } else {
                // const result = await this.getUnsupportedJsonSnippets(actionContext, document, position);
                // jsonDocument = result.jsonDocument;
                // items = result.items;
            }

            if (jsonDocument && items) {
                // tslint:disable-next-line:no-non-null-assertion // Guarded with if
                const vsCodeItems = items.map(c => toVsCodeCompletionItem(jsonDocument!, c, position));
                ext.completionItemsSpy.postCompletionItemsResult(jsonDocument, items, vsCodeItems);
                return new vscode.CompletionList(vsCodeItems, true);
            }
        });
    }


    private onResolveCompletionItem(item: vscode.CompletionItem, _token: vscode.CancellationToken): vscode.CompletionItem {
        console.log("onResolveCompletionItem");
        ext.completionItemsSpy.postCompletionItemResolution(item);
        return item;
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
    private async getPositionContext(
        textDocument: vscode.TextDocument,
        position: vscode.Position,
        cancel: Cancellation
    ): Promise<PositionContext | undefined> {
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
        return new DeploymentTemplateDoc(contents, uri, 0);
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
        return new DeploymentParametersDoc(contents, uri, 0);
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
}
