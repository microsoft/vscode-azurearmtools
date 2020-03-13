// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { ConfigurationTarget, workspace } from "vscode";

export interface IConfiguration {
    // tslint:disable-next-line:no-reserved-keywords
    get<T>(key: string): T | undefined;

    inspect<T>(key: string): { globalValue?: T } | undefined;

    update(section: string, value: unknown, configurationTarget?: ConfigurationTarget | boolean): Promise<void>;
}

export class VsCodeConfiguration implements IConfiguration {
    public constructor(public readonly section: string) {
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get<T>(key: string): T | undefined {
        return workspace.getConfiguration(this.section).get(key);
    }

    public inspect<T>(key: string): { globalValue?: T } | undefined {
        return workspace.getConfiguration(this.section).inspect<T>(key);
    }

    public async update(section: string, value: unknown, configurationTarget?: ConfigurationTarget): Promise<void> {
        await workspace.getConfiguration(this.section).update(section, value, configurationTarget);
    }
}
