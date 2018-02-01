import * as Json from "./JSON";
import * as vscode from "vscode";
import { TreeItem } from "vscode";


export class JsonOutlineProvider implements vscode.TreeDataProvider<string> {
    private tree;
    private text: string;
    private editor: vscode.TextEditor;

    public readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<string | null> =
        new vscode.EventEmitter<string | null>();
    public readonly onDidChangeTreeData: vscode.Event<string | null> = this.onDidChangeTreeDataEmitter.event;

    constructor(private context?: vscode.ExtensionContext) {

        vscode.window.onDidChangeActiveTextEditor((ev) => {

            this.refresh();
        });
        vscode.workspace.onDidChangeTextDocument((ev) => this.refresh(ev));
        vscode.workspace.onDidOpenTextDocument((ev) => this.refresh());
    }

    public refresh(event?: vscode.TextDocumentChangeEvent) {

        this.parseTree(vscode.window.activeTextEditor.document);
        this.onDidChangeTreeDataEmitter.fire(void 0);
    }

    public getChildren(element?: string): string[] {

        // check if there is a visible text editor
        if (vscode.window.visibleTextEditors.length > 0) {
            if (vscode.window.activeTextEditor.document.languageId === 'json') {

                if (!this.tree) {
                    this.refresh();
                }

                let result = [];
                if (!element) {
                    if (!!this.tree.value) {
                        for (let i = 0, il = this.tree.value.properties.length; i < il; i++) {
                            let item = this.getElementInfo(this.tree.value.properties[i]);
                            result.push(item);
                        }
                    }
                }
                else {
                    let elementInfo = JSON.parse(element);
                    let valueNode = this.tree.getValueAtCharacterIndex(elementInfo.current.value.start);

                    // Value is an object and is collapsible
                    if (elementInfo.current.value.type === "ObjectValue" && elementInfo.current.collapsible) {

                        for (var i = 0, il = valueNode.properties.length; i < il; i++) {
                            let item = this.getElementInfo(valueNode.properties[i], elementInfo);
                            result.push(item);

                        }
                    }
                    else if (elementInfo.current.value.type === "ArrayValue" && elementInfo.current.collapsible) {
                        // Array with Object
                        if (valueNode.elements[0].constructor.name === "ObjectValue") {
                            for (var i = 0, il = valueNode.length; i < il; i++) {
                                let item = this.getElementInfo(valueNode.elements[i], elementInfo);
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

        const elementInfo: IElementInfo = JSON.parse(element);
        const start = vscode.window.activeTextEditor.document.positionAt(elementInfo.current.key.start);
        const end = vscode.window.activeTextEditor.document.positionAt(elementInfo.current.value.end);

        let treeItem: vscode.TreeItem = {
            label: this.getLabel(elementInfo),
            collapsibleState: elementInfo.current.collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            iconPath: this.getIconPath(elementInfo),
            command: {
                arguments: [new vscode.Range(start, end)],
                command: "extension.treeview.goto",
                title: "",
            }
        }
        return treeItem;
    }

    public goToDefinition(range: vscode.Range) {
        const editor: vscode.TextEditor = vscode.window.activeTextEditor;

        // Center the method in the document
        editor.revealRange(range, vscode.TextEditorRevealType.Default);
        // Select the method name
        editor.selection = new vscode.Selection(range.start, range.end);
        // Swap the focus to the editor
        vscode.window.showTextDocument(editor.document, editor.viewColumn, false);
    }

    private parseTree(document?: vscode.TextDocument): void {

        if (document.languageId === "json") {
            this.text = document.getText();
            this.tree = Json.parse(this.text);
        }
    }

    private getLabel(elementInfo): string {

        const keyNode = this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Key is an object (e.g. a resource object)
        if (elementInfo.current.key.type === "ObjectValue") {
            let foundName = false;
            // Object contains no elements
            if (keyNode.properties.length === 0) {
                return "{}";
            }
            else {

                // Object contains elements, look for name element
                for (var i = 0, l = keyNode.properties.length; i < l; i++) {
                    let props = keyNode.properties[i];
                    // If name element is found
                    if (props.name._value.toUpperCase() === "name".toUpperCase()) {
                        foundName = true;
                        return props.value._value;
                    }
                }
                // Object contains elements, but not a name element
                if (!foundName) {
                    return "{...}";
                }
            }

        }
        // Value is an Array
        else if (elementInfo.current.value.type === "ArrayValue") {
            return keyNode._value;
        }
        else if (elementInfo.current.value.type === "ObjectValue") {
            return keyNode._value;
        }
        else {
            const valueNode = this.tree.getValueAtCharacterIndex(elementInfo.current.value.start);
            return `${keyNode._value}: ${valueNode._value}`;
        }
    }

    private getElementInfo(childElement, elementInfo?: IElementInfo) {

        let collapsible = false;
        let keyIsObject = false;

        // Is childElement an Object
        if (childElement.constructor.name === "ObjectValue") {
            keyIsObject = true;
            if (childElement.properties.length > 0) {
                collapsible = true;
            }
        }
        // Is value an Array and does it have elements
        else if (childElement.value.constructor.name === "ArrayValue" && childElement.value.elements.length > 0) {
            // Is the first element in the Array an Object
            if (childElement.value.elements[0].constructor.name === "ObjectValue") {
                collapsible = true;
            }
        }
        // Is value an Object and does it have elements
        else if (childElement.value.constructor.name === "ObjectValue" && childElement.value.properties.length > 0) {
            collapsible = true;
        }

        let result: IElementInfo = {
            current: {
                key: {
                    start: childElement.startIndex,
                    end: childElement.span.endIndex,
                    type: undefined,
                },
                value: {
                    start: undefined,
                    end: undefined,
                    type: undefined,
                },
                level: undefined,
                collapsible: collapsible
            },
            parent: {
                key: {
                    start: undefined,
                    end: undefined,
                    type: undefined,
                },
                value: {
                    start: undefined,
                    end: undefined,
                    type: undefined,
                }
            },
            root: {
                key: {
                    start: childElement.startIndex
                }
            }
        }

        // Key of the node is an Object
        if (!keyIsObject) {
            result.current.key.type = childElement.name.constructor.name;
            result.current.value.start = childElement.value.startIndex;
            result.current.value.end = childElement.value.span.afterEndIndex;
            result.current.value.type = childElement.value.constructor.name;
        }
        else {
            result.current.key.type = childElement.constructor.name;
            result.current.value.start = childElement.startIndex;
            result.current.value.end = childElement.span.afterEndIndex;
            result.current.value.type = childElement.constructor.name;
        }

        // Not a root element
        if (elementInfo) {
            result.parent.key.start = elementInfo.current.key.start;
            result.parent.key.end = elementInfo.current.key.end;
            result.parent.key.type = elementInfo.current.key.type;
            result.parent.value.start = elementInfo.current.value.start;
            result.parent.value.end = elementInfo.current.value.end;
            result.root.key.start = elementInfo.root.key.start;
            result.current.level = elementInfo.current.level + 1;
        }
        else {
            result.current.level = 1;
        }

        return JSON.stringify(result);
    }

    private getIconPath(elementInfo: IElementInfo): string {

        let icon;
        const keyNode = this.tree.getValueAtCharacterIndex(elementInfo.current.key.start);

        // Is current element a root element?
        if (elementInfo.current.level === 1) {
            if (keyNode._value.toUpperCase() === "$schema".toUpperCase()) { icon = "label.svg" };
            if (keyNode._value.toUpperCase() === "version".toUpperCase()) { icon = "label.svg" };
            if (keyNode._value.toUpperCase() === "contentVersion".toUpperCase()) { icon = "label.svg" };
            if (keyNode._value.toUpperCase() === "handler".toUpperCase()) { icon = "label.svg" };
            if (keyNode._value.toUpperCase() === "parameters".toUpperCase()) { icon = "parameters.svg" };
            if (keyNode._value.toUpperCase() === "variables".toUpperCase()) { icon = "variables.svg" };
            if (keyNode._value.toUpperCase() === "resources".toUpperCase()) { icon = "resources.svg" };
            if (keyNode._value.toUpperCase() === "outputs".toUpperCase()) { icon = "outputs.svg" };

        }
        // Is current element a element of a root element?
        else if (elementInfo.current.level === 2) {
            // Get root value
            const rootNode = this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);

            if (rootNode._value.toUpperCase() === "parameters".toUpperCase()) { icon = "parameters.svg" };
            if (rootNode._value.toUpperCase() === "variables".toUpperCase()) { icon = "variables.svg" };
            if (rootNode._value.toUpperCase() === "outputs".toUpperCase()) { icon = "outputs.svg" };
        }

        // If resourceType element is found on resource objects set to specific resourceType Icon or else a a default resource icon 
        if (elementInfo.current.level > 1 && elementInfo.current.key.type === "ObjectValue") {
            const rootNode = this.tree.getValueAtCharacterIndex(elementInfo.root.key.start);

            if (rootNode._value.toUpperCase() === "resources".toUpperCase()) {

                for (var i = 0, il = keyNode.properties.length; i < il; i++) {
                    if (keyNode.properties[i].name._value.toUpperCase() === "type".toUpperCase()) {
                        let resourceType = keyNode.properties[i].value._value.toUpperCase();
                        icon = "resources.svg";
                        resourceType === "Microsoft.Compute/virtualMachines".toUpperCase() ? icon = "virtualmachines.svg" : undefined;
                        resourceType === "Microsoft.Storage/storageAccounts".toUpperCase() ? icon = "storageaccounts.svg" : undefined;
                        resourceType === "Microsoft.Network/virtualNetworks".toUpperCase() ? icon = "virtualnetworks.svg" : undefined;
                        resourceType === "Microsoft.Compute/virtualMachines/extensions".toUpperCase() ? icon = "extensions.svg" : undefined;
                        resourceType === "Microsoft.Network/networkSecurityGroups".toUpperCase() ? icon = "nsg.svg" : undefined;
                        resourceType === "Microsoft.Network/networkInterfaces".toUpperCase() ? icon = "nic.svg" : undefined;
                        resourceType === "Microsoft.Network/publicIPAddresses".toUpperCase() ? icon = "publicip.svg" : undefined;
                    }
                }
            }
        }
        if (icon) {
            return (__dirname + '/../../icons/' + icon);
        }
        return;
    }
}

export interface IElementInfo {
    current: {
        key: {
            start: number;
            end: number;
            type: string;
        },
        value: {
            start: number;
            end: number;
            type: string;
        },
        level: number;
        collapsible: boolean;
    },
    parent: {
        key: {
            start: number;
            end: number;
            type: string;
        },
        value: {
            start: number;
            end: number;
            type: string;
        }
    },
    root: {
        key: {
            start: number;
        }
    }
}