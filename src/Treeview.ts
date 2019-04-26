// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-var-keyword // Grandfathered in
// tslint:disable:no-duplicate-variable // Grandfathered in
// tslint:disable: no-parameter-reassignment // Grandfathered in

// tslint:disable:no-increment-decrement

import * as assert from "assert";
import * as path from 'path';
import * as vscode from "vscode";
import { iconsPath } from "./constants";
import * as Json from "./JSON";
import { isLanguageIdSupported } from "./supported";
import * as Utilities from "./Utilities";

const topLevelIcons: [string, string][] = [
    ["$schema", "label.svg"],
    ["version", "label.svg"],
    ["contentVersion", "label.svg"],
    ["handler", "label.svg"],
    ["parameters", "parameters.svg"],
    ["variables", "variables.svg"],
    ["resources", "resources.svg"],
    ["outputs", "outputs.svg"],
];

const topLevelChildIconsByRootNode: [string, string][] = [
    ["parameters", "parameters.svg"],
    ["variables", "variables.svg"],
    ["outputs", "outputs.svg"],
];

const resourceIcons: [string, string][] = [
    ["Microsoft.Compute/virtualMachines", "virtualmachines.svg"],
    ["Microsoft.Storage/storageAccounts", "storageaccounts.svg"],
    ["Microsoft.Network/virtualNetworks", "virtualnetworks.svg"],
    ["Microsoft.Compute/virtualMachines/extensions", "extensions.svg"],
    ["Microsoft.Network/networkSecurityGroups", "nsg.svg"],
    ["Microsoft.Network/networkInterfaces", "nic.svg"],
    ["Microsoft.Network/publicIPAddresses", "publicip.svg"]
];

export class JsonOutlineProvider implements vscode.TreeDataProvider<string> {
    private tree: Json.ParseResult;
    private text: string;

