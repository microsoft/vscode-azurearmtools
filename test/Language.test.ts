// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression
// tslint:disable:max-func-body-length

import * as assert from "assert";
import { ContainsBehavior, Issue, IssueKind, LineColPos, Span } from "../extension.bundle";

suite("Language", () => {
    suite("Span", () => {
        suite("constructor()", () => {
            function constructorTest(startIndex: number, length: number): void {
                test(`with [${startIndex},${length})`, () => {
                    const span = new Span(startIndex, length);
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
            suite("ContainsBehavior.strict", () => {
                test("With index less than startIndex", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(2, ContainsBehavior.strict));
                });

                test("With index equal to startIndex", () => {
                    assert(new Span(3, 4).contains(3, ContainsBehavior.strict));
                });

                test("With index between the start and end indexes", () => {
                    assert(new Span(3, 4).contains(5, ContainsBehavior.strict));
                });

                test("With index equal to endIndex", () => {
                    assert(new Span(3, 4).contains(6, ContainsBehavior.strict));
                });

                test("With index directly after end index", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(7, ContainsBehavior.strict));
                });
            });

            suite("ContainsBehavior.extended", () => {
                test("With index less than startIndex", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(2, ContainsBehavior.extended));
                });

                test("With index equal to startIndex", () => {
                    assert(new Span(3, 4).contains(3, ContainsBehavior.extended));
                });

                test("With index between the start and end indexes", () => {
                    assert(new Span(3, 4).contains(5, ContainsBehavior.extended));
                });

                test("With index equal to endIndex", () => {
                    assert(new Span(3, 4).contains(6, ContainsBehavior.extended));
                });

                test("With index directly after end index", () => {
                    // Extended, so this should be true
                    assert.deepStrictEqual(true, new Span(3, 4).contains(7, ContainsBehavior.extended));
                });

                test("With index two after end index", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(8, ContainsBehavior.extended));
                });
            });

            suite("ContainsBehavior.enclosed", () => {
                test("With index less than startIndex", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(2, ContainsBehavior.enclosed));
                });

                test("With index equal to startIndex", () => {
                    // With enclosed, this should be false
                    assert.equal(new Span(3, 4).contains(3, ContainsBehavior.enclosed), false);
                });

                test("With index between the start and end indexes", () => {
                    assert(new Span(3, 4).contains(5, ContainsBehavior.enclosed));
                });

                test("With index equal to endIndex", () => {
                    assert(new Span(3, 4).contains(6, ContainsBehavior.enclosed));
                });

                test("With index directly after end index", () => {
                    assert.deepStrictEqual(false, new Span(3, 4).contains(7, ContainsBehavior.enclosed));
                });
            });
        });

        suite("union()", () => {
            test("With null", () => {
                const s = new Span(5, 7);
                assert.deepStrictEqual(s, s.union(undefined));
            });

            test("With same span", () => {
                const s = new Span(5, 7);
                assert.deepEqual(s, s.union(s));
            });

            test("With equal span", () => {
                const s = new Span(5, 7);
                assert.deepEqual(s, s.union(new Span(5, 7)));
            });

            test("With subset span", () => {
                const s = new Span(5, 17);
                assert.deepEqual(s, s.union(new Span(10, 2)));
            });
        });

        suite("intersect()", () => {

            test("With null", () => {
                const s = Span.fromStartAndAfterEnd(5, 7);
                assert.deepStrictEqual(s.intersect(undefined), undefined);
            });

            test("With same span", () => {
                const s = Span.fromStartAndAfterEnd(5, 7);
                assert.deepEqual(s, s.intersect(s));
            });

            test("With equal span", () => {
                const s = Span.fromStartAndAfterEnd(5, 7);
                assert.deepEqual(s, s.intersect(new Span(5, 7)));
            });

            test("second span to left", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(Span.fromStartAndAfterEnd(0, 9)),
                    undefined
                );
            });

            test("second touches the left", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(Span.fromStartAndAfterEnd(0, 10)),
                    // Two results could be argued here: len 0 span at 10, or undefined
                    // We'll go with the former until sometimes finds a reason why it should
                    //   be different
                    new Span(10, 0)
                );
            });

            test("second span to left and overlap", () => {
                assert.deepEqual(
                    new Span(10, 20).intersect(new Span(0, 11)),
                    new Span(10, 1)
                );
            });

            test("second span is superset", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(Span.fromStartAndAfterEnd(0, 21)),
                    Span.fromStartAndAfterEnd(10, 20)
                );
            });

            test("second span is subset", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(new Span(11, 8)),
                    new Span(11, 8)
                );
            });

            test("second span is len 0 subset, touching on the left", () => {
                assert.deepEqual(
                    new Span(10, 10).intersect(new Span(10, 0)),
                    new Span(10, 0)
                );
            });

            test("second span is len 0 subset, touching on the right", () => {
                assert.deepEqual(
                    new Span(10, 10).intersect(new Span(20, 0)),
                    new Span(20, 0)
                );
            });

            test("second span to right and overlapping", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(new Span(19, 10)),
                    new Span(19, 1)
                );
            });

            test("second span to right", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(new Span(21, 9)),
                    undefined
                );
            });

            test("length 0", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(new Span(15, 0)),
                    new Span(15, 0)
                );
            });

            test("length 1", () => {
                assert.deepEqual(
                    Span.fromStartAndAfterEnd(10, 20).intersect(new Span(15, 1)),
                    new Span(15, 1)
                );
            });
        });

        suite("translate()", () => {
            test("with 0 movement", () => {
                const span = new Span(1, 2);
                assert.equal(span.translate(0), span);
                assert.deepStrictEqual(span.translate(0), new Span(1, 2));
            });

            test("with 1 movement", () => {
                const span = new Span(1, 2);
                assert.notEqual(span.translate(1), new Span(2, 2));
                assert.deepStrictEqual(span.translate(1), new Span(2, 2));
            });

            test("with -1 movement", () => {
                const span = new Span(1, 2);
                assert.notEqual(span.translate(-1), new Span(0, 2));
                assert.deepStrictEqual(span.translate(-1), new Span(0, 2));
            });
        });

        test("toString()", () => {
            assert.deepStrictEqual(new Span(1, 2).toString(), "[1, 3)");
        });
    });

    suite("Position", () => {
        suite("constructor(number,number)", () => {
            test("With null _line", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new LineColPos(<any>null, 3); });
            });

            test("With undefined _line", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new LineColPos(<any>undefined, 3); });
            });

            test("With negative _line", () => {
                assert.throws(() => { new LineColPos(-1, 3); });
            });

            test("With null _column", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new LineColPos(2, <any>null); });
            });

            test("With undefined _column", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new LineColPos(2, <any>undefined); });
            });

            test("With negative _column", () => {
                assert.throws(() => { new LineColPos(2, -3); });
            });

            test("With valid arguments", () => {
                const p = new LineColPos(2, 3);
                assert.deepStrictEqual(p.line, 2);
                assert.deepStrictEqual(p.column, 3);
            });
        });
    });

    suite("Issue", () => {
        suite("constructor(Span,string)", () => {
            test("With null span", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new Issue(<any>null, "error message", IssueKind.tleSyntax); });
            });

            test("With undefined span", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new Issue(<any>undefined, "error message", IssueKind.tleSyntax); });
            });

            test("With null message", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new Issue(new Span(4, 1), <any>null, IssueKind.tleSyntax); });
            });

            test("With undefined message", () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                assert.throws(() => { new Issue(new Span(4, 1), <any>undefined, IssueKind.tleSyntax); });
            });

            test("With empty message", () => {
                assert.throws(() => { new Issue(new Span(3, 2), "", IssueKind.tleSyntax); });
            });

            test("With valid arguments", () => {
                const issue = new Issue(new Span(2, 4), "error message", IssueKind.tleSyntax);
                assert.deepStrictEqual(issue.span, new Span(2, 4));
                assert.deepStrictEqual(issue.message, "error message");
            });
        });
    });
});
