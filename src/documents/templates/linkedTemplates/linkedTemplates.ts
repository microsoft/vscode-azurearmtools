// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fse from 'fs-extra';
import * as path from 'path';
import { Diagnostic, TextDocument, Uri, window, workspace } from "vscode";
import { callWithTelemetryAndErrorHandling, DialogResponses, IActionContext, parseError, TelemetryProperties } from "vscode-azureextensionui";
import { armTemplateLanguageId, documentSchemes } from '../../../constants';
import { Errorish } from '../../../Errorish';
import { ext } from "../../../extensionVariables";
import { assert } from '../../../fixed_assert';
import { IProvideOpenedDocuments } from '../../../IProvideOpenedDocuments';
import { ContainsBehavior } from "../../../language/Span";
import { filterByType } from '../../../util/filterByType';
import { httpGet } from '../../../util/httpGet';
import { prependLinkedTemplateScheme, removeLinkedTemplateScheme } from '../../../util/linkedTemplateScheme';
import { normalizeUri } from '../../../util/normalizedPaths';
import { pathExists } from '../../../util/pathExists';
import { parseUri, stringifyUri } from '../../../util/uri';
import { DeploymentTemplateDoc } from '../../templates/DeploymentTemplateDoc';
import { LinkedTemplateScope } from '../../templates/scopes/templateScopes';
import { setLangIdToArm } from '../../templates/supported';
import { ILinkedTemplateReference } from './ILinkedTemplateReference';

/**
 * Inputs for RequestOpenLinkedFile request sent from language server
 */
export interface IRequestOpenLinkedFileArgs {
    sourceTemplateUri: string;
    requestedLinkOriginalUri: string;
    requestedLinkResolvedUri: string;
    pathType: PathType;
}

/**
 * Response sent back to language server from RequestOpenLinkedFile request
 */
export interface IRequestOpenLinkedFileResult { // Corresonds to OpenLinkedFileRequest.Result in language server
    loadErrorMessage?: string;
    content?: string;
}

enum PathType {
    templateLink = 0,
    templateRelativeLink = 1,
    parametersLink = 2,
}

export interface IFullValidationStatus {
    fullValidationEnabled: boolean;
    allParametersHaveDefaults: boolean;
    hasParameterFile: boolean;
}

export interface INotifyTemplateGraphArgs {
    rootTemplateUri: string;
    rootTemplateDocVersion: number;
    linkedTemplates: ILinkedTemplateReference[];
    fullValidationStatus: IFullValidationStatus;
    isComplete: boolean; // If there were validation errors, the graph might not be complete
}

type OpenLinkedFileResult =
    { document: TextDocument; loadError?: Errorish }
    | { document?: TextDocument; loadError: Errorish };

class LinkedTemplatePathNotFoundError extends Error {
    public constructor(message: string) {
        super(message);
    }
}

/**
 * Handles a request from the language server to open a linked template
 * @param sourceTemplateUri The full URI of the template which contains the link
 * @param requestedLinkPath The full URI of the resolved link being requested
 */
