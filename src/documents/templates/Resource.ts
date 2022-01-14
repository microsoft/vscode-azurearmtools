// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { templateKeys } from "../../../common";
import * as Json from "../../language/json/JSON";
import { Span } from "../../language/Span";
import { CachedValue } from "../../util/CachedValue";
import { IResource } from "./IResource";
import { TemplateScope } from "./scopes/TemplateScope";
import { getChildTemplateForResourceObject } from "./scopes/templateScopes";

/**
 * This class represents a member of the "resources" section in a deployment template
 */
export class Resource implements IResource {
    private readonly _childTemplate: CachedValue<TemplateScope | undefined> = new CachedValue<TemplateScope | undefined>();
    private readonly _nameValueCache: CachedValue<Json.StringValue | undefined> = new CachedValue<Json.StringValue | undefined>();
    private readonly _resTypeCache: CachedValue<Json.StringValue | undefined> = new CachedValue<Json.StringValue | undefined>();

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
            return getChildTemplateForResourceObject(this.parentScope, this, this.resourceObject);
        });
    }

    public get span(): Span {
        return this.resourceObject.span;
    }

    public get nameValue(): Json.StringValue | undefined {
        return this._nameValueCache.getOrCacheValue(() =>
            this.resourceObject.getPropertyValue(templateKeys.resourceName)?.asStringValue
        );
    }

    public get resourceTypeValue(): Json.StringValue | undefined {
        return this._resTypeCache.getOrCacheValue(() =>
            this.resourceObject.getPropertyValue(templateKeys.resourceType)?.asStringValue
        );
    }
}
