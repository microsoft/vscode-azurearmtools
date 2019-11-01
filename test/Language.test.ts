// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression
// tslint:disable:max-func-body-length

import * as assert from "assert";
import { Language } from "../extension.bundle";

const IssueKind = Language.IssueKind;

suite("Language", () => {
    suite("Span", () => {
        suite("constructor()", () => {
            function constructorTest(startIndex: number, length: number): void {
                test(`with [${startIndex},${length})`, () => {
                    const span = new Language.Span(startIndex, length);
                    assert.deepStrictEqual(span.startIndex, startIndex);
                    assert.deepStrictEqual(span.length, length);
                    assert.deepStrictEqual(span.endIndex, startIndex + (length > 0 ? length - 1 : 0), "Wrong endIndex");
                    assert.deepStrictEqual(span.afterEndIndex, startIndex + length, "Wrong afterEndIndex");
                });
            }
            constructorTest(-1, 3);
            constructorTest(0, 3);
            constructorTest(10, -3);
            constructorTest(11, 0);
            constructorTest(21, 3);
        });

        suite("contains()", () => {
            test("With index less than startIndex", () => {
                assert.deepStrictEqual(false, new Language.Span(3, 4).contains(2));
            });

            test("With index equal to startIndex", () => {
                assert(new Language.Span(3, 4).contains(3));
            });

            test("With index between the start and end indexes", () => {
                assert(new Language.Span(3, 4).contains(5));
            });

            test("With index equal to endIndex", () => {
                assert(new Language.Span(3, 4).contains(6));
            });

            test("With index directly after end index", () => {
                assert.deepStrictEqual(false, new Language.Span(3, 4).contains(7));
            });
        });

        suite("union()", () => {
            test("With null", () => {
                let s = new Language.Span(5, 7);
                assert.deepStrictEqual(s, s.union(null));
            });

            test("With same span", () => {
                let s = new Language.Span(5, 7);
                assert.deepEqual(s, s.union(s));
            });

            test("With equal span", () => {
                let s = new Language.Span(5, 7);
                assert.deepEqual(s, s.union(new Language.Span(5, 7)));
            });

            test("With subset span", () => {
                let s = new Language.Span(5, 17);
                assert.deepEqual(s, s.union(new Language.Span(10, 2)));
            });
        });

        suite("translate()", () => {
            test("with 0 movement", () => {
                const span = new Language.Span(1, 2);
                assert.equal(span.translate(0), span);
                assert.deepStrictEqual(span.translate(0), new Language.Span(1, 2));
            });

            test("with 1 movement", () => {
                const span = new Language.Span(1, 2);
                assert.notEqual(span.translate(1), new Language.Span(2, 2));
                assert.deepStrictEqual(span.translate(1), new Language.Span(2, 2));
            });

            test("with -1 movement", () => {
                const span = new Language.Span(1, 2);
                assert.notEqual(span.translate(-1), new Language.Span(0, 2));
                assert.deepStrictEqual(span.translate(-1), new Language.Span(0, 2));
            });
        });

        test("toString()", () => {
            assert.deepStrictEqual(new Language.Span(1, 2).toString(), "[1, 3)");
        });
    });

    suite("Position", () => {
        suite("constructor(number,number)", () => {
            test("With null _line", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Position(<any>null, 3); });
            });

            test("With undefined _line", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Position(<any>undefined, 3); });
            });

            test("With negative _line", () => {
                assert.throws(() => { new Language.Position(-1, 3); });
            });

            test("With null _column", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Position(2, <any>null); });
            });

            test("With undefined _column", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Position(2, <any>undefined); });
            });

            test("With negative _column", () => {
                assert.throws(() => { new Language.Position(2, -3); });
            });

            test("With valid arguments", () => {
                const p = new Language.Position(2, 3);
                assert.deepStrictEqual(p.line, 2);
                assert.deepStrictEqual(p.column, 3);
            });
        });
    });

    suite("Issue", () => {
        suite("constructor(Span,string)", () => {
            test("With null span", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Issue(<any>null, "error message", IssueKind.tleSyntax); });
            });

            test("With undefined span", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Issue(<any>undefined, "error message", IssueKind.tleSyntax); });
            });

            test("With empty span", () => {
                assert.throws(() => { new Language.Issue(new Language.Span(5, 0), "error message", IssueKind.tleSyntax); });
            });

            test("With null message", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Issue(new Language.Span(4, 1), <any>null, IssueKind.tleSyntax); });
            });

            test("With undefined message", () => {
                // tslint:disable-next-line:no-any
                assert.throws(() => { new Language.Issue(new Language.Span(4, 1), <any>undefined, IssueKind.tleSyntax); });
            });

            test("With empty message", () => {
                assert.throws(() => { new Language.Issue(new Language.Span(3, 2), "", IssueKind.tleSyntax); });
            });

            test("With valid arguments", () => {
                const issue = new Language.Issue(new Language.Span(2, 4), "error message", IssueKind.tleSyntax);
                assert.deepStrictEqual(issue.span, new Language.Span(2, 4));
                assert.deepStrictEqual(issue.message, "error message");
            });
        });
    });
});
