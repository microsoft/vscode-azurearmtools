// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-var-keyword // Grandfathered in
// tslint:disable:no-duplicate-variable // Grandfathered in
// tslint:disable: no-parameter-reassignment // Grandfathered in

// tslint:disable:no-increment-decrement

import * as path from 'path';
import * as vscode from "vscode";
import { armTemplateLanguageId, iconsPath, templateKeys } from "./constants";
import { assert } from './fixed_assert';
import * as Json from "./JSON";

const topLevelIcons: [string, string][] = [
    ["$schema", "label.svg"],
    ["version", "label.svg"],
    ["contentVersion", "label.svg"],
    ["handler", "label.svg"],
    [templateKeys.parameters, "parameters.svg"],
    [templateKeys.variables, "variables.svg"],
    [templateKeys.functions, "functions.svg"],
    ["resources", "resources.svg"],
    ["outputs", "outputs.svg"],
];

const topLevelChildIconsByRootNode: [string, string][] = [
    [templateKeys.parameters, "parameters.svg"],
    [templateKeys.variables, "variables.svg"],
    ["outputs", "outputs.svg"],
];

const functionIcons: [string, string][] = [
    [templateKeys.parameters, "parameters.svg"],
    ["output", "outputs.svg"],
];

const resourceIcons: [string, string][] = [
    ["Microsoft.Automation/automationAccounts", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/certificates", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/compilationjobs", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/configurations", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/connectionTypes", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/connections", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/credentials", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/jobSchedules", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/jobs", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/modules", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/nodeConfigurations", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/python2Packages", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/runbooks", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/schedules", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/softwareUpdateConfigurations", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/sourceControls", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/sourceControls/sourceControlSyncJobs", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/variables", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/watchers", "automation.svg"],
    ["Microsoft.Automation/automationAccounts/webhooks", "automation.svg"],
    ["Microsoft.Cdn/profiles", "cdnprofiles.svg"],
    ["Microsoft.Compute/virtualMachines", "virtualmachines.svg"],
    ["Microsoft.Compute/virtualMachines/extensions", "extensions.svg"],
    ["Microsoft.ContainerInstance/containerGroups", "containerinstances.svg"],
    ["Microsoft.DocumentDB/databaseAccounts", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/databases", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/databases/collections", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/databases/containers", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/databases/graphs", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/keyspaces", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/apis/tables", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/cassandraKeyspaces", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/gremlinDatabases", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/sqlDatabases", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/storedProcedures", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/triggers", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/userDefinedFunctions", "cosmosdb.svg"],
    ["Microsoft.DocumentDB/databaseAccounts/tables", "cosmosdb.svg"],
    ["Microsoft.Insights/QueryPacks/queries", "applicationinsights.svg"],
    ["Microsoft.Insights/actionGroups", "applicationinsights.svg"],
    ["Microsoft.Insights/activityLogAlerts", "applicationinsights.svg"],
    ["Microsoft.Insights/alertrules", "applicationinsights.svg"],
    ["Microsoft.Insights/autoscalesettings", "applicationinsights.svg"],
    ["Microsoft.Insights/components", "applicationinsights.svg"],
    ["Microsoft.Insights/components/ProactiveDetectionConfigs", "applicationinsights.svg"],
    ["Microsoft.Insights/diagnosticSettings", "applicationinsights.svg"],
    ["Microsoft.Insights/guestDiagnosticSettings", "applicationinsights.svg"],
    ["Microsoft.Insights/guestDiagnosticSettingsAssociation", "applicationinsights.svg"],
    ["Microsoft.Insights/logprofiles", "applicationinsights.svg"],
    ["Microsoft.Insights/metricAlerts", "applicationinsights.svg"],
    ["Microsoft.Insights/queryPacks", "applicationinsights.svg"],
    ["Microsoft.Insights/scheduledQueryRules", "applicationinsights.svg"],
    ["Microsoft.Insights/webtests", "applicationinsights.svg"],
    ["Microsoft.Insights/workbooks", "applicationinsights.svg"],
    ["Microsoft.KeyVault/vaults", "keyvaults.svg"],
    ["Microsoft.KeyVault/vaults/secrets", "keyvaults.svg"],
    ["Microsoft.Media/mediaServices", "mediaservices.svg"],
    ["Microsoft.Network/azureFirewalls", "firewall.svg"],
    ["Microsoft.Network/networkInterfaces", "nic.svg"],
    ["Microsoft.Network/networkSecurityGroups", "nsg.svg"],
    ["Microsoft.Network/networkSecurityGroups/securityRules", "nsg.svg"],
    ["Microsoft.Network/publicIPAddresses", "publicip.svg"],
    ["Microsoft.Network/publicIPPrefixes", "publicip.svg"],
    ["Microsoft.Network/routeTables/routes", "routetables.svg"],
    ["Microsoft.Network/trafficManagerProfiles", "trafficmanagerprofiles.svg"],
    ["Microsoft.Network/virtualNetworkGateways", "virtualnetworkgateways.svg"],
    ["Microsoft.Network/virtualNetworks", "virtualnetworks.svg"],
    ["Microsoft.Sql/instancePools", "sqlservers.svg"],
    ["Microsoft.Sql/locations/instanceFailoverGroups", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/administrators", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases/backupShortTermRetentionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases/schemas/tables/columns/sensitivityLabels", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases/securityAlertPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases/vulnerabilityAssessments", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/databases/vulnerabilityAssessments/rules/baselines", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/encryptionProtector", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/keys", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/restorableDroppedDatabases/backupShortTermRetentionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/securityAlertPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/managedInstances/vulnerabilityAssessments", "sqlservers.svg"],
    ["Microsoft.Sql/servers", "sqlservers.svg"],
    ["Microsoft.Sql/servers/administrators", "sqlservers.svg"],
    ["Microsoft.Sql/servers/auditingSettings", "sqlservers.svg"],
    ["Microsoft.Sql/servers/backupLongTermRetentionVaults", "sqlservers.svg"],
    ["Microsoft.Sql/servers/communicationLinks", "sqlservers.svg"],
    ["Microsoft.Sql/servers/connectionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/auditingSettings", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/backupLongTermRetentionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/connectionPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/dataMaskingPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/dataMaskingPolicies/rules", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/extendedAuditingSettings", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/extensions", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/geoBackupPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/schemas/tables/columns/sensitivityLabels", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/securityAlertPolicies	", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/syncGroups", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/syncGroups/syncMembers", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/transparentDataEncryption", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/vulnerabilityAssessments", "sqlservers.svg"],
    ["Microsoft.Sql/servers/databases/vulnerabilityAssessments/rules/baselines", "sqlservers.svg"],
    ["Microsoft.Sql/servers/disasterRecoveryConfiguration", "sqlservers.svg"],
    ["Microsoft.Sql/servers/dnsAliases", "sqlservers.svg"],
    ["Microsoft.Sql/servers/elasticPools", "sqlservers.svg"],
    ["Microsoft.Sql/servers/encryptionProtector", "sqlservers.svg"],
    ["Microsoft.Sql/servers/extendedAuditingSettings", "sqlservers.svg"],
    ["Microsoft.Sql/servers/failoverGroups", "sqlservers.svg"],
    ["Microsoft.Sql/servers/firewallRules", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents/credentials", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents/jobs", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents/jobs/executions", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents/jobs/steps", "sqlservers.svg"],
    ["Microsoft.Sql/servers/jobAgents/targetGroups", "sqlservers.svg"],
    ["Microsoft.Sql/servers/keys", "sqlservers.svg"],
    ["Microsoft.Sql/servers/privateEndpointConnections", "sqlservers.svg"],
    ["Microsoft.Sql/servers/securityAlertPolicies", "sqlservers.svg"],
    ["Microsoft.Sql/servers/syncAgents", "sqlservers.svg"],
    ["Microsoft.Sql/servers/virtualNetworkRules", "sqlservers.svg"],
    ["Microsoft.Sql/servers/vulnerabilityAssessments", "sqlservers.svg"],
    ["Microsoft.Storage/storageAccounts", "storageaccounts.svg"],
    ["Microsoft.Web/sites", "appservices.svg"],
    ["config", "appconfiguration.svg"],
];

export class JsonOutlineProvider implements vscode.TreeDataProvider<string> {
    private tree: Json.ParseResult | undefined;
    private text: string | undefined;

    public readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<string | null> =
        new vscode.EventEmitter<string | null>();
    public readonly onDidChangeTreeData: vscode.Event<string | null> = this.onDidChangeTreeDataEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => this.updateTreeState()));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => this.updateTreeState()));
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => this.updateTreeState()));

        setTimeout(
            () => {
                // In case there is already a document opened before the extension gets loaded.
                this.updateTreeState();
            },
            500);
    }

    public refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(void 0);
    }

    public getChildren(element?: string): string[] {
        // check if there is a visible text editor
        if (vscode.window.visibleTextEditors.length > 0) {
            if (vscode.window.activeTextEditor && this.shouldShowTreeForDocument(vscode.window.activeTextEditor.document)) {

                if (!this.tree) {
                    this.refresh();
                    throw new Error("No tree");
                }

                let result: string[] = [];
                if (!element) {
                    if (this.tree.value instanceof Json.ObjectValue) {
                        // tslint:disable-next-line:one-variable-per-declaration
                        for (let i = 0, il = this.tree.value.properties.length; i < il; i++) {
                            let item = this.getElementInfo(this.tree.value.properties[i]);
                            result.push(item);
                        }
                    }
                } else {
                    let elementInfo = <IElementInfo>JSON.parse(element);
                    let valueNode = elementInfo.current.value.start !== undefined ? this.tree.getValueAtCharacterIndex(elementInfo.current.value.start) : undefined;

                    // Value is an object and is collapsible
                    if (valueNode instanceof Json.ObjectValue && elementInfo.current.collapsible) {

                        // tslint:disable-next-line:one-variable-per-declaration
                        for (let i = 0, il = valueNode.properties.length; i < il; i++) {
                            let item = this.getElementInfo(valueNode.properties[i], elementInfo);
                            result.push(item);

                        }
                    } else if (valueNode instanceof Json.ArrayValue && elementInfo.current.collapsible) {
                        // Array with objects
                        // tslint:disable-next-line:one-variable-per-declaration
                        for (let i = 0, il = valueNode.length; i < il; i++) {
                            let valueElement = valueNode.elements[i];
                            if (valueElement instanceof Json.ObjectValue) {
                                let item = this.getElementInfo(valueElement, elementInfo);
                                result.push(item);
                            }
                        }
                    }
                }

                return result;
            }
        }

        return [];
    }

    public getTreeItem(element: string): vscode.TreeItem {
        const elementInfo: IElementInfo = <IElementInfo>JSON.parse(element);
        const activeTextEditor = vscode.window.activeTextEditor;
        assert(activeTextEditor);
        // tslint:disable-next-line: no-non-null-assertion // Asserted
        const document = activeTextEditor!.document;
        const start = document.positionAt(elementInfo.current.key.start);
        const end = elementInfo.current.value.end !== undefined ? document.positionAt(elementInfo.current.value.end) : start;

        let treeItem: vscode.TreeItem = {
            contextValue: this.getContextValue(elementInfo),
            label: this.getTreeNodeLabel(elementInfo),
            collapsibleState: elementInfo.current.collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            iconPath: this.getIconPath(elementInfo),
            command: {
                arguments: [new vscode.Range(start, end)],
                command: "azurerm-vscode-tools.treeview.goto",
                title: "",
            }
        };

        return treeItem;
    }

    public goToDefinition(range: vscode.Range): void {
        const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        if (editor) {
            // Center the method in the document
            editor.revealRange(range, vscode.TextEditorRevealType.Default);
            // Select the method name
            editor.selection = new vscode.Selection(range.start, range.end);
            // Swap the focus to the editor
            vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
        }
    }

    private parseTree(document?: vscode.TextDocument): void {
        if (document && this.shouldShowTreeForDocument(document)) {
            this.text = document.getText();
            this.tree = Json.parse(this.text);
        }
    }

    /**
     * Retrieves the context value of the tree item, which can be used in the "where" clause of an view/item/context
     * menu, as viewItem == <contextValue>
     */
    private getContextValue(elementInfo: IElementInfo): string | undefined {
        if (elementInfo.current.level === 1) {
            const keyNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);
            if (keyNode instanceof Json.StringValue) {
                return keyNode.unquotedValue;
            }
        }
        return undefined;
    }

    private getTreeNodeLabel(elementInfo: IElementInfo): string {
        const keyNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Key is an object (e.g. a resource object)
        if (keyNode instanceof Json.ObjectValue) {
            // Object contains no elements
            if (keyNode.properties.length === 0) {
                return "{}";
            } else {
                // Object contains elements, look for displayName tag first
                // tslint:disable-next-line: strict-boolean-expressions
                let tags = keyNode.properties.find(p => p.nameValue && p.nameValue.toString().toLowerCase() === 'tags');
                if (tags && tags.value instanceof Json.ObjectValue) {
                    // tslint:disable-next-line: strict-boolean-expressions
                    let displayNameProp = tags.value.properties.find(p => p.nameValue && p.nameValue.toString().toLowerCase() === 'displayname');
                    if (displayNameProp) {
                        let displayName = displayNameProp.value && displayNameProp.value.toString();
                        if (displayName) {
                            return displayName;
                        }
                    }
                }

                let label = this.getLabelFromProperties("name", keyNode);
                if (label !== undefined) {
                    return label;
                }

                label = this.getLabelFromProperties("namespace", keyNode);
                if (label !== undefined) {
                    return label;
                }

                // Object contains elements, but not a name element
                return "{...}";
            }

        } else if (elementInfo.current.value.kind === Json.ValueKind.ArrayValue || elementInfo.current.value.kind === Json.ValueKind.ObjectValue) {
            // The value of the node is an array or object (e.g. properties or resources) - return key as the node label
            return toFriendlyString(keyNode);
        } else if (elementInfo.current.value.start !== undefined) {
            // For other value types, display key and value since they won't be expandable
            const valueNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.current.value.start);

            return `${keyNode instanceof Json.StringValue ? toFriendlyString(keyNode) : "?"}: ${toFriendlyString(valueNode)}`;
        }

        return "";
    }

    private getLabelFromProperties(propertyName: string, keyNode: Json.ObjectValue): string | undefined {
        // tslint:disable-next-line:one-variable-per-declaration
        for (var i = 0, l = keyNode.properties.length; i < l; i++) {
            let props = keyNode.properties[i];
            // If element is found
            if (props.nameValue instanceof Json.StringValue && props.nameValue.toString().toUpperCase() === propertyName.toUpperCase()) {
                let name = toFriendlyString(props.value);
                return shortenTreeLabel(name);
            }
        }
        return undefined;
    }

    /**
     * Returns an IElementInfo that describes either an array element or an object element (a property)
     */
    private getElementInfo(childElement: Json.Property | Json.ObjectValue, elementInfo?: IElementInfo): string {
        let collapsible = false;

        // Is childElement an Object (thus an array element, e.g. a top-level element of "resources")
        if (childElement instanceof Json.ObjectValue) {
            if (childElement.properties.length > 0) {
                collapsible = true;
            }
        } else {
            // Otherwise we're looking at a property (i.e., an object element)

            // Is it a property with an Array value and does it have elements?
            if (childElement.value instanceof Json.ArrayValue && childElement.value.elements.length > 0) {
                // Is the first element in the Array an Object
                if (childElement.value.elements[0].valueKind === Json.ValueKind.ObjectValue) {
                    collapsible = true;
                }
            } else if (childElement.value instanceof Json.ObjectValue && childElement.value.properties.length > 0) {
                collapsible = true;
            }
        }

        let result: IElementInfo = {
            current: {
                key: {
                    start: childElement.startIndex,
                    end: childElement.span.endIndex,
                    kind: undefined,
                },
                value: {
                    start: undefined,
                    end: undefined,
                    kind: undefined,
                },
                level: undefined,
                collapsible: collapsible
            },
            parent: {
                key: {
                    start: undefined,
                    end: undefined,
                    kind: undefined,
                },
                value: {
                    start: undefined,
                    end: undefined,
                    kind: undefined,
                }
            },
            root: {
                key: {
                    start: childElement.startIndex
                }
            }
        };

        if (childElement instanceof Json.Property) {
            result.current.key.kind = childElement.valueKind;
            // tslint:disable-next-line: strict-boolean-expressions
            result.current.value.start = childElement.value ? childElement.value.startIndex : undefined;
            result.current.value.end = childElement.value ? childElement.value.span.afterEndIndex : undefined;
            result.current.value.kind = childElement.value ? childElement.value.valueKind : undefined;
        } else {
            result.current.key.kind = childElement.valueKind;
            result.current.value.start = childElement.startIndex;
            result.current.value.end = childElement.span.afterEndIndex;
            result.current.value.kind = childElement.valueKind;
        }

        // Not a root element
        if (elementInfo) {
            result.parent.key.start = elementInfo.current.key.start;
            result.parent.key.end = elementInfo.current.key.end;
            result.parent.key.kind = elementInfo.current.key.kind;
            result.parent.value.start = elementInfo.current.value.start;
            result.parent.value.end = elementInfo.current.value.end;
            result.root.key.start = elementInfo.root.key.start;
            // tslint:disable-next-line: strict-boolean-expressions
            result.current.level = (elementInfo.current.level || 0) + 1;
        } else {
            result.current.level = 1;
        }

        return JSON.stringify(result);
    }

    private getIcon(icons: [string, string][], itemName: string, defaultIcon: string): string {
        // tslint:disable-next-line: strict-boolean-expressions
        itemName = (itemName || "").toLowerCase();
        let iconItem = icons.find(item => item[0].toLowerCase() === itemName);

        return iconItem ? iconItem[1] : defaultIcon;
    }

    private getIconPath(elementInfo: IElementInfo): string | undefined {

        let icon: string | undefined;
        const keyOrResourceNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Is current element a root element?
        if (elementInfo.current.level === 1) {
            if (keyOrResourceNode) {
                icon = this.getIcon(topLevelIcons, keyOrResourceNode.toString(), "");
            }
        } else if (elementInfo.current.level === 2) {
            // Is current element an element of a root element?

            // Get root value
            const rootNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);
            if (rootNode) {
                icon = this.getIcon(topLevelChildIconsByRootNode, rootNode.toString(), "");
            }
        }

        // If resourceType element is found on resource objects set to specific resourceType Icon or else a default resource icon
        // tslint:disable-next-line: strict-boolean-expressions
        if (elementInfo.current.level && elementInfo.current.level > 1) {
            const rootNode = this.tree && this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);

            if (elementInfo.current.key.kind === Json.ValueKind.ObjectValue &&
                rootNode && rootNode.toString().toUpperCase() === "resources".toUpperCase() && keyOrResourceNode instanceof Json.ObjectValue) {
                // tslint:disable-next-line:one-variable-per-declaration
                for (var i = 0, il = keyOrResourceNode.properties.length; i < il; i++) {
                    const name = keyOrResourceNode.properties[i].nameValue;
                    if (name.toString().toUpperCase() === "type".toUpperCase()) {
                        const value = keyOrResourceNode.properties[i].value;
                        if (value) {
                            let resourceType = value.toString().toUpperCase();
                            icon = this.getIcon(resourceIcons, resourceType, "resources.svg");
                        }
                    }
                }
            }

            if (rootNode && rootNode.toString().toUpperCase() === "functions".toUpperCase()) {
                icon = this.getFunctionsIcon(elementInfo, keyOrResourceNode);
            }
        }

        if (icon) {
            return path.join(iconsPath, icon);
        }

        return undefined;
    }

    private getFunctionsIcon(elementInfo: IElementInfo, node: Json.Value | null | undefined): string | undefined {
        const level: number | undefined = elementInfo.current.level;
        if (!node || level === undefined) {
            return undefined;
        }
        if (level === 5) {
            return this.getIcon(functionIcons, node.toFriendlyString(), "");
        }
        if (!elementInfo.current.collapsible) {
            return undefined;
        }
        if (level < 5) {
            return this.getIcon(topLevelIcons, templateKeys.functions, "");
        }
        if (elementInfo.current.level === 6) {
            return this.getIcon(functionIcons, "parameters", "");
        }
        return undefined;
    }

    private updateTreeState(): void {
        const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
        const document: vscode.TextDocument | undefined = !!activeEditor ? activeEditor.document : undefined;
        this.parseTree(document);
        const showTreeView = !!document && this.shouldShowTreeForDocument(document);

        if (showTreeView) {
            this.refresh();
        }

        this.setTreeViewContext(showTreeView);
    }

    private shouldShowTreeForDocument(document: vscode.TextDocument): boolean {
        // Only show view if the language is set to Azure Resource Manager Template
        return document.languageId === armTemplateLanguageId;
    }

    private setTreeViewContext(visible: boolean): void {
        vscode.commands.executeCommand('setContext', 'showAzureTemplateView', visible);
    }
}