export async function onRequestOpenLinkedFile(
    {
        sourceTemplateUri,
        requestedLinkResolvedUri,
        pathType
    }: IRequestOpenLinkedFileArgs
): Promise<IRequestOpenLinkedFileResult | undefined> {
    return await callWithTelemetryAndErrorHandling<IRequestOpenLinkedFileResult>('onRequestOpenLinkedFile', async (context: IActionContext) => {
        const properties = <TelemetryProperties & {
            openResult: 'Loaded' | 'Error';
            openErrorType: string;
            fileScheme: string;
            hasQuery: string;
            hasSas: string;
        }>context.telemetry.properties;
        properties.openErrorType = '';
        properties.openResult = 'Error';

        let requestedLinkUri: Uri;
        try {
            requestedLinkUri = parseUri(requestedLinkResolvedUri);
        } catch (error) {
            return { loadErrorMessage: parseError(error).message };
        }

        properties.fileScheme = requestedLinkUri.scheme;
        properties.hasQuery = String(!!requestedLinkUri.query);
        properties.uriHasSas = String(!!requestedLinkUri.query.match('[&?]sig='));

        if (requestedLinkUri.scheme === documentSchemes.untitled) {
            properties.openErrorType = 'template not saved';
            return { loadErrorMessage: "Template file needs to be saved" };
        } else if (!path.isAbsolute(requestedLinkUri.fsPath)) {
            properties.openErrorType = 'path not absolute';
            return { loadErrorMessage: "Link uri should be an absolute path" };
        } else if (requestedLinkUri.scheme === documentSchemes.file) {
            // It's a local file.
            // Strip the path of any query string, and use only the local file path
            const localPath = requestedLinkUri.fsPath;

            const result = await tryOpenLocalLinkedFile(localPath, pathType, context);
            if (result.document) {
                properties.openResult = 'Loaded';
            } else {
                const parsedError = parseError(result.loadError);
                properties.openErrorType = parsedError.errorType;
            }

            const loadErrorMessage = result.loadError ? parseError(result.loadError).message : undefined;
            return { loadErrorMessage };
        } else {
            // Something else (http etc).  Try to retrieve the content and return it directly
            try {
                const content = await tryLoadNonLocalLinkedFile(requestedLinkUri, context, true);
                properties.openResult = 'Loaded';
                return { content };
            } catch (error) {
                const parsedError = parseError(error);
                properties.openErrorType = parsedError.errorType;
                return { loadErrorMessage: parsedError.message };
            }
        }
    });
}

export async function tryLoadNonLocalLinkedFile(uri: Uri, context: IActionContext, open: boolean): Promise<string> {
    uri = removeLinkedTemplateScheme(uri);
    let content: string;
    try {
        content = await httpGet(stringifyUri(uri));
    } catch (err) {
        // Improve the error message for downstream, UI doesn't currently know about statusMessage/statusCode
        const error = <Errorish & { statusMessage?: string; statusCode?: number }>err;
        error.message = String(error.message ?? error.statusMessage ?? error.statusCode);
        throw error;
    }

    assert(ext.provideOpenedDocuments, "ext.provideOpenedDocuments");
    const newUri = prependLinkedTemplateScheme(uri);

    // We need to place it into our docs immediately because our text document content provider will be queried
    // for content before we get the document open event
    const dt = new DeploymentTemplateDoc(content, newUri, 0);
    ext.provideOpenedDocuments.setOpenedDeploymentDocument(newUri, dt);

    if (open) {
        const doc = await workspace.openTextDocument(newUri);
        setLangIdToArm(doc, context);
    }

    return content;
}

/**
 * Attempts to load the given file into a text document in VS Code so that
 * it will get sent to the language server.
 * <remarks>This function should not throw
 */
async function tryOpenLocalLinkedFile(
    localPath: string,
    pathType: PathType,
    context: IActionContext
): Promise<OpenLinkedFileResult> {
    try {
        // Check first if the path exists, so we get a better error message if not
        if (!(await pathExists(localPath))) {
            return {
                loadError: <Errorish>new LinkedTemplatePathNotFoundError(
                    pathType === PathType.parametersLink ?
                        `Linked parameter not found: "${localPath}"` :
                        `Linked template file not found: "${localPath}"`
                )
            };
        }

        // Load into a text document (this does not cause the document to be shown)
        // Note: If the URI is already opened, this returns the existing document
        const document = await workspace.openTextDocument(localPath);
        // ext.outputChannel.appendLine(`... Opened linked file ${localPath}, langid = ${document.languageId}`);
        if (document.languageId !== armTemplateLanguageId) {
            // ext.outputChannel.appendLine(`... Setting langid to ${armTemplateLanguageId}`);
            context.telemetry.properties.isLinkedTemplate = 'true';
            setLangIdToArm(document, context);
        }

        // No errors
        return { document };
    } catch (err) {
        ext.outputChannel.appendLine(`... Failed loading ${localPath}: ${parseError(err).message}`);
        return { loadError: <Errorish>err };
    }
}

/**
 * Propagates the given template graph information as received from the language server into the scopes
 * in the deployment template, where they can be accessed as needed.
 */
