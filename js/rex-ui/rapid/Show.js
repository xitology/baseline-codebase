/**
 * @flow
 */

import invariant from "invariant";
import * as React from "react";

import { type Endpoint } from "rex-graphql";
import * as Resource from "rex-graphql/Resource2";

import { introspect } from "./Introspection";
import * as EndpointSchemaStorage from "./EndpointSchemaStorage.js";
import * as QueryPath from "./QueryPath.js";
import { ShowRenderer, type ShowRendererConfigProps } from "./ShowRenderer.js";
import * as Field from "./Field.js";
import { ErrorBoundary } from "./ErrorBoundary";

export type ShowProps<V, R, O = *> = {|
  endpoint: Endpoint,
  fetch: string,
  resource: Resource.Resource<V, R>,
  getRows: R => O,
  fields?: ?{ [name: $Keys<O>]: Field.FieldConfig },
  titleField?: ?Field.FieldConfig,
  args?: { [key: string]: any },
  onAdd?: () => void,
  onRemove?: () => void,
  ...ShowRendererConfigProps,
|};

export let Show = <V, R>(props: ShowProps<V, R>) => {
  let { fetch, endpoint, resource, fields = null, ...rest } = props;

  let fieldSpecs = Field.configureFields(fields);

  return (
    <ErrorBoundary>
      <ShowRenderer
        {...rest}
        endpoint={endpoint}
        resource={resource}
        fieldSpecs={fieldSpecs}
      />
    </ErrorBoundary>
  );
};