    public readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<string | null> =
        new vscode.EventEmitter<string | null>();
    public readonly onDidChangeTreeData: vscode.Event<string | null> = this.onDidChangeTreeDataEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => this.updateTreeState()));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => this.updateTreeState()));

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
            if (isLanguageIdSupported(vscode.window.activeTextEditor.document.languageId)) {

                if (!this.tree) {
                    this.refresh();
                    assert(this.tree, "No tree");
                }

                let result = [];
                if (!element) {
                    if (this.tree.value instanceof Json.ObjectValue) {
                        for (let i = 0, il = this.tree.value.properties.length; i < il; i++) {
                            let item = this.getElementInfo(this.tree.value.properties[i]);
                            result.push(item);
                        }
                    }
                } else {
                    let elementInfo = <IElementInfo>JSON.parse(element);
                    assert(!!elementInfo.current, "elementInfo.current not defined");
                    let valueNode = this.tree.getValueAtCharacterIndex(elementInfo.current.value.start);

                    // Value is an object and is collapsible
                    if (valueNode instanceof Json.ObjectValue && elementInfo.current.collapsible) {

                        for (let i = 0, il = valueNode.properties.length; i < il; i++) {
                            let item = this.getElementInfo(valueNode.properties[i], elementInfo);
                            result.push(item);

                        }
                    } else if (valueNode instanceof Json.ArrayValue && elementInfo.current.collapsible) {
                        // Array with objects
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
    }

    public getTreeItem(element: string): vscode.TreeItem {

        const elementInfo: IElementInfo = <IElementInfo>JSON.parse(element);
        const start = vscode.window.activeTextEditor.document.positionAt(elementInfo.current.key.start);
        const end = vscode.window.activeTextEditor.document.positionAt(elementInfo.current.value.end);

        let treeItem: vscode.TreeItem = {
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
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;

        // Center the method in the document
        editor.revealRange(range, vscode.TextEditorRevealType.Default);
        // Select the method name
        editor.selection = new vscode.Selection(range.start, range.end);
        // Swap the focus to the editor
        vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    }

    private parseTree(document?: vscode.TextDocument): void {
        if (!!document && isLanguageIdSupported(document.languageId)) {
            this.text = document.getText();
            this.tree = Json.parse(this.text);
        }
    }

    private getTreeNodeLabel(elementInfo: IElementInfo): string {
        const keyNode = this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Key is an object (e.g. a resource object)
        if (keyNode instanceof Json.ObjectValue) {
            let foundName = false;
            // Object contains no elements
            if (keyNode.properties.length === 0) {
                return "{}";
            } else {
                // Object contains elements, look for displayName tag first
                let tags = keyNode.properties.find(p => p.name && p.name.toString().toLowerCase() === 'tags');
                if (tags && tags.value instanceof Json.ObjectValue) {
                    let displayNameProp = tags.value.properties.find(p => p.name && p.name.toString().toLowerCase() === 'displayname');
                    if (displayNameProp) {
                        let displayName = displayNameProp.value && displayNameProp.value.toString();
                        if (displayName) {
                            return displayName;
                        }
                    }
                }

                // Look for name element
                for (var i = 0, l = keyNode.properties.length; i < l; i++) {
                    let props = keyNode.properties[i];
                    // If name element is found
                    if (props.name instanceof Json.StringValue && props.name.toString().toUpperCase() === "name".toUpperCase()) {
                        let name = props.value.toFriendlyString();

                        return shortenTreeLabel(name);
                    }
                }

                // Object contains elements, but not a name element
                if (!foundName) {
                    return "{...}";
                }
            }

        } else if (elementInfo.current.value.kind === Json.ValueKind.ArrayValue || elementInfo.current.value.kind === Json.ValueKind.ObjectValue) {
            // The value of the node is an array or object (e.g. properties or resources) - return key as the node label
            return keyNode.toFriendlyString();
        } else {
            // For other value types, display key and value since they won't be expandable
            const valueNode = this.tree.getValueAtCharacterIndex(elementInfo.current.value.start);

            return `${keyNode instanceof Json.StringValue ? keyNode.toFriendlyString() : "?"}: ${valueNode.toFriendlyString()}`;
        }
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
            result.current.value.start = childElement.value.startIndex;
            result.current.value.end = childElement.value.span.afterEndIndex;
            result.current.value.kind = childElement.value.valueKind;
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
            result.current.level = elementInfo.current.level + 1;
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

        let icon: string;
        const keyOrResourceNode = this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Is current element a root element?
        if (elementInfo.current.level === 1) {
            icon = this.getIcon(topLevelIcons, keyOrResourceNode.toString(), "");
        } else if (elementInfo.current.level === 2) {
            // Is current element an element of a root element?

            // Get root value
            const rootNode = this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);
            icon = this.getIcon(topLevelChildIconsByRootNode, rootNode.toString(), "");
        }

        // If resourceType element is found on resource objects set to specific resourceType Icon or else a default resource icon
        if (elementInfo.current.level > 1 && elementInfo.current.key.kind === Json.ValueKind.ObjectValue) {
            const rootNode = this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);

            if (rootNode.toString().toUpperCase() === "resources".toUpperCase() && keyOrResourceNode instanceof Json.ObjectValue) {
                for (var i = 0, il = keyOrResourceNode.properties.length; i < il; i++) {
                    if (keyOrResourceNode.properties[i].name.toString().toUpperCase() === "type".toUpperCase()) {
                        let resourceType = keyOrResourceNode.properties[i].value.toString().toUpperCase();
                        icon = this.getIcon(resourceIcons, resourceType, "resources.svg");
                    }
                }
            }
        }

        if (icon) {
            return path.join(iconsPath, icon);
        }

        return undefined;
    }

    private updateTreeState(): void {
        const activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
        const document: vscode.TextDocument = !!activeEditor ? activeEditor.document : null;
        this.parseTree(document);
        const showTreeView = this.isArmTemplate(document);

        if (showTreeView) {
            this.refresh();
        }

        this.setTreeViewContext(showTreeView);
    }

    private isArmTemplate(document?: vscode.TextDocument): boolean {
        return !!document && isLanguageIdSupported(document.languageId) && Utilities.isValidSchemaUri(this.getSchemaUri());
    }

    private setTreeViewContext(visible: boolean): void {
        vscode.commands.executeCommand('setContext', 'showArmJsonView', visible);
    }

    private getSchemaUri(): string {
        if (!!this.tree) {
            const value: Json.ObjectValue = Json.asObjectValue(this.tree.value);
            if (value) {
                const schema: Json.Value = Json.asStringValue(value.getPropertyValue("$schema"));
                if (schema) {
                    return schema.toString();
                }
            }
        }

        return null;
    }
}

export interface IElementInfo {
    current: {
        key: {
            start: number;
            end: number;
            kind: Json.ValueKind;
        };
        value: {
            start: number;
            end: number;
            kind: Json.ValueKind;
        };
        level: number;
        collapsible: boolean;
    };
    parent: {
        key: {
            start: number;
            end: number;
            kind: Json.ValueKind;
        };
        value: {
            start: number;
            end: number;
            kind: Json.ValueKind;
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
