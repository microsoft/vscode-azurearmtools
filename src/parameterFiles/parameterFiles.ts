// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as path from 'path';
import { commands, MessageItem, TextDocument, Uri, ViewColumn, window, workspace } from 'vscode';
import { callWithTelemetryAndErrorHandling, DialogResponses, IActionContext, IAzureQuickPickItem, UserCancelledError } from 'vscode-azureextensionui';
import { configKeys, configPrefix, globalStateKeys } from '../constants';
import { DeploymentTemplate } from '../DeploymentTemplate';
import { ext } from '../extensionVariables';
import { queryCreateParameterFile } from '../parameterFileGeneration';
import { containsParametersSchema } from '../schemas';
import { normalizePath } from '../util/normalizePath';
import { DeploymentFileMapping } from './DeploymentFileMapping';

const readAtMostBytesToFindParamsSchema = 4 * 1024;
const currentMessage = "Current";
const similarFilenameMessage = "Similar filename";
const fileNotFoundMessage = "File not found";
const howToMessage = `You can manually associate a parameter file with this template at any time by clicking "Select Parameter File..." in the status bar or the editor context menu.`;

// Not worrying about Win32 case-insensitivity here because
// it's this vscode instance and local only and thus likely to be the
// same casing whenever it's loaded. Also, consequences of being wrong
// are minor.
const _filesToIgnoreThisSession: Set<string> = new Set<string>();

interface IPossibleParameterFile {
  uri: Uri;
  friendlyPath: string;
  isCloseNameMatch: boolean;
  fileNotFound?: boolean;
}

// tslint:disable-next-line: max-func-body-length
export async function selectParameterFile(actionContext: IActionContext, mapping: DeploymentFileMapping, sourceUri: Uri | undefined): Promise<void> {
  if (!sourceUri) {
    sourceUri = window.activeTextEditor?.document.uri;
  }
  if (!sourceUri) {
    await ext.ui.showWarningMessage(`No Azure Resource Manager template file is being edited.`);
    return;
  }

  let templateUri: Uri = sourceUri;

  // Verify it's a template file (have to read in entire file to do full validation)
  const contents = (await fse.readFile(templateUri.fsPath, { encoding: "utf8" })).toString();
  const template: DeploymentTemplate = new DeploymentTemplate(contents, Uri.file("Check file is template"));
  if (!template.hasArmSchemaUri()) {
    throw new Error(`"${templateUri.fsPath}" does not appear to be an Azure Resource Manager deployment template file.`);
  }

  let quickPickList: IQuickPickList = await createParameterFileQuickPickList(mapping, templateUri);
  // Show the quick pick
  const result: IAzureQuickPickItem<IPossibleParameterFile | undefined> = await ext.ui.showQuickPick(
    quickPickList.items,
    {
      canPickMany: false,
      placeHolder: `Select a parameter file to associate with "${path.basename(templateUri.fsPath)}"`,
      suppressPersistence: true
    });

  // Interpret result
  if (result === quickPickList.none) {
    // None

    // Remove the mapping for this file
    await neverAskAgain(templateUri, actionContext);
    await mapping.mapParameterFile(templateUri, undefined);
  } else if (result === quickPickList.browse) {
    // Browse...

    const paramsPaths: Uri[] | undefined = await window.showOpenDialog({
      canSelectMany: false,
      defaultUri: templateUri,
      openLabel: "Select Parameter File"
    });
    if (!paramsPaths || paramsPaths.length !== 1) {
      throw new UserCancelledError();
    }
    const selectedParamsPath: Uri = paramsPaths[0];

    if (!await isParameterFile(selectedParamsPath.fsPath)) {
      const selectAnywayResult = await ext.ui.showWarningMessage(
        `"${selectedParamsPath.fsPath}" does not appear to be a valid parameter file. Select it anyway?`,
        { modal: true },
        DialogResponses.yes,
        DialogResponses.no
      );
      if (selectAnywayResult !== DialogResponses.yes) {
        throw new UserCancelledError();
      }
    }

    await neverAskAgain(templateUri, actionContext);

    // Map to the browsed file
    await mapping.mapParameterFile(templateUri, selectedParamsPath);
  } else if (result === quickPickList.newFile) {
    // New parameter file

    let newUri: Uri = await queryCreateParameterFile(actionContext, templateUri, template);
    await mapping.mapParameterFile(templateUri, newUri);
    await commands.executeCommand('azurerm-vscode-tools.openParameterFile', templateUri, newUri);
  } else if (result === quickPickList.openCurrent) {
    // Open current

    await commands.executeCommand('azurerm-vscode-tools.openParameterFile', templateUri);
  } else if (result.data === quickPickList.currentParamFile) {
    // Current re-selected

    // Nothing to change
    dontAskAgainThisSession(templateUri, actionContext);
  } else {
    // Item in the list selected

    assert(result.data, "Quick pick item should have had data");
    await neverAskAgain(templateUri, actionContext);
    await mapping.mapParameterFile(templateUri, result.data?.uri);
  }
}

