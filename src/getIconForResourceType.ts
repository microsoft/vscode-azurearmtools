// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

const resourceIcons: [string, string][] = [
    ["Microsoft.Compute/virtualMachines", "virtualmachines.svg"],
    ["Microsoft.Storage/storageAccounts", "storageaccounts.svg"],
    ["Microsoft.Network/virtualNetworks", "virtualnetworks.svg"],
    ["Microsoft.Compute/virtualMachines/extensions", "extensions.svg"],
    ["Microsoft.Network/networkSecurityGroups", "nsg.svg"],
    ["Microsoft.Network/networkInterfaces", "nic.svg"],
    ["Microsoft.Network/publicIPAddresses", "publicip.svg"]
];

export function getIconForResourceType(itemName: string): string | undefined {
    // tslint:disable-next-line: strict-boolean-expressions
    if (itemName) {
        itemName = itemName.toLowerCase();
        let iconItem = resourceIcons.find(item => item[0].toLowerCase() === itemName);
        if (iconItem) {
            return iconItem[1];
        }
    }

    return undefined;
}
