// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

// tslint:disable:no-unused-expression max-func-body-length promise-function-async max-line-length insecure-random
// tslint:disable:object-literal-key-quotes no-function-expression no-non-null-assertion align no-http-string

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from "vscode";
import { DeploymentFileMapping, isWin32, normalizePath } from "../extension.bundle";
import { TestConfiguration } from "./support/TestConfiguration";
import { testOnWin32 } from './support/testOnPlatform';

suite("DeploymentFileMapping", () => {
    const root = isWin32 ? "c:\\" : "/";
    const param1 = Uri.file(isWin32 ? "c:\\temp\\template1.params.json" : "/temp/template1.params.json");
    const param1variation = Uri.file(isWin32 ? "c:\\temp\\abc\\..\\template1.params.json" : "/temp/abc/../template1.params.json");

    const param1subfolder = Uri.file(isWin32 ? "c:\\temp\\sub\\template1.params.json" : "/temp/sub/template1.params.json");
    const param1parentfolder = Uri.file(isWin32 ? "c:\\template1.params.json" : "/template1.params.json");

    const template1 = Uri.parse(isWin32 ? "c:\\temp\\template1.json" : "/temp/template1.json");
    const template1variation = Uri.parse(isWin32 ? "c:\\temp\\abc\\..\\template1.json" : "/temp/abc/../template1.json");

    test("Update/get", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = template1;
        const p = param1;

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(t)?.fsPath, p.fsPath);
        assert.equal(mapping.getTemplateFile(p)?.fsPath, t.fsPath);
    });

    test("Update/get - paths normalized", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = template1variation;
        const p = param1variation;

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(t)?.fsPath, path.resolve(p.fsPath));
        assert.equal(mapping.getTemplateFile(p)?.fsPath, path.resolve(t.fsPath));
    });

    test("Update/get - param in subfolder", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = template1;
        const p = param1subfolder;

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(t)?.fsPath, p.fsPath);
        assert.equal(mapping.getTemplateFile(p)?.fsPath, t.fsPath);
    });

    test("Update/get - param in parent folder", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = template1;
        const p = param1parentfolder;

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(t)?.fsPath, p.fsPath);
        assert.equal(mapping.getTemplateFile(p)?.fsPath, t.fsPath);
    });

    testOnWin32("Update/get - param on different drive", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = Uri.file("c:\\temp\\template1.params.json");
        const p = Uri.file("d:\\temp\\template1.params.json");

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(t)?.fsPath, p.fsPath);
        assert.equal(mapping.getTemplateFile(p)?.fsPath, t.fsPath);
    });

    test("Param paths are stored in settings relative to template folder", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = template1;
        const p = param1subfolder;

        await mapping.mapParameterFile(t, p);

        const parameterFiles = <{ [key: string]: string }>testConfig.get("parameterFiles");
        const pStoredPath = parameterFiles[t.fsPath];
        assert(!path.isAbsolute(pStoredPath));
    });

    testOnWin32("Case-insensitive on Windows", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t = Uri.file("C:\\TEMP\\Template1.json");
        const p = Uri.file("C:\\TEMP\\Template1.Params.json");

        await mapping.mapParameterFile(t, p);

        assert.equal(mapping.getParameterFile(Uri.file("c:\\temp\\tEMPLATE.jSON"))?.fsPath, p.fsPath);
        assert.equal(mapping.getTemplateFile(Uri.file("c:\\temP\\TemPLATE1.pARAMS.jSOn"))?.fsPath, t.fsPath);
    });

    testOnWin32("Case-insensitive on Windows - last entry wins", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const t1 = Uri.file("C:\\TEMP\\Template1.json");
        const t2 = Uri.file("C:\\TEMP\\TEMPLATE1.json");
        const t3 = Uri.file("C:\\TEMP\\tempLATE1.json");
        const p1 = Uri.file("C:\\TEMP\\Template1.Params.json");
        const p2 = Uri.file("C:\\TEMP\\TEMPLATE.PARAMS.json");
        const p3 = Uri.file("C:\\TEMP\\tempLATE1.paRAMS.json");

        const obj: { [key: string]: unknown } = {};
        testConfig.Test_globalValues.set("parameterFiles", obj);
        obj[t1.fsPath] = p1.fsPath;
        obj[t2.fsPath] = p2.fsPath;
        obj[t3.fsPath] = p3.fsPath;

        // Look-up on any template version returns p2
        const normalizedTemplate = normalizePath(t1.fsPath);
        assert(normalizedTemplate === normalizePath(t2.fsPath) && normalizedTemplate === normalizePath(t3.fsPath));
        assert.equal(mapping.getParameterFile(t1)?.fsPath, p2.fsPath);
        assert.equal(mapping.getParameterFile(t2)?.fsPath, p2.fsPath);
        assert.equal(mapping.getParameterFile(t3)?.fsPath, p2.fsPath);

        // Look-up on any parameter version returns same normalized path
        const normalizedParams = normalizePath(p1.fsPath);
        assert(normalizedParams === normalizePath(p2.fsPath) && normalizedParams === normalizePath(p3.fsPath));
        assert.equal(mapping.getTemplateFile(p1)?.fsPath, normalizedParams);
        assert.equal(mapping.getTemplateFile(p2)?.fsPath, normalizedParams);
        assert.equal(mapping.getTemplateFile(p3)?.fsPath, normalizedParams);
    });

    test("Bad settings 1", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);

        assert.equal(mapping.getParameterFile(template1), undefined);
    });

    test("Bad settings 2", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);
        const obj: { [key: string]: unknown } = {};
        testConfig.Test_globalValues.set("parameterFiles", obj);
        obj[<string><unknown>undefined] = "foo";
        obj[<string><unknown>undefined] = "foo";
        obj[""] = "foo";
        obj.goo = "foo";
        obj["temp/relative/foo.json"] = "foo";
        obj["."] = "foo";

        obj[`${root}t1.json`] = undefined;
        obj[`${root}t2.json`] = "";
        obj[`${root}t3.json`] = 1;
        obj[`${root}t4.json`] = {};
        obj[`${root}t5.json`] = ".";
        obj[`${root}t6.json`] = "/";
        obj[`${root}good1.json`] = "a.";

        // getParameterFile
        assert.equal(mapping.getParameterFile(Uri.parse(<string><unknown>undefined)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(<string><unknown>1)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse("")), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse("foo")), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse("temp/relative/foo.json")), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t1.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t2.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t3.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t4.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t5.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}t6.json`)), undefined);
        assert.equal(mapping.getParameterFile(Uri.parse(`${root}good1.json`))?.fsPath, `${root}a.`);

        // getTemplateFile
        assert.equal(mapping.getTemplateFile(Uri.parse("")), undefined);
        assert.equal(mapping.getTemplateFile(Uri.parse("foo.params.json")), undefined);
    });

    test("Remove mapping", async () => {
        const testConfig = new TestConfiguration();
        const mapping = new DeploymentFileMapping(testConfig);

        await mapping.mapParameterFile(template1, param1);
        assert.equal(mapping.getParameterFile(template1)?.fsPath, param1.fsPath);
        assert.equal(mapping.getTemplateFile(param1)?.fsPath, template1.fsPath);

        await mapping.mapParameterFile(template1, undefined);
        assert.equal(mapping.getParameterFile(template1), undefined);
        assert.equal(mapping.getTemplateFile(param1), undefined);
    });
});