export async function openParameterFile(mapping: DeploymentFileMapping, templateUri: Uri | undefined, parameterUri: Uri | undefined): Promise<void> {
  if (templateUri) {
    let paramFile: Uri | undefined = parameterUri || mapping.getParameterFile(templateUri);
    if (!paramFile) {
      throw new Error(`There is no parameter file currently associated with template file "${templateUri.fsPath}"`);
    }

    let doc: TextDocument = await workspace.openTextDocument(paramFile);
    await window.showTextDocument(doc, ViewColumn.Beside);
  }
}

export async function openTemplateFile(mapping: DeploymentFileMapping, parameterUri: Uri | undefined, templateUri: Uri | undefined): Promise<void> {
  if (parameterUri) {
    let templateFile: Uri | undefined = templateUri || mapping.getTemplateFile(parameterUri);
    if (!templateFile) {
      throw new Error(`There is no template file currently associated with parameter file "${parameterUri.fsPath}"`);
    }

    let doc: TextDocument = await workspace.openTextDocument(templateFile);
    await window.showTextDocument(doc);
  }
}

/**
 * If the file is inside the workspace folder, use the path relative to that, otherwise
 * use the absolute path.  This is intended for UI only.
 */
export function getFriendlyPathToFile(uri: Uri): string {
  const workspaceFolder = workspace.getWorkspaceFolder(uri); //asdftestpoint

  if (workspaceFolder) {
    return path.relative(path.dirname(workspaceFolder.uri.fsPath), uri.fsPath);
  } else {
    return uri.fsPath;
  }
}

export function getRelativeParameterFilePath(templateUri: Uri, parameterUri: Uri): string {
  const templatePath = normalizePath(templateUri);
  const paramPath = normalizePath(parameterUri);

  return path.relative(path.dirname(templatePath), paramPath);
}

export function resolveParameterFilePath(templatePath: string, parameterPathRelativeToTemplate: string): string {
  assert(path.isAbsolute(templatePath));
  const resolved = path.resolve(path.dirname(templatePath), parameterPathRelativeToTemplate);
  return resolved;
}

interface IQuickPickList {
  items: IAzureQuickPickItem<IPossibleParameterFile | undefined>[];
  currentParamFile: IPossibleParameterFile | undefined;
  none: IAzureQuickPickItem<IPossibleParameterFile | undefined>;
  newFile: IAzureQuickPickItem<IPossibleParameterFile | undefined>;
  browse: IAzureQuickPickItem<IPossibleParameterFile | undefined>;
  openCurrent: IAzureQuickPickItem<IPossibleParameterFile | undefined>;
}

async function createParameterFileQuickPickList(mapping: DeploymentFileMapping, templateUri: Uri): Promise<IQuickPickList> {
  // Find likely parameter file matches
  let suggestions: IPossibleParameterFile[] = await findSuggestedParameterFiles(templateUri);

  // Find the current in that list
  const currentParamUri: Uri | undefined = mapping.getParameterFile(templateUri);
  const currentParamPathNormalized: string | undefined = currentParamUri ? normalizePath(currentParamUri) : undefined;
  let currentParamFile: IPossibleParameterFile | undefined = suggestions.find(pf => normalizePath(pf.uri) === currentParamPathNormalized);
  if (currentParamUri && !currentParamFile) {
    // There is a current parameter file, but it wasn't among the list we came up with.  We must add it to the list.
    currentParamFile = { isCloseNameMatch: false, uri: currentParamUri, friendlyPath: getRelativeParameterFilePath(templateUri, currentParamUri) };
    let exists = false;
    try {
      exists = await fse.pathExists(currentParamUri.fsPath);
    } catch (err) {
      // Ignore
    }
    currentParamFile.fileNotFound = !exists;

    suggestions = suggestions.concat(currentParamFile);
  }

  // Create initial pick list and sort it
  let pickItems: IAzureQuickPickItem<IPossibleParameterFile | undefined>[] = suggestions.map(paramFile => createQuickPickItem(paramFile, currentParamFile, templateUri));
  sortQuickPickList(pickItems);

  // Move the current item (if any) to the top
  const currentItem = pickItems.find(pi => pi.data === currentParamFile);
  if (currentItem) {
    // tslint:disable-next-line: no-any
    pickItems = [currentItem].concat(pickItems.filter(ppf => ppf !== currentItem));
  }

  // Add None at top, New/Browse/Open Current at bottom
  const none: IAzureQuickPickItem<IPossibleParameterFile | undefined> = {
    label: "$(circle-slash) None",
    description: !!currentParamUri ? undefined : currentMessage,
    data: undefined
  };
  const browse: IAzureQuickPickItem<IPossibleParameterFile | undefined> = {
    label: '$(file-directory) Browse...',
    data: undefined
  };
  const openCurrent: IAzureQuickPickItem<IPossibleParameterFile | undefined> = {
    label: '$(go-to-file) Open Current',
    data: undefined
  };
  const newFile: IAzureQuickPickItem<IPossibleParameterFile | undefined> = {
    label: '$(new-file) New...',
    data: undefined
  };
  pickItems = [none].concat(pickItems).concat([newFile, browse]);

  if (currentItem) {
    pickItems = pickItems.concat([openCurrent]);
  }

  return {
    items: pickItems,
    currentParamFile,
    none,
    browse,
    openCurrent,
    newFile
  };
}

