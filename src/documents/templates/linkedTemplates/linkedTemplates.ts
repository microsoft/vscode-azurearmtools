// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as path from 'path';
import { commands, DocumentLink, TextDocument, Uri, workspace } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext, parseError, TelemetryProperties } from "vscode-azureextensionui";
import { armTemplateLanguageId } from '../../../constants';
import { Errorish } from '../../../Errorish';
import { ext } from "../../../extensionVariables";
import { assert } from '../../../fixed_assert';
import { IProvideOpenedDocuments } from '../../../IProvideOpenedDocuments';
import { ContainsBehavior } from "../../../language/Span";
import { normalizePath } from '../../../util/normalizePath';
import { ofType } from '../../../util/ofType';
import { pathExists } from '../../../util/pathExists';
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
export interface IRequestOpenLinkedFileResult {
    loadErrorMessage: string | undefined;
}

enum PathType {
    templateLink = 0,
    templateRelativeLink = 1,
    parametersLink = 2,
}

export interface INotifyTemplateGraphArgs {
    rootTemplateUri: string;
    linkedTemplates: ILinkedTemplateReference[];
    fullValidationEnabled: boolean;
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
        }>context.telemetry.properties;
        properties.openErrorType = '';
        properties.openResult = 'Error';

        const requestedLinkResolvedPathParsed: Uri = Uri.parse(requestedLinkResolvedUri, true);

        assert(path.isAbsolute(requestedLinkResolvedPathParsed.fsPath), "Internal error: requestedLinkUri should be an absolute path");

        // Strip the path of any query string, and use only the local file path
        const localPath = requestedLinkResolvedPathParsed.fsPath;

        const result = await tryOpenLinkedFile(localPath, pathType, context);
        if (result.document) {
            properties.openResult = 'Loaded';
        } else {
            const parsedError = parseError(result.loadError);
            properties.openErrorType = parsedError.errorType;
        }

        const loadErrorMessage = result.loadError ? parseError(result.loadError).message : undefined;
        return { loadErrorMessage };
    });
}

/**
 * Attempts to load the given file into a text document in VS Code so that
 * it will get sent to the language server.
 * <remarks>This function should not throw
 */
async function tryOpenLinkedFile(
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
        ext.outputChannel.appendLine(`... Opened linked file ${localPath}, langid = ${document.languageId}`);
        if (document.languageId !== armTemplateLanguageId) {
            ext.outputChannel.appendLine(`... Setting langid to ${armTemplateLanguageId}`);
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
    assert(normalizePath(Uri.parse(graph.rootTemplateUri)) === normalizePath(dt.documentUri));

    // Clear current
    const linkedScopes = ofType(dt.allScopes, LinkedTemplateScope);
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
}

export async function openLinkedTemplateFile(linkedTemplateUri: Uri): Promise<void> {
    const args = <DocumentLink>{
        target: linkedTemplateUri
    };
    await commands.executeCommand("editor.action.openLink", args);
}
