// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as assert from 'assert';
import { ConfigurationTarget } from "vscode";
import { IConfiguration } from "../../extension.bundle";

export class TestConfiguration implements IConfiguration {
    // tslint:disable-next-line:variable-name
    public Test_globalValues: Map<string, unknown> = new Map<string, unknown>();

    // tslint:disable-next-line:no-reserved-keywords
    public get<T>(key: string): T | undefined {
        return <T>this.Test_globalValues.get(key);
    }

    public inspect<T>(key: string): { globalValue?: T | undefined } | undefined {
        const value = <T>this.Test_globalValues.get(key);
        return {
            globalValue: value
        };
    }

    public async update(section: string, value: unknown, configurationTarget?: ConfigurationTarget): Promise<void> {
        assert(configurationTarget === ConfigurationTarget.Global, "NYI");
        this.Test_globalValues.set(section, value);
    }
}