function sortQuickPickList(pickItems: IAzureQuickPickItem<IPossibleParameterFile | undefined>[]): void {
  pickItems.sort((a, b) => {
    const aData = a?.data;
    const bData = a?.data;

    // Close name matches go first
    if (a?.data?.isCloseNameMatch !== b?.data?.isCloseNameMatch) {
      return a?.data?.isCloseNameMatch ? -1 : 1;
    }

    // Otherwise compare filenames
    // tslint:disable-next-line: strict-boolean-expressions
    return (aData?.uri.fsPath || "").localeCompare(bData?.uri.fsPath || "");
  });
}

function createQuickPickItem(paramFile: IPossibleParameterFile, current: IPossibleParameterFile | undefined, templateUri: Uri): IAzureQuickPickItem<IPossibleParameterFile> {
  const isCurrent: boolean = paramFile === current;
  return {
    label: `${isCurrent ? '$(check) ' : '$(json) '} ${paramFile.friendlyPath}`,
    data: paramFile,
    description: isCurrent ? currentMessage
      : paramFile.fileNotFound ? fileNotFoundMessage
        : paramFile.isCloseNameMatch ? similarFilenameMessage
          : undefined
  };
}

/**
 * Finds parameter files to suggest for a given template.
 */
export async function findSuggestedParameterFiles(templateUri: Uri): Promise<IPossibleParameterFile[]> {
  let paths: IPossibleParameterFile[] = [];

  return await callWithTelemetryAndErrorHandling('findSuggestedParameterFiles', async (actionContext: IActionContext) => {
    actionContext.errorHandling.rethrow = false;

    // Current logic is simple: Find all .json/c files in the same folder as the template file and check
    //   if they're a parameter file
    try {
      const folder = path.dirname(templateUri.fsPath);
      const fileNames: string[] = await fse.readdir(folder);
      for (let paramFileName of fileNames) {
        const fullPath: string = path.join(folder, paramFileName);
        const uri: Uri = Uri.file(fullPath);
        if (await isParameterFile(fullPath)) {
          paths.push({
            uri,
            friendlyPath: getRelativeParameterFilePath(templateUri, uri), //asdf
            isCloseNameMatch: mayBeMatchingParameterFile(templateUri.fsPath, fullPath)
          });
        }
      }
    } catch (error) {
      // Ignore
    }

    return paths;
  })
    // tslint:disable-next-line: strict-boolean-expressions
    || [];
}

async function isParameterFile(filePath: string): Promise<boolean> {
  try {
    if (!hasSupportedParameterFileExtension(filePath)) {
      return false;
    }

    if (await doesFileContainString(filePath, containsParametersSchema, readAtMostBytesToFindParamsSchema)) {
      return true;
    }
  } catch (error) {
    // Ignore
  }

  return false;
}

