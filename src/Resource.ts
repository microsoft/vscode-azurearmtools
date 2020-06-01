// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CachedValue } from "./CachedValue";
import { templateKeys } from "./constants";
import { IResource } from "./IResource";
import * as Json from "./JSON";
import * as language from "./Language";
import { TemplateScope } from "./TemplateScope";
import { getChildTemplateForResourceObject } from "./templateScopes";

/**
 * This class represents a member of the "resources" section in a deployment template
 */
export class Resource implements IResource {
    private readonly _childTemplate: CachedValue<TemplateScope | undefined> = new CachedValue<TemplateScope | undefined>();
    private readonly _nameValueCache: CachedValue<Json.StringValue | undefined> = new CachedValue<Json.StringValue | undefined>();

    constructor(
        private readonly parentScope: TemplateScope,
        public readonly resourceObject: Json.ObjectValue
    ) { }

    /**
     * Convenient way of seeing what this object represents in the debugger, shouldn't be used for production code
     */
    public get __debugDisplay(): string {
        return this.nameValue?.unquotedValue ?? '(unnamed resource)';
    }

    public get childDeployment(): TemplateScope | undefined {
        return this._childTemplate.getOrCacheValue(() => {
            return getChildTemplateForResourceObject(this.parentScope, this.resourceObject);
        });
    }

    public get span(): language.Span {
        return this.resourceObject.span;
    }

    public get nameValue(): Json.StringValue | undefined {
        return this._nameValueCache.getOrCacheValue(() =>
            this.resourceObject.getPropertyValue(templateKeys.resourceName)?.asStringValue
        );
    }
}