export interface IElementInfo {
    current: {
        key: {
            start: number;
            end: number;
            kind?: Json.ValueKind;
        };
        value: {
            start?: number;
            end?: number;
            kind?: Json.ValueKind;
        };
        level?: number;
        collapsible: boolean;
    };
    parent: {
        key: {
            start?: number;
            end?: number;
            kind?: Json.ValueKind;
        };
        value: {
            start?: number;
            end?: number;
            kind?: Json.ValueKind;
        };
    };
    root: {
        key: {
            start: number;
        };
    };
}

/**
 * Shortens a label in a way intended to keep the important information but make it easier to read
 * and shorter (so you can read more in the limited horizontal space)
 */
export function shortenTreeLabel(label: string): string {
    let originalLabel = label;

    // If it's an expression - starts and ends with [], but doesn't start with [[, and at least one character inside the []
    if (label && label.match(/^\[[^\[].*]$/)) {

        //  variables/parameters('a') -> [a]
        label = label.replace(/(variables|parameters)\('([^']+)'\)/g, '<$2>');

        // concat(x,'y') => x,'y'
        // Repeat multiple times for recursive cases
        // tslint:disable-next-line:no-constant-condition
        while (true) {
            let newLabel = label.replace(/concat\((.*)\)/g, '$1');
            if (label !== newLabel) {
                label = newLabel;
            } else {
                break;
            }
        }

        if (label !== originalLabel) {
            // If we actually made changes, remove the brackets so users don't think this is the exact expression
            return label.substr(1, label.length - 2);
        }
    }

    return originalLabel;
}

function toFriendlyString(value: Json.Value | null | undefined): string {
    if (value instanceof Json.Value) {
        return value.toFriendlyString();
    } else {
        return String(value);
    }
}