async function doesFileContainString(filePath: string, matches: (fileSubcontents: string) => boolean, maxBytesToRead: number): Promise<boolean> {
  // tslint:disable-next-line: typedef
  return new Promise<boolean>((resolve, reject) => {
    const stream = fse.createReadStream(filePath, { encoding: 'utf8' });

    let content: string = '';
    stream.on('data', (chunk: string) => {
      content += chunk;
      if (matches(content)) {
        stream.close();
        resolve(true);
      }

      if (content.length >= maxBytesToRead) {
        stream.close();
        resolve(false);
      }
    });
    stream.on('end', () => {
      resolve(false);
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Determines if a file is likely a parameter file for the given template file, based on name.
 * Common patterns are:
 *   template.json, template.params.json
 *   template.json, template.parameters.json
 */
export function mayBeMatchingParameterFile(templateFileName: string, parameterFileName: string): boolean {
  if (!hasSupportedParameterFileExtension(parameterFileName)) {
    return false;
  }

  const baseTemplateName = removeAllExtensions(path.basename(templateFileName)).toLowerCase();
  const baseParamsName = removeAllExtensions(path.basename(parameterFileName)).toLowerCase();

  return baseParamsName.startsWith(baseTemplateName);
}

function removeAllExtensions(fileName: string): string {
  return fileName.replace(/\..+$/, '');
}

/**
 * Search for potential parameter file matches for the given document, and ask the user if appropriate whether to associate it
 */
export function considerQueryingForParameterFile(mapping: DeploymentFileMapping, document: TextDocument): void {
  // Only deal with saved files, because we don't have an accurate
  //   URI that we can track for unsaved files, and it's a better user experience.
  if (document.uri.scheme !== 'file') {
    return;
  }

  const templateUri = document.uri;
  const templatPath = templateUri.fsPath;
  const alreadyHasParamFile: boolean = !!mapping.getParameterFile(document.uri);

  // tslint:disable-next-line: no-floating-promises Don't wait
  callWithTelemetryAndErrorHandling('queryAddParameterFile', async (actionContext: IActionContext): Promise<void> => {
    actionContext.telemetry.properties.alreadyHasParamFile = String(alreadyHasParamFile);

    if (alreadyHasParamFile) {
      return;
    }

    if (!canAsk(templateUri, actionContext)) {
      return;
    }

    const suggestions = await findSuggestedParameterFiles(document.uri);
    const closeMatches = suggestions.filter(pf => pf.isCloseNameMatch);
    actionContext.telemetry.measurements.closeMatches = closeMatches.length;
    // Take the shortest as the most likely best match
    const closestMatch: IPossibleParameterFile | undefined = closeMatches.length > 0 ? closeMatches.sort(pf => -pf.uri.fsPath.length)[0] : undefined;
    if (!closestMatch) {
      // No likely matches, so don't ask
      return;
    }

    const yes: MessageItem = { title: "Yes" };
    const no: MessageItem = { title: "No" };
    const another: MessageItem = { title: "Choose File..." };

    const response: MessageItem | undefined = await window.showInformationMessage(
      `A parameter file "${closestMatch.friendlyPath}" has been detected. Do you want to associate it with template file "${path.basename(templatPath)}"? Having a parameter file association enables additional functionality, such as more complete validation.`,
      yes,
      no,
      another
    );
    if (!response) {
      actionContext.telemetry.properties.response = 'Canceled';
      throw new UserCancelledError();
    }

    actionContext.telemetry.properties.response = response.title;

    switch (response.title) {
      case yes.title:
        await mapping.mapParameterFile(templateUri, closestMatch.uri);
        break;
      case no.title:
        // We won't ask again
        await neverAskAgain(templateUri, actionContext);

        // Let them know how to do it manually
        // Don't wait for an answer
        window.showInformationMessage(howToMessage);
        break;
      case another.title:
        await commands.executeCommand("azurerm-vscode-tools.selectParameterFile", templateUri);
        break;
      default:
        assert("considerQueryingForParameterFile: Unexpected response");
        break;
    }
  });
}

function canAsk(templateUri: Uri, actionContext: IActionContext): boolean {
  const checkForMatchingParamFilesSetting: boolean = !!workspace.getConfiguration(configPrefix).get<boolean>(configKeys.checkForMatchingParameterFiles);
  actionContext.telemetry.properties.checkForMatchingParamFiles = String(checkForMatchingParamFilesSetting);
  if (!checkForMatchingParamFilesSetting) {
    return false;
  }

  // tslint:disable-next-line: strict-boolean-expressions
  const neverAskFiles: string[] = ext.context.globalState.get<string[]>(globalStateKeys.dontAskAboutParameterFiles) || [];
  const key = normalizePath(templateUri);
  if (neverAskFiles.includes(key)) {
    actionContext.telemetry.properties.isInDontAskList = 'true';
    return false;
  }

  let ignoreThisSession = _filesToIgnoreThisSession.has(normalizePath(templateUri));
  if (ignoreThisSession) {
    actionContext.telemetry.properties.ignoreThisSession = 'true';
    return false;
  }

  return true;
}

function dontAskAgainThisSession(templateUri: Uri, actionContext: IActionContext): void {
  _filesToIgnoreThisSession.add(normalizePath(templateUri));
}

async function neverAskAgain(templateUri: Uri, actionContext: IActionContext): Promise<void> {
  // tslint:disable-next-line: strict-boolean-expressions
  const neverAskFiles: string[] = ext.context.globalState.get<string[]>(globalStateKeys.dontAskAboutParameterFiles) || [];
  const key: string = normalizePath(templateUri);
  neverAskFiles.push(key);
  await ext.context.globalState.update(globalStateKeys.dontAskAboutParameterFiles, neverAskFiles);
}

function hasSupportedParameterFileExtension(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.json' || extension === '.jsonc';
}
