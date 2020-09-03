import { Location } from "vscode";
// ---------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.md in the project root for license information.
// ---------------------------------------------------------------------------------------------
import { ResolvableCodeLens } from "./documents/DeploymentDocument";
import { TemplateScope } from "./documents/templates/scopes/TemplateScope";
import { Span } from "./language/Span";
import { getVSCodeRangeFromSpan } from "./vscodeIntegration/vscodePosition";

export class ShowChildParentCodeLens extends ResolvableCodeLens {
    public constructor(
        scope: TemplateScope,
        span: Span,
        private readonly targetSpan: Span | undefined,
        private readonly title: string
    ) {
        super(scope, span); //asdf inside the curlies
    }

    public async resolve(): Promise<boolean> {
        /*
        codeLens.command = {
            title: this.getCodeLensLabel(locations),
            command: locations.length ? 'editor.action.showReferences' : '',
            arguments: [codeLens.document, codeLens.range.start, locations]
        };
        */

        /*
        CommandsRegistry.registerCommand({
    id: 'editor.action.peekLocations',
    description: {
        description: 'Peek locations from a position in a file',
        args: [
            { name: 'uri', description: 'The text document in which to start', constraint: URI },
            { name: 'position', description: 'The position at which to start', constraint: corePosition.Position.isIPosition },
            { name: 'locations', description: 'An array of locations.', constraint: Array },
            { name: 'multiple', description: 'Define what to do when having multiple results, either `peek`, `gotoAndPeek`, or `goto' },
        ]
    },
    handler: async (accessor: ServicesAccessor, resource: any, position: any, references: any, multiple?: any) => {
        accessor.get(ICommandService).executeCommand('editor.action.goToLocations', resource, position, references, multiple, undefined, true);
    }
});
*/
        if (this.targetSpan) {//asdf
            this.command = {
                title: this.title,
                //command: 'azurerm-vscode-tools.codeLens.gotoResource', asdf
                // arguments: [
                //     <IGotoResourceArgs>{
                //         documentUri: this.scope.document.documentUri,
                //         range: getVSCodeRangeFromSpan(this.scope.document, this.targetSpan),
                //         telemetryProperties: {
                //             //asdf telemetry: which code lens type?
                //             //asdf make sure telemetry works
                //         }
                //     }
                // ]
                command: 'editor.action.showReferences', //asdf 'editor.action.showReferences',
                arguments:
                    [
                        this.scope.document.documentUri,
                        getVSCodeRangeFromSpan(this.scope.document, this.targetSpan).start, //asdf
                        <Location[]>[
                            new Location(
                                this.scope.document.documentUri,
                                //new Range(new Position(0, 0), new Position(10, 10))
                                getVSCodeRangeFromSpan(this.scope.document, this.targetSpan)
                            )
                        ]
                    ]
            };
        } else {
            //asdf
            this.command = {
                title: this.title,
                command: ''
            };

        }

        return true;
    }
}
