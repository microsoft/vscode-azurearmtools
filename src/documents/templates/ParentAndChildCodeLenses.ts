import { Location } from "vscode";
import { assert } from "../../fixed_assert";
// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------
import { sortArrayByProperty } from "../../util/sortArrayByProperty";
import { IPeekResourcesArgs } from "../../vscodeIntegration/commandArguments";
import { getVSCodeRangeFromSpan } from "../../vscodeIntegration/vscodePosition";
import { ResolvableCodeLens } from "../DeploymentDocument";
import { getResourcesInfo, IJsonResourceInfo } from "./getResourcesInfo";
import { IResource } from "./IResource";
import { TemplateScope } from "./scopes/TemplateScope";

export function getParentAndChildCodeLenses(scope: TemplateScope): ResolvableCodeLens[] {
    const lenses: ResolvableCodeLens[] = [];

    // Delay getting resource info until resolution
    let infos: IJsonResourceInfo[] | undefined;
    const delayGetResourcesInfo = (): IJsonResourceInfo[] => {
        if (!infos) {
            infos = getResourcesInfo({ scope, recognizeDecoupledChildren: true });
        }

        return infos;
    };

    //asdf nested scopes
    //asdf 730a doesn't work
    for (const resource of scope.resources) {
        lenses.push(new ParentCodeLens(scope, resource, delayGetResourcesInfo));
        lenses.push(new ChildrenCodeLens(scope, resource, delayGetResourcesInfo));
    }

    return lenses;

    function asdf(resource: IResource): void {
        lenses.push(new ParentCodeLens(scope, resource, delayGetResourcesInfo));
        lenses.push(new ChildrenCodeLens(scope, resource, delayGetResourcesInfo));

        //ASDF
    }
}

export abstract class ParentOrChildCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TemplateScope,
        protected readonly sourceResource: IResource
    ) {
        super(scope, sourceResource.span);
    }

    protected resolveCore(title: string, targets: IJsonResourceInfo[]): boolean {
        if (targets.length > 0) {
            const targetLocations = targets.map(resInfo =>
                new Location(
                    this.scope.document.documentUri,
                    getVSCodeRangeFromSpan(this.scope.document, resInfo.resourceObject.span))
            );
            this.command = {
                title: title,
                command: 'azurerm-vscode-tools.codeLens.peekResources',
                arguments:
                    [
                        <IPeekResourcesArgs>{
                            source: { uri: this.scope.document.documentUri, range: this.range },
                            targets: targetLocations
                        }
                    ]
            };
        } else {
            this.command = {
                title: title,
                command: ''
            };

        }

        return true;
    }
}

export class ChildrenCodeLens extends ParentOrChildCodeLens {
    public constructor(
        scope: TemplateScope,
        sourceResource: IResource,
        private readonly delayGetResourcesInfo: () => IJsonResourceInfo[]
    ) {
        super(scope, sourceResource);
    }

    public async resolve(): Promise<boolean> {
        const infos = this.delayGetResourcesInfo();
        const sourceInfo = findResourceInfoFromIResource(infos, this.sourceResource);

        let title: string;
        const children = <IJsonResourceInfo[]>sourceInfo?.children ?? [];
        if (children.length > 0) {
            const orderedChildren = sortArrayByProperty(children, "shortNameExpression");
            const countOfChildrenTitle = `${orderedChildren.length} ${orderedChildren.length === 1 ? "child" : "children"}`;
            const childrenLabels = orderedChildren.map(child => (<IJsonResourceInfo>child).getFriendlyResourceLabel({})).join(", ");
            title = `${countOfChildrenTitle}: ${childrenLabels}`;
        } else {
            title = "No children";
        }

        return super.resolveCore(title, children);
    }
}

export class ParentCodeLens extends ParentOrChildCodeLens {
    public constructor(
        scope: TemplateScope,
        sourceResource: IResource,
        private readonly delayGetResourcesInfo: () => IJsonResourceInfo[]
    ) {
        super(scope, sourceResource);
    }

    public async resolve(): Promise<boolean> {
        const infos = this.delayGetResourcesInfo();
        const sourceInfo = findResourceInfoFromIResource(infos, this.sourceResource);
        assert(sourceInfo);
        const parent = <IJsonResourceInfo | undefined>sourceInfo?.parent;

        let title: string;
        if (parent) {
            title = `Parent: ${parent.getFriendlyResourceLabel({})}`;
        } else {
            title = "No parent";
        }

        return super.resolveCore(title, parent ? [parent] : []);
    }
}

function findResourceInfoFromIResource(infos: IJsonResourceInfo[], resource: IResource): IJsonResourceInfo | undefined {
    return infos.find(info => info.resourceObject.span.startIndex === resource.span.startIndex);
}
