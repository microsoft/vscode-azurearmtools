// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ConfigurationTarget } from "vscode";
import { IConfiguration } from "../../extension.bundle";

export class TestConfiguration implements IConfiguration {
    // tslint:disable-next-line:no-reserved-keywords
    public get<T>(key: string): T | undefined {
        throw new Error("Method not implemented.");
    }

    public inspect<T>(key: string): { globalValue?: T | undefined } | undefined {
        throw new Error("Method not implemented.");
    }

    public async update(section: string, value: unknown, configurationTarget?: ConfigurationTarget): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
