// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CodeAction, CodeActionContext, CodeLens, Command, Position, Range, Selection, Uri } from "vscode";
import { INamedDefinition } from "../language/INamedDefinition";
import { Issue } from "../language/Issue";
import { ReferenceList } from "../language/ReferenceList";
import { Span } from "../language/Span";
import { __debugMarkPositionInString, __debugMarkRangeInString } from "../util/debugMarkStrings";
import { getVSCodeRangeFromSpan } from "../vscodeIntegration/vscodePosition";
import { JsonDocument } from "./JsonDocument";
import { IParameterValuesSourceProvider } from "./parameters/IParameterValuesSourceProvider";
import { PositionContext } from "./positionContexts/PositionContext";
import { TemplateScope } from "./templates/scopes/TemplateScope";

/**
 * Represents a deployment-related JSON file
 */
export abstract class DeploymentDocument extends JsonDocument {
    /**
     * Constructor
     *
     * @param _documentText The string text of the document
     * @param _documentUri The location of the document
     */
    constructor(documentText: string, documentUri: Uri, public readonly documentVersion: number) {
        super(documentText, documentUri);
    }

    // tslint:disable-next-line:function-name
    public _debugShowTextAt(positionOrRange: number | Span | Range | Position): string {
        if (positionOrRange instanceof Span) {
            return __debugMarkRangeInString(this.documentText, positionOrRange.startIndex, positionOrRange.length);
        } else if (positionOrRange instanceof Range) {
            const startIndex = this.getDocumentCharacterIndex(positionOrRange.start.line, positionOrRange.start.character, { allowOutOfBounds: true });
            const endIndex = this.getDocumentCharacterIndex(positionOrRange.end.line, positionOrRange.end.character, { allowOutOfBounds: true });
            return __debugMarkRangeInString(this.documentText, startIndex, endIndex - startIndex);
        } else if (positionOrRange instanceof Position) {
            const index = this.getDocumentCharacterIndex(positionOrRange.line, positionOrRange.character, { allowOutOfBounds: true });
            return __debugMarkPositionInString(this.documentText, index);
        } else {
            return __debugMarkPositionInString(this.documentText, positionOrRange);
        }
    }

    public abstract getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentDocument | undefined): PositionContext;

    public abstract getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedTemplate: DeploymentDocument | undefined): PositionContext;

    /**
     * Find all references in this document to the given named definition (which may or may not be in this document)
     */
    public abstract findReferencesToDefinition(definition: INamedDefinition): ReferenceList;

    /**
     * Provide commands for the given document and range.
     *
     * @param associatedDocument The associated document, if any (for a template file, the associated document is a parameter file,
     * for a parameter file, the associated document is a template file)
     * @param range The selector or range for which the command was invoked. This will always be a selection if
     * there is a currently active editor.
     * @param context Context carrying additional information.
     * @param token A cancellation token.
     * @return An array of commands, quick fixes, or refactorings or a thenable of such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    public abstract getCodeActions(associatedDocument: DeploymentDocument | undefined, range: Range | Selection, context: CodeActionContext): (Command | CodeAction)[];

    // This should be as fast as possible
    // Anything slow should occur during ResolvableCodeLens.resolve()
    public abstract getCodeLenses(
        // If a parameter file is associated with this template template, this should
        //   provide its URI and be able to lazily retrieve the parameter value source
        // If there is no associated parameter file, this should be undefined
        parameterValuesSourceProvider: IParameterValuesSourceProvider | undefined
    ): ResolvableCodeLens[];

    // CONSIDER: Should we cache?  But that cache would depend on associatedTemplate not changing, not sure if that's
    // guaranteed.
    // Consider whether associated document should be a function passed in to constructor so that it's a permanent part of the
    // template state once it's lazily created
    public getErrors(associatedDocument: DeploymentDocument | undefined): Issue[] {
        return this.getErrorsCore(associatedDocument);
    }

    public abstract getErrorsCore(associatedDocument: DeploymentDocument | undefined): Issue[];

    public abstract getWarnings(): Issue[];
}

export abstract class ResolvableCodeLens extends CodeLens {
    public constructor(
        public readonly scope: TemplateScope,
        public readonly span: Span
    ) {
        super(getVSCodeRangeFromSpan(scope.document, span));
    }

    /**
     * Must fill in the code lens title and command, or return false if no longer valid
     */
    public abstract resolve(): Promise<boolean>;
}