export function assignTemplateGraphToDeploymentTemplate(
    graph: INotifyTemplateGraphArgs,
    dt: DeploymentTemplateDoc,
    provideOpenDocuments: IProvideOpenedDocuments
): void {
    assert(normalizeUri(parseUri(graph.rootTemplateUri)) === normalizeUri(dt.documentUri));
    // tslint:disable-next-line: strict-boolean-expressions
    assert(!!graph.fullValidationStatus, "assignTemplateGraphToDeploymentTemplate: graph.fullValidationStatus should never be undefined");

    // Clear current
    const linkedScopes = filterByType(dt.allScopes, LinkedTemplateScope);
    for (const linkReference of graph.linkedTemplates) {
        const linkPositionInTemplate = dt.getDocumentCharacterIndex(
            linkReference.lineNumberInParent,
            linkReference.columnNumberInParent,
            {
                // The position of the link refers to a previous version of the document, so get the
                // closest position without throwing an error
                allowOutOfBounds: true
            }
        );

        // Since templated deployments can't have children (in the defining document), there can be at most one linked deployment scope whose defining
        //   resource contains the location
        const matchingScope = linkedScopes.find(scope => scope.owningDeploymentResource.span.contains(linkPositionInTemplate, ContainsBehavior.enclosed));
        if (matchingScope) {
            matchingScope.assignLinkedFileReferences([linkReference], provideOpenDocuments);
        }
    }

    dt.templateGraph = graph;
}

/**
 * This is the executed when the user clicks on a linked template code lens so open the linked file
 */
export async function openLinkedTemplateFileCommand(linkedTemplateUri: Uri, actionContext: IActionContext): Promise<void> {
    let targetUri: Uri;
    actionContext.telemetry.properties.scheme = linkedTemplateUri.scheme;
    actionContext.telemetry.properties.uriHasQuery = String(!!linkedTemplateUri.query);
    actionContext.telemetry.properties.uriHasSas = String(!!linkedTemplateUri.query.match('[&?]sig='));

    if (linkedTemplateUri.scheme === documentSchemes.file) {
        const exists = await pathExists(linkedTemplateUri);
        actionContext.telemetry.properties.exists = String(exists);
        if (!exists) {
            const fsPath = linkedTemplateUri.fsPath;
            const response = await ext.ui.showWarningMessage(
                `Could not find file "${fsPath}".  Do you want to create it?`,
                DialogResponses.yes,
                DialogResponses.cancel);
            if (response === DialogResponses.yes) {
                await fse.mkdirs(path.dirname(fsPath));
                await fse.writeFile(fsPath, "", {});
            } else {
                return;
            }
        }

        targetUri = linkedTemplateUri;
    } else {
        targetUri = prependLinkedTemplateScheme(linkedTemplateUri);
    }

    const doc = await workspace.openTextDocument(targetUri);
    setLangIdToArm(doc, actionContext);
    await window.showTextDocument(doc);
}

export async function reloadLinkedTemplateFileCommand(linkedTemplateUri: Uri, actionContext: IActionContext): Promise<void> {
    let targetUri: Uri;
    actionContext.telemetry.properties.scheme = linkedTemplateUri.scheme;

    if (linkedTemplateUri.scheme === documentSchemes.file) {
        const exists = await pathExists(linkedTemplateUri);
        actionContext.telemetry.properties.exists = String(exists);
        if (!exists) {
            const fsPath = linkedTemplateUri.fsPath;
            const response = await ext.ui.showWarningMessage(
                `Could not find file "${fsPath}".  Do you want to create it?`,
                DialogResponses.yes,
                DialogResponses.cancel);
            if (response === DialogResponses.yes) {
                await fse.writeFile(fsPath, "", {});
            } else {
                return;
            }
        }

        targetUri = linkedTemplateUri;
    } else {
        targetUri = prependLinkedTemplateScheme(linkedTemplateUri);
    }

    const doc = await workspace.openTextDocument(targetUri);
    setLangIdToArm(doc, actionContext);
    await window.showTextDocument(doc);
}

/**
 * Diagnostics that point to non-file URIs need to use our custom "linked-template:" schema
 * because vscode doesn't natively support navigating to non-file URIs.
 */
export function convertDiagnosticUrisToLinkedTemplateSchema(diagnostic: Diagnostic): void {
    if (diagnostic.relatedInformation) {
        for (const ri of diagnostic.relatedInformation) {
            if (ri.location.uri.scheme !== documentSchemes.file) {
                ri.location.uri = prependLinkedTemplateScheme(ri.location.uri);
            }
        }
    }
}
