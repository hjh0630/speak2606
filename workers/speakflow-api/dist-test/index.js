var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// content/scenarios.json
var scenarios_default = [
  {
    id: "phone_meeting",
    title_zh: "\u7535\u8BDD\u4F1A\u8BAE",
    title_en: "Phone Meeting",
    icon: "\u{1F4DE}",
    description_zh: "\u4E0E\u6D77\u5916\u5BA2\u6237\u521D\u6B21/\u8DDF\u8FDB\u901A\u8BDD,\u4ECB\u7ECD\u516C\u53F8\u3001\u786E\u8BA4\u9700\u6C42\u3001\u63A8\u52A8\u4E0B\u4E00\u6B65",
    description_en: "Initial or follow-up call with overseas buyers \u2014 introductions, product discussion, next-step alignment",
    category: "communication",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / sourcing manager",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u5BA2\u6237",
    user_role: "Chinese export sales representative (garment & textile)",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458(\u670D\u88C5\u7EBA\u7EC7)",
    key_skills: [
      "opening the call",
      "introducing the company",
      "presenting samples and capacity",
      "handling objections",
      "confirming next steps and closing"
    ],
    key_skills_zh: [
      "\u5F00\u573A\u767D",
      "\u516C\u53F8\u4ECB\u7ECD",
      "\u6837\u54C1\u4E0E\u4EA7\u80FD\u63A8\u4ECB",
      "\u5904\u7406\u5F02\u8BAE",
      "\u786E\u8BA4\u4E0B\u4E00\u6B65\u5E76\u6536\u5C3E"
    ],
    industry_terms_sample: [
      "MOQ",
      "lead time",
      "handfeel",
      "sample yardage",
      "bulk order"
    ],
    estimated_minutes: 8,
    tags: [
      "voice",
      "sales",
      "follow-up"
    ]
  },
  {
    id: "inquiry_quote",
    title_zh: "\u8BE2\u76D8\u62A5\u4EF7",
    title_en: "Inquiry & Quotation",
    icon: "\u{1F4E8}",
    description_zh: "\u6536\u5230 RFQ\u3001\u62A5\u4EF7\u3001\u8BAE\u4EF7\u3001\u786E\u8BA4 PI",
    description_en: "Responding to RFQs, preparing quotations, negotiating price, issuing Proforma Invoice",
    category: "sales",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / merchandiser",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u8DDF\u5355",
    user_role: "Chinese export sales representative (garment & textile)",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458(\u670D\u88C5\u7EBA\u7EC7)",
    key_skills: [
      "understanding the RFQ",
      "calculating FOB / CIF / EXW prices",
      "presenting cost breakdown",
      "negotiating price and MOQ",
      "issuing and following up on PI"
    ],
    key_skills_zh: [
      "\u7406\u89E3\u8BE2\u76D8",
      "FOB / CIF / EXW \u62A5\u4EF7\u8BA1\u7B97",
      "\u6210\u672C\u7ED3\u6784\u8BF4\u660E",
      "\u8BAE\u4EF7\u4E0E MOQ \u8C08\u5224",
      "PI \u53D1\u9001\u4E0E\u8DDF\u8FDB"
    ],
    industry_terms_sample: [
      "RFQ",
      "PI",
      "FOB",
      "CIF",
      "EXW",
      "TT payment",
      "deposit"
    ],
    estimated_minutes: 10,
    tags: [
      "email_to_call",
      "pricing",
      "negotiation"
    ]
  },
  {
    id: "factory_audit",
    title_zh: "\u5DE5\u5382\u53C2\u89C2/\u9A8C\u5382",
    title_en: "Factory Visit & Audit",
    icon: "\u{1F3ED}",
    description_zh: "\u63A5\u5F85\u5BA2\u6237\u9A8C\u5382\u3001\u4ECB\u7ECD\u4EA7\u7EBF\u4EA7\u80FD\u3001\u56DE\u7B54\u5408\u89C4\u4E0E\u54C1\u63A7\u95EE\u9898",
    description_en: "Hosting customer audits, presenting production lines, capacity, QC and compliance",
    category: "operations",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / third-party auditor (BSCI / SEDEX / SA8000)",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u7B2C\u4E09\u65B9\u9A8C\u5382\u5458",
    user_role: "Chinese factory sales / merchandising manager",
    user_role_zh: "\u4E2D\u56FD\u5DE5\u5382\u4E1A\u52A1/\u8DDF\u5355\u4E3B\u7BA1",
    key_skills: [
      "greeting and safety briefing",
      "presenting company profile and capacity",
      "walking the production lines (cutting, sewing, finishing, packing)",
      "explaining QC procedures and AQL",
      "answering compliance and CSR questions"
    ],
    key_skills_zh: [
      "\u6B22\u8FCE\u4E0E\u5B89\u5168\u987B\u77E5",
      "\u516C\u53F8\u53CA\u4EA7\u80FD\u4ECB\u7ECD",
      "\u4EA7\u7EBF\u53C2\u89C2\u8BB2\u89E3(\u88C1\u526A/\u8F66\u7F1D/\u540E\u6574/\u5305\u88C5)",
      "QC \u6D41\u7A0B\u4E0E AQL \u8BF4\u660E",
      "\u5408\u89C4\u4E0E CSR \u95EE\u9898\u5E94\u7B54"
    ],
    industry_terms_sample: [
      "AQL",
      "QC",
      "production line",
      "capacity",
      "lead time"
    ],
    estimated_minutes: 12,
    tags: [
      "on_site",
      "compliance",
      "production"
    ]
  },
  {
    id: "logistics_shipping",
    title_zh: "\u7269\u6D41/\u8239\u671F/\u5355\u8BC1",
    title_en: "Logistics, Shipping & Documents",
    icon: "\u{1F6A2}",
    description_zh: "\u50AC\u8D27\u3001\u88C5\u67DC\u3001\u63D0\u5355\u3001\u62A5\u5173\u3001\u5355\u8BC1\u6C9F\u901A",
    description_en: "Shipping follow-up, container loading, B/L, customs clearance, document handling",
    category: "logistics",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / freight forwarder / shipping coordinator",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u8D27\u4EE3 / \u8239\u52A1",
    user_role: "Chinese export sales / shipping clerk",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458/\u8239\u52A1",
    key_skills: [
      "giving shipping status updates",
      "explaining ETD / ETA / cut-off time",
      "coordinating container loading and stuffing",
      "preparing and checking B/L, invoice, packing list, C/O",
      "handling customs and inspection issues"
    ],
    key_skills_zh: [
      "\u8239\u671F\u72B6\u6001\u6C47\u62A5",
      "ETD / ETA / \u622A\u5173\u65F6\u95F4\u89E3\u91CA",
      "\u88C5\u67DC\u4E0E\u88C5\u7BB1\u534F\u8C03",
      "\u63D0\u5355/\u53D1\u7968/\u88C5\u7BB1\u5355/\u4EA7\u5730\u8BC1\u51C6\u5907\u6838\u5BF9",
      "\u62A5\u5173\u4E0E\u67E5\u9A8C\u95EE\u9898\u5904\u7406"
    ],
    industry_terms_sample: [
      "ETD",
      "ETA",
      "B/L",
      "C/O",
      "FCL",
      "LCL",
      "telex release"
    ],
    estimated_minutes: 9,
    tags: [
      "shipping",
      "documents",
      "logistics"
    ]
  },
  {
    id: "sample_development",
    title_zh: "\u6B3E\u5F0F\u5F00\u53D1/\u6253\u6837",
    title_en: "Sample Development",
    icon: "\u{1F9F5}",
    description_zh: "\u786E\u8BA4\u6837\u677F\u3001\u5DE5\u827A\u3001\u4FEE\u6539\u610F\u89C1\u3001\u5BC4\u6837\u8DDF\u8FDB",
    description_en: "Sample confirmation, workmanship discussion, revision feedback, sample shipment follow-up",
    category: "product",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / designer / merchandiser",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u8BBE\u8BA1\u5E08 / \u8DDF\u5355",
    user_role: "Chinese merchandiser / sample room coordinator",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u8DDF\u5355/\u6837\u8863\u623F\u534F\u8C03\u5458",
    key_skills: [
      "confirming tech-pack and spec sheet",
      "discussing fabric, GSM, yarn count, handfeel",
      "explaining workmanship and stitching",
      "handling fit / measurement comments",
      "managing sample yardage and courier (DHL / FedEx)"
    ],
    key_skills_zh: [
      "\u5DE5\u827A\u5355\u4E0E\u5C3A\u5BF8\u8868\u786E\u8BA4",
      "\u9762\u6599/\u514B\u91CD/\u7EB1\u652F/\u624B\u611F\u8BA8\u8BBA",
      "\u8F66\u7F1D\u5DE5\u827A\u8BB2\u89E3",
      "\u5C3A\u5BF8\u4E0E\u7248\u578B\u610F\u89C1\u5904\u7406",
      "\u6837\u5E03\u7528\u91CF\u4E0E\u5FEB\u9012\u5BC4\u6837\u8DDF\u8FDB"
    ],
    industry_terms_sample: [
      "GSM",
      "yarn count",
      "handfeel",
      "tech-pack",
      "pre-production sample"
    ],
    estimated_minutes: 10,
    tags: [
      "product",
      "R&D",
      "sampling"
    ]
  },
  {
    id: "claim_aftersales",
    title_zh: "\u7D22\u8D54/\u552E\u540E",
    title_en: "Claims & After-sales",
    icon: "\u26A0\uFE0F",
    description_zh: "\u8D28\u91CF\u95EE\u9898\u3001\u5EF6\u8BEF\u3001\u6263\u6B3E\u3001\u89E3\u51B3\u65B9\u6848\u8C08\u5224",
    description_en: "Quality issues, shipment delay, debit notes, negotiating solutions",
    category: "service",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / QC manager / legal representative",
    ai_role_zh: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u54C1\u63A7\u7ECF\u7406 / \u6CD5\u52A1",
    user_role: "Chinese export sales / quality manager",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458/\u54C1\u8D28\u7ECF\u7406",
    key_skills: [
      "receiving and acknowledging complaints",
      "asking for evidence (photos, inspection report, sample)",
      "proposing root-cause analysis and corrective action",
      "negotiating debit note / discount / replacement",
      "closing the claim with timeline"
    ],
    key_skills_zh: [
      "\u63A5\u6536\u5E76\u786E\u8BA4\u6295\u8BC9",
      "\u8981\u6C42\u8BC1\u636E(\u7167\u7247/\u9A8C\u8D27\u62A5\u544A/\u6837\u54C1)",
      "\u6839\u56E0\u5206\u6790\u4E0E\u7EA0\u6B63\u63AA\u65BD\u63D0\u8BAE",
      "\u6263\u6B3E/\u6298\u6263/\u8865\u8D27\u8C08\u5224",
      "\u7D22\u8D54\u5173\u95ED\u4E0E\u65F6\u95F4\u8282\u70B9"
    ],
    industry_terms_sample: [
      "debit note",
      "claim",
      "inspection report",
      "AQL",
      "rework"
    ],
    estimated_minutes: 11,
    tags: [
      "service",
      "quality",
      "negotiation"
    ]
  },
  {
    id: "yarn_sourcing",
    title_zh: "\u7EB1\u7EBF\u91C7\u8D2D",
    title_en: "Yarn Sourcing",
    icon: "\u{1F9F6}",
    description_zh: "\u4E0E\u7EB1\u7EBF\u4F9B\u5E94\u5546\u6C9F\u901A\u6210\u5206\u3001\u7EB1\u652F\u3001\u637B\u5EA6\u3001\u989C\u8272\u3001\u8D77\u8BA2\u91CF\u3001\u4EF7\u683C\u4E0E\u4EA4\u671F",
    description_en: "Discuss composition, yarn count, twist, color, MOQ, price and lead time with yarn suppliers",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Yarn supplier / sales representative",
    ai_role_zh: "\u7EB1\u7EBF\u4F9B\u5E94\u5546 / \u4E1A\u52A1\u5458",
    user_role: "Knit or woven fabric sourcing / merchandiser (garment factory)",
    user_role_zh: "\u9762\u6599\u91C7\u8D2D\u6216\u8DDF\u5355(\u670D\u88C5\u5382)",
    key_skills: [
      "specifying yarn composition and count",
      "discussing twist and spinning method",
      "requesting color matching against Pantone",
      "negotiating MOQ and cone weight",
      "confirming lead time and sample dispatch"
    ],
    key_skills_zh: [
      "\u6210\u5206\u4E0E\u7EB1\u652F\u8868\u8FBE",
      "\u637B\u5EA6\u4E0E\u7EBA\u7EB1\u65B9\u5F0F\u8BA8\u8BBA",
      "\u5BF9\u8272\u4E0E\u6F58\u901A\u8272\u53F7",
      "\u8D77\u8BA2\u91CF\u4E0E\u7B52\u91CD\u8C08\u5224",
      "\u4EA4\u671F\u4E0E\u6837\u54C1\u5BC4\u9001\u786E\u8BA4"
    ],
    industry_terms_sample: [
      "yarn count",
      "twist",
      "combed",
      "compact yarn",
      "Pantone TCX"
    ],
    estimated_minutes: 9,
    tags: [
      "process",
      "yarn",
      "sourcing"
    ]
  },
  {
    id: "weaving_knitting",
    title_zh: "\u7EC7\u9020\u6C9F\u901A",
    title_en: "Weaving & Knitting",
    icon: "\u{1FAA1}",
    description_zh: "\u4E0E\u7EC7\u5382\u6216\u9488\u7EC7\u5382\u6280\u672F\u6C9F\u901A\u68AD\u7EC7 / \u9488\u7EC7\u3001\u7EC4\u7EC7\u7ED3\u6784\u3001\u514B\u91CD\u3001\u5BC6\u5EA6\u3001\u4E0A\u673A\u53C2\u6570\u4E0E\u7F29\u7387",
    description_en: "Discuss woven vs knit construction, fabric structure, GSM, density, machine settings and shrinkage with the mill",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Weaving / knitting mill technician",
    ai_role_zh: "\u7EC7\u5382 / \u9488\u7EC7\u5382\u6280\u672F\u5458",
    user_role: "Garment factory merchandiser or fabric sourcing",
    user_role_zh: "\u670D\u88C5\u5382\u8DDF\u5355 / \u9762\u6599\u91C7\u8D2D",
    key_skills: [
      "choosing weave vs knit",
      "specifying GSM, EPI/PPI, courses/wales",
      "discussing machine gauge and stitch length",
      "negotiating width and shrinkage tolerance",
      "requesting greige or finish samples"
    ],
    key_skills_zh: [
      "\u68AD\u7EC7\u4E0E\u9488\u7EC7\u9009\u62E9",
      "\u514B\u91CD\u3001\u5BC6\u5EA6\u3001\u7EBF\u5708\u53C2\u6570",
      "\u673A\u53F7\u4E0E\u7EBF\u5708\u957F\u5EA6",
      "\u95E8\u5E45\u4E0E\u7F29\u7387\u516C\u5DEE",
      "\u576F\u5E03\u4E0E\u6210\u54C1\u6837\u7533\u8BF7"
    ],
    industry_terms_sample: [
      "GSM",
      "EPI",
      "PPI",
      "gauge",
      "shrinkage"
    ],
    estimated_minutes: 10,
    tags: [
      "process",
      "weaving",
      "knitting"
    ]
  },
  {
    id: "dyeing_finishing",
    title_zh: "\u67D3\u6574\u5DE5\u827A",
    title_en: "Dyeing & Finishing",
    icon: "\u{1F3A8}",
    description_zh: "\u4E0E\u67D3\u5382\u8DDF\u5355:\u67D3\u8272\u3001\u5370\u82B1\u3001\u540E\u6574\u7406\u3001\u8272\u7262\u5EA6\u3001\u514B\u91CD\u635F\u5931\u3001\u7F29\u6C34\u4E0E\u624B\u611F",
    description_en: "Coordinate with the dye house on dyeing, finishing, color fastness, GSM loss, shrinkage and handfeel",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Dye house merchandiser / colorist",
    ai_role_zh: "\u67D3\u5382\u8DDF\u5355 / \u8C03\u8272\u5E08",
    user_role: "Garment factory merchandiser / sourcing",
    user_role_zh: "\u670D\u88C5\u5382\u8DDF\u5355 / \u9762\u6599\u91C7\u8D2D",
    key_skills: [
      "specifying dye process and color matching",
      "reviewing lab dips and production lots",
      "discussing color fastness to wash, light, rubbing",
      "explaining GSM loss and shrinkage",
      "requesting finishing options (mercerizing, singeing, softening)"
    ],
    key_skills_zh: [
      "\u67D3\u8272\u5DE5\u827A\u4E0E\u5BF9\u8272",
      "\u5BF9\u8272\u6837\u4E0E\u751F\u4EA7\u5927\u8D27",
      "\u8010\u6D17 / \u8010\u5149 / \u8010\u6469\u64E6\u8272\u7262\u5EA6",
      "\u514B\u91CD\u635F\u5931\u4E0E\u7F29\u6C34",
      "\u540E\u6574\u7406(\u4E1D\u5149/\u70E7\u6BDB/\u67D4\u8F6F)"
    ],
    industry_terms_sample: [
      "lab dip",
      "Delta E",
      "reactive dye",
      "color fastness",
      "GSM loss"
    ],
    estimated_minutes: 10,
    tags: [
      "process",
      "dyeing",
      "finishing"
    ]
  },
  {
    id: "printing_embroidery",
    title_zh: "\u5370\u7EE3\u82B1\u5DE5\u827A",
    title_en: "Printing & Embroidery",
    icon: "\u{1F58B}\uFE0F",
    description_zh: "\u4E0E\u5370\u82B1\u5382 / \u7EE3\u82B1\u5382\u6C9F\u901A\u5370\u82B1\u65B9\u5F0F(\u6570\u7801 / \u7F51\u5370 / \u5706\u7F51 / \u5E73\u7F51)\u3001\u7EE3\u82B1\u5DE5\u827A\u3001\u82B1\u578B\u4E0E\u914D\u8272",
    description_en: "Coordinate with print and embroidery houses on print method (digital / rotary / flat screen), embroidery technique, artwork and color matching",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Print / embroidery house merchandiser",
    ai_role_zh: "\u5370\u82B1\u5382 / \u7EE3\u82B1\u5382\u8DDF\u5355",
    user_role: "Garment factory merchandiser / designer",
    user_role_zh: "\u670D\u88C5\u5382\u8DDF\u5355 / \u8BBE\u8BA1\u5E08",
    key_skills: [
      "choosing the right print method",
      "preparing artwork for color separation",
      "specifying embroidery stitch type and density",
      "matching Pantone shades across print / embroidery",
      "approving strike-off and production samples"
    ],
    key_skills_zh: [
      "\u5370\u82B1\u65B9\u5F0F\u9009\u62E9",
      "\u82B1\u578B\u5206\u8272\u4E0E\u6587\u4EF6\u51C6\u5907",
      "\u7EE3\u82B1\u9488\u6CD5\u4E0E\u5BC6\u5EA6",
      "\u6F58\u901A\u8272\u53F7\u7EDF\u4E00",
      "\u6253\u6837\u4E0E\u5927\u8D27\u786E\u8BA4"
    ],
    industry_terms_sample: [
      "digital print",
      "rotary screen",
      "satin stitch",
      "Pantone TCX",
      "registration"
    ],
    estimated_minutes: 9,
    tags: [
      "process",
      "print",
      "embroidery"
    ]
  },
  {
    id: "seamless_garment",
    title_zh: "\u65E0\u7F1D\u670D\u88C5",
    title_en: "Seamless Garment",
    icon: "\u{1FA71}",
    description_zh: "\u4E0E\u65E0\u7F1D\u5185\u8863\u5382\u6C9F\u901A\u7B52\u5F62\u7ED3\u6784\u3001seamless knitting\u3001\u6C28\u7EB6\u6BD4\u4F8B\u3001\u514B\u91CD\u5206\u5E03\u4E0E\u5C3A\u7801",
    description_en: "Talk to seamless knitwear factories on tubular construction, seamless knitting, spandex ratio, GSM distribution and sizing",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Seamless knitting factory merchandiser",
    ai_role_zh: "\u65E0\u7F1D\u9488\u7EC7\u5382\u8DDF\u5355",
    user_role: "Intimates / activewear merchandiser",
    user_role_zh: "\u5185\u8863 / \u8FD0\u52A8\u670D\u88C5\u8DDF\u5355",
    key_skills: [
      "explaining seamless knitting and tubular body",
      "specifying nylon-to-spandex ratio and denier",
      "discussing machine gauge (E14, E18, E28)",
      "reviewing GSM distribution across body zones",
      "approving fit on body length, gusset and waistband"
    ],
    key_skills_zh: [
      "\u65E0\u7F1D\u9488\u7EC7\u4E0E\u7B52\u5F62\u7ED3\u6784",
      "\u9526\u7EB6\u6C28\u7EB6\u6BD4\u4E0E\u65E6\u6570",
      "\u673A\u53F7 E14 / E18 / E28",
      "\u5206\u533A\u514B\u91CD\u4E0E\u538B\u529B\u5206\u5E03",
      "\u7B52\u957F / \u4E09\u89D2\u533A / \u8170\u5934\u5C3A\u5BF8"
    ],
    industry_terms_sample: [
      "seamless knitting",
      "spandex",
      "gauge E28",
      "gusset",
      "tubular"
    ],
    estimated_minutes: 9,
    tags: [
      "process",
      "seamless",
      "intimate",
      "activewear"
    ]
  },
  {
    id: "quality_tech_issue",
    title_zh: "\u5DE5\u827A\u95EE\u9898\u89E3\u51B3",
    title_en: "Quality & Tech Issue Resolution",
    icon: "\u{1F6E0}\uFE0F",
    description_zh: "\u9762\u5BF9\u5BA2\u6237 / QC,\u89E3\u91CA\u75B5\u70B9\u3001\u8FD4\u5DE5\u65B9\u6848\u3001\u5DE5\u827A\u6539\u8FDB\u4E0E\u8BA9\u6B65\u63A5\u6536",
    description_en: "Explain defects, propose rework, suggest process improvement and concession options to the buyer or QC",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Buyer / third-party QC inspector",
    ai_role_zh: "\u5BA2\u6237 / \u7B2C\u4E09\u65B9\u9A8C\u8D27\u5458",
    user_role: "Chinese factory quality manager / merchandiser",
    user_role_zh: "\u5DE5\u5382\u54C1\u8D28\u7ECF\u7406 / \u8DDF\u5355",
    key_skills: [
      "acknowledging and categorizing defects (barry, skew, pilling, hole)",
      "requesting evidence (photo, inspection report, reference sample)",
      "explaining root cause in process terms",
      "proposing rework or repair in the factory",
      "negotiating concession / AQL relaxation / down-grade"
    ],
    key_skills_zh: [
      "\u75B5\u70B9\u5206\u7C7B\u4E0E\u786E\u8BA4",
      "\u8BC1\u636E\u8981\u6C42(\u7167\u7247 / \u62A5\u544A / \u53C2\u8003\u6837)",
      "\u6839\u56E0\u5206\u6790(\u5DE5\u827A\u5C42\u9762)",
      "\u5382\u5185\u8FD4\u5DE5 / \u4FEE\u8865\u65B9\u6848",
      "\u8BA9\u6B65\u63A5\u6536 / AQL \u653E\u5BBD / \u964D\u7EA7"
    ],
    industry_terms_sample: [
      "barry",
      "skew",
      "pilling",
      "AQL",
      "rework"
    ],
    estimated_minutes: 11,
    tags: [
      "process",
      "quality",
      "problem solving"
    ]
  },
  {
    id: "shirt_production",
    title_zh: "\u886C\u8863\u751F\u4EA7",
    title_en: "Shirt Production",
    icon: "\u{1F454}",
    description_zh: "\u68AD\u7EC7\u886C\u8863\u5168\u6D41\u7A0B\u6C9F\u901A:\u9762\u6599\u8FDB\u5382\u68C0\u9A8C\u3001\u6280\u672F\u51C6\u5907\u3001\u88C1\u526A\u3001\u7F1D\u5236\u3001\u9501\u773C\u9489\u6263\u3001\u6574\u70EB\u3001\u6210\u8863\u68C0\u9A8C\u3001\u5305\u88C5\u5165\u5E93",
    description_en: "Full woven shirt production communication: incoming fabric inspection, tech pack prep, cutting, sewing, buttonholes, ironing, final inspection, packing",
    category: "refine",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Shirt factory production manager / cutting room / IE engineer",
    ai_role_zh: "\u886C\u8863\u751F\u4EA7\u5382\u957F / \u8F66\u95F4\u4E3B\u4EFB / IE \u5DE5\u7A0B\u5E08",
    user_role: "Merchandiser or QA following up shirt production",
    user_role_zh: "\u8DDF\u5355\u6216\u8D28\u68C0",
    key_skills: [
      "fabric inspection report (4-point system)",
      "marker making and spreading",
      "seam allowance and SPI",
      "buttonhole and button attaching",
      "fusing and interlining",
      "ironing temperature and pressing cloth",
      "AQL final inspection",
      "folding and polybag packing"
    ],
    key_skills_zh: [
      "\u9762\u6599 4 \u5206\u5236\u68C0\u9A8C",
      "\u6392\u6599\u4E0E\u62D6\u6599",
      "\u7F1D\u4EFD\u4E0E\u9488\u8DDD",
      "\u9501\u773C\u9489\u6263",
      "\u7C98\u5408\u886C\u4E0E\u538B\u70EB",
      "\u6574\u70EB\u6E29\u5EA6\u4E0E\u70EB\u5E03",
      "AQL \u7EC8\u68C0",
      "\u6298\u53E0\u4E0E\u80F6\u888B\u5305\u88C5"
    ],
    industry_terms_sample: [
      "tech pack",
      "marker",
      "seam allowance",
      "SPI",
      "fusing",
      "AQL"
    ],
    estimated_minutes: 10,
    tags: [
      "refine",
      "garment",
      "production",
      "shirt"
    ]
  },
  {
    id: "order_management",
    title_zh: "\u8BA2\u5355\u6C9F\u901A",
    title_en: "Order Management",
    icon: "\u{1F4CB}",
    description_zh: "\u8BA2\u5355\u5168\u5468\u671F\u6C9F\u901A:\u63A5\u5355\u3001PI \u5236\u4F5C\u3001\u5BA2\u6237\u786E\u8BA4\u3001\u9884\u4ED8\u6B3E\u3001\u6392\u4EA7\u3001\u5927\u8D27\u8FDB\u5EA6\u3001\u51FA\u8FD0\u3001\u5C3E\u6B3E",
    description_en: "Full order cycle communication: order intake, PI, customer confirmation, deposit, production, shipment, balance",
    category: "refine",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Overseas buyer / brand sourcing manager",
    ai_role_zh: "\u6D77\u5916\u54C1\u724C\u91C7\u8D2D / \u5BA2\u6237",
    user_role: "Chinese export sales / merchandising",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458 / \u8DDF\u5355",
    key_skills: [
      "issuing and confirming PI",
      "explaining payment terms (TT, LC, DP, DA)",
      "tracking deposit and balance",
      "communicating ETD and ETA",
      "managing booking and cut-off",
      "OEM vs ODM scope"
    ],
    key_skills_zh: [
      "PI \u5236\u4F5C\u4E0E\u786E\u8BA4",
      "\u4ED8\u6B3E\u65B9\u5F0F\u89E3\u91CA(TT/LC/DP/DA)",
      "\u5B9A\u91D1\u4E0E\u5C3E\u6B3E\u8DDF\u8FDB",
      "ETD/ETA \u6C9F\u901A",
      "\u8BA2\u8231\u4E0E\u622A\u6E2F",
      "OEM/ODM \u8303\u56F4"
    ],
    industry_terms_sample: [
      "Proforma Invoice",
      "TT 30/70",
      "LC at sight",
      "deposit",
      "ETD",
      "ETA",
      "booking"
    ],
    estimated_minutes: 10,
    tags: [
      "refine",
      "order",
      "sales",
      "shipping"
    ]
  },
  {
    id: "exception_handling",
    title_zh: "\u5F02\u5E38\u5904\u7406",
    title_en: "Exception Handling",
    icon: "\u26A0\uFE0F",
    description_zh: "\u751F\u4EA7\u4E0E\u8BA2\u5355\u5F02\u5E38\u5E94\u6025:\u5EF6\u671F\u3001\u8D28\u91CF\u504F\u5DEE\u3001\u6539\u5355\u3001\u7269\u6599\u65AD\u4F9B\u3001\u8239\u671F\u5EF6\u8BEF\u3001\u7D22\u8D54\u524D\u7F6E\u6C9F\u901A",
    description_en: "Emergency handling of production and order issues: delays, spec deviations, order changes, material shortages, shipment slips, pre-claim conversations",
    category: "refine",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Buyer under pressure / third-party QC",
    ai_role_zh: "\u5BA2\u6237(\u9762\u5BF9\u5EF6\u671F/\u95EE\u9898) / \u7B2C\u4E09\u65B9 QC",
    user_role: "Merchandiser or export manager handling exceptions",
    user_role_zh: "\u8DDF\u5355\u6216\u5916\u8D38\u7ECF\u7406\u5904\u7406\u5F02\u5E38",
    key_skills: [
      "notifying delays proactively",
      "explaining force majeure calmly",
      "proposing rework or replacement",
      "offering credit note to prevent claim",
      "issuing revised ETD",
      "writing 8D / RC report"
    ],
    key_skills_zh: [
      "\u4E3B\u52A8\u901A\u77E5\u5EF6\u671F",
      "\u4E0D\u53EF\u6297\u529B\u51B7\u9759\u8BF4\u660E",
      "\u8FD4\u5DE5 / \u6362\u8D27\u65B9\u6848",
      "\u6263\u6B3E / \u8D37\u9879\u901A\u77E5\u9632\u7D22\u8D54",
      "\u4FEE\u8BA2 ETD \u6C9F\u901A",
      "8D / RC \u62A5\u544A"
    ],
    industry_terms_sample: [
      "force majeure",
      "expedite",
      "rework",
      "credit note",
      "claim",
      "8D"
    ],
    estimated_minutes: 11,
    tags: [
      "refine",
      "exception",
      "crisis",
      "claim"
    ]
  },
  {
    id: "post_mortem",
    title_zh: "\u53CD\u601D\u590D\u76D8",
    title_en: "Post-Mortem Review",
    icon: "\u{1F50D}",
    description_zh: "\u8BA2\u5355\u7ED3\u675F\u540E\u590D\u76D8:\u8D28\u91CF\u95EE\u9898\u3001\u4EA4\u671F\u95EE\u9898\u3001\u5BA2\u6237\u53CD\u9988\u3001\u6539\u8FDB\u63AA\u65BD\u3001SOP \u66F4\u65B0\u30015-why \u5206\u6790",
    description_en: "End-of-order review: quality issues, lead-time issues, customer feedback, improvements, SOP updates, 5-why analysis",
    category: "refine",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Factory management / quality manager",
    ai_role_zh: "\u5DE5\u5382\u7BA1\u7406\u5C42 / \u54C1\u8D28\u7ECF\u7406",
    user_role: "Project manager reporting to senior management",
    user_role_zh: "\u9879\u76EE\u7ECF\u7406(\u5411\u7BA1\u7406\u5C42\u6C47\u62A5)",
    key_skills: [
      "running 5-why root cause analysis",
      "writing corrective and preventive action (CAPA)",
      "summarizing lessons learned",
      "updating SOPs and work instructions",
      "presenting KPI review",
      "proposing PDCA and Kaizen improvements"
    ],
    key_skills_zh: [
      "5-why \u6839\u56E0\u5206\u6790",
      "CAPA \u7EA0\u6B63\u9884\u9632\u63AA\u65BD",
      "\u7ECF\u9A8C\u6559\u8BAD\u603B\u7ED3",
      "SOP \u4E0E\u4F5C\u4E1A\u6307\u5BFC\u4E66\u66F4\u65B0",
      "KPI \u590D\u76D8\u6C47\u62A5",
      "PDCA \u4E0E\u6539\u5584\u63D0\u6848"
    ],
    industry_terms_sample: [
      "5-why analysis",
      "root cause",
      "CAPA",
      "SOP",
      "PDCA",
      "Kaizen"
    ],
    estimated_minutes: 10,
    tags: [
      "refine",
      "post-mortem",
      "Kaizen",
      "CAPA"
    ]
  },
  {
    id: "flyknit_weaving",
    title_zh: "\u98DE\u7EC7",
    title_en: "Flyknit Weaving",
    icon: "\u{1F9E6}",
    description_zh: "\u98DE\u7EC7\u978B\u9762\u6280\u672F\u6C9F\u901A,\u4E00\u4F53\u7F16\u7EC7\u3001\u96F6\u7F1D\u5408\u3001\u7535\u8111\u6A2A\u673A",
    description_en: "Flyknit upper technology \u2014 one-piece knitting, no-sew construction, computer flat knitting",
    category: "weaving",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Flyknit factory technical engineer (upper development)",
    ai_role_zh: "\u98DE\u7EC7\u5382\u6280\u672F\u5DE5\u7A0B\u5E08(\u978B\u9762\u5F00\u53D1)",
    user_role: "Footwear brand sourcing / designer",
    user_role_zh: "\u8FD0\u52A8\u54C1\u724C\u91C7\u8D2D / \u978B\u7C7B\u8BBE\u8BA1\u5E08",
    key_skills: [
      "upper design",
      "yarn selection",
      "gauge selection",
      "pattern programming",
      "production lead time",
      "QC standards"
    ],
    key_skills_zh: [
      "\u978B\u9762\u8BBE\u8BA1",
      "\u7EB1\u7EBF\u9009\u578B",
      "\u673A\u53F7\u9009\u62E9",
      "\u82B1\u578B\u7F16\u7A0B",
      "\u751F\u4EA7\u4EA4\u671F",
      "QC \u6807\u51C6"
    ],
    industry_terms_sample: [
      "flyknit",
      "intarsia",
      "computer flat knitting machine",
      "gauge E14",
      "jacquard pattern",
      "no-sew upper"
    ],
    estimated_minutes: 9,
    tags: [
      "knitting",
      "footwear",
      "technical"
    ]
  },
  {
    id: "warp_knitting",
    title_zh: "\u7ECF\u7F16",
    title_en: "Warp Knitting",
    icon: "\u{1FAA1}",
    description_zh: "\u7ECF\u7F16\u5DE5\u827A\u6C9F\u901A,tricot / raschel\u3001\u591A\u68B3\u6809\u3001\u886C\u7EAC",
    description_en: "Warp knitting \u2014 tricot, raschel, multi-bar, guide bars, inlay",
    category: "weaving",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Warp knitting factory technician",
    ai_role_zh: "\u7ECF\u7F16\u5382\u6280\u672F\u5458",
    user_role: "Fabric sourcing / lingerie factory merchandiser",
    user_role_zh: "\u9762\u6599\u91C7\u8D2D / \u5185\u8863\u5382\u5DE5\u827A",
    key_skills: [
      "specifying warp knit fabric",
      "guide bar configuration",
      "understanding inlay",
      "lace vs mesh",
      "lead time and MOQ"
    ],
    key_skills_zh: [
      "\u7ECF\u7F16\u9762\u6599\u89C4\u683C",
      "\u68B3\u6809\u914D\u7F6E",
      "\u886C\u7EAC\u7406\u89E3",
      "\u857E\u4E1D\u4E0E\u7F51\u773C\u533A\u5206",
      "\u4EA4\u671F\u4E0E MOQ"
    ],
    industry_terms_sample: [
      "warp knitting",
      "tricot",
      "raschel",
      "guide bar",
      "inlay",
      "raschel lace"
    ],
    estimated_minutes: 9,
    tags: [
      "knitting",
      "technical",
      "fabric"
    ]
  },
  {
    id: "shuttle_weaving",
    title_zh: "\u68AD\u7EC7",
    title_en: "Shuttle / Woven",
    icon: "\u{1F9F5}",
    description_zh: "\u68AD\u7EC7\u5DE5\u827A\u6C9F\u901A,\u55B7\u6C14/\u5251\u6746/\u6C34\u7EC7,\u7EC4\u7EC7\u4E0E\u5BC6\u5EA6",
    description_en: "Woven fabric \u2014 air-jet / rapier / water-jet, weave structures, density",
    category: "weaving",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Woven mill technical director",
    ai_role_zh: "\u68AD\u7EC7\u5382\u6280\u672F\u5382\u957F",
    user_role: "Shirt / suit factory / woven fabric sourcing",
    user_role_zh: "\u886C\u886B/\u897F\u88C5\u5382 / \u68AD\u7EC7\u9762\u6599\u91C7\u8D2D",
    key_skills: [
      "reading EPI / PPI",
      "weave structures",
      "loom selection",
      "warp and weft yarn",
      "finishing expectations"
    ],
    key_skills_zh: [
      "EPI / PPI \u8BC6\u522B",
      "\u7EC7\u7269\u7EC4\u7EC7",
      "\u7EC7\u673A\u9009\u578B",
      "\u7ECF\u7EAC\u7EB1",
      "\u540E\u6574\u7406\u9884\u671F"
    ],
    industry_terms_sample: [
      "air-jet loom",
      "rapier loom",
      "EPI",
      "PPI",
      "twill 3/1",
      "jacquard"
    ],
    estimated_minutes: 9,
    tags: [
      "weaving",
      "technical",
      "fabric"
    ]
  },
  {
    id: "weft_knitting",
    title_zh: "\u7EAC\u7F16",
    title_en: "Weft Knitting",
    icon: "\u{1F455}",
    description_zh: "\u7EAC\u7F16\u5DE5\u827A\u6C9F\u901A,\u5706\u673A/\u6A2A\u673A\u3001\u5355\u9762/\u53CC\u9762\u3001\u63D0\u82B1/\u7ED2\u7C7B",
    description_en: "Weft knitting \u2014 circular / flat, single jersey, interlock, rib, fleece",
    category: "weaving",
    subcategory: "garment_textile",
    difficulty_levels: [
      "beginner",
      "intermediate",
      "advanced"
    ],
    ai_role: "Weft knitting factory technician",
    ai_role_zh: "\u7EAC\u7F16\u5382\u6280\u672F\u5458",
    user_role: "T-shirt / underwear factory sourcing",
    user_role_zh: "T \u6064 / \u5185\u8863\u5382\u91C7\u8D2D",
    key_skills: [
      "specifying knit structure",
      "circular vs flat",
      "GSM and shrinkage",
      "yarn count",
      "lead time"
    ],
    key_skills_zh: [
      "\u9488\u7EC7\u7EC4\u7EC7\u89C4\u683C",
      "\u5706\u673A\u6A2A\u673A",
      "\u514B\u91CD\u4E0E\u7F29\u7387",
      "\u7EB1\u7EBF\u652F\u6570",
      "\u4EA4\u671F"
    ],
    industry_terms_sample: [
      "single jersey",
      "interlock",
      "rib 1x1",
      "pique",
      "3-thread fleece"
    ],
    estimated_minutes: 9,
    tags: [
      "knitting",
      "technical",
      "garment"
    ]
  },
  {
    id: "accessories_sourcing",
    title_zh: "\u8F85\u6599\u91C7\u8D2D",
    title_en: "Accessories Sourcing",
    icon: "\u{1F9F7}",
    description_zh: "\u4E0E\u7EBD\u6263/\u62C9\u94FE/\u540A\u724C/\u7EC7\u5E26\u4F9B\u5E94\u5546\u6C9F\u901A\u89C4\u683C\u3001\u989C\u8272\u3001\u8D77\u8BA2\u91CF\u3001\u4EF7\u683C\u4E0E\u4EA4\u671F,\u4EE5\u53CA\u5BF9\u8272\u548C\u5F00\u6A21",
    description_en: "Coordinate with button / zipper / label / tape suppliers on specs, color, MOQ, price, lead time, color matching and custom tooling",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Accessory supplier / sales representative",
    ai_role_zh: "\u8F85\u6599\u4F9B\u5E94\u5546 / \u4E1A\u52A1\u5458",
    user_role: "Garment factory merchandiser / accessories sourcing",
    user_role_zh: "\u670D\u88C5\u5382\u8DDF\u5355 / \u8F85\u6599\u91C7\u8D2D",
    key_skills: [
      "specifying button material / size / Pantone",
      "discussing zipper type and tape color",
      "requesting custom logo on labels and tags",
      "negotiating MOQ and tooling cost",
      "confirming sample dispatch and lead time"
    ],
    key_skills_zh: [
      "\u7EBD\u6263\u6750\u8D28/\u5C3A\u5BF8/\u6F58\u901A\u8272\u53F7",
      "\u62C9\u94FE\u7C7B\u578B\u4E0E\u5E26\u5E03\u989C\u8272",
      "\u540A\u724C\u7EC7\u6807\u5B9A\u5236 logo",
      "\u8D77\u8BA2\u91CF\u4E0E\u5F00\u6A21\u8D39\u8C08\u5224",
      "\u6837\u54C1\u5BC4\u9001\u4E0E\u4EA4\u671F\u786E\u8BA4"
    ],
    industry_terms_sample: [
      "shank button",
      "YKK zipper",
      "Pantone TCX",
      "tooling fee",
      "woven label"
    ],
    estimated_minutes: 9,
    tags: ["process", "accessory", "sourcing"]
  },
  {
    id: "garment_washing",
    title_zh: "\u6210\u8863\u6D17\u6C34/\u540E\u6574",
    title_en: "Garment Washing & Finishing",
    icon: "\u{1FAE7}",
    description_zh: "\u4E0E\u6D17\u6C34\u5382\u6C9F\u901A\u6D17\u6C34\u65B9\u5F0F(\u666E\u6D17/\u9175\u7D20/\u77F3\u78E8/\u6F02\u67D3/\u7845\u6CB9)\u3001\u7F29\u6C34\u3001\u624B\u611F\u63A7\u5236\u4E0E\u8272\u7262\u5EA6",
    description_en: "Coordinate with laundry on wash type (general / enzyme / stone / bleach / silicone), shrinkage, handfeel control and color fastness",
    category: "process",
    subcategory: "garment_textile",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Garment laundry / finishing house merchandiser",
    ai_role_zh: "\u6D17\u6C34\u5382 / \u540E\u6574\u7406\u5382\u8DDF\u5355",
    user_role: "Garment factory merchandiser or denim / casual wear sourcing",
    user_role_zh: "\u670D\u88C5\u5382\u8DDF\u5355 / \u725B\u4ED4\u6216\u4F11\u95F2\u6B3E\u91C7\u8D2D",
    key_skills: [
      "specifying wash type and recipe",
      "discussing handfeel target (soft, dry, vintage)",
      "reviewing shrinkage tolerance and dimensional change",
      "reviewing color fastness to wash / rubbing",
      "approving bulk wash after lab dip / first bulk sample"
    ],
    key_skills_zh: [
      "\u6D17\u6C34\u65B9\u5F0F\u4E0E\u914D\u65B9",
      "\u76EE\u6807\u624B\u611F(\u67D4\u8F6F/\u5E72\u723D/\u590D\u53E4)",
      "\u7F29\u7387\u516C\u5DEE\u4E0E\u5C3A\u5BF8\u53D8\u5316",
      "\u8010\u6D17 / \u8010\u6469\u64E6\u8272\u7262\u5EA6",
      "\u5927\u8D27\u6D17\u6C34\u6279\u51C6\u6D41\u7A0B"
    ],
    industry_terms_sample: [
      "enzyme wash",
      "stone wash",
      "silicone softener",
      "dimensional change",
      "lab dip"
    ],
    estimated_minutes: 10,
    tags: ["process", "garment", "finishing"]
  },
  {
    id: "lc_discrepancy",
    title_zh: "\u4FE1\u7528\u8BC1\u4E0D\u7B26\u70B9",
    title_en: "LC Document Discrepancy",
    icon: "\u{1F4D1}",
    description_zh: "\u4EA4\u5355\u65F6\u4FE1\u7528\u8BC1\u6709\u4E0D\u7B26\u70B9,\u4E0E\u5BA2\u6237/\u94F6\u884C\u6C9F\u901A\u63A5\u53D7\u4E0D\u7B26\u3001\u6539\u8BC1\u6216\u62C5\u4FDD\u653E\u5355\u3002\u26A0\uFE0F \u5F02\u5E38/\u8FDB\u9636\u573A\u666F,\u5EFA\u8BAE\u5148\u5B8C\u6210 [\u8BE2\u76D8\u62A5\u4EF7] + [\u8BA2\u5355\u6C9F\u901A],\u719F\u6089 LC \u6D41\u7A0B",
    description_en: "On LC negotiation, present documents with discrepancies; negotiate with buyer and bank for acceptance, amendment or indemnity. \u26A0\uFE0F Anomaly / advanced; finish [Inquiry & Quote] + [Order Management] first to be familiar with LC workflow.",
    category: "business",
    subcategory: "trade_finance",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Overseas buyer / documentary credit specialist at negotiating bank",
    ai_role_zh: "\u6D77\u5916\u5BA2\u6237 / \u8BAE\u4ED8\u884C\u5355\u8BC1\u5458",
    user_role: "Chinese export sales / documentation clerk",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458 / \u5355\u8BC1\u5458",
    key_skills: [
      "explaining UCP 600 article 14 review timeline",
      "listing common discrepancies (late shipment, short shipment, expired LC)",
      "requesting buyer to waive discrepancy or amend LC",
      "preparing indemnity letter for negotiation under reserve",
      "communicating with advising / negotiating bank",
      "handling multi-discrepancy escalation with fraud allegation"
    ],
    key_skills_zh: [
      "UCP 600 \u7B2C 14 \u6761\u5BA1\u5355\u65F6\u9650",
      "\u5E38\u89C1\u4E0D\u7B26\u70B9(\u665A\u88C5/\u77ED\u88C5/\u8FC7\u671F)",
      "\u8BF7\u6C42\u5BA2\u6237\u653E\u5F03\u4E0D\u7B26\u70B9\u6216\u6539\u8BC1",
      "\u62C5\u4FDD\u653E\u5355 / \u4FDD\u7559\u8BAE\u4ED8",
      "\u901A\u77E5\u884C / \u8BAE\u4ED8\u884C\u6C9F\u901A",
      "\u591A\u4E0D\u7B26\u70B9 + \u6B3A\u8BC8\u6307\u63A7\u7684\u5347\u7EA7\u5904\u7406"
    ],
    industry_terms_sample: [
      "discrepancy",
      "waiver",
      "indemnity",
      "UCP 600",
      "B/L date",
      "amendment",
      "negotiation under reserve",
      "issuing bank"
    ],
    estimated_minutes: 11,
    estimated_difficulty: 4,
    prerequisites: ["inquiry_quote", "order_management"],
    tags: ["business", "LC", "documents", "exception", "anomaly", "crisis", "trade-finance"]
  },
  {
    id: "payment_overdue",
    title_zh: "\u5BA2\u6237\u4ED8\u6B3E\u903E\u671F/\u50AC\u6B3E",
    title_en: "Overdue Payment & Collection",
    icon: "\u{1F4B0}",
    description_zh: "\u5BA2\u6237\u5C3E\u6B3E/\u5F00\u8239\u540E\u8D27\u6B3E\u672A\u6309\u65F6\u4ED8,\u50AC\u6536\u6C9F\u901A,\u4FE1\u7528\u8BC1\u5EF6\u671F\u6216\u5206\u671F\u65B9\u6848\u3002\u26A0\uFE0F \u5F02\u5E38/\u8FDB\u9636\u573A\u666F,\u5EFA\u8BAE\u5148\u5B8C\u6210 [\u8BA2\u5355\u6C9F\u901A] + [\u4FE1\u7528\u8BC1\u4E0D\u7B26\u70B9],\u719F\u6089 PI/LC \u6D41\u7A0B",
    description_en: "Customer overdue on balance or post-shipment payment \u2014 collection calls, LC extension or installment plan negotiation. \u26A0\uFE0F Anomaly / advanced; finish [Order Management] + [LC Document Discrepancy] first to be familiar with PI/LC workflow.",
    category: "business",
    subcategory: "trade_finance",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Overseas buyer / finance controller under cash flow pressure",
    ai_role_zh: "\u6D77\u5916\u5BA2\u6237 / \u8D22\u52A1\u603B\u76D1(\u8D44\u91D1\u7D27\u5F20)",
    user_role: "Chinese export sales / finance manager",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458 / \u8D22\u52A1\u7ECF\u7406",
    key_skills: [
      "polite first reminder and asking for payment date",
      "second reminder with potential credit hold",
      "negotiating installment or LC extension",
      "explaining late-payment interest and impact on future orders",
      "closing on a confirmed payment schedule",
      "managing credit-hold escalation and bankruptcy / Chapter 11 scenarios"
    ],
    key_skills_zh: [
      "\u793C\u8C8C\u9996\u50AC + \u8BE2\u95EE\u4ED8\u6B3E\u65E5",
      "\u4E8C\u50AC + \u6682\u505C\u6388\u4FE1",
      "\u5206\u671F / \u4FE1\u7528\u8BC1\u5EF6\u671F\u8C08\u5224",
      "\u903E\u671F\u5229\u606F\u4E0E\u672A\u6765\u8BA2\u5355\u5F71\u54CD",
      "\u786E\u8BA4\u4ED8\u6B3E\u65F6\u95F4\u8868\u5E76\u6536\u5C3E",
      "\u4FE1\u7528\u6682\u505C\u5347\u7EA7 + \u5BA2\u6237\u7834\u4EA7/Chapter 11 \u5904\u7406"
    ],
    industry_terms_sample: [
      "overdue",
      "payment reminder",
      "credit hold",
      "installment plan",
      "LC extension",
      "late-payment interest",
      "wire transfer",
      "debit note"
    ],
    estimated_minutes: 10,
    estimated_difficulty: 4,
    prerequisites: ["order_management", "lc_discrepancy"],
    tags: ["business", "payment", "exception", "anomaly", "crisis", "trade-finance", "collections"]
  },
  {
    id: "customs_hold",
    title_zh: "\u6D77\u5173\u67E5\u9A8C/\u6263\u8D27",
    title_en: "Customs Hold & Return",
    icon: "\u{1F6C3}",
    description_zh: "\u8D27\u7269\u5230\u6E2F\u88AB\u6D77\u5173\u67E5\u9A8C/\u6263\u7559,\u4E0E\u8D27\u4EE3\u3001\u5BA2\u6237\u3001\u62A5\u5173\u884C\u6C9F\u901A\u8BC1\u660E\u6587\u4EF6\u3001\u6539\u6E2F\u6216\u9000\u8FD0\u3002\u26A0\uFE0F \u5F02\u5E38/\u8FDB\u9636\u573A\u666F,\u5EFA\u8BAE\u5148\u5B8C\u6210 [\u7269\u6D41/\u8239\u671F/\u5355\u8BC1] + [\u8BA2\u5355\u6C9F\u901A]",
    description_en: "Cargo held by customs at destination \u2014 coordinate with forwarder, buyer and customs broker on documents, diversion or return. \u26A0\uFE0F Anomaly / advanced; finish [Logistics & Shipping] + [Order Management] first.",
    category: "business",
    subcategory: "logistics",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Destination customs officer / overseas buyer logistics manager",
    ai_role_zh: "\u76EE\u7684\u6E2F\u6D77\u5173 / \u5BA2\u6237\u7269\u6D41\u7ECF\u7406",
    user_role: "Chinese export sales / shipping clerk / forwarder",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458 / \u8239\u52A1 / \u8D27\u4EE3",
    key_skills: [
      "identifying hold reason (HS code, value, label, certificate)",
      "preparing supplementary documents (C/O, test report, invoice breakdown)",
      "negotiating with customs broker on duty and bond",
      "discussing diversion to free port or return to origin",
      "communicating cost allocation between buyer and seller",
      "requesting binding ruling from CBP / customs authority"
    ],
    key_skills_zh: [
      "\u786E\u8BA4\u6263\u8D27\u539F\u56E0(HS\u7F16\u7801/\u4EF7\u503C/\u6807\u7B7E/\u8BC1\u4E66)",
      "\u8865\u5145\u5355\u8BC1(C/O/\u6D4B\u8BD5\u62A5\u544A/\u53D1\u7968\u62C6\u5206)",
      "\u4E0E\u62A5\u5173\u884C\u8C08\u5173\u7A0E\u4E0E\u4FDD\u8BC1\u91D1",
      "\u6539\u6E2F\u5230\u81EA\u7531\u6E2F\u6216\u9000\u8FD0\u56DE\u59CB\u53D1\u5730",
      "\u8D39\u7528\u5206\u644A\u6C9F\u901A",
      "\u7533\u8BF7 binding ruling / \u4E8B\u5148\u88C1\u5B9A"
    ],
    industry_terms_sample: [
      "customs hold",
      "HS code",
      "C/O",
      "demurrage",
      "return cargo",
      "binding ruling",
      "test report",
      "free port"
    ],
    estimated_minutes: 11,
    estimated_difficulty: 4,
    prerequisites: ["logistics_shipping", "order_management"],
    tags: ["business", "logistics", "exception", "customs", "anomaly", "crisis"]
  },
  {
    id: "trade_fair",
    title_zh: "\u5C55\u4F1A/Showroom \u63A5\u5355",
    title_en: "Trade Fair & Showroom",
    icon: "\u{1F6CD}",
    description_zh: "\u5E7F\u4EA4\u4F1A\u3001Canton Fair\u3001Magic Show\u3001Texworld \u7B49\u5C55\u4F1A\u73B0\u573A\u548C Showroom \u63A5\u5F85\u5BA2\u6237,\u5FEB\u901F\u4ECB\u7ECD\u4EA7\u54C1\u5E76\u62FF\u610F\u5411\u5355",
    description_en: "Receive buyers at trade fairs (Canton Fair, Magic Show, Texworld) and showrooms \u2014 quick product intro, sample walk-through and intent orders",
    category: "business",
    subcategory: "sales",
    difficulty_levels: ["beginner", "intermediate", "advanced"],
    ai_role: "Overseas buyer / sourcing manager walking the booth",
    ai_role_zh: "\u6D77\u5916\u5BA2\u6237 / \u91C7\u8D2D\u7ECF\u7406(\u901B\u5C55\u4F4D)",
    user_role: "Chinese export sales on booth duty",
    user_role_zh: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458(\u5C55\u4F1A\u7AD9\u4F4D)",
    key_skills: [
      "30-second elevator pitch",
      "highlighting hero products and fabric tech",
      "qualifying the buyer (category, volume, target market)",
      "collecting business cards and follow-up plan",
      "closing with a tentative MOQ and sample dispatch"
    ],
    key_skills_zh: [
      "30 \u79D2\u7535\u68AF\u6F14\u8BB2",
      "\u4EAE\u70B9\u4EA7\u54C1\u548C\u9762\u6599\u79D1\u6280\u63A8\u4ECB",
      "\u5BA2\u6237\u80CC\u666F\u5224\u65AD(\u54C1\u7C7B/\u91CF/\u76EE\u6807\u5E02\u573A)",
      "\u6536\u540D\u7247\u4E0E\u8DDF\u8FDB\u8BA1\u5212",
      "\u73B0\u573A\u521D\u6B65 MOQ \u4E0E\u6837\u54C1\u5BC4\u9001"
    ],
    industry_terms_sample: [
      "elevator pitch",
      "hero product",
      "MOQ",
      "Showroom",
      "lead"
    ],
    estimated_minutes: 8,
    tags: ["business", "sales", "fair", "showroom"]
  }
];

// content/vocabulary.json
var vocabulary_default = [
  {
    term: "MOQ",
    full_form: "Minimum Order Quantity",
    category: "phone_meeting",
    phonetic: "/\u02CCem \u0259\u028A \u02C8kju\u02D0/",
    definition_en: "the smallest quantity a supplier is willing to produce per order",
    definition_zh: "\u6700\u4F4E\u8D77\u8BA2\u91CF",
    example: "Our MOQ for this style is 500 pieces per color."
  },
  {
    term: "lead time",
    full_form: "lead time",
    category: "phone_meeting",
    phonetic: "/\u02C8li\u02D0d ta\u026Am/",
    definition_en: "the time between placing an order and receiving the goods",
    definition_zh: "\u4EA4\u8D27\u5468\u671F",
    example: "The standard lead time is 30 days after the deposit."
  },
  {
    term: "RFQ",
    full_form: "Request For Quotation",
    category: "inquiry_quote",
    phonetic: "/\u02CC\u0251\u02D0r ef \u02C8kju\u02D0/",
    definition_en: "a formal request to suppliers for price quotation",
    definition_zh: "\u8BE2\u4EF7\u5355",
    example: "Please send us your RFQ and we will reply within 24 hours."
  },
  {
    term: "PI",
    full_form: "Proforma Invoice",
    category: "inquiry_quote",
    phonetic: "/\u02CCpi\u02D0 \u02C8a\u026A/",
    definition_en: "a preliminary invoice sent to buyers before shipment, used as a quotation and payment reference",
    definition_zh: "\u5F62\u5F0F\u53D1\u7968 / \u9884\u5F00\u53D1\u7968",
    example: "Please review the PI and confirm by reply email."
  },
  {
    term: "FOB",
    full_form: "Free On Board",
    category: "inquiry_quote",
    phonetic: "/\u02CCef \u0259\u028A \u02C8bi\u02D0/",
    definition_en: "price includes delivery to the port of loading; buyer takes over from there",
    definition_zh: "\u79BB\u5CB8\u4EF7(\u88C5\u8FD0\u6E2F\u4EA4\u8D27)",
    example: "Our offer is FOB Ningbo at USD 4.20 per piece."
  },
  {
    term: "CIF",
    full_form: "Cost, Insurance & Freight",
    category: "inquiry_quote",
    phonetic: "/\u02CCsi\u02D0 a\u026A \u02C8ef/",
    definition_en: "price includes cost, insurance, and freight to the destination port",
    definition_zh: "\u5230\u5CB8\u4EF7(\u5305\u542B\u8FD0\u8D39\u4FDD\u9669)",
    example: "CIF Hamburg is USD 5.10 per piece."
  },
  {
    term: "EXW",
    full_form: "Ex Works",
    category: "inquiry_quote",
    phonetic: "/\u02CCi\u02D0 eks \u02C8d\u028Cb\u0259lju\u02D0/",
    definition_en: "price is at the factory gate; buyer arranges and pays for all transport",
    definition_zh: "\u51FA\u5382\u4EF7(\u5DE5\u5382\u4EA4\u8D27)",
    example: "EXW price is USD 3.85, no loading included."
  },
  {
    term: "TT payment",
    full_form: "Telegraphic Transfer",
    category: "inquiry_quote",
    phonetic: "/\u02CCti\u02D0 \u02C8ti\u02D0 \u02C8pe\u026Am\u0259nt/",
    definition_en: "a bank wire transfer, the most common payment method in export trade",
    definition_zh: "\u7535\u6C47",
    example: "We accept 30 percent TT deposit and 70 percent against B/L copy."
  },
  {
    term: "deposit",
    full_form: "deposit",
    category: "inquiry_quote",
    phonetic: "/d\u026A\u02C8p\u0252z\u026At/",
    definition_en: "an upfront partial payment to confirm an order",
    definition_zh: "\u8BA2\u91D1 / \u5B9A\u91D1",
    example: "A 30 percent deposit is required to start production."
  },
  {
    term: "AQL",
    full_form: "Acceptable Quality Level",
    category: "factory_audit",
    phonetic: "/\u02CCe\u026A kju\u02D0 \u02C8el/",
    definition_en: "the maximum acceptable number of defects per hundred units in a sampling inspection",
    definition_zh: "\u53EF\u63A5\u53D7\u8D28\u91CF\u6C34\u5E73(\u62BD\u6837\u6807\u51C6)",
    example: "Our AQL standard is 2.5 for major, 4.0 for minor."
  },
  {
    term: "QC",
    full_form: "Quality Control",
    category: "factory_audit",
    phonetic: "/\u02CCkju\u02D0 \u02C8si\u02D0/",
    definition_en: "the process of checking products to ensure they meet quality standards",
    definition_zh: "\u54C1\u63A7 / \u8D28\u91CF\u63A7\u5236",
    example: "We have in-line QC and final QC at our factory."
  },
  {
    term: "BSCI",
    full_form: "Business Social Compliance Initiative",
    category: "factory_audit",
    phonetic: "/\u02CCbi\u02D0 \u02CCes \u02CCsi\u02D0 \u02C8a\u026A/",
    definition_en: "a European social compliance audit framework for supply chains",
    definition_zh: "\u6B27\u6D32\u5546\u4E1A\u793E\u4F1A\u5408\u89C4\u5021\u8BAE",
    example: "We are BSCI audited and our latest report is grade B."
  },
  {
    term: "SEDEX",
    full_form: "Supplier Ethical Data Exchange",
    category: "factory_audit",
    phonetic: "/\u02C8si\u02D0 deks/",
    definition_en: "a UK-based ethical trade audit platform (SMETA)",
    definition_zh: "\u4F9B\u5E94\u5546\u9053\u5FB7\u6570\u636E\u4EA4\u6362(\u82F1)",
    example: "Our factory is registered on SEDEX with a SMETA 4-pillar audit."
  },
  {
    term: "production line",
    full_form: "production line",
    category: "factory_audit",
    phonetic: "/pr\u0259\u02C8d\u028Ck\u0283n la\u026An/",
    definition_en: "a sequence of workstations where garments are assembled",
    definition_zh: "\u751F\u4EA7\u7EBF",
    example: "We run 12 production lines, each with 25 operators."
  },
  {
    term: "capacity",
    full_form: "capacity",
    category: "factory_audit",
    phonetic: "/k\u0259\u02C8p\xE6s\u0259ti/",
    definition_en: "the maximum output a factory can produce in a given period",
    definition_zh: "\u4EA7\u80FD",
    example: "Our monthly capacity is 200,000 pieces for woven tops."
  },
  {
    term: "ETD",
    full_form: "Estimated Time of Departure",
    category: "logistics_shipping",
    phonetic: "/\u02CCi\u02D0 ti\u02D0 \u02C8di\u02D0/",
    definition_en: "the expected date a vessel leaves the port of origin",
    definition_zh: "\u9884\u8BA1\u79BB\u6E2F\u65E5\u671F",
    example: "Our ETD from Ningbo is the 22nd of this month."
  },
  {
    term: "ETA",
    full_form: "Estimated Time of Arrival",
    category: "logistics_shipping",
    phonetic: "/\u02CCi\u02D0 ti\u02D0 \u02C8e\u026A/",
    definition_en: "the expected date a vessel reaches the destination port",
    definition_zh: "\u9884\u8BA1\u5230\u6E2F\u65E5\u671F",
    example: "ETA at Long Beach is around the 11th of next month."
  },
  {
    term: "B/L",
    full_form: "Bill of Lading",
    category: "logistics_shipping",
    phonetic: "/\u02CCbi\u02D0 \u02C8el/",
    definition_en: "a document issued by the carrier acknowledging receipt of cargo for shipment",
    definition_zh: "\u63D0\u5355",
    example: "The original B/L will be sent by DHL within 3 days of sailing."
  },
  {
    term: "C/O",
    full_form: "Certificate of Origin",
    category: "logistics_shipping",
    phonetic: "/\u02CCsi\u02D0 \u02C8\u0259\u028A/",
    definition_en: "a document certifying the country where the goods were manufactured",
    definition_zh: "\u4EA7\u5730\u8BC1",
    example: "The C/O will be issued by CCPIT stating 'Made in China'."
  },
  {
    term: "FCL",
    full_form: "Full Container Load",
    category: "logistics_shipping",
    phonetic: "/\u02CCef \u02CCsi\u02D0 \u02C8el/",
    definition_en: "a container fully loaded with one consignee's cargo",
    definition_zh: "\u6574\u67DC",
    example: "We will ship this order as FCL to save on per-unit cost."
  },
  {
    term: "LCL",
    full_form: "Less than Container Load",
    category: "logistics_shipping",
    phonetic: "/\u02CCel \u02CCsi\u02D0 \u02C8el/",
    definition_en: "a shipment that doesn't fill a whole container, consolidated with others",
    definition_zh: "\u62FC\u67DC",
    example: "For small orders, LCL is more economical."
  },
  {
    term: "telex release",
    full_form: "telex release",
    category: "logistics_shipping",
    phonetic: "/\u02C8teleks r\u026A\u02C8li\u02D0s/",
    definition_en: "the shipping line releases cargo at destination without the original B/L",
    definition_zh: "\u7535\u653E",
    example: "For US buyers, we usually do telex release after full payment."
  },
  {
    term: "cut-off time",
    full_form: "cut-off time",
    category: "logistics_shipping",
    phonetic: "/\u02C8k\u028Ct \u0252f ta\u026Am/",
    definition_en: "the latest time cargo must be at the terminal to load the planned vessel",
    definition_zh: "\u622A\u5173\u65F6\u95F4",
    example: "The cut-off is on the 17th, by 6 PM."
  },
  {
    term: "stuffing",
    full_form: "container stuffing",
    category: "logistics_shipping",
    phonetic: "/\u02C8st\u028Cf\u026A\u014B/",
    definition_en: "the process of loading cargo into a shipping container",
    definition_zh: "\u88C5\u67DC",
    example: "We will arrange stuffing at our warehouse on the 15th."
  },
  {
    term: "PSI",
    full_form: "Pre-Shipment Inspection",
    category: "logistics_shipping",
    phonetic: "/\u02CCpi\u02D0 \u02CCes \u02C8a\u026A/",
    definition_en: "a final inspection performed before goods are loaded for export",
    definition_zh: "\u88C5\u67DC\u524D\u68C0\u9A8C",
    example: "Our PSI is conducted by SGS on the morning of stuffing."
  },
  {
    term: "demurrage",
    full_form: "demurrage",
    category: "logistics_shipping",
    phonetic: "/d\u026A\u02C8m\u028Cr\u026Ad\u0292/",
    definition_en: "a charge payable to the port/terminal when a container stays beyond free time",
    definition_zh: "\u6EDE\u6E2F\u8D39(\u5806\u573A)",
    example: "Demurrage starts at USD 75 per day after the 7-day free period."
  },
  {
    term: "detention",
    full_form: "detention",
    category: "logistics_shipping",
    phonetic: "/d\u026A\u02C8ten\u0283n/",
    definition_en: "a charge by the shipping line when a container is held outside the port",
    definition_zh: "\u6EDE\u7BB1\u8D39(\u8239\u516C\u53F8)",
    example: "Detention is separate from demurrage and charged by the carrier."
  },
  {
    term: "GSM",
    full_form: "Grams per Square Meter",
    category: "sample_development",
    phonetic: "/\u02CCd\u0292i\u02D0 \u02CCes \u02C8em/",
    definition_en: "the weight of a fabric per square meter, indicating its thickness/density",
    definition_zh: "\u514B\u91CD(\u6BCF\u5E73\u65B9\u7C73\u514B\u6570)",
    example: "The fabric is 220 GSM French terry, 100 percent cotton."
  },
  {
    term: "yarn count",
    full_form: "yarn count",
    category: "sample_development",
    phonetic: "/j\u0251\u02D0n ka\u028Ant/",
    definition_en: "a numerical system indicating the thickness of yarn; higher number = finer yarn",
    definition_zh: "\u7EB1\u652F",
    example: "Our 220 GSM terry uses 32s single yarn."
  },
  {
    term: "handfeel",
    full_form: "handfeel",
    category: "sample_development",
    phonetic: "/\u02C8h\xE6ndfi\u02D0l/",
    definition_en: "the tactile sensation of a fabric when touched by hand",
    definition_zh: "\u624B\u611F",
    example: "The handfeel is soft and slightly dry, with a peach-skin finish."
  },
  {
    term: "tech-pack",
    full_form: "technical package",
    category: "sample_development",
    phonetic: "/\u02C8tek p\xE6k/",
    definition_en: "a detailed document from the buyer specifying design, materials, measurements, and construction",
    definition_zh: "\u5DE5\u827A\u5355 / \u6280\u672F\u5305",
    example: "Please review the tech-pack and flag any inconsistencies."
  },
  {
    term: "spec sheet",
    full_form: "specification sheet",
    category: "sample_development",
    phonetic: "/\u02C8spek \u0283i\u02D0t/",
    definition_en: "a document listing product specifications (BOM, measurements, colors, trims)",
    definition_zh: "\u89C4\u683C\u8868",
    example: "The spec sheet says M chest is 96 cm, but the pattern was drafted at 100."
  },
  {
    term: "BOM",
    full_form: "Bill of Materials",
    category: "sample_development",
    phonetic: "/b\u0252m/",
    definition_en: "a list of all raw materials and trims needed to make a product",
    definition_zh: "\u7269\u6599\u6E05\u5355",
    example: "The BOM lists fabric, lining, buttons, zipper, thread, and labels."
  },
  {
    term: "pre-production sample",
    full_form: "pre-production sample",
    category: "sample_development",
    phonetic: "/\u02CCpri\u02D0 pr\u0259\u02C8d\u028Ck\u0283n \u02C8s\xE6mpl/",
    definition_en: "a sample made from bulk fabric before mass production starts",
    definition_zh: "\u4EA7\u524D\u6837",
    example: "Please sign off the pre-production sample before we start bulk."
  },
  {
    term: "lab dip",
    full_form: "laboratory dip",
    category: "sample_development",
    phonetic: "/l\xE6b d\u026Ap/",
    definition_en: "a small fabric sample dyed to match a target color before bulk production",
    definition_zh: "\u67D3\u8272\u5C0F\u6837 / \u8BD5\u8272\u6837",
    example: "We will send you a lab dip for sign-off before bulk dyeing."
  },
  {
    term: "Pantone TPX",
    full_form: "Pantone Textile Paper eXtended",
    category: "sample_development",
    phonetic: "/\u02C8p\xE6nt\u0259\u028An \u02CCti\u02D0 pi\u02D0 \u02C8eks/",
    definition_en: "a Pantone color system for textiles, used as the standard for shade matching",
    definition_zh: "\u6F58\u901A\u7EBA\u7EC7\u8272\u5361 TPX \u7CFB\u5217",
    example: "We need the lab dip to match Pantone TPX 18-1664 within Delta E 1.0."
  },
  {
    term: "Delta E",
    full_form: "Delta E",
    category: "sample_development",
    phonetic: "/\u02C8delt\u0259 i\u02D0/",
    definition_en: "a numerical measure of color difference; lower is closer match",
    definition_zh: "\u8272\u5DEE\u503C",
    example: "Delta E below 1.0 is acceptable for most color matches."
  },
  {
    term: "differential feed",
    full_form: "differential feed",
    category: "sample_development",
    phonetic: "/\u02CCd\u026Af\u0259\u02C8ren\u0283l fi\u02D0d/",
    definition_en: "a sewing machine feature that controls the rate of front and back feed dogs independently, critical for stretch knits",
    definition_zh: "\u5DEE\u52A8\u9001\u5E03",
    example: "Coverstitch hem waving is usually a differential feed setting issue."
  },
  {
    term: "overlock",
    full_form: "overlock stitch",
    category: "sample_development",
    phonetic: "/\u02C8\u0259\u028Av\u0259l\u0252k/",
    definition_en: "a stitch that trims and overcasts the fabric edge in one pass; prevents fraying",
    definition_zh: "\u9501\u8FB9 / \u5305\u7F1D",
    example: "Side seams should be overlocked before topstitching."
  },
  {
    term: "coverstitch",
    full_form: "coverstitch",
    category: "sample_development",
    phonetic: "/\u02C8k\u028Cv\u0259st\u026At\u0283/",
    definition_en: "a two-or-three-needle stitch that gives a clean, professional hem finish on knits",
    definition_zh: "\u7EF7\u7F1D",
    example: "The hem should be coverstitched, not overlocked, for a cleaner finish."
  },
  {
    term: "fit sample",
    full_form: "fit sample",
    category: "sample_development",
    phonetic: "/f\u026At \u02C8s\xE6mpl/",
    definition_en: "a sample tried on a real body (fit model) to evaluate silhouette and fit",
    definition_zh: "\u8BD5\u8863\u6837",
    example: "We can do a fit sample on our part-time fit model for USD 50 extra."
  },
  {
    term: "YKK",
    full_form: "Yoshida Kogyo Kabushikigaisha",
    category: "sample_development",
    phonetic: "/wa\u026A ke\u026A ke\u026A/",
    definition_en: "a Japanese brand widely considered the industry standard for zippers",
    definition_zh: "YKK \u62C9\u94FE(\u884C\u4E1A\u6807\u51C6\u54C1\u724C)",
    example: "The buyer specified YKK zippers, which adds USD 0.15 per piece."
  },
  {
    term: "Oeko-Tex",
    full_form: "Oeko-Tex Standard 100",
    category: "sample_development",
    phonetic: "/\u02C8\u0259\u028Ak\u0259\u028A teks/",
    definition_en: "an international certification for textiles tested for harmful substances",
    definition_zh: "Oeko-Tex 100 \u751F\u6001\u7EBA\u7EC7\u54C1\u8BA4\u8BC1",
    example: "Our fabric is Oeko-Tex Standard 100 certified for babywear."
  },
  {
    term: "REACH",
    full_form: "Registration, Evaluation, Authorisation and Restriction of Chemicals",
    category: "sample_development",
    phonetic: "/ri\u02D0t\u0283/",
    definition_en: "EU regulation governing chemical substances in products",
    definition_zh: "\u6B27\u76DF\u5316\u5B66\u54C1\u6CD5\u89C4",
    example: "We can issue a REACH SVHC test report for this fabric."
  },
  {
    term: "MSDS",
    full_form: "Material Safety Data Sheet",
    category: "sample_development",
    phonetic: "/\u02CCem \u02CCes \u02CCdi\u02D0 \u02C8es/",
    definition_en: "a safety document listing chemical composition, hazards, and handling of a substance",
    definition_zh: "\u5316\u5B66\u54C1\u5B89\u5168\u6280\u672F\u8BF4\u660E\u4E66",
    example: "Please provide the MSDS for the dye used in this batch."
  },
  {
    term: "debit note",
    full_form: "debit note",
    category: "claim_aftersales",
    phonetic: "/\u02C8deb\u026At n\u0259\u028At/",
    definition_en: "a document issued by a buyer to claim a refund or reduce amount owed to a supplier",
    definition_zh: "\u6263\u6B3E\u5355 / \u501F\u8BB0\u901A\u77E5",
    example: "The buyer issued a debit note for USD 4,000 against the next invoice."
  },
  {
    term: "credit note",
    full_form: "credit note",
    category: "claim_aftersales",
    phonetic: "/\u02C8kred\u026At n\u0259\u028At/",
    definition_en: "a document issued by a supplier acknowledging a credit to a buyer's account",
    definition_zh: "\u8D37\u8BB0\u901A\u77E5 / \u9000\u6B3E\u5355",
    example: "We issued a credit note to be applied to your next PO."
  },
  {
    term: "RCA",
    full_form: "Root Cause Analysis",
    category: "claim_aftersales",
    phonetic: "/\u02CC\u0251\u02D0r \u02CCsi\u02D0 \u02C8e\u026A/",
    definition_en: "a structured method to identify the underlying cause of a problem",
    definition_zh: "\u6839\u56E0\u5206\u6790",
    example: "Please send us the RCA report within 5 business days."
  },
  {
    term: "CAP",
    full_form: "Corrective Action Plan",
    category: "claim_aftersales",
    phonetic: "/k\xE6p/",
    definition_en: "a written plan detailing corrective and preventive actions after an issue",
    definition_zh: "\u7EA0\u6B63\u63AA\u65BD\u8BA1\u5212",
    example: "The signed CAP must include owner, deadline, and verification method."
  },
  {
    term: "claim",
    full_form: "claim",
    category: "claim_aftersales",
    phonetic: "/kle\u026Am/",
    definition_en: "a demand by a buyer for compensation due to a product or service issue",
    definition_zh: "\u7D22\u8D54",
    example: "The buyer filed a claim for 240 defective pieces."
  },
  {
    term: "inspection report",
    full_form: "inspection report",
    category: "claim_aftersales",
    phonetic: "/\u026An\u02C8spek\u0283n r\u026A\u02C8p\u0254\u02D0t/",
    definition_en: "a written report from a QC inspector detailing findings of a quality check",
    definition_zh: "\u68C0\u9A8C\u62A5\u544A",
    example: "Please send the third-party inspection report with the claim."
  },
  {
    term: "rework",
    full_form: "rework",
    category: "claim_aftersales",
    phonetic: "/ri\u02D0\u02C8w\u025C\u02D0k/",
    definition_en: "the process of repairing defective products so they meet specifications",
    definition_zh: "\u8FD4\u5DE5",
    example: "We can rework the 240 affected pieces at our cost."
  },
  {
    term: "AQL 2.5",
    full_form: "AQL 2.5",
    category: "claim_aftersales",
    phonetic: "/\u02CCe\u026A kju\u02D0 \u02C8el tu\u02D0 p\u0254\u026Ant fa\u026Av/",
    definition_en: "a common Acceptable Quality Level used in garment inspection for major defects",
    definition_zh: "AQL 2.5(\u4E3B\u8981\u7F3A\u9677\u62BD\u6837\u6807\u51C6)",
    example: "Our standard is AQL 2.5 for major, 4.0 for minor."
  },
  {
    term: "material breach",
    full_form: "material breach",
    category: "claim_aftersales",
    phonetic: "/m\u0259\u02C8t\u026A\u0259ri\u0259l bri\u02D0t\u0283/",
    definition_en: "a serious failure to perform a contract term that justifies termination",
    definition_zh: "\u5B9E\u8D28\u6027\u8FDD\u7EA6",
    example: "The buyer alleges a material breach under the master supply agreement."
  },
  {
    term: "NDA",
    full_form: "Non-Disclosure Agreement",
    category: "claim_aftersales",
    phonetic: "/\u02CCen \u02CCdi\u02D0 \u02C8e\u026A/",
    definition_en: "a legal contract restricting the parties from sharing confidential information",
    definition_zh: "\u4FDD\u5BC6\u534F\u8BAE",
    example: "We can sign an NDA to keep the settlement confidential."
  },
  {
    term: "compliance",
    full_form: "compliance",
    category: "factory_audit",
    phonetic: "/k\u0259m\u02C8pla\u026A\u0259ns/",
    definition_en: "the act of meeting legal, regulatory, and customer requirements",
    definition_zh: "\u5408\u89C4",
    example: "Our compliance team manages BSCI, SEDEX, and buyer-specific audits."
  },
  {
    term: "audit",
    full_form: "audit",
    category: "factory_audit",
    phonetic: "/\u02C8\u0254\u02D0d\u026At/",
    definition_en: "a systematic examination of a factory's operations, records, and compliance",
    definition_zh: "\u5BA1\u6838 / \u5BA1\u8BA1",
    example: "The annual BSCI audit is scheduled for March."
  },
  {
    term: "non-conformity",
    full_form: "non-conformity",
    category: "factory_audit",
    phonetic: "/\u02CCn\u0252n k\u0259n\u02C8f\u0254\u02D0m\u0259ti/",
    definition_en: "a deviation from a standard, requirement, or process",
    definition_zh: "\u4E0D\u7B26\u5408\u9879",
    example: "Lack of ventilation in the chemical room is a non-conformity."
  },
  {
    term: "PI",
    full_form: "Proforma Invoice (recap)",
    category: "inquiry_quote",
    phonetic: "/\u02CCpi\u02D0 \u02C8a\u026A/",
    definition_en: "issued after price agreement, used to collect the deposit",
    definition_zh: "PI \u5F62\u5F0F\u53D1\u7968(\u7528\u4E8E\u6536\u8BA2\u91D1)",
    example: "The PI is valid for 7 days from the date of issue."
  },
  {
    term: "hand sample",
    full_form: "hand sample",
    category: "sample_development",
    phonetic: "/h\xE6nd \u02C8s\xE6mpl/",
    definition_en: "a small fabric cutting sent for handfeel evaluation before lab dip",
    definition_zh: "\u624B\u611F\u6837",
    example: "We will send a hand sample for the new French terry first."
  },
  {
    term: "TT 30/70",
    full_form: "TT 30/70",
    category: "inquiry_quote",
    phonetic: "/\u02CCti\u02D0 \u02C8ti\u02D0 \u03B8\u025C\u02D0ti \u02C8sev\u0259nti/",
    definition_en: "30 percent deposit by TT, 70 percent balance against B/L copy",
    definition_zh: "30/70 \u7535\u6C47\u4ED8\u6B3E\u6BD4\u4F8B",
    example: "Standard payment terms are TT 30/70 for new buyers."
  },
  {
    term: "LC",
    full_form: "Letter of Credit",
    category: "inquiry_quote",
    phonetic: "/\u02CCel \u02C8si\u02D0/",
    definition_en: "a bank-issued document guaranteeing payment to the seller upon shipment",
    definition_zh: "\u4FE1\u7528\u8BC1",
    example: "For first orders we accept LC at sight from a top-tier bank."
  },
  {
    term: "DP",
    full_form: "Documents against Payment",
    category: "inquiry_quote",
    phonetic: "/\u02CCdi\u02D0 \u02C8pi\u02D0/",
    definition_en: "the bank releases shipping documents to the buyer only against payment",
    definition_zh: "\u4ED8\u6B3E\u4EA4\u5355",
    example: "We can accept DP at sight for trusted buyers."
  },
  {
    term: "DA",
    full_form: "Documents against Acceptance",
    category: "inquiry_quote",
    phonetic: "/\u02CCdi\u02D0 \u02C8e\u026A/",
    definition_en: "the bank releases documents against the buyer's acceptance of a draft",
    definition_zh: "\u627F\u5151\u4EA4\u5355",
    example: "DA 30 days is risky for new buyers."
  },
  {
    term: "yarn count",
    full_form: "yarn count",
    category: "yarn_sourcing",
    phonetic: "/j\u0251\u02D0n ka\u028Ant/",
    definition_en: "a numerical system indicating yarn fineness; common systems are Ne (English, count = number of 840-yard lengths per pound), Nm (metric, meters per gram), and Tex (grams per 1000 m)",
    definition_zh: "\u7EB1\u7EBF\u7EC6\u5EA6,\u5E38\u89C1 Ne(\u82F1\u5236)\u3001Nm(\u516C\u5236)\u3001Tex(\u7279\u514B\u65AF)",
    example: "We need 32 Ne compact cotton yarn for this style."
  },
  {
    term: "combed cotton",
    full_form: "combed cotton yarn",
    category: "yarn_sourcing",
    phonetic: "/k\u0259\u028Amd \u02C8k\u0252tn/",
    definition_en: "cotton yarn that has been combed to remove short fibers and impurities, producing a smoother, stronger, finer yarn than carded",
    definition_zh: "\u7CBE\u68B3\u68C9\u7EB1,\u7ECF\u68B3\u7406\u53BB\u9664\u77ED\u7EA4\u548C\u6742\u8D28,\u6BD4\u666E\u68B3\u66F4\u5149\u6D01\u3001\u5F3A\u97E7",
    example: "32s combed cotton gives a cleaner handfeel for premium tees."
  },
  {
    term: "carded cotton",
    full_form: "carded cotton yarn",
    category: "yarn_sourcing",
    phonetic: "/\u02C8k\u0251\u02D0d\u026Ad \u02C8k\u0252tn/",
    definition_en: "cotton yarn that has only been carded to align fibers; cheaper and more hairy than combed, used in basic or rustic styles",
    definition_zh: "\u666E\u68B3\u68C9\u7EB1,\u53EA\u7ECF\u7C97\u68B3,\u6BDB\u7FBD\u591A,\u4EF7\u683C\u4FBF\u5B9C",
    example: "20s carded cotton is a common choice for budget fleece."
  },
  {
    term: "compact yarn",
    full_form: "compact-spun yarn",
    category: "yarn_sourcing",
    phonetic: "/\u02C8k\u0252mp\xE6kt j\u0251\u02D0n/",
    definition_en: "ring-spun yarn with a compacting zone that reduces hairiness and improves strength; cleaner surface for printing and dyeing",
    definition_zh: "\u7D27\u5BC6\u7EBA\u7EB1,\u5728\u73AF\u952D\u7EBA\u57FA\u7840\u4E0A\u52A0\u538B\u5B9E\u533A,\u6BDB\u7FBD\u5C11\u3001\u5E03\u9762\u5149\u6D01",
    example: "Compact yarn is preferred for high-end jersey where print clarity matters."
  },
  {
    term: "ring-spun",
    full_form: "ring-spun yarn",
    category: "yarn_sourcing",
    phonetic: "/r\u026A\u014B sp\u028Cn/",
    definition_en: "yarn spun on a ring-spinning frame, producing a strong, fine yarn; the most common spinning method for premium cotton",
    definition_zh: "\u73AF\u952D\u7EBA\u7EB1,\u4E3B\u6D41\u7CBE\u68B3\u68C9\u7EBA\u7EB1\u65B9\u6CD5,\u5F3A\u529B\u597D\u3001\u7EB1\u5149\u6D01",
    example: "Ring-spun yarn is the standard for combed cotton tees."
  },
  {
    term: "open-end",
    full_form: "open-end yarn (OE)",
    category: "yarn_sourcing",
    phonetic: "/\u02C8\u0259\u028Ap\u0259n end/",
    definition_en: "yarn spun by a rotor or air-jet process; cheaper and faster than ring-spun, but weaker and hairier",
    definition_zh: "\u6C14\u6D41\u7EBA\u6216\u8F6C\u676F\u7EBA,\u6BD4\u73AF\u952D\u7EBA\u4FBF\u5B9C\u4F46\u5F3A\u529B\u7A0D\u4F4E",
    example: "Open-end yarn is common in budget knit fleece."
  },
  {
    term: "vortex spun",
    full_form: "vortex-spun yarn",
    category: "yarn_sourcing",
    phonetic: "/\u02C8v\u0254\u02D0teks sp\u028Cn/",
    definition_en: "yarn produced on a Murata vortex spinner, with very low hairiness; used in some knit applications",
    definition_zh: "\u6DA1\u6D41\u7EBA,\u65E5\u672C\u6751\u7530\u5DE5\u827A,\u6BDB\u7FBD\u6781\u5C11",
    example: "Vortex-spun yarn is popular for high-speed knitting of jersey."
  },
  {
    term: "siro-spun",
    full_form: "siro-spun yarn",
    category: "yarn_sourcing",
    phonetic: "/\u02C8s\u026A\u0259r\u0259\u028A sp\u028Cn/",
    definition_en: "a two-strand spinning method that produces a yarn resembling plied; gives a cleaner, stronger yarn than singles",
    definition_zh: "\u8D5B\u7EDC\u7EBA,\u4E24\u6839\u7C97\u7EB1\u5E73\u884C\u7EBA\u6210\u7C7B\u4F3C\u80A1\u7EBF\u7684\u7EB1",
    example: "Siro-spun yarn is used in shirting for a clean appearance."
  },
  {
    term: "slub",
    full_form: "slub yarn",
    category: "yarn_sourcing",
    phonetic: "/sl\u028Cb/",
    definition_en: "yarn with intentional thick and thin sections, used for textured, rustic fabric appearance",
    definition_zh: "\u7AF9\u8282\u7EB1,\u7C97\u7EC6\u4E0D\u5747,\u7528\u4E8E\u7C97\u72B7\u98CE\u683C\u5E03\u9762",
    example: "Slub yarn gives the fabric a vintage, irregular look."
  },
  {
    term: "melange",
    full_form: "melange yarn (heather)",
    category: "yarn_sourcing",
    phonetic: "/me\u026A\u02C8l\u0251\u02D0n\u0292/",
    definition_en: "yarn spun from pre-blended dyed fibers, producing a heathered or mixed-color effect; common in casual wear",
    definition_zh: "\u9EBB\u7070\u7EB1,\u67D3\u8272\u7EA4\u7EF4\u9884\u6DF7\u7EBA\u7EB1,\u5F62\u6210\u6DF7\u8272\u6548\u679C",
    example: "Melange yarn is widely used in athleisure and casual basics."
  },
  {
    term: "twist",
    full_form: "yarn twist",
    category: "yarn_sourcing",
    phonetic: "/tw\u026Ast/",
    definition_en: "the number of turns per unit length in a yarn, usually measured in TPM (turns per meter) or TPI (turns per inch)",
    definition_zh: "\u637B\u5EA6,\u6BCF\u7C73\u6216\u6BCF\u82F1\u5BF8\u7684\u637B\u56DE\u6570,TPM/TPI",
    example: "4 TPM is a typical twist for knit yarn."
  },
  {
    term: "S twist / Z twist",
    full_form: "direction of twist",
    category: "yarn_sourcing",
    phonetic: "/es twist / zi\u02D0 twist/",
    definition_en: "S-twist turns clockwise, Z-twist counterclockwise; knit yarns are typically Z-twist, woven warp often S-twist",
    definition_zh: "S \u637B(\u987A\u65F6\u9488)\u3001Z \u637B(\u9006\u65F6\u9488),\u9488\u7EC7\u591A\u7528 Z \u637B",
    example: "We use Z-twist yarn for single jersey."
  },
  {
    term: "cone",
    full_form: "yarn cone (cheese)",
    category: "yarn_sourcing",
    phonetic: "/k\u0259\u028An/",
    definition_en: "a package of yarn wound on a conical or cylindrical paper tube, ready for knitting or weaving; common weights 1-2 kg",
    definition_zh: "\u7B52\u5B50\u7EB1,\u9488\u7EC7/\u68AD\u7EC7\u7528\u7684\u5377\u88C5,\u5E38\u89C1 1-2 \u516C\u65A4",
    example: "1.5 kg cheese cones are standard for seamless knitting."
  },
  {
    term: "composition",
    full_form: "fiber composition",
    category: "yarn_sourcing",
    phonetic: "/\u02CCk\u0252mp\u0259\u02C8z\u026A\u0283n/",
    definition_en: "the fiber blend of a yarn, e.g. 100% cotton, 80/20 cotton/polyester, CVC (chief value cotton), T/C (polyester/cotton)",
    definition_zh: "\u7EA4\u7EF4\u6210\u5206,\u5982 100% \u68C9\u300180/20 \u68C9/\u6DA4\u3001CVC\u3001T/C",
    example: "The composition is 100% combed cotton, 32s single."
  },
  {
    term: "GSM",
    full_form: "grams per square meter",
    category: "weaving_knitting",
    phonetic: "/\u02CCd\u0292i\u02D0 \u02CCes \u02C8em/",
    definition_en: "the weight of a fabric in grams per square meter, indicating its density and thickness",
    definition_zh: "\u514B\u91CD,\u6BCF\u5E73\u65B9\u7C73\u514B\u6570,\u53CD\u6620\u9762\u6599\u539A\u8584\u548C\u5BC6\u5EA6",
    example: "The buyer spec calls for 220 GSM single jersey."
  },
  {
    term: "EPI",
    full_form: "ends per inch (warp)",
    category: "weaving_knitting",
    phonetic: "/\u02CCi\u02D0 pi\u02D0 \u02C8a\u026A/",
    definition_en: "the number of warp yarns per inch of woven fabric; a measure of warp density",
    definition_zh: "\u7ECF\u5BC6,\u6BCF\u82F1\u5BF8\u7ECF\u7EB1\u6839\u6570,\u68AD\u7EC7\u53C2\u6570",
    example: "For 60s shirting, we run 100 EPI on the loom."
  },
  {
    term: "PPI",
    full_form: "picks per inch (weft)",
    category: "weaving_knitting",
    phonetic: "/\u02CCpi\u02D0 pi\u02D0 \u02C8a\u026A/",
    definition_en: "the number of weft (filling) yarns per inch of woven fabric",
    definition_zh: "\u7EAC\u5BC6,\u6BCF\u82F1\u5BF8\u7EAC\u7EB1\u6839\u6570",
    example: "80 EPI x 80 PPI is a standard poplin density."
  },
  {
    term: "course",
    full_form: "course (knit)",
    category: "weaving_knitting",
    phonetic: "/k\u0254\u02D0s/",
    definition_en: "a horizontal row of loops in a knitted fabric; courses per cm measures the width density",
    definition_zh: "\u6A2A\u5217,\u9488\u7EC7\u5E03\u6A2A\u5411\u7EBF\u5708\u884C",
    example: "We measure courses per cm on the finished fabric."
  },
  {
    term: "wale",
    full_form: "wale (knit)",
    category: "weaving_knitting",
    phonetic: "/we\u026Al/",
    definition_en: "a vertical column of loops in a knitted fabric; wales per cm measures the length density",
    definition_zh: "\u7EB5\u884C,\u9488\u7EC7\u5E03\u7EB5\u5411\u7EBF\u5708\u5217",
    example: "Interlock has finer wales than single jersey."
  },
  {
    term: "gauge",
    full_form: "machine gauge (knitting)",
    category: "weaving_knitting",
    phonetic: "/\u0261e\u026Ad\u0292/",
    definition_en: "the number of needles per inch on a knitting machine; e.g. E14, E18, E24, E28, E32; higher gauge = finer knit",
    definition_zh: "\u673A\u53F7,\u6BCF\u82F1\u5BF8\u9488\u6570,E14 \u7C97\u3001E28 \u4E2D\u3001E32 \u7EC6",
    example: "Seamless leggings are knit on E28 or E32 machines."
  },
  {
    term: "single jersey",
    full_form: "single jersey knit",
    category: "weaving_knitting",
    phonetic: "/\u02C8s\u026A\u014B\u0261l \u02C8d\u0292\u025C\u02D0zi/",
    definition_en: "a one-face knit fabric with distinct face and back; lightweight and common for T-shirts",
    definition_zh: "\u5355\u9762\u6C57\u5E03,\u6B63\u53CD\u9762\u4E0D\u540C\u7684\u6700\u57FA\u672C\u9488\u7EC7\u5E03",
    example: "Single jersey at 180 GSM is the most common tee fabric."
  },
  {
    term: "interlock",
    full_form: "interlock knit",
    category: "weaving_knitting",
    phonetic: "/\u02C8\u026Ant\u0259l\u0252k/",
    definition_en: "a double-knit fabric with two interlocking single-jersey layers; thicker, more stable, reversible",
    definition_zh: "\u53CC\u9762\u5E03,\u4E24\u5C42\u5355\u9762\u4E92\u9501,\u539A\u5B9E\u7A33\u5B9A,\u4E24\u9762\u76F8\u540C",
    example: "Interlock at 220 GSM is good for premium tees and dresses."
  },
  {
    term: "rib",
    full_form: "rib knit (1x1, 2x2)",
    category: "weaving_knitting",
    phonetic: "/r\u026Ab/",
    definition_en: "a knit with alternating knit and purl stitches; very stretchy; 1x1 alternates 1 knit 1 purl, 2x2 alternates 2 knit 2 purl",
    definition_zh: "\u7F57\u7EB9,1x1\u30012x2 \u4EA4\u66FF,\u9AD8\u5F39\u6027,\u5E38\u7528\u4E8E\u9886\u53E3\u8896\u53E3",
    example: "1x1 rib is used for the neckband of T-shirts."
  },
  {
    term: "pique",
    full_form: "pique knit",
    category: "weaving_knitting",
    phonetic: "/\u02C8pi\u02D0ke\u026A/",
    definition_en: "a knit with a waffle or honeycomb texture; common in polo shirts",
    definition_zh: "\u73E0\u5730\u7F51\u773C,\u5E38\u7528\u4E8E Polo \u886B",
    example: "Pique knit 220 GSM is the classic polo fabric."
  },
  {
    term: "fleece",
    full_form: "fleece knit (3-end, 2-end)",
    category: "weaving_knitting",
    phonetic: "/fli\u02D0s/",
    definition_en: "a knit with a brushed or raised back for warmth; 3-end has 3 yarn feeds including spandex, 2-end has 2",
    definition_zh: "\u6293\u7ED2,\u80CC\u9762\u8D77\u7ED2\u4FDD\u6696,3 \u8DEF\u542B\u6C28\u7EB6,2 \u8DEF\u4E0D\u542B",
    example: "3-end fleece gives better recovery than 2-end."
  },
  {
    term: "terry",
    full_form: "terry knit (French terry)",
    category: "weaving_knitting",
    phonetic: "/\u02C8teri/",
    definition_en: "a knit with loops on the back that can be left as is (French terry) or brushed (terry fleece); used in sweatshirts and athleisure",
    definition_zh: "\u6BDB\u5708\u5E03,\u80CC\u9762\u6709\u672A\u526A\u65AD\u7684\u7EBF\u5708,\u53EF\u8D77\u7ED2\u6216\u4E0D\u8D77\u7ED2",
    example: "French terry at 320 GSM is the standard unbrushed sweatshirt fabric."
  },
  {
    term: "jacquard",
    full_form: "jacquard knit",
    category: "weaving_knitting",
    phonetic: "/d\u0292\u0259\u02C8k\u0251\u02D0d/",
    definition_en: "a knit produced on a jacquard machine with individual needle control, allowing complex patterns",
    definition_zh: "\u63D0\u82B1\u9488\u7EC7,\u673A\u5668\u5355\u72EC\u63A7\u5236\u9488,\u51FA\u590D\u6742\u82B1\u578B",
    example: "Jacquard knits allow logo and pattern in the fabric structure."
  },
  {
    term: "dobby",
    full_form: "dobby weave",
    category: "weaving_knitting",
    phonetic: "/\u02C8d\u0252bi/",
    definition_en: "a small-pattern weave produced on a dobby loom, allowing simple geometric designs",
    definition_zh: "\u591A\u81C2\u5C0F\u63D0\u82B1,\u7B80\u5355\u51E0\u4F55\u56FE\u6848",
    example: "Dobby weaves are used for textured shirting."
  },
  {
    term: "plain weave",
    full_form: "plain weave (tabby)",
    category: "weaving_knitting",
    phonetic: "/ple\u026An wi\u02D0v/",
    definition_en: "the simplest and most common weave, with weft passing alternately over and under each warp",
    definition_zh: "\u5E73\u7EB9,\u6700\u57FA\u672C\u7684\u68AD\u7EC7\u7EC4\u7EC7",
    example: "Plain weave poplin is a standard shirting fabric."
  },
  {
    term: "twill",
    full_form: "twill weave",
    category: "weaving_knitting",
    phonetic: "/tw\u026Al/",
    definition_en: "a weave with diagonal lines, produced by offset weft; common in chinos and denim",
    definition_zh: "\u659C\u7EB9,\u7ECF\u7EAC\u4EA4\u9519\u5F62\u6210\u659C\u7EBF,\u7528\u4E8E\u5361\u5176\u3001\u725B\u4ED4",
    example: "3/1 twill is the classic denim construction."
  },
  {
    term: "satin",
    full_form: "satin weave",
    category: "weaving_knitting",
    phonetic: "/\u02C8s\xE6t\u026An/",
    definition_en: "a weave with long warp or weft floats, giving a smooth, lustrous surface",
    definition_zh: "\u7F0E\u7EB9,\u957F\u6D6E\u7EBF,\u8868\u9762\u5149\u6ED1\u6709\u5149\u6CFD",
    example: "Satin weave is used in formal shirting and linings."
  },
  {
    term: "loop length",
    full_form: "loop length (knit)",
    category: "weaving_knitting",
    phonetic: "/lu\u02D0p le\u014B\u03B8/",
    definition_en: "the length of yarn in a single knitted loop, measured in mm; directly affects GSM, handfeel and shrinkage",
    definition_zh: "\u7EBF\u5708\u957F\u5EA6,\u5F71\u54CD\u514B\u91CD\u3001\u624B\u611F\u3001\u7F29\u6C34",
    example: "Tightening the loop length from 3.0 to 2.7 mm raised the GSM by 5%."
  },
  {
    term: "shrinkage",
    full_form: "fabric shrinkage",
    category: "weaving_knitting",
    phonetic: "/\u02C8\u0283r\u026Ank\u026Ad\u0292/",
    definition_en: "the dimensional change of fabric after washing, measured in % lengthwise (L) and widthwise (W); industry standard \xB15%",
    definition_zh: "\u7F29\u6C34\u7387,\u6C34\u6D17\u540E\u5C3A\u5BF8\u53D8\u5316,\u957F\u5EA6/\u5BBD\u5EA6\u65B9\u5411\u767E\u5206\u6BD4",
    example: "Our cotton jersey pre-shrunk to 3% L / 3% W."
  },
  {
    term: "color fastness",
    full_form: "color fastness",
    category: "dyeing_finishing",
    phonetic: "/\u02C8k\u028Cl\u0259 \u02C8f\xE6stn\u0259s/",
    definition_en: "the resistance of a dyed fabric to color change or transfer under conditions such as washing, light, rubbing, perspiration",
    definition_zh: "\u8272\u7262\u5EA6,\u67D3\u8272\u540E\u62B5\u6297\u892A\u8272/\u6CBE\u8272\u7684\u80FD\u529B",
    example: "Buyer's standard is grade 4 washing fastness on dark shades."
  },
  {
    term: "wash fastness",
    full_form: "wash fastness (ISO 105-C06)",
    category: "dyeing_finishing",
    phonetic: "/w\u0252\u0283 \u02C8f\xE6stn\u0259s/",
    definition_en: "color change and staining after washing, tested at 40 or 60\xB0C with a multi-fiber strip; grades 1-5",
    definition_zh: "\u8010\u6D17\u8272\u7262\u5EA6,\u591A\u7EA4\u7EF4\u8D34\u886C\u6D4B\u8BD5,1-5 \u7EA7",
    example: "Wash fastness at 40\xB0C came in at grade 4 on the navy."
  },
  {
    term: "light fastness",
    full_form: "light fastness (ISO 105-B02)",
    category: "dyeing_finishing",
    phonetic: "/la\u026At \u02C8f\xE6stn\u0259s/",
    definition_en: "resistance of color to fading under exposure to light (xenon arc), graded 1-8 (blue scale)",
    definition_zh: "\u8010\u5149\u8272\u7262\u5EA6,\u6C19\u706F\u6D4B\u8BD5,1-8 \u7EA7\u84DD\u6807",
    example: "Light fastness grade 4 is the minimum for outdoor apparel."
  },
  {
    term: "rubbing fastness",
    full_form: "rubbing / crocking fastness (ISO 105-X12)",
    category: "dyeing_finishing",
    phonetic: "/\u02C8r\u028Cb\u026A\u014B \u02C8f\xE6stn\u0259s/",
    definition_en: "color transfer from fabric to a white crocking cloth by rubbing; dry and wet; grades 1-5",
    definition_zh: "\u8010\u6469\u64E6\u8272\u7262\u5EA6,\u5E72\u6469\u548C\u6E7F\u6469,1-5 \u7EA7",
    example: "Wet rubbing fastness is critical for deep shades."
  },
  {
    term: "reactive dye",
    full_form: "reactive dye",
    category: "dyeing_finishing",
    phonetic: "/ri\u02C8\xE6kt\u026Av da\u026A/",
    definition_en: "a dye that forms a covalent bond with cellulosic fibers, giving good wash fastness; main dye class for cotton",
    definition_zh: "\u6D3B\u6027\u67D3\u6599,\u4E0E\u7EA4\u7EF4\u7D20\u5171\u4EF7\u952E\u7ED3\u5408,\u68C9\u5E03\u4E3B\u6D41\u67D3\u6599",
    example: "Reactive dyes are used for cotton T-shirt fabric."
  },
  {
    term: "disperse dye",
    full_form: "disperse dye",
    category: "dyeing_finishing",
    phonetic: "/d\u026A\u02C8sp\u025C\u02D0s da\u026A/",
    definition_en: "a non-ionic dye used for synthetic fibers, especially polyester; applied under high temperature and pressure",
    definition_zh: "\u5206\u6563\u67D3\u6599,\u7528\u4E8E\u5408\u6210\u7EA4\u7EF4,\u9AD8\u6E29\u9AD8\u538B\u67D3\u8272",
    example: "Disperse dye on polyester requires 130\xB0C thermosol."
  },
  {
    term: "vat dye",
    full_form: "vat dye",
    category: "dyeing_finishing",
    phonetic: "/v\xE6t da\u026A/",
    definition_en: "an insoluble dye reduced to a soluble form for dyeing, then oxidized to fix; very high fastness",
    definition_zh: "\u8FD8\u539F\u67D3\u6599,\u8272\u7262\u5EA6\u6781\u4F73,\u9002\u5408\u6DF1\u8272",
    example: "Indigo on denim is a vat dye."
  },
  {
    term: "jet dyeing",
    full_form: "jet dyeing",
    category: "dyeing_finishing",
    phonetic: "/d\u0292et \u02C8da\u026A\u026A\u014B/",
    definition_en: "a piece-dyeing method where fabric is circulated in a closed jet machine; suitable for knit and small lots",
    definition_zh: "\u6EA2\u6D41\u67D3\u8272,\u5339\u67D3\u65B9\u5F0F,\u9002\u5408\u9488\u7EC7\u548C\u5C0F\u6279\u91CF\u591A\u8272",
    example: "Jet dyeing is flexible for small-lot multi-color knits."
  },
  {
    term: "continuous dyeing",
    full_form: "continuous dyeing (pad-dry-cure)",
    category: "dyeing_finishing",
    phonetic: "/k\u0259n\u02C8t\u026Anju\u0259s \u02C8da\u026A\u026A\u014B/",
    definition_en: "a pad-dry-cure or pad-steam process for high-volume fabric dyeing; efficient for large lots of single color",
    definition_zh: "\u8FDE\u7EED\u67D3\u8272,\u9002\u5408\u5927\u6279\u91CF\u5355\u8272,\u6548\u7387\u9AD8",
    example: "Continuous dyeing is cost-effective for 10,000+ kg single-color runs."
  },
  {
    term: "lab dip",
    full_form: "lab dip / laboratory dip",
    category: "dyeing_finishing",
    phonetic: "/l\xE6b d\u026Ap/",
    definition_en: "a small fabric sample dyed in the lab to match a target color (Pantone TCX/TPX) before bulk production",
    definition_zh: "\u5BF9\u8272\u6837,\u5B9E\u9A8C\u5BA4\u67D3\u8272\u5C0F\u6837,\u5927\u8D27\u524D\u5BA2\u6237\u7B7E\u6536",
    example: "We need 4 lab dips signed off before bulk dyeing."
  },
  {
    term: "Delta E",
    full_form: "Delta E (color difference)",
    category: "dyeing_finishing",
    phonetic: "/\u02C8delt\u0259 i\u02D0/",
    definition_en: "a numerical measure of color difference under CIELab; <1.0 imperceptible, 1-2 acceptable, >2 visible",
    definition_zh: "\u8272\u5DEE\u503C,CIELab \u6807\u51C6,\u6570\u5B57\u8D8A\u5C0F\u8D8A\u63A5\u8FD1",
    example: "Delta E under 1.0 is acceptable for most color matches."
  },
  {
    term: "Pantone TCX",
    full_form: "Pantone Textile Cotton eXtended",
    category: "dyeing_finishing",
    phonetic: "/\u02C8p\xE6nt\u0259\u028An \u02CCti\u02D0 si\u02D0 \u02C8eks/",
    definition_en: "a Pantone color system for cotton-based textiles, used as the standard for fabric color matching",
    definition_zh: "\u6F58\u901A TCX,\u68C9\u57FA\u7EBA\u7EC7\u8272\u5361",
    example: "We matched the lab dip to Pantone TCX 19-4052 within dE 1.0."
  },
  {
    term: "pre-shrunk",
    full_form: "pre-shrunk (compacting)",
    category: "dyeing_finishing",
    phonetic: "/pri\u02D0 \u0283r\u028C\u014Bk/",
    definition_en: "a finishing process that mechanically compacts the fabric to remove residual shrinkage, often to \xB13%",
    definition_zh: "\u9884\u7F29,\u673A\u68B0\u538B\u5B9E\u51CF\u5C11\u6C34\u6D17\u7F29\u6C34",
    example: "Pre-shrunk jersey holds its size after home laundering."
  },
  {
    term: "mercerized",
    full_form: "mercerized finish",
    category: "dyeing_finishing",
    phonetic: "/\u02C8m\u025C\u02D0s\u0259ra\u026Azd/",
    definition_en: "treatment of cotton with concentrated NaOH to swell the fiber, increasing luster, strength and dye affinity",
    definition_zh: "\u4E1D\u5149,NaOH \u5904\u7406\u540E\u8868\u9762\u5149\u6CFD\u597D\u3001\u5F3A\u529B\u9AD8",
    example: "Mercerized cotton jersey has a subtle luster on the face."
  },
  {
    term: "singed",
    full_form: "singeing finish",
    category: "dyeing_finishing",
    phonetic: "/s\u026And\u0292d/",
    definition_en: "a finishing process that burns off surface fuzz/hairiness from fabric by passing over a gas flame or hot plate, giving a cleaner surface",
    definition_zh: "\u70E7\u6BDB,\u70E7\u53BB\u8868\u9762\u6BDB\u7FBD,\u5E03\u9762\u5149\u6D01",
    example: "Singeing at 1100\xB0C cleans the surface for luster."
  },
  {
    term: "softener",
    full_form: "softener (silicone vs non-silicone)",
    category: "dyeing_finishing",
    phonetic: "/\u02C8s\u0252fn\u0259/",
    definition_en: "a finishing chemical that imparts soft hand; silicone gives slick feel, non-silicone (hydrophilic) preserves wicking",
    definition_zh: "\u67D4\u8F6F\u5242,\u7845\u6CB9\u6ED1\u723D\u3001\u975E\u7845\u4EB2\u6C34",
    example: "Use non-silicone softener on performance fabric to keep wicking."
  },
  {
    term: "bleached",
    full_form: "bleached",
    category: "dyeing_finishing",
    phonetic: "/bli\u02D0t\u0283t/",
    definition_en: "fabric treated with hydrogen peroxide or chlorine to remove natural color, preparing for dyeing or printing",
    definition_zh: "\u6F02\u767D,\u53BB\u9664\u5929\u7136\u8272\u7D20,\u4FBF\u4E8E\u67D3\u8272\u5370\u82B1",
    example: "The greige fabric is bleached before reactive dyeing."
  },
  {
    term: "GSM loss",
    full_form: "GSM loss in finishing",
    category: "dyeing_finishing",
    phonetic: "/\u02CCd\u0292i\u02D0 \u02CCes \u02C8em l\u0252s/",
    definition_en: "the percentage decrease in fabric weight from greige to finished state, typically 3-8% on cotton knit",
    definition_zh: "\u514B\u91CD\u635F\u5931,\u576F\u5E03\u5230\u6210\u54C1\u514B\u91CD\u51CF\u5C11\u6BD4\u4F8B",
    example: "Compensate the 5% GSM loss by knitting greige heavier."
  },
  {
    term: "hydrophilic finish",
    full_form: "hydrophilic finish",
    category: "dyeing_finishing",
    phonetic: "/\u02CCha\u026Adr\u0259\u02C8f\u026Al\u026Ak \u02C8f\u026An\u026A\u0283/",
    definition_en: "a chemical finish that makes synthetic fabric wick moisture, used in activewear",
    definition_zh: "\u4EB2\u6C34\u6574\u7406,\u63D0\u9AD8\u5316\u7EA4\u5438\u6E7F\u6027,\u8FD0\u52A8\u9762\u6599\u5E38\u7528",
    example: "Hydrophilic finish on polyester for moisture management."
  },
  {
    term: "digital print",
    full_form: "digital textile printing",
    category: "printing_embroidery",
    phonetic: "/\u02C8d\u026Ad\u0292\u026Atl pr\u026Ant/",
    definition_en: "inkjet printing of fabric directly from a digital file, no screens required; ideal for small lots and complex multi-color designs",
    definition_zh: "\u6570\u7801\u5370\u82B1,\u55B7\u58A8\u76F4\u5370,\u9002\u5408\u5C0F\u6279\u91CF\u591A\u8272\u590D\u6742\u82B1\u578B",
    example: "Digital print allows photographic detail on 14-color designs."
  },
  {
    term: "rotary screen",
    full_form: "rotary screen printing",
    category: "printing_embroidery",
    phonetic: "/\u02C8r\u0259\u028At\u0259ri skri\u02D0n/",
    definition_en: "a cylindrical screen continuously rotates while fabric passes under it, ideal for high-volume runs of repeating patterns",
    definition_zh: "\u5706\u7F51\u5370\u82B1,\u9002\u5408\u5927\u6279\u91CF\u91CD\u590D\u56FE\u6848",
    example: "Rotary screen print runs at 30 m/min on a 5,000 m bulk order."
  },
  {
    term: "flat screen",
    full_form: "flat screen printing (flatbed)",
    category: "printing_embroidery",
    phonetic: "/fl\xE6t skri\u02D0n/",
    definition_en: "a flat screen printing method where each color is printed through a separate screen; flexible for medium lots and detailed patterns",
    definition_zh: "\u5E73\u7F51\u5370\u82B1,\u9002\u5408\u4E2D\u7B49\u6279\u91CF\u548C\u7EC6\u8282\u56FE\u6848",
    example: "Flat screen handles the 4 metallic colors cleanly."
  },
  {
    term: "sublimation",
    full_form: "sublimation printing",
    category: "printing_embroidery",
    phonetic: "/\u02CCs\u028Cbl\u026A\u02C8me\u026A\u0283n/",
    definition_en: "a heat transfer process where dye sublimates into polyester fibers; vivid, durable prints on polyester",
    definition_zh: "\u70ED\u5347\u534E\u5370\u82B1,\u67D3\u6599\u5347\u534E\u8FDB\u5165\u6DA4\u7EB6,\u8272\u5F69\u9C9C\u8273\u7262\u56FA",
    example: "Sublimation print is widely used on polyester sportswear."
  },
  {
    term: "pigment print",
    full_form: "pigment printing",
    category: "printing_embroidery",
    phonetic: "/\u02C8p\u026A\u0261m\u0259nt pr\u026Ant/",
    definition_en: "printing with insoluble pigments bound to fabric by a binder; cheap and versatile but slightly stiffer hand",
    definition_zh: "\u6D82\u6599\u5370\u82B1,\u7528\u7C98\u5408\u5242\u56FA\u7740,\u6210\u672C\u4F4E,\u624B\u611F\u7565\u786C",
    example: "Pigment print is the most economical for cotton T-shirts."
  },
  {
    term: "reactive print",
    full_form: "reactive printing",
    category: "printing_embroidery",
    phonetic: "/ri\u02C8\xE6kt\u026Av pr\u026Ant/",
    definition_en: "printing with reactive dyes that bond to cellulose; soft hand and high wash fastness",
    definition_zh: "\u6D3B\u6027\u5370\u82B1,\u4E0E\u7EA4\u7EF4\u5171\u4EF7\u7ED3\u5408,\u624B\u611F\u67D4\u8F6F\u3001\u7262\u5EA6\u597D",
    example: "Reactive print is the premium choice for cotton jersey."
  },
  {
    term: "strike-off",
    full_form: "strike-off (print sample)",
    category: "printing_embroidery",
    phonetic: "/stra\u026Ak \u0252f/",
    definition_en: "a small printed sample on the actual fabric for color and registration approval before bulk production",
    definition_zh: "\u5370\u82B1\u6253\u6837,\u5927\u8D27\u524D\u989C\u8272\u548C\u5957\u51C6\u7B7E\u6536",
    example: "Strike-off approval is required before bulk print."
  },
  {
    term: "registration",
    full_form: "registration tolerance",
    category: "printing_embroidery",
    phonetic: "/\u02CCred\u0292\u026A\u02C8stre\u026A\u0283n/",
    definition_en: "the alignment accuracy of multiple colors in a print, measured in mm; tighter is better",
    definition_zh: "\u5957\u51C6,\u591A\u8272\u5BF9\u9F50\u7CBE\u5EA6,\u6570\u5B57\u8D8A\u5C0F\u8D8A\u7CBE\u51C6",
    example: "We hold registration tolerance of 0.3 mm on 12-color prints."
  },
  {
    term: "color separation",
    full_form: "color separation",
    category: "printing_embroidery",
    phonetic: "/\u02C8k\u028Cl\u0259 \u02CCsep\u0259\u02C8re\u026A\u0283n/",
    definition_en: "the process of separating a multi-color artwork into individual channels/screen for each color",
    definition_zh: "\u5206\u8272,\u628A\u591A\u8272\u8BBE\u8BA1\u7A3F\u62C6\u6210\u6BCF\u8272\u4E00\u4E2A\u901A\u9053",
    example: "Color separation for 12 colors is included in the setup fee."
  },
  {
    term: "satin stitch",
    full_form: "satin stitch (embroidery)",
    category: "printing_embroidery",
    phonetic: "/\u02C8s\xE6t\u026An st\u026At\u0283/",
    definition_en: "a tight zigzag stitch for filling areas; produces a smooth, lustrous surface; used for narrow bands and text",
    definition_zh: "\u7F0E\u7EB9\u7EE3,\u7D27\u5BC6\u4E4B\u5B57\u9488,\u7528\u4E8E\u7A84\u5E26\u548C\u6587\u5B57",
    example: "Satin stitch at 0.4 mm pitch gives clean logo edges."
  },
  {
    term: "chain stitch",
    full_form: "chain stitch (embroidery)",
    category: "printing_embroidery",
    phonetic: "/t\u0283e\u026An st\u026At\u0283/",
    definition_en: "a looped stitch that resembles a chain; used for outlines, running stitches, and decorative effects",
    definition_zh: "\u94FE\u5F0F\u7EE3,\u73AF\u73AF\u76F8\u6263,\u5E38\u7528\u4E8E\u8F6E\u5ED3\u548C\u88C5\u9970",
    example: "Chain stitch outlines the embroidery logo."
  },
  {
    term: "fill stitch",
    full_form: "fill stitch (tatami)",
    category: "printing_embroidery",
    phonetic: "/f\u026Al st\u026At\u0283/",
    definition_en: "a layered embroidery stitch with rows in alternating directions; used for large filled areas",
    definition_zh: "\u586B\u5145\u7EE3(\u69BB\u69BB\u7C73),\u591A\u5C42\u53E0\u52A0,\u9002\u5408\u5927\u9762\u79EF\u8272\u5757",
    example: "Fill stitch is used for the body of an embroidered badge."
  },
  {
    term: "toweling embroidery",
    full_form: "toweling embroidery (chenille)",
    category: "printing_embroidery",
    phonetic: "/\u02C8ta\u028A\u0259l\u026A\u014B \u02CCembr\u0254\u026A\u02C8dri/",
    definition_en: "a raised, fluffy embroidery effect using a looped pile yarn, used in decorative and varsity-style apparel",
    definition_zh: "\u6BDB\u5DFE\u7EE3(\u96EA\u5C3C\u5C14),\u51F8\u8D77\u6BDB\u5708\u6548\u679C,\u88C5\u9970\u611F\u5F3A",
    example: "Toweling embroidery gives a varsity letterman look."
  },
  {
    term: "sequin embroidery",
    full_form: "sequin embroidery",
    category: "printing_embroidery",
    phonetic: "/\u02C8si\u02D0kw\u026An \u02CCembr\u0254\u026A\u02C8dri/",
    definition_en: "embroidery with sequins attached; used in eveningwear and decorative garments",
    definition_zh: "\u73E0\u7247\u7EE3,\u88C5\u9970\u611F\u5F3A,\u7528\u4E8E\u793C\u670D\u548C\u88C5\u9970",
    example: "Sequin embroidery needs a special attachment on the machine."
  },
  {
    term: "applique",
    full_form: "applique embroidery",
    category: "printing_embroidery",
    phonetic: "/\u0259\u02C8pl\u026A\u02D0ke\u026A/",
    definition_en: "a technique where fabric pieces are sewn onto a base fabric, often with embroidered edges",
    definition_zh: "\u8D34\u5E03\u7EE3,\u628A\u5E03\u7247\u7F1D\u5728\u5E95\u5E03\u4E0A,\u5E38\u914D\u7EE3\u8FB9",
    example: "Applique reduces thread count and adds dimension."
  },
  {
    term: "chenille",
    full_form: "chenille yarn / embroidery",
    category: "printing_embroidery",
    phonetic: "/\u0283\u0259\u02C8ni\u02D0l/",
    definition_en: "a fuzzy, caterpillar-like yarn or embroidery effect with raised pile",
    definition_zh: "\u96EA\u5C3C\u5C14\u7EBF/\u7EE3,\u51F8\u8D77\u6BDB\u8338\u6548\u679C",
    example: "Chenille patches are popular in streetwear."
  },
  {
    term: "eyelet",
    full_form: "eyelet embroidery (cutwork)",
    category: "printing_embroidery",
    phonetic: "/\u02C8a\u026Al\u0259t/",
    definition_en: "an embroidery with small cut-out holes, finished with stitching; decorative and breathable",
    definition_zh: "\u9542\u7A7A\u7EE3,\u526A\u5B54\u540E\u7EE3\u8FB9\u88C5\u9970,\u900F\u6C14",
    example: "Eyelet embroidery is used in summer blouses."
  },
  {
    term: "backing",
    full_form: "embroidery backing (tear-away / cut-away)",
    category: "printing_embroidery",
    phonetic: "/\u02C8b\xE6k\u026A\u014B/",
    definition_en: "stabilizing material placed under the fabric during embroidery; tear-away for knits, cut-away for stretch and stability",
    definition_zh: "\u7EE3\u82B1\u886C\u5E95,\u6495\u886C\u9002\u5408\u9488\u7EC7,\u5207\u886C\u9002\u5408\u5F39\u6027\u5E03",
    example: "Use cut-away backing on stretch jersey for embroidery."
  },
  {
    term: "white underbase",
    full_form: "white underbase (print)",
    category: "printing_embroidery",
    phonetic: "/wa\u026At \u02C8\u028Cnd\u0259be\u026As/",
    definition_en: "a layer of white ink printed first on colored fabric to make subsequent colors appear vibrant",
    definition_zh: "\u767D\u5E95\u5C42,\u5728\u8272\u5E03\u4E0A\u5148\u5370\u767D\u58A8\u8BA9\u540E\u7EED\u8272\u66F4\u9C9C\u8273",
    example: "Light blue base needs a white underbase for the print to pop."
  },
  {
    term: "topping film",
    full_form: "water-soluble topping film",
    category: "printing_embroidery",
    phonetic: "/\u02C8t\u0252p\u026A\u014B f\u026Alm/",
    definition_en: "a transparent film placed on top of the fabric during embroidery to keep stitches raised on textured surfaces; dissolves in water",
    definition_zh: "\u6C34\u6EB6\u6027\u4E0A\u819C,\u7EE3\u82B1\u65F6\u76D6\u5728\u5E03\u4E0A\u8BA9\u9488\u8FF9\u7ACB\u8D77,\u6C34\u6EB6\u53BB\u9664",
    example: "Topping film is standard for toweling and terry embroidery."
  },
  {
    term: "hand feel",
    full_form: "hand feel",
    category: "dyeing_finishing",
    phonetic: "/h\xE6nd fi\u02D0l/",
    definition_en: "the tactile sensation of a fabric \u2014 soft, crisp, smooth, stiff, etc.",
    definition_zh: "\u7EC7\u7269\u7684\u624B\u611F(\u67D4\u8F6F\u3001\u633A\u62EC\u3001\u6ED1\u723D\u7B49)",
    example: "We need a softer hand feel for this t-shirt fabric."
  },
  {
    term: "GSM loss",
    full_form: "GSM loss",
    category: "dyeing_finishing",
    phonetic: "/\u02CCd\u0292i\u02D0 es \u025Bm l\u0252s/",
    definition_en: "reduction in fabric weight after wet processing",
    definition_zh: "\u67D3\u6574\u540E\u514B\u91CD\u635F\u5931",
    example: "A GSM loss of 3 to 5 percent is normal after washing."
  },
  {
    term: "course",
    full_form: "course",
    category: "weaving_knitting",
    phonetic: "/k\u0254\u02D0rs/",
    definition_en: "a horizontal row of knit stitches",
    definition_zh: "\u9488\u7EC7\u7269\u6A2A\u5217(\u4E00\u884C\u7EBF\u5708)",
    example: "We increased the courses per inch to get a denser fabric."
  },
  {
    term: "wale",
    full_form: "wale",
    category: "weaving_knitting",
    phonetic: "/we\u026Al/",
    definition_en: "a vertical column of knit stitches",
    definition_zh: "\u9488\u7EC7\u7269\u7EB5\u884C(\u4E00\u5217\u7EBF\u5708)",
    example: "A higher wales count means finer knit construction."
  },
  {
    term: "registration",
    full_form: "registration",
    category: "printing_embroidery",
    phonetic: "/\u02CCr\u025Bd\u0292\u026A\u02C8stre\u026A\u0283\u0259n/",
    definition_en: "precise alignment of multiple color screens in printing",
    definition_zh: "\u5370\u82B1\u5957\u8272\u5BF9\u4F4D\u7CBE\u5EA6",
    example: "Misregistration of more than 0.3mm is not acceptable."
  },
  {
    term: "siro-spun",
    full_form: "siro-spun",
    category: "yarn_sourcing",
    phonetic: "/\u02C8s\u026A\u0259ro\u028A sp\u028Cn/",
    definition_en: "a two-strand compact spinning method for smoother yarn",
    definition_zh: "\u8D5B\u7EDC\u7EBA(\u53CC\u80A1\u7D27\u5BC6\u7EBA)",
    example: "Siro-spun yarn gives better hairiness and strength."
  },
  {
    term: "combed",
    full_form: "combed",
    category: "yarn_sourcing",
    phonetic: "/ko\u028Amd/",
    definition_en: "cotton that has been combed to remove short fibers, giving smoother yarn",
    definition_zh: "\u7CBE\u68B3(\u53BB\u9664\u77ED\u7EA4\u7EF4,\u7EB1\u66F4\u5149\u6D01)",
    example: "We only use combed cotton for premium tee shirts."
  },
  {
    term: "sublimation print",
    full_form: "sublimation print",
    category: "printing_embroidery",
    phonetic: "/\u02CCs\u028Cbl\u026A\u02C8me\u026A\u0283\u0259n pr\u026Ant/",
    definition_en: "dye transfer via heat into polyester fabric; produces vivid, no-hand-feel prints",
    definition_zh: "\u70ED\u5347\u534E\u5370\u82B1(\u805A\u916F\u4E13\u7528,\u8272\u5F69\u9C9C\u8273)",
    example: "Sublimation print works best on white polyester."
  },
  {
    term: "tech pack",
    full_form: "technical package",
    category: "shirt_production",
    phonetic: "/\u02C8tek p\xE6k/",
    definition_en: "a complete set of documents that defines how a garment is to be produced, including spec, BOM, artwork, measurements, and construction notes",
    definition_zh: "\u6280\u672F\u5305 / \u5DE5\u827A\u5355",
    example: "We received the buyer's tech pack last week and started marker making."
  },
  {
    term: "BOM",
    full_form: "Bill of Materials",
    category: "shirt_production",
    phonetic: "/bi\u02D0 \u0259\u028A em/",
    definition_en: "a list of all materials, trims, and components needed to produce one garment",
    definition_zh: "\u7269\u6599\u6E05\u5355",
    example: "The BOM for this shirt includes shell fabric, interlining, buttons, thread, and labels."
  },
  {
    term: "marker",
    full_form: "marker",
    category: "shirt_production",
    phonetic: "/\u02C8m\u0251\u02D0k\u0259/",
    definition_en: "a paper or digital layout of all pattern pieces arranged for cutting to minimize fabric waste",
    definition_zh: "\u6392\u6599\u56FE / \u6392\u6599\u6837\u677F",
    example: "Marker efficiency for this style is 86% on 145 cm fabric."
  },
  {
    term: "marker efficiency",
    full_form: "marker efficiency",
    category: "shirt_production",
    phonetic: "/\u02C8m\u0251\u02D0k\u0259 \u026A\u02C8f\u026A\u0283\u0259nsi/",
    definition_en: "the ratio of fabric used by pattern pieces to total fabric used in the lay",
    definition_zh: "\u6392\u6599\u5229\u7528\u7387",
    example: "We aim for marker efficiency above 84% on cotton poplin."
  },
  {
    term: "spreading",
    full_form: "spreading / lay",
    category: "shirt_production",
    phonetic: "/\u02C8spred\u026A\u014B/",
    definition_en: "the process of stacking multiple plies of fabric on the cutting table in preparation for cutting",
    definition_zh: "\u62D6\u6599 / \u94FA\u6599",
    example: "We do spreading face-up, face-down alternating to avoid shade variation."
  },
  {
    term: "plies",
    full_form: "plies (of fabric)",
    category: "shirt_production",
    phonetic: "/pla\u026Az/",
    definition_en: "the number of layers of fabric stacked in a single lay for cutting",
    definition_zh: "\u94FA\u6599\u5C42\u6570",
    example: "For this 110 GSM cotton we run 12 plies per lay."
  },
  {
    term: "notch",
    full_form: "notch",
    category: "shirt_production",
    phonetic: "/n\u0252t\u0283/",
    definition_en: "a small V-cut or mark on a cut piece used to align panels during sewing",
    definition_zh: "\u526A\u53E3 / \u5B9A\u4F4D\u7F3A\u53E3",
    example: "Notches on the sleeve cap help align it to the armscye."
  },
  {
    term: "drill mark",
    full_form: "drill mark",
    category: "shirt_production",
    phonetic: "/dr\u026Al m\u0251\u02D0k/",
    definition_en: "a small hole punched through stacked fabric layers to mark a sewing reference point",
    definition_zh: "\u94BB\u5B54\u5B9A\u4F4D\u6807\u8BB0",
    example: "Drill marks on the pocket position ensure consistent placement on every shirt."
  },
  {
    term: "bundle",
    full_form: "bundle",
    category: "shirt_production",
    phonetic: "/\u02C8b\u028Cndl/",
    definition_en: "a tied set of cut pieces grouped for one sewing operation in a bundle system",
    definition_zh: "\u6346\u624E\u5206\u6279\u4EF6",
    example: "Each bundle contains 10 pieces for one operation."
  },
  {
    term: "seam allowance",
    full_form: "seam allowance",
    category: "shirt_production",
    phonetic: "/si\u02D0m \u0259\u02C8la\u028A\u0259ns/",
    definition_en: "the extra fabric left at the edge of a panel for sewing the seam",
    definition_zh: "\u7F1D\u4EFD",
    example: "Standard seam allowance for shirts is 1 cm on side seams."
  },
  {
    term: "SPI",
    full_form: "Stitches Per Inch",
    category: "shirt_production",
    phonetic: "/es pi\u02D0 a\u026A/",
    definition_en: "the number of stitches in one inch of seam, indicating seam strength and appearance",
    definition_zh: "\u6BCF\u82F1\u5BF8\u9488\u6570",
    example: "Side seam is 8 SPI and topstitch is 10 to 12 SPI."
  },
  {
    term: "flat-felled seam",
    full_form: "flat-felled seam",
    category: "shirt_production",
    phonetic: "/fl\xE6t feld si\u02D0m/",
    definition_en: "a strong seam where one raw edge is enclosed and the other is topstitched flat",
    definition_zh: "\u5305\u8FB9\u6298\u8FB9\u7F1D / \u6765\u53BB\u7F1D",
    example: "We use a flat-felled seam on the side seam of premium shirts."
  },
  {
    term: "French seam",
    full_form: "French seam",
    category: "shirt_production",
    phonetic: "/frent\u0283 si\u02D0m/",
    definition_en: "a seam that encloses the raw edges inside, used on light or sheer fabrics",
    definition_zh: "\u6CD5\u5F0F\u7F1D / \u5185\u5305\u7F1D",
    example: "French seam is used on the sleeve placket to enclose raw edges."
  },
  {
    term: "buttonhole",
    full_form: "buttonhole",
    category: "shirt_production",
    phonetic: "/\u02C8b\u028Ctnh\u0259\u028Al/",
    definition_en: "a slit finished with stitching to allow a button to pass through",
    definition_zh: "\u6263\u773C / \u9501\u773C",
    example: "Flat buttonholes are 16 stitches per cm on the front placket."
  },
  {
    term: "shank button",
    full_form: "shank button",
    category: "shirt_production",
    phonetic: "/\u0283\xE6\u014Bk \u02C8b\u028Ctn/",
    definition_en: "a button with a small loop on the back, sewn on with the shank, not through the face",
    definition_zh: "\u6709\u811A\u6263 / \u67C4\u6263",
    example: "Shank buttons are used on heavy coats, not standard shirts."
  },
  {
    term: "interlining",
    full_form: "interlining",
    category: "shirt_production",
    phonetic: "/\u02C8\u026Ant\u0259la\u026An\u026A\u014B/",
    definition_en: "a layer of fabric placed between the shell and the lining to add body, shape, or reinforcement",
    definition_zh: "\u886C / \u886C\u5E03 / \u4E2D\u95F4\u886C",
    example: "We use a 60 GSM knit fusible interlining in the collar and cuff."
  },
  {
    term: "fusible interlining",
    full_form: "fusible interlining",
    category: "shirt_production",
    phonetic: "/\u02C8fju\u02D0z\u0259bl \u02C8\u026Ant\u0259la\u026An\u026A\u014B/",
    definition_en: "an interlining coated with hot-melt adhesive that bonds to the shell under heat and pressure",
    definition_zh: "\u7C98\u5408\u886C",
    example: "Fusible interlining is pressed at 145 degrees for 12 seconds."
  },
  {
    term: "fusing",
    full_form: "fusing",
    category: "shirt_production",
    phonetic: "/\u02C8fju\u02D0z\u026A\u014B/",
    definition_en: "the process of bonding fusible interlining to the shell fabric using a heat press",
    definition_zh: "\u538B\u886C / \u7C98\u5408",
    example: "Pre-fuse test is required before bulk fusing on the collar."
  },
  {
    term: "peel strength",
    full_form: "peel strength",
    category: "shirt_production",
    phonetic: "/pi\u02D0l stre\u014B\u03B8/",
    definition_en: "the force required to separate the fusible interlining from the shell, measured in kg per 2.5 cm",
    definition_zh: "\u5265\u79BB\u5F3A\u5EA6",
    example: "Peel strength of knit fusible on cotton poplin must be above 1.5 kg per 2.5 cm."
  },
  {
    term: "pressing cloth",
    full_form: "pressing cloth",
    category: "shirt_production",
    phonetic: "/\u02C8pres\u026A\u014B kl\u0252\u03B8/",
    definition_en: "a thin cloth placed between the iron and the garment to prevent shine or scorching",
    definition_zh: "\u70EB\u5E03",
    example: "Use a pressing cloth on dark colors to avoid iron shine."
  },
  {
    term: "iron shine",
    full_form: "iron shine",
    category: "shirt_production",
    phonetic: "/\u02C8a\u026A\u0259n \u0283a\u026An/",
    definition_en: "a glossy mark on fabric caused by ironing at too high a temperature or without a pressing cloth",
    definition_zh: "\u70EB\u5149 / \u70EB\u75D5",
    example: "Dark navy shirts easily show iron shine if pressed without a cloth."
  },
  {
    term: "AQL",
    full_form: "Acceptable Quality Limit",
    category: "shirt_production",
    phonetic: "/e\u026A kju\u02D0 el/",
    definition_en: "the maximum acceptable number of defective items in a sampling plan, used in final inspection",
    definition_zh: "\u53EF\u63A5\u53D7\u8D28\u91CF\u9650",
    example: "We use AQL 1.5 for major, 2.5 for minor, 4.0 for critical defects."
  },
  {
    term: "DUPRO",
    full_form: "During Production Inspection",
    category: "shirt_production",
    phonetic: "/\u02C8dju\u02D0pr\u0259\u028A/",
    definition_en: "an inspection conducted when production is 30% to 50% complete to catch issues early",
    definition_zh: "\u4E2D\u671F\u9A8C\u8D27 / \u751F\u4EA7\u4E2D\u68C0\u9A8C",
    example: "DUPRO is scheduled when 30% of the order is sewn."
  },
  {
    term: "PSI",
    full_form: "Pre-Shipment Inspection",
    category: "shirt_production",
    phonetic: "/pi\u02D0 es a\u026A/",
    definition_en: "the final inspection conducted when 80% or more of the order is packed, ready for shipment",
    definition_zh: "\u88C5\u67DC\u524D\u68C0\u9A8C / \u5C3E\u671F\u68C0\u9A8C",
    example: "PSI is done at 100% packed, before container loading."
  },
  {
    term: "polybag",
    full_form: "polybag",
    category: "shirt_production",
    phonetic: "/\u02C8p\u0252lib\xE6\u0261/",
    definition_en: "a clear plastic bag used to pack one garment for retail or shipping",
    definition_zh: "\u80F6\u888B / \u5851\u6599\u888B",
    example: "Each shirt goes into a clear polybag with a small desiccant."
  },
  {
    term: "shipping mark",
    full_form: "shipping mark / carton mark",
    category: "shirt_production",
    phonetic: "/\u02C8\u0283\u026Ap\u026A\u014B m\u0251\u02D0k/",
    definition_en: "printed information on the outside of export cartons identifying the buyer, PO, style, and destination",
    definition_zh: "\u7BB1\u551B / \u8FD0\u8F93\u6807\u8BB0",
    example: "Shipping mark is 'STYLEHOUSE UK' in black on two sides of the carton."
  },
  {
    term: "carton",
    full_form: "carton / master carton",
    category: "shirt_production",
    phonetic: "/\u02C8k\u0251\u02D0tn/",
    definition_en: "the outer corrugated box used to pack multiple polybagged garments for export",
    definition_zh: "\u5916\u7BB1 / \u51FA\u53E3\u7EB8\u7BB1",
    example: "Master carton is 5-ply, holding 12 pieces, 60 x 40 x 30 cm."
  },
  {
    term: "GSM",
    full_form: "Grams per Square Meter",
    category: "shirt_production",
    phonetic: "/d\u0292i\u02D0 es em/",
    definition_en: "the weight of fabric per square meter, indicating fabric thickness and hand feel",
    definition_zh: "\u514B\u91CD / \u6BCF\u5E73\u65B9\u7C73\u514B\u6570",
    example: "Poplin shirting for this shirt is 110 GSM, plus or minus 5% tolerance."
  },
  {
    term: "Delta E",
    full_form: "Delta E (color difference)",
    category: "shirt_production",
    phonetic: "/\u02C8delt\u0259 i\u02D0/",
    definition_en: "a numerical measure of color difference between two samples; lower is closer, less than 2 is acceptable",
    definition_zh: "\u8272\u5DEE\u503C",
    example: "Bulk lot Delta E is 1.8 against the lab dip, at the edge of the 2.0 tolerance."
  },
  {
    term: "POP",
    full_form: "Point of Purchase",
    category: "shirt_production",
    phonetic: "/pi\u02D0 \u0259\u028A pi\u02D0/",
    definition_en: "the retail display location where the product is sold, used in packaging and labeling decisions",
    definition_zh: "\u96F6\u552E\u5356\u70B9",
    example: "Each polybag has a sticker with the POP barcode for the retail store."
  },
  {
    term: "Proforma Invoice",
    full_form: "Proforma Invoice (PI)",
    category: "order_management",
    phonetic: "/pr\u0259\u02C8f\u0254\u02D0m\u0259 \u02C8\u026Anv\u0254\u026As/",
    definition_en: "a preliminary invoice sent to the buyer before shipment, used for payment, customs, and license applications",
    definition_zh: "\u5F62\u5F0F\u53D1\u7968",
    example: "Please find the Proforma Invoice attached, valid for 30 days."
  },
  {
    term: "Sales Contract",
    full_form: "Sales Contract (SC)",
    category: "order_management",
    phonetic: "/se\u026Alz \u02C8k\u0252ntr\xE6kt/",
    definition_en: "a binding agreement between buyer and seller covering terms, price, delivery, and payment",
    definition_zh: "\u9500\u552E\u5408\u540C",
    example: "Both parties signed the Sales Contract before the deposit was wired."
  },
  {
    term: "Purchase Order",
    full_form: "Purchase Order (PO)",
    category: "order_management",
    phonetic: "/\u02C8p\u025C\u02D0t\u0283\u0259s \u02C8\u0254\u02D0d\u0259/",
    definition_en: "a commercial document issued by the buyer to the seller confirming the order details",
    definition_zh: "\u91C7\u8D2D\u8BA2\u5355",
    example: "PO 4521 was issued on 5 June for 3,000 shirts."
  },
  {
    term: "TT",
    full_form: "Telegraphic Transfer",
    category: "order_management",
    phonetic: "/ti\u02D0 ti\u02D0/",
    definition_en: "an electronic bank-to-bank wire transfer, the most common payment method in China export",
    definition_zh: "\u7535\u6C47",
    example: "We accept payment by TT 30% deposit, 70% balance before shipment."
  },
  {
    term: "LC",
    full_form: "Letter of Credit",
    category: "order_management",
    phonetic: "/el si\u02D0/",
    definition_en: "a bank guarantee of payment to the seller upon presentation of compliant shipping documents",
    definition_zh: "\u4FE1\u7528\u8BC1",
    example: "The LC at sight was opened by the buyer's bank in Sydney."
  },
  {
    term: "DP",
    full_form: "Documents against Payment",
    category: "order_management",
    phonetic: "/di\u02D0 pi\u02D0/",
    definition_en: "a payment method where the buyer pays to receive the shipping documents",
    definition_zh: "\u4ED8\u6B3E\u4EA4\u5355",
    example: "We agreed on DP at sight for this trial order."
  },
  {
    term: "DA",
    full_form: "Documents against Acceptance",
    category: "order_management",
    phonetic: "/di\u02D0 e\u026A/",
    definition_en: "a payment method where the buyer accepts a draft to receive the documents, paying later",
    definition_zh: "\u627F\u5151\u4EA4\u5355",
    example: "DA 30 days is common in the Middle East market."
  },
  {
    term: "deposit",
    full_form: "deposit / down payment",
    category: "order_management",
    phonetic: "/d\u026A\u02C8p\u0252z\u026At/",
    definition_en: "an upfront partial payment, usually 30%, made by the buyer to confirm the order",
    definition_zh: "\u5B9A\u91D1 / \u9884\u4ED8\u6B3E",
    example: "The deposit is 30% of the invoice value, paid upon PI signing."
  },
  {
    term: "balance",
    full_form: "balance payment",
    category: "order_management",
    phonetic: "/\u02C8b\xE6l\u0259ns/",
    definition_en: "the remaining payment, usually 70%, made before shipment or against B/L copy",
    definition_zh: "\u5C3E\u6B3E / \u4F59\u6B3E",
    example: "Balance is paid against B/L copy, original B/L is sent by courier after full payment."
  },
  {
    term: "ETD",
    full_form: "Estimated Time of Departure",
    category: "order_management",
    phonetic: "/i\u02D0 ti\u02D0 di\u02D0/",
    definition_en: "the estimated date the vessel leaves the port of origin",
    definition_zh: "\u9884\u8BA1\u5F00\u8239\u65E5 / \u79BB\u6E2F\u65E5",
    example: "ETD Shanghai is 28 September, ETA Sydney is 15 October."
  },
  {
    term: "ETA",
    full_form: "Estimated Time of Arrival",
    category: "order_management",
    phonetic: "/i\u02D0 ti\u02D0 e\u026A/",
    definition_en: "the estimated date the vessel arrives at the destination port",
    definition_zh: "\u9884\u8BA1\u5230\u6E2F\u65E5",
    example: "ETA is 13 to 15 days after ETD for the Shanghai to Sydney route."
  },
  {
    term: "booking",
    full_form: "shipping booking",
    category: "order_management",
    phonetic: "/\u02C8b\u028Ak\u026A\u014B/",
    definition_en: "the reservation of cargo space on a vessel with a shipping line or forwarder",
    definition_zh: "\u8BA2\u8231",
    example: "We made the booking with COSCO for the 28 September ETD."
  },
  {
    term: "cut-off date",
    full_form: "cut-off date",
    category: "order_management",
    phonetic: "/k\u028Ct \u0252f de\u026At/",
    definition_en: "the last date cargo or documents must be delivered to the port or shipping line",
    definition_zh: "\u622A\u6E2F\u65E5 / \u622A\u5173\u65E5",
    example: "CY cut-off is 26 September, 2 days before ETD."
  },
  {
    term: "Bill of Lading",
    full_form: "Bill of Lading (B/L)",
    category: "order_management",
    phonetic: "/b\u026Al \u0259v \u02C8le\u026Ad\u026A\u014B/",
    definition_en: "a legal document issued by the carrier acknowledging receipt of cargo for shipment",
    definition_zh: "\u63D0\u5355",
    example: "The original B/L is sent by courier after we receive the full balance."
  },
  {
    term: "OEM",
    full_form: "Original Equipment Manufacturer",
    category: "order_management",
    phonetic: "/\u0259\u028A i\u02D0 em/",
    definition_en: "a supplier that makes products to the buyer's design and specification",
    definition_zh: "\u4EE3\u5DE5 / \u8D34\u724C\u751F\u4EA7",
    example: "This is an OEM order \u2014 you provide the tech pack, we produce."
  },
  {
    term: "ODM",
    full_form: "Original Design Manufacturer",
    category: "order_management",
    phonetic: "/\u0259\u028A di\u02D0 em/",
    definition_en: "a supplier that designs and manufactures a product, which the buyer then brands",
    definition_zh: "\u8BBE\u8BA1\u4EE3\u5DE5 / \u81EA\u6709\u8BBE\u8BA1\u5236\u9020",
    example: "ODM orders require a side letter on IP ownership."
  },
  {
    term: "force majeure",
    full_form: "force majeure",
    category: "exception_handling",
    phonetic: "/f\u0254\u02D0s m\xE6\u02C8\u0292\u025C\u02D0/",
    definition_en: "an unforeseeable event (war, earthquake, pandemic, port strike) that prevents contract performance and excuses delay",
    definition_zh: "\u4E0D\u53EF\u6297\u529B",
    example: "The port strike was declared force majeure by the Shanghai port authority."
  },
  {
    term: "expedite",
    full_form: "expedite / rush",
    category: "exception_handling",
    phonetic: "/\u02C8eksp\u026Ada\u026At/",
    definition_en: "to speed up production or shipping, usually at additional cost, to meet a revised deadline",
    definition_zh: "\u52A0\u6025 / \u8D76\u5DE5",
    example: "We will expedite the re-dye at extra cost on our side."
  },
  {
    term: "rework",
    full_form: "rework / repair",
    category: "exception_handling",
    phonetic: "/\u02CCri\u02D0\u02C8w\u025C\u02D0k/",
    definition_en: "to fix defects on finished or semi-finished pieces so they meet the original spec",
    definition_zh: "\u8FD4\u5DE5 / \u4FEE\u8865",
    example: "All 600 pieces need rework on the bar tacks at the factory's cost."
  },
  {
    term: "replacement",
    full_form: "replacement",
    category: "exception_handling",
    phonetic: "/r\u026A\u02C8ple\u026Asm\u0259nt/",
    definition_en: "shipping new pieces to replace defective ones, often in a separate shipment",
    definition_zh: "\u6362\u8D27 / \u8865\u4EF6",
    example: "Replacement pieces will ship by air at our cost."
  },
  {
    term: "scrap",
    full_form: "scrap / off-spec",
    category: "exception_handling",
    phonetic: "/skr\xE6p/",
    definition_en: "pieces that cannot be reworked and are disposed of, counted as waste",
    definition_zh: "\u62A5\u5E9F / \u4E0D\u5408\u683C",
    example: "About 2% of the lot was scrapped and could not be reworked."
  },
  {
    term: "credit note",
    full_form: "credit note",
    category: "exception_handling",
    phonetic: "/\u02C8kred\u026At n\u0259\u028At/",
    definition_en: "a document issued by the seller reducing the buyer's payable amount, often for defects or goodwill",
    definition_zh: "\u8D37\u9879\u901A\u77E5\u5355",
    example: "We issued a credit note for USD 1,500 to cover the QC cost."
  },
  {
    term: "debit note",
    full_form: "debit note",
    category: "exception_handling",
    phonetic: "/\u02C8deb\u026At n\u0259\u028At/",
    definition_en: "a document issued by the seller to the buyer for additional charges owed",
    definition_zh: "\u501F\u9879\u901A\u77E5\u5355",
    example: "The debit note for the air-freight surcharge was attached to the invoice."
  },
  {
    term: "claim",
    full_form: "claim / complaint",
    category: "exception_handling",
    phonetic: "/kle\u026Am/",
    definition_en: "a formal demand by the buyer for compensation due to defects, delay, or other breach",
    definition_zh: "\u7D22\u8D54 / \u6295\u8BC9",
    example: "The buyer filed a claim for USD 5,000 due to delayed delivery."
  },
  {
    term: "claim prevention",
    full_form: "claim prevention",
    category: "exception_handling",
    phonetic: "/kle\u026Am pr\u026A\u02C8ven\u0283n/",
    definition_en: "proactive steps taken to address issues before they escalate into a formal claim",
    definition_zh: "\u7D22\u8D54\u524D\u7F6E / \u9632\u7D22\u8D54",
    example: "We use credit notes as a claim prevention tool on small issues."
  },
  {
    term: "8D report",
    full_form: "8 Disciplines Problem Solving",
    category: "exception_handling",
    phonetic: "/e\u026At di\u02D0 r\u026A\u02C8p\u0254\u02D0t/",
    definition_en: "a structured problem-solving method with 8 steps: team, problem, containment, root cause, corrective, implementation, prevention, recognition",
    definition_zh: "8D \u62A5\u544A",
    example: "We delivered the 8D report within 48 hours, in English."
  },
  {
    term: "root cause",
    full_form: "root cause",
    category: "exception_handling",
    phonetic: "/ru\u02D0t k\u0254\u02D0z/",
    definition_en: "the fundamental reason a problem occurred, identified through 5-why or fishbone analysis",
    definition_zh: "\u6839\u672C\u539F\u56E0",
    example: "The root cause was the missing preventive maintenance on the bar tack machine."
  },
  {
    term: "corrective action",
    full_form: "corrective action (CA)",
    category: "exception_handling",
    phonetic: "/k\u0259\u02C8rekt\u026Av \u02C8\xE6k\u0283n/",
    definition_en: "the immediate action taken to fix the current problem and contain its impact",
    definition_zh: "\u7EA0\u6B63\u63AA\u65BD",
    example: "Corrective action was to replace the worn needle bar immediately."
  },
  {
    term: "preventive action",
    full_form: "preventive action (PA)",
    category: "exception_handling",
    phonetic: "/pr\u026A\u02C8vent\u026Av \u02C8\xE6k\u0283n/",
    definition_en: "the action taken to eliminate the root cause and prevent the problem from recurring",
    definition_zh: "\u9884\u9632\u63AA\u65BD",
    example: "Preventive action is to install a digital counter and update the SOP."
  },
  {
    term: "CAPA",
    full_form: "Corrective and Preventive Action",
    category: "exception_handling",
    phonetic: "/\u02C8k\xE6p\u0259/",
    definition_en: "a combined register of corrective and preventive actions with owners, due dates, and verification",
    definition_zh: "\u7EA0\u6B63\u4E0E\u9884\u9632\u63AA\u65BD",
    example: "Each CAPA item has an owner, a due date, and a verification method."
  },
  {
    term: "production delay",
    full_form: "production delay",
    category: "exception_handling",
    phonetic: "/pr\u0259\u02C8d\u028Ck\u0283n d\u026A\u02C8le\u026A/",
    definition_en: "any slip in the planned production schedule, often resulting in a revised ETD",
    definition_zh: "\u751F\u4EA7\u5EF6\u671F",
    example: "A 2-day production delay pushed the ETD from 28 to 30 September."
  },
  {
    term: "5-why analysis",
    full_form: "5-why root cause analysis",
    category: "post_mortem",
    phonetic: "/fa\u026Av wa\u026A \u0259\u02C8n\xE6l\u0259s\u026As/",
    definition_en: "a questioning technique that asks 'why' five times to drill from a symptom to the systemic root cause",
    definition_zh: "5 \u4E2A\u4E3A\u4EC0\u4E48 / 5-why \u5206\u6790",
    example: "We did 5-why on the bar tack skipping and found the missing maintenance system."
  },
  {
    term: "fishbone diagram",
    full_form: "fishbone / Ishikawa diagram",
    category: "post_mortem",
    phonetic: "/\u02C8f\u026A\u0283b\u0259\u028An \u02C8da\u026A\u0259\u0261r\xE6m/",
    definition_en: "a cause-and-effect diagram with branches for 6 M's: Man, Machine, Material, Method, Measurement, Milieu",
    definition_zh: "\u9C7C\u9AA8\u56FE / \u77F3\u5DDD\u56FE",
    example: "The fishbone for the bar tack issue had 6 categories, top causes in Machine and Method."
  },
  {
    term: "Pareto analysis",
    full_form: "Pareto analysis (80/20 rule)",
    category: "post_mortem",
    phonetic: "/p\u0259\u02C8ri\u02D0t\u0259\u028A \u0259\u02C8n\xE6l\u0259s\u026As/",
    definition_en: "a technique that ranks causes by frequency, identifying the vital few that drive most of the impact",
    definition_zh: "\u5E15\u7D2F\u6258\u5206\u6790 / \u4E8C\u516B\u6CD5\u5219",
    example: "Pareto showed 60% of defects came from bar tack, so we focused the 5-why there."
  },
  {
    term: "lessons learned",
    full_form: "lessons learned",
    category: "post_mortem",
    phonetic: "/\u02C8lesnz l\u025C\u02D0nd/",
    definition_en: "documented knowledge from a project about what worked, what did not, and what to do differently",
    definition_zh: "\u7ECF\u9A8C\u6559\u8BAD",
    example: "We circulated the lessons learned to all production lines."
  },
  {
    term: "best practice",
    full_form: "best practice",
    category: "post_mortem",
    phonetic: "/best \u02C8pr\xE6kt\u026As/",
    definition_en: "a method or technique that has consistently shown superior results and is recommended for adoption",
    definition_zh: "\u6700\u4F73\u5B9E\u8DF5",
    example: "Daily KPI review is now a best practice across all lines."
  },
  {
    term: "KPI review",
    full_form: "Key Performance Indicator review",
    category: "post_mortem",
    phonetic: "/ke\u026A pi\u02D0 a\u026A r\u026A\u02C8vju\u02D0/",
    definition_en: "a periodic meeting where actual performance is compared against targets and gaps are discussed",
    definition_zh: "KPI \u8BC4\u5BA1",
    example: "The monthly KPI review covers OTD, defect rate, COPQ, and claim rate."
  },
  {
    term: "SOP",
    full_form: "Standard Operating Procedure",
    category: "post_mortem",
    phonetic: "/es \u0259\u028A pi\u02D0/",
    definition_en: "a documented step-by-step procedure for performing a routine operation in the factory",
    definition_zh: "\u6807\u51C6\u4F5C\u4E1A\u7A0B\u5E8F",
    example: "We updated the bar tack SOP to v3.0 with preventive maintenance steps."
  },
  {
    term: "work instruction",
    full_form: "work instruction (WI)",
    category: "post_mortem",
    phonetic: "/w\u025C\u02D0k \u026An\u02C8str\u028Ck\u0283n/",
    definition_en: "a detailed document showing how to perform a specific task, often at the operator level",
    definition_zh: "\u4F5C\u4E1A\u6307\u5BFC\u4E66",
    example: "The work instruction for the new bar tack SOP is posted at every station."
  },
  {
    term: "PDCA",
    full_form: "Plan-Do-Check-Act",
    category: "post_mortem",
    phonetic: "/pi\u02D0 di\u02D0 si\u02D0 e\u026A/",
    definition_en: "a four-step continuous improvement cycle: plan a change, do it, check the result, act to standardize or refine",
    definition_zh: "PDCA \u5FAA\u73AF / \u6234\u660E\u73AF",
    example: "We run the SOP update on a PDCA cycle over 90 days."
  },
  {
    term: "Kaizen",
    full_form: "Kaizen (continuous improvement)",
    category: "post_mortem",
    phonetic: "/ka\u026A\u02C8zen/",
    definition_en: "a Japanese philosophy of small, continuous improvements involving all employees",
    definition_zh: "\u6539\u5584 / \u6301\u7EED\u6539\u8FDB",
    example: "Each line submits two Kaizen proposals per month."
  },
  {
    term: "meeting minutes",
    full_form: "meeting minutes",
    category: "post_mortem",
    phonetic: "/\u02C8mi\u02D0t\u026A\u014B \u02C8m\u026An\u026Ats/",
    definition_en: "a written record of what was discussed and decided in a meeting, circulated to attendees",
    definition_zh: "\u4F1A\u8BAE\u7EAA\u8981",
    example: "I will circulate the meeting minutes within 24 hours."
  },
  {
    term: "action items",
    full_form: "action items",
    category: "post_mortem",
    phonetic: "/\u02C8\xE6k\u0283n \u02C8a\u026At\u0259mz/",
    definition_en: "specific tasks assigned in a meeting, with an owner and a due date",
    definition_zh: "\u884C\u52A8\u9879",
    example: "Each action item has an owner, a due date, and a status field."
  },
  {
    term: "COPQ",
    full_form: "Cost of Poor Quality",
    category: "post_mortem",
    phonetic: "/si\u02D0 \u0259\u028A pi\u02D0 kju\u02D0/",
    definition_en: "the total cost of rework, scrap, claims, returns, and extra inspection caused by defects",
    definition_zh: "\u8D28\u91CF\u635F\u5931\u6210\u672C",
    example: "COPQ for this incident was about USD 8,000."
  },
  {
    term: "yield rate",
    full_form: "yield rate",
    category: "post_mortem",
    phonetic: "/ji\u02D0ld re\u026At/",
    definition_en: "the percentage of input pieces that pass inspection as first-quality, indicating process efficiency",
    definition_zh: "\u4E00\u6B21\u5408\u683C\u7387 / \u826F\u7387",
    example: "Yield rate on the navy line dropped from 96% to 88% during the bar tack issue."
  },
  {
    term: "defect rate",
    full_form: "defect rate",
    category: "post_mortem",
    phonetic: "/\u02C8di\u02D0fekt re\u026At/",
    definition_en: "the percentage of defective pieces in a lot, often measured in DPMO (defects per million opportunities)",
    definition_zh: "\u75B5\u70B9\u7387",
    example: "Defect rate rose to 1.8% in Q3, above the 1.2% target."
  },
  {
    term: "flyknit",
    full_form: "flyknit",
    category: "flyknit_weaving",
    phonetic: "/\u02C8fla\u026A\u02CCn\u026At/",
    definition_en: "a one-piece knitted upper technology for sports shoes, made on a computer flat knitting machine with no sewing required",
    definition_zh: "\u98DE\u7EC7,\u4E00\u4F53\u7F16\u7EC7\u978B\u9762\u6280\u672F",
    example: "We are sourcing a flyknit upper for our new running shoe line."
  },
  {
    term: "whole-upper",
    full_form: "whole-upper one-piece",
    category: "flyknit_weaving",
    phonetic: "/ho\u028Al \u02C8\u028Cp\u0259r/",
    definition_en: "a fully knitted shoe upper produced in one piece, with the vamp, tongue and collar all integrated",
    definition_zh: "\u6574\u7247\u978B\u9762,\u4E00\u6B21\u6210\u578B",
    example: "We need the whole-upper knitted in one piece, no assembly seams."
  },
  {
    term: "computer flat knitting machine",
    full_form: "computer flat knitting machine (CFKM)",
    category: "flyknit_weaving",
    phonetic: "/k\u0259m\u02C8pju\u02D0t\u0259r fl\xE6t \u02C8n\u026At\u026A\u014B m\u0259\u02C8\u0283i\u02D0n/",
    definition_en: "a computerized V-bed knitting machine used to produce shaped knit panels such as flyknit uppers",
    definition_zh: "\u7535\u8111\u6A2A\u673A,\u5168\u6210\u578B\u9488\u7EC7\u673A",
    example: "Our factory runs 200 computer flat knitting machines for upper production."
  },
  {
    term: "gauge E14",
    full_form: "gauge E14 (needles per inch)",
    category: "flyknit_weaving",
    phonetic: "/\u0261e\u026Ad\u0292 i\u02D0 f\u0254\u02D0r\u02C8ti\u02D0n/",
    definition_en: "a needle gauge of 14 needles per inch on a flat knitting machine, used for medium-thickness flyknit uppers",
    definition_zh: "\u673A\u53F7 E14,\u6BCF\u82F1\u5BF8 14 \u9488",
    example: "For a medium-weight running upper, gauge E14 is the most common choice."
  },
  {
    term: "gauge E15",
    full_form: "gauge E15 (needles per inch)",
    category: "flyknit_weaving",
    phonetic: "/\u0261e\u026Ad\u0292 i\u02D0 f\u026Af\u02C8ti\u02D0n/",
    definition_en: "a needle gauge of 15 needles per inch, slightly finer than E14, used for lighter, denser flyknit",
    definition_zh: "\u673A\u53F7 E15,\u6BCF\u82F1\u5BF8 15 \u9488",
    example: "Gauge E15 gives a finer, smoother surface for lifestyle flyknit uppers."
  },
  {
    term: "gauge E18",
    full_form: "gauge E18 (needles per inch)",
    category: "flyknit_weaving",
    phonetic: "/\u0261e\u026Ad\u0292 i\u02D0 e\u026A\u02C8ti\u02D0n/",
    definition_en: "a needle gauge of 18 needles per inch, used for ultra-fine seamless knitting and lightweight uppers",
    definition_zh: "\u673A\u53F7 E18,\u6BCF\u82F1\u5BF8 18 \u9488,\u7EC6\u9488",
    example: "Gauge E18 is for very light, dense, premium running uppers."
  },
  {
    term: "intarsia",
    full_form: "intarsia knitting",
    category: "flyknit_weaving",
    phonetic: "/\u026An\u02C8t\u0251\u02D0rsi\u0259/",
    definition_en: "a knitting technique that knits separate yarn blocks of different colors in the same course, used for logos and color blocks on flyknit uppers",
    definition_zh: "\u5D4C\u82B1,\u65E0\u865A\u7EBF\u63D0\u82B1",
    example: "We use intarsia to knit the swoosh logo directly into the upper."
  },
  {
    term: "jacquard pattern",
    full_form: "jacquard pattern",
    category: "flyknit_weaving",
    phonetic: "/d\u0292\u0259\u02C8k\u0251\u02D0rd p\xE6t\u0259rn/",
    definition_en: "a multi-color knit pattern produced by selective needle selection, with floats on the reverse side",
    definition_zh: "\u63D0\u82B1\u82B1\u578B,\u8D3E\u5361\u82B1\u578B",
    example: "The jacquard pattern on the upper is breathable yet supportive."
  },
  {
    term: "tuck stitch",
    full_form: "tuck stitch",
    category: "flyknit_weaving",
    phonetic: "/t\u028Ck st\u026At\u0283/",
    definition_en: "a stitch held on the needle without being knocked over, used to create texture, openness, or 3D structure on a knit upper",
    definition_zh: "\u96C6\u5708\u9488,\u534A\u6210\u578B\u7EBF\u5708",
    example: "We add tuck stitches in the forefoot to improve flexibility."
  },
  {
    term: "miss stitch",
    full_form: "miss stitch (float)",
    category: "flyknit_weaving",
    phonetic: "/m\u026As st\u026At\u0283/",
    definition_en: "a stitch where the yarn floats over the needle without forming a loop, used in jacquard knitting",
    definition_zh: "\u6D6E\u7EBF,\u8DF3\u9488",
    example: "The miss stitch on the reverse side reduces yarn consumption in jacquard."
  },
  {
    term: "hold stitch",
    full_form: "hold stitch",
    category: "flyknit_weaving",
    phonetic: "/ho\u028Ald st\u026At\u0283/",
    definition_en: "a stitch held on a needle for several courses to create a shaped, slacker area in the knit",
    definition_zh: "\u63E1\u6301\u9488,hold \u9488",
    example: "Hold stitches are used to shape the toebox curve."
  },
  {
    term: "yarn carrier",
    full_form: "yarn carrier",
    category: "flyknit_weaving",
    phonetic: "/j\u0251\u02D0rn \u02C8k\xE6ri\u0259r/",
    definition_en: "a movable feeder on a flat knitting machine that delivers yarn to selected needles",
    definition_zh: "\u7EB1\u5634,\u5BFC\u7EB1\u5668",
    example: "We have 12 yarn carriers on the machine for multi-color intarsia."
  },
  {
    term: "sock-like fit",
    full_form: "sock-like fit",
    category: "flyknit_weaving",
    phonetic: "/s\u0252k la\u026Ak f\u026At/",
    definition_en: "a snug, sock-like wearing feel produced by a one-piece flyknit upper with high elasticity",
    definition_zh: "\u889C\u5957\u5F0F\u8D34\u5408\u611F",
    example: "The flyknit upper gives a sock-like fit that wraps the foot."
  },
  {
    term: "no-sew upper",
    full_form: "no-sew upper",
    category: "flyknit_weaving",
    phonetic: "/no\u028A sju\u02D0 \u02C8\u028Cp\u0259r/",
    definition_en: "a shoe upper assembled without stitching, typically by welding or knitting as one piece",
    definition_zh: "\u65E0\u8F66\u7F1D\u978B\u9762,\u4E00\u4F53\u978B\u9762",
    example: "A no-sew upper cuts labor cost and avoids needle holes in the material."
  },
  {
    term: "density",
    full_form: "density (courses per cm)",
    category: "flyknit_weaving",
    phonetic: "/\u02C8dens\u0259ti/",
    definition_en: "the number of courses (horizontal rows) per cm in a knit fabric, indicating tightness",
    definition_zh: "\u5BC6\u5EA6,\u6A2A\u5BC6,\u6BCF\u5398\u7C73\u7EBF\u5708\u6570",
    example: "We increased the density in the eyestay area for more support."
  },
  {
    term: "spandex",
    full_form: "spandex / Lycra / elastane",
    category: "flyknit_weaving",
    phonetic: "/\u02C8sp\xE6nd\u025Bks/",
    definition_en: "an elastic fiber used in flyknit uppers, typically 20D-40D for footwear",
    definition_zh: "\u6C28\u7EB6,\u5F39\u529B\u4E1D",
    example: "We blend 20D spandex in the collar to give a comfortable sock-like fit."
  },
  {
    term: "polyester filament",
    full_form: "polyester filament yarn",
    category: "flyknit_weaving",
    phonetic: "/\u02CCp\u0252li\u02C8\u025Bst\u0259r \u02C8f\u026Al\u0259m\u0259nt/",
    definition_en: "a continuous filament polyester yarn, commonly 75D-150D, used as the main yarn in flyknit",
    definition_zh: "\u6DA4\u7EB6\u957F\u4E1D",
    example: "75D polyester filament is the standard base yarn for running uppers."
  },
  {
    term: "Dtex",
    full_form: "decitex (Dtex)",
    category: "flyknit_weaving",
    phonetic: "/\u02C8di\u02D0t\u025Bks/",
    definition_en: "a yarn count unit, the weight in grams of 10,000 meters of yarn, used for filament yarn",
    definition_zh: "\u5206\u7279\u514B\u65AF,\u957F\u4E1D\u7EB1\u7EBF\u7EC6\u5EA6\u5355\u4F4D",
    example: "A 167 dtex polyester filament is common in flyknit uppers."
  },
  {
    term: "breathability zone",
    full_form: "breathability zone",
    category: "flyknit_weaving",
    phonetic: "/\u02CCbri\u02D0\xF0\u0259\u02C8b\u026Al\u0259ti zo\u028An/",
    definition_en: "an area on the upper with looser knit, mesh structure, or open holes for ventilation",
    definition_zh: "\u900F\u6C14\u533A",
    example: "We program a breathability zone on the vamp and medial side."
  },
  {
    term: "support zone",
    full_form: "support zone",
    category: "flyknit_weaving",
    phonetic: "/s\u0259\u02C8p\u0254\u02D0rt zo\u028An/",
    definition_en: "an area on the upper with denser knit, reinforcement yarn, or TPU yarn for stability",
    definition_zh: "\u652F\u6491\u533A,\u8865\u5F3A\u533A",
    example: "The eyestay and heel counter are the key support zones."
  },
  {
    term: "TPU yarn",
    full_form: "TPU yarn (thermoplastic polyurethane)",
    category: "flyknit_weaving",
    phonetic: "/ti\u02D0 pi\u02D0 ju\u02D0 j\u0251\u02D0rn/",
    definition_en: "a thermoplastic yarn that melts under heat and bonds with the upper, used for reinforcement or welding",
    definition_zh: "TPU \u7EB1,\u70ED\u7194\u7EB1",
    example: "We use TPU yarn at 180\xB0C to weld the upper to the strobel board."
  },
  {
    term: "heel counter",
    full_form: "heel counter",
    category: "flyknit_weaving",
    phonetic: "/hi\u02D0l \u02C8ka\u028Ant\u0259r/",
    definition_en: "a reinforcement at the heel of the shoe, either knitted-in or hot-pressed, to lock the heel",
    definition_zh: "\u540E\u8DDF\u6E2F\u5B9D,\u540E\u8DDF\u8865\u5F3A",
    example: "The heel counter is hot-pressed at 120\xB0C for 60 seconds."
  },
  {
    term: "strobel",
    full_form: "strobel stitch (strobel board)",
    category: "flyknit_weaving",
    phonetic: "/\u02C8stro\u028Ab\u0259l/",
    definition_en: "a stitching method that attaches the upper to the insole board, used in most sports shoes",
    definition_zh: "\u978B\u9762\u4E0E\u4E2D\u5E95\u677F\u7F1D\u5408(\u6CBF\u6761\u5DE5\u827A)",
    example: "We combine the flyknit upper with a strobel-stitched insole board."
  },
  {
    term: "warp knitting",
    full_form: "warp knitting",
    category: "warp_knitting",
    phonetic: "/w\u0254\u02D0rp \u02C8n\u026At\u026A\u014B/",
    definition_en: "a knitting process where yarns run vertically (warp-wise) and form loops interlocked along the length, produced on tricot or raschel machines",
    definition_zh: "\u7ECF\u7F16",
    example: "Warp knitting is fast and stable, ideal for lingerie, mesh, and lace."
  },
  {
    term: "tricot",
    full_form: "tricot warp knitting machine",
    category: "warp_knitting",
    phonetic: "/\u02C8tri\u02D0k\u0252/",
    definition_en: "a warp knitting machine with bearded needles, mainly producing fine, plain fabrics for lingerie and lining",
    definition_zh: "\u7279\u91CC\u79D1\u7ECF\u7F16\u673A",
    example: "Tricot is the standard machine for smooth, fine fabrics like lingerie mesh."
  },
  {
    term: "raschel",
    full_form: "raschel warp knitting machine",
    category: "warp_knitting",
    phonetic: "/\u02C8r\xE6\u0283\u0259l/",
    definition_en: "a warp knitting machine with latch needles, used for lace, net, mesh, carpet, and technical textiles",
    definition_zh: "\u62C9\u820D\u5C14\u7ECF\u7F16\u673A",
    example: "Raschel machines with 30+ guide bars are used for floral lace."
  },
  {
    term: "milanese",
    full_form: "milanese warp knitting",
    category: "warp_knitting",
    phonetic: "/\u02CCm\u026Al\u0259\u02C8ni\u02D0z/",
    definition_en: "a warp knitting technique using two sets of yarns running diagonally, producing a very run-resistant, fine fabric",
    definition_zh: "\u7C73\u5170\u5C3C\u65AF\u7ECF\u7F16",
    example: "Milanese is rarely used today but produces very stable, run-resistant fabric."
  },
  {
    term: "guide bar",
    full_form: "guide bar (GB1, GB2, GB3)",
    category: "warp_knitting",
    phonetic: "/\u0261a\u026Ad b\u0251\u02D0r/",
    definition_en: "a bar on a warp knitting machine that controls the lateral movement of yarn guides to form stitches",
    definition_zh: "\u68B3\u6809,GB1/GB2/GB3",
    example: "A three-bar raschel has GB1, GB2, and GB3 for ground, pattern, and inlay."
  },
  {
    term: "pillar stitch",
    full_form: "pillar stitch (chain stitch)",
    category: "warp_knitting",
    phonetic: "/\u02C8p\u026Al\u0259r st\u026At\u0283/",
    definition_en: "a basic warp knit stitch forming a vertical chain, also called chain stitch or 1-and-1",
    definition_zh: "\u7F16\u94FE\u7EC4\u7EC7,\u7ECF\u5E73\u7EC4\u7EC7",
    example: "Pillar stitch is the building block of warp knit structures."
  },
  {
    term: "lap",
    full_form: "lap (overlap)",
    category: "warp_knitting",
    phonetic: "/l\xE6p/",
    definition_en: "the lateral movement of a guide bar across the needles to wrap yarn around them",
    definition_zh: "\u9488\u80CC\u57AB\u7EB1,\u57AB\u7EB1",
    example: "The lap movement on GB2 controls the pattern design."
  },
  {
    term: "underlap",
    full_form: "underlap",
    category: "warp_knitting",
    phonetic: "/\u02C8\u028Cnd\u0259r\u02CCl\xE6p/",
    definition_en: "the movement of the guide bar on the back side of the needle, mainly determining fabric properties",
    definition_zh: "\u9488\u524D\u57AB\u7EB1,\u5EF6\u5C55\u7EBF",
    example: "A longer underlap gives more horizontal strength and stability."
  },
  {
    term: "closed lap",
    full_form: "closed lap",
    category: "warp_knitting",
    phonetic: "/klo\u028Azd l\xE6p/",
    definition_en: "a lap where the guide bar moves in the same direction on both sides of the needle",
    definition_zh: "\u95ED\u53E3\u57AB\u7EB1",
    example: "Closed lap is used in 1-and-1 pillar stitch."
  },
  {
    term: "open lap",
    full_form: "open lap",
    category: "warp_knitting",
    phonetic: "/\u02C8o\u028Ap\u0259n l\xE6p/",
    definition_en: "a lap where the guide bar moves in opposite directions on the two sides of the needle",
    definition_zh: "\u5F00\u53E3\u57AB\u7EB1",
    example: "Open lap on both bars forms a simple 2-and-2 warp knit."
  },
  {
    term: "inlay",
    full_form: "inlay (full-width weft insertion)",
    category: "warp_knitting",
    phonetic: "/\u02C8\u026An\u02CCle\u026A/",
    definition_en: "a yarn laid in between needles by a guide bar without forming a stitch, used to add weft-wise strength or pattern",
    definition_zh: "\u886C\u7EAC,\u5168\u5E45\u886C\u7EAC",
    example: "Inlay with spandex gives the fabric 4-way stretch."
  },
  {
    term: "warp beam",
    full_form: "warp beam (creel)",
    category: "warp_knitting",
    phonetic: "/w\u0254\u02D0rp bi\u02D0m/",
    definition_en: "a large cylindrical beam on which warp yarns are wound and fed to the knitting machine",
    definition_zh: "\u7ECF\u8F74,\u76D8\u5934",
    example: "Each guide bar is fed from its own warp beam behind the machine."
  },
  {
    term: "warping machine",
    full_form: "warping machine",
    category: "warp_knitting",
    phonetic: "/\u02C8w\u0254\u02D0rp\u026A\u014B m\u0259\u02C8\u0283i\u02D0n/",
    definition_en: "a machine that winds warp yarns from creel packages onto a warp beam in parallel, equal length",
    definition_zh: "\u6574\u7ECF\u673A",
    example: "Sectional warping is used for patterned warp knits like lace."
  },
  {
    term: "sectional warping",
    full_form: "sectional warping",
    category: "warp_knitting",
    phonetic: "/\u02C8s\u025Bk\u0283\u0259n\u0259l \u02C8w\u0254\u02D0rp\u026A\u014B/",
    definition_en: "a warping method where warp is built up section by section, used for colored patterns and lace",
    definition_zh: "\u5206\u6761\u6574\u7ECF,\u5206\u6BB5\u6574\u7ECF",
    example: "Sectional warping allows multi-color patterned warps for raschel lace."
  },
  {
    term: "Karl Mayer",
    full_form: "Karl Mayer machine",
    category: "warp_knitting",
    phonetic: "/k\u0251\u02D0rl \u02C8ma\u026A\u0259r/",
    definition_en: "a leading German manufacturer of warp knitting machines and warp preparation equipment",
    definition_zh: "\u5361\u5C14\u8FC8\u8036,\u5FB7\u56FD\u7ECF\u7F16\u673A\u54C1\u724C",
    example: "Our HKS4 tricot is built by Karl Mayer, made in Germany."
  },
  {
    term: "HKS",
    full_form: "HKS (high-speed warp knitting machine)",
    category: "warp_knitting",
    phonetic: "/e\u026At\u0283 ke\u026A \u025Bs/",
    definition_en: "Karl Mayer's high-speed tricot machine series, used for fine fabrics at high production speed",
    definition_zh: "\u9AD8\u901F\u7ECF\u7F16\u673A HKS \u7CFB\u5217",
    example: "HKS machines can run at 3,000+ courses per minute."
  },
  {
    term: "raschel lace",
    full_form: "raschel lace",
    category: "warp_knitting",
    phonetic: "/\u02C8r\xE6\u0283\u0259l le\u026As/",
    definition_en: "lace fabric produced on a multi-bar raschel machine, simulating the look of true Leavers lace",
    definition_zh: "\u62C9\u820D\u5C14\u857E\u4E1D,\u7ECF\u7F16\u857E\u4E1D",
    example: "Modern raschel lace can closely mimic traditional Leavers lace at lower cost."
  },
  {
    term: "warp knit mesh",
    full_form: "warp knit mesh",
    category: "warp_knitting",
    phonetic: "/w\u0254\u02D0rp n\u026At m\u025B\u0283/",
    definition_en: "a net-like warp knit fabric with regular hexagonal or square holes, used for sports linings and bags",
    definition_zh: "\u7ECF\u7F16\u7F51\u773C\u5E03",
    example: "Warp knit mesh is the standard lining for running shoes and sports bags."
  },
  {
    term: "warp knit suede",
    full_form: "warp knit suede (\u9E82\u76AE\u7ED2)",
    category: "warp_knitting",
    phonetic: "/w\u0254\u02D0rp n\u026At swe\u026Ad/",
    definition_en: "a brushed warp knit fabric that imitates suede leather, often polyester or nylon",
    definition_zh: "\u7ECF\u7F16\u9E82\u76AE\u7ED2",
    example: "Warp knit suede is widely used for sofa upholstery and garment shells."
  },
  {
    term: "jacquard warp knit",
    full_form: "jacquard warp knit (\u7ECF\u7F16\u8D3E\u5361)",
    category: "warp_knitting",
    phonetic: "/d\u0292\u0259\u02C8k\u0251\u02D0rd w\u0254\u02D0rp n\u026At/",
    definition_en: "a warp knit fabric with a pattern produced by selectively controlling individual guide bars (jacquard)",
    definition_zh: "\u7ECF\u7F16\u8D3E\u5361,\u7ECF\u7F16\u63D0\u82B1",
    example: "Jacquard warp knit is used for patterned curtain and lace fabrics."
  },
  {
    term: "loom",
    full_form: "loom (weaving machine)",
    category: "shuttle_weaving",
    phonetic: "/lu\u02D0m/",
    definition_en: "a machine that interlaces warp and weft yarns to produce woven fabric",
    definition_zh: "\u7EC7\u673A,\u7EC7\u5E03\u673A",
    example: "Our mill runs 600 looms, mostly air-jet and rapier."
  },
  {
    term: "shuttle",
    full_form: "shuttle",
    category: "shuttle_weaving",
    phonetic: "/\u02C8\u0283\u028Ct\u0259l/",
    definition_en: "a traditional weaving tool that carries the weft yarn across the shed; modern shuttleless looms use other weft insertion methods",
    definition_zh: "\u68AD\u5B50,\u68AD",
    example: "Shuttle looms are now rare in large mills, replaced by shuttleless looms."
  },
  {
    term: "shuttleless loom",
    full_form: "shuttleless loom",
    category: "shuttle_weaving",
    phonetic: "/\u02C8\u0283\u028Ct\u0259l\u0259s lu\u02D0m/",
    definition_en: "a modern weaving machine that inserts weft without a shuttle, using rapier, air-jet, water-jet, or projectile methods",
    definition_zh: "\u65E0\u68AD\u7EC7\u673A",
    example: "Shuttleless looms give higher speed and fewer weft breaks."
  },
  {
    term: "air-jet loom",
    full_form: "air-jet loom (\u55B7\u6C14\u7EC7\u673A)",
    category: "shuttle_weaving",
    phonetic: "/\u025B\u0259r d\u0292\u025Bt lu\u02D0m/",
    definition_en: "a shuttleless loom that uses a jet of compressed air to carry the weft yarn across the shed, very high speed",
    definition_zh: "\u55B7\u6C14\u7EC7\u673A",
    example: "Air-jet looms are the fastest, reaching 1,500+ rpm for plain cotton."
  },
  {
    term: "rapier loom",
    full_form: "rapier loom (\u5251\u6746\u7EC7\u673A)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8re\u026Api\u0259r lu\u02D0m/",
    definition_en: "a shuttleless loom that uses a rigid or flexible rapier to carry the weft across the shed, very versatile",
    definition_zh: "\u5251\u6746\u7EC7\u673A",
    example: "Rapier looms are ideal for fancy yarn, denim, and small batch."
  },
  {
    term: "water-jet loom",
    full_form: "water-jet loom (\u6C34\u5C04\u6D41\u7EC7\u673A)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8w\u0254\u02D0t\u0259r d\u0292\u025Bt lu\u02D0m/",
    definition_en: "a shuttleless loom that uses a water jet to insert the weft, mainly for hydrophobic synthetic fabrics",
    definition_zh: "\u6C34\u5C04\u6D41\u7EC7\u673A,\u55B7\u6C34\u7EC7\u673A",
    example: "Water-jet looms are widely used for polyester taffeta and nylon fabric."
  },
  {
    term: "projectile loom",
    full_form: "projectile loom",
    category: "shuttle_weaving",
    phonetic: "/pr\u0259\u02C8d\u0292\u025Bkta\u026Al lu\u02D0m/",
    definition_en: "a shuttleless loom that uses small projectiles to grip and carry the weft across the shed",
    definition_zh: "\u7247\u68AD\u7EC7\u673A",
    example: "Projectile looms like Sulzer P7100 are common for heavy industrial fabrics."
  },
  {
    term: "dobby",
    full_form: "dobby loom / dobby weave",
    category: "shuttle_weaving",
    phonetic: "/\u02C8d\u0252bi/",
    definition_en: "a loom attachment or weave structure that controls a small number of heald frames for simple patterns like twill and small geometric designs",
    definition_zh: "\u591A\u81C2\u673A,\u5C0F\u63D0\u82B1",
    example: "Dobby looms are perfect for twill, plain, and small geometric patterns."
  },
  {
    term: "jacquard loom",
    full_form: "jacquard loom",
    category: "shuttle_weaving",
    phonetic: "/d\u0292\u0259\u02C8k\u0251\u02D0rd lu\u02D0m/",
    definition_en: "a loom with a jacquard head that controls each warp end individually, used for complex large patterns",
    definition_zh: "\u5927\u63D0\u82B1\u7EC7\u673A,\u8D3E\u5361\u7EC7\u673A",
    example: "Jacquard looms are used for damask, matelass\xE9, and complex patterned fabrics."
  },
  {
    term: "warp",
    full_form: "warp (\u7ECF\u7EB1)",
    category: "shuttle_weaving",
    phonetic: "/w\u0254\u02D0rp/",
    definition_en: "the set of yarns running lengthwise in a woven fabric, parallel to the selvedge",
    definition_zh: "\u7ECF\u7EB1,\u7ECF\u7EBF",
    example: "Warp yarns are sized before weaving to reduce breakage."
  },
  {
    term: "weft",
    full_form: "weft (\u7EAC\u7EB1)",
    category: "shuttle_weaving",
    phonetic: "/w\u025Bft/",
    definition_en: "the yarn running crosswise in a woven fabric, perpendicular to the selvedge",
    definition_zh: "\u7EAC\u7EB1,\u7EAC\u7EBF",
    example: "We use 40s cotton weft for a soft hand feel on this shirt."
  },
  {
    term: "warping",
    full_form: "warping (\u6574\u7ECF)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8w\u0254\u02D0rp\u026A\u014B/",
    definition_en: "the process of transferring warp yarns from creel packages onto a warp beam in equal length and tension",
    definition_zh: "\u6574\u7ECF",
    example: "Direct warping is used for plain fabrics; sectional warping for patterned."
  },
  {
    term: "sizing",
    full_form: "sizing (\u6D46\u7EB1)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8sa\u026Az\u026A\u014B/",
    definition_en: "the process of coating warp yarns with size (usually starch or PVA) to strengthen them and reduce breakage during weaving",
    definition_zh: "\u6D46\u7EB1",
    example: "Sizing with PVA improves weaving efficiency for fine-count cotton warp."
  },
  {
    term: "drawing-in",
    full_form: "drawing-in (\u7A7F\u7EFC)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8dr\u0254\u02D0\u026A\u014B \u026An/",
    definition_en: "the process of threading each warp end through a heald and a reed, in a specific pattern",
    definition_zh: "\u7A7F\u7EFC",
    example: "Drawing-in pattern determines the weave structure on the loom."
  },
  {
    term: "heald frame",
    full_form: "heald frame (\u7EFC\u6846)",
    category: "shuttle_weaving",
    phonetic: "/hi\u02D0ld fre\u026Am/",
    definition_en: "a frame carrying healds (heddles) that lift or lower groups of warp yarns to form the shed",
    definition_zh: "\u7EFC\u6846",
    example: "A dobby loom typically has 8-16 heald frames."
  },
  {
    term: "reed",
    full_form: "reed (\u94A2\u7B58)",
    category: "shuttle_weaving",
    phonetic: "/ri\u02D0d/",
    definition_en: "a comb-like device on a loom that beats the weft into place and keeps warp yarns evenly spaced",
    definition_zh: "\u94A2\u7B58",
    example: "Reed count determines the warp density of the fabric."
  },
  {
    term: "shedding",
    full_form: "shedding (\u5F00\u53E3)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8\u0283\u025Bd\u026A\u014B/",
    definition_en: "the action of separating warp yarns into upper and lower layers to form a shed for weft insertion",
    definition_zh: "\u5F00\u53E3,\u5F00\u53E3\u8FD0\u52A8",
    example: "Shedding is the first step of the weaving cycle."
  },
  {
    term: "beat-up",
    full_form: "beat-up (\u6253\u7EAC)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8bi\u02D0t \u028Cp/",
    definition_en: "the action of pushing the weft yarn into the fell of the cloth using the reed, determining fabric density",
    definition_zh: "\u6253\u7EAC,\u6253\u7EAC\u8FD0\u52A8",
    example: "Beat-up force affects fabric hand feel and density uniformity."
  },
  {
    term: "take-up",
    full_form: "take-up (\u5377\u53D6)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8te\u026Ak \u028Cp/",
    definition_en: "the action of winding the woven fabric onto the cloth roll at a controlled rate",
    definition_zh: "\u5377\u53D6,\u5377\u5E03",
    example: "Take-up tension must match loom speed to keep fabric flat."
  },
  {
    term: "let-off",
    full_form: "let-off (\u9001\u7ECF)",
    category: "shuttle_weaving",
    phonetic: "/l\u025Bt \u0252f/",
    definition_en: "the action of releasing warp yarn from the warp beam at a controlled tension during weaving",
    definition_zh: "\u9001\u7ECF,\u653E\u7ECF",
    example: "Electronic let-off keeps warp tension constant from full beam to empty."
  },
  {
    term: "plain weave",
    full_form: "plain weave (1/1)",
    category: "shuttle_weaving",
    phonetic: "/ple\u026An wi\u02D0v/",
    definition_en: "the simplest weave structure, each weft passes over one warp and under the next, balanced and stable",
    definition_zh: "\u5E73\u7EB9,\u5E73\u7EB9\u7EC4\u7EC7",
    example: "Plain weave is the most common structure for shirts and sheets."
  },
  {
    term: "twill",
    full_form: "twill weave (2/1, 3/1)",
    category: "shuttle_weaving",
    phonetic: "/tw\u026Al/",
    definition_en: "a weave with diagonal lines on the surface, formed by weft floating over multiple warps, e.g. 2/1 or 3/1 twill",
    definition_zh: "\u659C\u7EB9,2/1 \u659C\u7EB9,3/1 \u659C\u7EB9",
    example: "3/1 twill is the classic structure for chino and denim."
  },
  {
    term: "satin",
    full_form: "satin weave (4/1, 5/1, 8/1)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8s\xE6t\u0259n/",
    definition_en: "a weave with long warp or weft floats giving a smooth, lustrous surface, e.g. 4-satin, 5-satin, 8-satin",
    definition_zh: "\u7F0E\u7EB9,4 \u679A\u7F0E,5 \u679A\u7F0E,8 \u679A\u7F0E",
    example: "8-satin gives the smoothest, most lustrous surface for sateen sheets."
  },
  {
    term: "yarn-dyed",
    full_form: "yarn-dyed (\u8272\u7EC7)",
    category: "shuttle_weaving",
    phonetic: "/j\u0251\u02D0rn da\u026Ad/",
    definition_en: "a fabric woven from pre-dyed yarns, giving clear color and good fastness, e.g. yarn-dyed stripes and checks",
    definition_zh: "\u8272\u7EC7,\u8272\u7EBA",
    example: "Yarn-dyed stripes are the classic Oxford shirting look."
  },
  {
    term: "piece-dyed",
    full_form: "piece-dyed (\u5339\u67D3)",
    category: "shuttle_weaving",
    phonetic: "/pi\u02D0s da\u026Ad/",
    definition_en: "a fabric dyed in the piece (after weaving), the most common method for solid color",
    definition_zh: "\u5339\u67D3,\u5E03\u5339\u67D3\u8272",
    example: "Piece-dyed solid color is cheaper than yarn-dyed for large runs."
  },
  {
    term: "EPI",
    full_form: "EPI (Ends Per Inch)",
    category: "shuttle_weaving",
    phonetic: "/i\u02D0 pi\u02D0 a\u026A/",
    definition_en: "the number of warp ends per inch of fabric width, a key parameter of woven fabric density",
    definition_zh: "\u7ECF\u5BC6,\u6BCF\u82F1\u5BF8\u7ECF\u7EB1\u6570",
    example: "Our poplin is 144 EPI by 76 PPI, soft yet stable."
  },
  {
    term: "PPI",
    full_form: "PPI (Picks Per Inch)",
    category: "shuttle_weaving",
    phonetic: "/pi\u02D0 pi\u02D0 a\u026A/",
    definition_en: "the number of weft picks per inch of fabric length, the other key parameter of woven density",
    definition_zh: "\u7EAC\u5BC6,\u6BCF\u82F1\u5BF8\u7EAC\u7EB1\u6570",
    example: "Higher PPI gives a more compact, durable fabric."
  },
  {
    term: "shrinkage in loom state",
    full_form: "shrinkage in loom state (\u7EC7\u7F29\u7387)",
    category: "shuttle_weaving",
    phonetic: "/\u02C8\u0283r\u026Ank\u026Ad\u0292 \u026An lu\u02D0m ste\u026At/",
    definition_en: "the length reduction of warp and weft yarn in the woven state compared to the un-stretched state, important for greige planning",
    definition_zh: "\u7EC7\u7F29\u7387,\u576F\u5E03\u7EC7\u7F29",
    example: "Cotton twill has a higher warp shrinkage in loom state than polyester."
  },
  {
    term: "weft knitting",
    full_form: "weft knitting",
    category: "weft_knitting",
    phonetic: "/w\u025Bft \u02C8n\u026At\u026A\u014B/",
    definition_en: "a knitting process where one yarn forms loops across the width of the fabric, course by course",
    definition_zh: "\u7EAC\u7F16",
    example: "Weft knitting is the most common method for T-shirts and underwear."
  },
  {
    term: "circular knitting machine",
    full_form: "circular knitting machine (\u5706\u673A)",
    category: "weft_knitting",
    phonetic: "/\u02C8s\u025C\u02D0rkj\u0259l\u0259r \u02C8n\u026At\u026A\u014B m\u0259\u02C8\u0283i\u02D0n/",
    definition_en: "a weft knitting machine with a rotating cylinder, producing tubular fabric for T-shirts and underwear",
    definition_zh: "\u5706\u673A,\u5706\u5F62\u7EAC\u7F16\u673A",
    example: "Single jersey is produced on a circular knitting machine."
  },
  {
    term: "flat knitting machine",
    full_form: "flat knitting machine (\u6A2A\u673A)",
    category: "weft_knitting",
    phonetic: "/fl\xE6t \u02C8n\u026At\u026A\u014B m\u0259\u02C8\u0283i\u02D0n/",
    definition_en: "a weft knitting machine with a flat bed, used for shaped panels like sweaters and collars",
    definition_zh: "\u6A2A\u673A,\u5E73\u677F\u9488\u7EC7\u673A",
    example: "Flat knitting machines knit fully-fashioned sweater panels."
  },
  {
    term: "cylinder",
    full_form: "cylinder (\u9488\u7B52)",
    category: "weft_knitting",
    phonetic: "/\u02C8s\u026Al\u026And\u0259r/",
    definition_en: "the rotating slotted cylinder on a circular knitting machine that holds the needles",
    definition_zh: "\u9488\u7B52",
    example: "A 30-inch diameter cylinder gives about 1,800 needles for 24 gauge."
  },
  {
    term: "needle count",
    full_form: "needle count (\u9488\u6570)",
    category: "weft_knitting",
    phonetic: "/\u02C8ni\u02D0d\u0259l ka\u028Ant/",
    definition_en: "the total number of needles on a circular knitting machine cylinder, determining fabric width and gauge",
    definition_zh: "\u9488\u6570,\u603B\u9488\u6570",
    example: "Higher needle count means wider fabric at the same gauge."
  },
  {
    term: "cam arrangement",
    full_form: "cam arrangement (\u4E09\u89D2\u6392\u5217)",
    category: "weft_knitting",
    phonetic: "/k\xE6m \u0259\u02C8re\u026And\u0292m\u0259nt/",
    definition_en: "the layout of stitch cams on a circular knitting machine, determining knit, tuck, miss patterns",
    definition_zh: "\u4E09\u89D2\u6392\u5217,\u4E09\u89D2\u914D\u7F6E",
    example: "A 4-track cam arrangement allows complex jacquard on a single jersey machine."
  },
  {
    term: "single jersey",
    full_form: "single jersey (\u5355\u9762\u7EC4\u7EC7)",
    category: "weft_knitting",
    phonetic: "/\u02C8s\u026A\u014B\u0261\u0259l \u02C8d\u0292\u025C\u02D0rzi/",
    definition_en: "a basic weft knit with face loops on one side and back loops on the other, used for T-shirts",
    definition_zh: "\u5355\u9762\u6C57\u5E03,\u5355\u9762\u7EC4\u7EC7",
    example: "Single jersey curls at the edges \u2014 that's how you tell it from interlock."
  },
  {
    term: "interlock",
    full_form: "interlock (\u53CC\u9762\u7EC4\u7EC7)",
    category: "weft_knitting",
    phonetic: "/\u02C8\u026Ant\u0259r\u02CCl\u0252k/",
    definition_en: "a double-knit fabric with two 1x1 rib layers interlocked, giving a smooth both-side face and high stability",
    definition_zh: "\u53CC\u9762\u5E03,\u68C9\u6BDB\u5E03,interlock",
    example: "Interlock does not curl at the edges and is more stable than single jersey."
  },
  {
    term: "rib 1x1",
    full_form: "rib 1x1 (1+1 \u7F57\u7EB9)",
    category: "weft_knitting",
    phonetic: "/r\u026Ab w\u028Cn b\u026A w\u028Cn/",
    definition_en: "a rib knit with one knit stitch alternating with one purl stitch, very stretchy in the width",
    definition_zh: "1+1 \u7F57\u7EB9,1x1 \u7F57\u7EB9",
    example: "Rib 1x1 is the standard cuff and collar fabric for T-shirts."
  },
  {
    term: "rib 2x2",
    full_form: "rib 2x2 (2+2 \u7F57\u7EB9)",
    category: "weft_knitting",
    phonetic: "/r\u026Ab tu\u02D0 b\u026A tu\u02D0/",
    definition_en: "a rib knit with two knit stitches alternating with two purl stitches, wider ribs, less stretchy",
    definition_zh: "2+2 \u7F57\u7EB9,2x2 \u7F57\u7EB9",
    example: "Rib 2x2 is used for sweater cuffs and beanies."
  },
  {
    term: "pique",
    full_form: "pique (\u73E0\u5730)",
    category: "weft_knitting",
    phonetic: "/pi\u02C8ke\u026A/",
    definition_en: "a knit with a waffle or honeycomb texture, the classic Lacoste polo fabric",
    definition_zh: "\u73E0\u5730,\u73E0\u5730\u7F51\u773C",
    example: "Pique polo is usually 220 GSM combed cotton, with a textured face."
  },
  {
    term: "fleece",
    full_form: "fleece (3-thread fleece)",
    category: "weft_knitting",
    phonetic: "/fli\u02D0s/",
    definition_en: "a 3-yarn knit with face yarn, tie yarn, and a brushed loop yarn on the back, used for hoodies and sweatshirts",
    definition_zh: "\u6293\u7ED2,\u4E09\u7EBF\u7ED2,\u536B\u8863\u5E03",
    example: "3-thread fleece at 320 GSM is the standard hoodie fabric."
  },
  {
    term: "jersey jacquard",
    full_form: "jersey jacquard (\u5355\u9762\u63D0\u82B1)",
    category: "weft_knitting",
    phonetic: "/\u02C8d\u0292\u025C\u02D0rzi d\u0292\u0259\u02C8k\u0251\u02D0rd/",
    definition_en: "a single jersey fabric with a multi-color pattern produced by selective needle knitting, with floats on the back",
    definition_zh: "\u5355\u9762\u63D0\u82B1,\u5927\u5706\u673A\u63D0\u82B1",
    example: "Jersey jacquard is the most cost-effective way to do all-over color patterns on knits."
  },
  {
    term: "Fair Isle",
    full_form: "Fair Isle (\u8D39\u5C14\u5C9B\u63D0\u82B1)",
    category: "weft_knitting",
    phonetic: "/f\u025Br a\u026Al/",
    definition_en: "a traditional stranded colorwork pattern with small repeating geometric motifs, typically on flat knit garments",
    definition_zh: "\u8D39\u5C14\u5C9B\u63D0\u82B1,\u5317\u6B27\u98CE\u63D0\u82B1",
    example: "Fair Isle is a heritage look on wool sweaters."
  },
  {
    term: "terry",
    full_form: "terry (\u6BDB\u5708\u5E03)",
    category: "weft_knitting",
    phonetic: "/\u02C8t\u025Bri/",
    definition_en: "a knit with uncut loops on the back, used for towels, beachwear, and casual sweatpants",
    definition_zh: "\u6BDB\u5708\u5E03,\u6BDB\u5DFE\u5E03",
    example: "French terry is terry with a smooth face and soft loop back."
  },
  {
    term: "velour",
    full_form: "velour (\u5929\u9E45\u7ED2\u9488\u7EC7)",
    category: "weft_knitting",
    phonetic: "/v\u0259\u02C8l\u028Ar/",
    definition_en: "a knit with cut loops on the surface, sheared to give a soft velvety hand feel, used for tracksuits",
    definition_zh: "\u9488\u7EC7\u5929\u9E45\u7ED2,velour",
    example: "Velour tracksuits were huge in the 2000s and are coming back."
  },
  {
    term: "ottoman",
    full_form: "ottoman rib",
    category: "weft_knitting",
    phonetic: "/\u02C8\u0252t\u0259m\u0259n/",
    definition_en: "a double-knit with pronounced horizontal ribs, used for structured tops and dresses",
    definition_zh: "\u5965\u7279\u66FC\u6761,\u6A2A\u6761\u9488\u7EC7",
    example: "Ottoman rib is often used in tailored knit dresses for body shape."
  },
  {
    term: "Milano rib",
    full_form: "Milano rib (\u7C73\u5170\u7F57\u7EB9)",
    category: "weft_knitting",
    phonetic: "/m\u026A\u02C8l\u0251\u02D0no\u028A r\u026Ab/",
    definition_en: "a flat double-knit rib with a clear vertical cord on the face, used for suit lining and outerwear",
    definition_zh: "\u7C73\u5170\u7F57\u7EB9,\u7C73\u5170\u5C3C\u65AF\u7F57\u7EB9",
    example: "Milano rib is the classic structured rib for jacket lining."
  },
  {
    term: "sinkers",
    full_form: "sinker (\u6C89\u964D\u7247)",
    category: "weft_knitting",
    phonetic: "/\u02C8s\u026A\u014Bk\u0259r/",
    definition_en: "a thin metal plate on a knitting machine that holds down the previously formed loop while a new loop is being made",
    definition_zh: "\u6C89\u964D\u7247",
    example: "Sinkers are essential for holding loops on a circular knitting machine."
  },
  {
    term: "course",
    full_form: "course (\u6A2A\u5217)",
    category: "weft_knitting",
    phonetic: "/k\u0254\u02D0rs/",
    definition_en: "a horizontal row of loops in a knit fabric, equivalent to a weft pick",
    definition_zh: "\u6A2A\u5217,\u7EBF\u5708\u6A2A\u5217",
    example: "Courses per cm (CPC) is the vertical density of a knit."
  },
  {
    term: "wale",
    full_form: "wale (\u7EB5\u884C)",
    category: "weft_knitting",
    phonetic: "/we\u026Al/",
    definition_en: "a vertical column of loops in a knit fabric, running lengthwise",
    definition_zh: "\u7EB5\u884C,\u7EBF\u5708\u7EB5\u884C",
    example: "Wales per inch (WPI) is the horizontal density of a knit."
  },
  {
    term: "CPC",
    full_form: "CPC (courses per cm)",
    category: "weft_knitting",
    phonetic: "/si\u02D0 pi\u02D0 si\u02D0/",
    definition_en: "the number of knit courses per cm in a knit fabric, the vertical density",
    definition_zh: "\u7EB5\u5BC6,\u6BCF\u5398\u7C73\u6A2A\u5217\u6570",
    example: "A 200 GSM single jersey is around 18 CPC and 12 WPI."
  },
  {
    term: "WPI",
    full_form: "WPI (wales per inch)",
    category: "weft_knitting",
    phonetic: "/\u02CCd\u028Cblju\u02D0 pi\u02D0 a\u026A/",
    definition_en: "the number of knit wales per inch in a knit fabric, the horizontal density",
    definition_zh: "\u6A2A\u5BC6,\u6BCF\u82F1\u5BF8\u7EB5\u884C\u6570",
    example: "WPI is the standard way to express knit density in the US."
  },
  {
    term: "open loop",
    full_form: "open loop (\u5F00\u53E3\u7EBF\u5708)",
    category: "weft_knitting",
    phonetic: "/\u02C8o\u028Ap\u0259n lu\u02D0p/",
    definition_en: "a knit loop whose yarn ends cross at the bottom, the legs are open",
    definition_zh: "\u5F00\u53E3\u7EBF\u5708",
    example: "Open loops make a softer, looser knit surface."
  },
  {
    term: "closed loop",
    full_form: "closed loop (\u95ED\u53E3\u7EBF\u5708)",
    category: "weft_knitting",
    phonetic: "/klo\u028Azd lu\u02D0p/",
    definition_en: "a knit loop whose yarn ends cross at the top, the legs are closed",
    definition_zh: "\u95ED\u53E3\u7EBF\u5708",
    example: "Closed loops give a cleaner, more stable knit surface."
  },
  {
    term: "sinker loop",
    full_form: "sinker loop (\u6C89\u964D\u5F27)",
    category: "weft_knitting",
    phonetic: "/\u02C8s\u026A\u014Bk\u0259r lu\u02D0p/",
    definition_en: "the lower arc of a knit loop that connects two adjacent needle loops on the back side",
    definition_zh: "\u6C89\u964D\u5F27,\u7EBF\u5708\u5F27",
    example: "The sinker loop length is the main driver of fabric thickness."
  },
  {
    term: "needle loop",
    full_form: "needle loop (\u5708\u67F1)",
    category: "weft_knitting",
    phonetic: "/\u02C8ni\u02D0d\u0259l lu\u02D0p/",
    definition_en: "the upper arc of a knit loop that sits over the needle, also called face loop",
    definition_zh: "\u9488\u7F16\u5F27,\u5708\u67F1",
    example: "Needle loops form the visible face of the knit."
  },
  {
    term: "float loop",
    full_form: "float loop (\u5EF6\u5C55\u7EBF)",
    category: "weft_knitting",
    phonetic: "/flo\u028At lu\u02D0p/",
    definition_en: "the part of yarn connecting two knit loops in a different course, not forming a loop itself",
    definition_zh: "\u5EF6\u5C55\u7EBF,\u6D6E\u7EBF",
    example: "Long floats on the back of jacquard knit can be snagged."
  },
  {
    term: "mending",
    full_form: "mending (\u4FEE\u8865)",
    category: "weft_knitting",
    phonetic: "/\u02C8m\u025Bnd\u026A\u014B/",
    definition_en: "the process of repairing minor defects (holes, slubs, dropped stitches) on knitted fabric before finishing",
    definition_zh: "\u4FEE\u8865,\u9A8C\u5E03\u4FEE\u8865",
    example: "After knitting, every roll goes through inspection and mending."
  },
  {
    term: "inspection",
    full_form: "inspection (\u9A8C\u5E03)",
    category: "weft_knitting",
    phonetic: "/\u026An\u02C8sp\u025Bk\u0283\u0259n/",
    definition_en: "the process of checking fabric on a moving frame under light, looking for defects like holes, slubs, barre",
    definition_zh: "\u9A8C\u5E03,\u5E03\u9762\u68C0\u9A8C",
    example: "Inspection is done at 4 points per meter, with a four-point system."
  },
  {
    term: "finishing",
    full_form: "finishing (\u540E\u6574\u7406)",
    category: "weft_knitting",
    phonetic: "/\u02C8f\u026An\u026A\u0283\u026A\u014B/",
    definition_en: "the processes applied to greige fabric to improve hand feel, appearance, and performance, e.g. singeing, brushing, compacting",
    definition_zh: "\u540E\u6574\u7406,\u540E\u5904\u7406",
    example: "Compacting in finishing controls the residual shrinkage of single jersey."
  },
  {
    term: "yarn count Ne",
    full_form: "yarn count Ne (English count)",
    category: "weft_knitting",
    phonetic: "/j\u0251\u02D0rn ka\u028Ant \u02CCen \u02C8i\u02D0/",
    definition_en: "the English cotton yarn count: the number of 840-yard lengths per pound; higher Ne = finer yarn",
    definition_zh: "\u82F1\u5236\u652F\u6570 Ne,\u68C9\u7EB1\u7EC6\u5EA6",
    example: "Combed cotton 32 Ne is a common T-shirt yarn."
  },
  {
    term: "yarn count Nm",
    full_form: "yarn count Nm (metric count)",
    category: "weft_knitting",
    phonetic: "/j\u0251\u02D0rn ka\u028Ant \u02CC\u025Bn \u02C8\u025Bm/",
    definition_en: "the metric yarn count: the number of 1 km lengths per kg; higher Nm = finer yarn, common for wool",
    definition_zh: "\u516C\u5236\u652F\u6570 Nm,\u6BDB\u7EB1\u7EC6\u5EA6",
    example: "Wool 28 Nm / 2 is the classic sweater yarn."
  }
];

// content/system_prompts.json
var system_prompts_default = {
  beginner: "You are roleplaying an overseas buyer (the AI) calling a Chinese garment & textile exporter. The user is practicing spoken English.\n\nPersona: friendly, patient, slow-speaking Western buyer. Speak in short, simple sentences (10-15 words max). Use present simple and common present perfect. Avoid idioms, slang, and contractions only when they slow clarity. Pronounce numbers and trade terms (FOB, MOQ, GSM) clearly and spell them out the first time.\n\nBehavior rules:\n- Stay in character as a real buyer. Open the call, state the purpose, ask the user to clarify or confirm.\n- If the user freezes or says 'I don't understand', rephrase in simpler words, never break character.\n- If the user makes a grammar mistake, do NOT correct it mid-conversation. After the round, a separate system note will provide feedback.\n- Always leave a clear question or prompt at the end of your turn so the user knows what to say next.\n- Use the current scenario context. The scenario is: {{scenario_title}}.\n- Sprinkle in 1-2 industry terms per turn (MOQ, lead time, FOB, GSM, handfeel, sample, etc.), but define them in plain English right after.\n- Use phrases like 'Sorry, could you say that again?' or 'No problem, take your time' to slow the pace.\n- Keep each turn to 1-3 sentences. Never monologue.\n\nSample opener style: 'Hello, this is Mark. I am calling about t-shirts. Do you have time to talk?'\n\nYou are a friendly technical sales rep from a Chinese yarn / fabric / dye-house / print-house / seamless-garment supplier. You are talking to a Chinese garment factory merchandiser who is just starting to handle overseas buyers. Use short sentences, simple vocabulary, and common words. Speak slowly, ask one question at a time, and repeat key terms when the user seems lost. Avoid advanced industry jargon; if you must use a term like 'GSM' or 'yarn count', explain it on first use in one short phrase. Be patient with grammar mistakes, never correct the user directly \u2014 just continue the conversation naturally. Stay in your role as the supplier at all times. Drive the conversation forward: greet, ask what they need, listen, react, and close with a clear next step (send a sample, confirm a delivery date, etc.).\n\nYou are roleplaying a counterpart on the factory / customer side in a Chinese garment export business. The current scenario is: {{scenario_title}}.\n\nPersona: a patient, clear-speaking production or sales counterpart who uses short sentences (10 to 15 words) and simple vocabulary. You might be a cutting room supervisor, an order desk clerk, a QC assistant, or a junior quality manager \u2014 depending on the scenario. Speak slowly, repeat key numbers, and define any trade term the first time you use it.\n\nBehavior rules:\n- Stay in character at all times. Drive the conversation forward one step at a time, ask one question per turn.\n- Use 1 to 2 industry terms per turn (PO, ETD, AQL, SPI, CAPA, etc.) and explain them in plain English right after.\n- If the user freezes or says 'I don't understand', rephrase in simpler words, never break character.\n- Do not correct the user's grammar mid-conversation. A separate feedback layer will handle that.\n- Always end your turn with a clear question or next-step prompt so the user knows what to say.\n- For shirt_production: use terms like PO, GSM, cutting, sewing, ironing, AQL, polybag, shipping mark \u2014 define each the first time.\n- For order_management: use terms like Proforma Invoice, deposit, balance, ETD, ETA, booking, B/L \u2014 define each the first time.\n- For exception_handling: use terms like delay, rework, credit note, claim, force majeure \u2014 define each the first time.\n- For post_mortem: use terms like 5-why, root cause, CAPA, KPI, SOP \u2014 define each the first time.\n- Keep each turn to 1 to 3 sentences. Never monologue.\n\nSample opener style: 'Good morning, this is Mr. Wang from the cutting room. May I help you?'\n\nYou are roleplaying a Chinese flyknit / warp-knit / woven / weft-knit mill technical engineer talking to a Chinese footwear brand sourcing manager, fabric buyer, or T-shirt/underwear factory merchandiser. The user is practicing spoken English for factory-floor and sourcing conversations.\n\nPersona: patient, friendly Chinese factory engineer. Use short, simple sentences (10-15 words max). Use present simple. Avoid idioms and heavy technical jargon. When you must use a term (gauge, jacquard, EPI, courses), define it in plain English right after.\n\nBehavior rules:\n- Stay in character as the factory technical contact. Open the call, state the scenario purpose, ask the user to clarify or confirm.\n- The current scenario is: {{scenario_title}}. Stay strictly inside that scenario's topic (flyknit upper, warp knit fabric, woven fabric, or weft knit fabric).\n- If the user freezes or says 'I don't understand', rephrase in simpler words, never break character.\n- Do NOT correct the user mid-conversation. A separate feedback system will handle errors.\n- Always end your turn with a clear question or prompt.\n- Use 1-2 industry terms per turn (e.g. gauge E14, jacquard, EPI, GSM, courses, rib 1x1), and explain each in one short phrase the first time.\n- Use filler phrases like 'No problem, take your time' or 'Sorry, could you say that again?' to slow the pace.\n- Each turn: 1-3 sentences. Never monologue.\n\nSample opener style: 'Hello, this is Daniel from the flyknit lab. What can I do for you today?'",
  intermediate: "You are roleplaying an experienced overseas buyer / merchandiser in a typical B2B garment export call with a Chinese supplier. The user is a Chinese export sales representative practicing professional English.\n\nPersona: a mid-level buyer or merchandiser at a mid-market apparel brand or trading company. Conversational but business-focused. Speaks in 15-25 word sentences with a mix of common business idioms ('let's circle back', 'on the same page', 'to be honest') and precise trade vocabulary (FOB Ningbo, AQL 2.5, lab dip, GSM, lead time, TT 30/70, handfeel, etc.).\n\nBehavior rules:\n- Stay in character. Open with a clear business purpose. Push the conversation forward: ask for numbers, ask for confirmation, push back on vague answers.\n- The current scenario is: {{scenario_title}}. Stay within that scenario's typical agenda (e.g. for inquiry_quote: clarify specs, discuss price, ask for PI).\n- If the user gives a vague answer ('I will check'), push for a specific timeline ('by when exactly?').\n- Use real-world follow-ups: 'Is that FOB or CIF?', 'Can you email the offer today?', 'What's the lead time from the deposit?'\n- Use natural filler and hesitation ('well...', 'let me think', 'to be honest') sparingly \u2014 it makes the conversation feel real.\n- Correctness feedback is handled out-of-band. Do not correct the user mid-conversation.\n- Each turn: 2-5 sentences. End with a question or next-step prompt 80% of the time.\n- Use industry jargon correctly. The user is expected to know MOQ, PI, FOB, CIF, AQL, lab dip, handfeel, GSM, yarn count, B/L, ETD, ETA.\n\nYou are an experienced technical sales rep from a Chinese yarn / fabric / dye-house / print-house / seamless-garment supplier. You are talking to a Chinese garment factory merchandiser with 2 to 5 years of experience. Use normal business English, full sentences, and industry-standard vocabulary (yarn count, GSM, EPI, PPI, color fastness, shrink rate, registration, MOQ, lead time, etc.). Define a new term only when the user clearly does not know it. Push the user to be specific \u2014 ask about quantities, dates, target prices, and concrete specifications. You may correct a terminology mistake indirectly by restating what you think the user means. Always drive the conversation forward: a sample, a quote, a confirmation, a next meeting. Stay in your role as the supplier at all times.\n\nYou are roleplaying an experienced counterpart in a Chinese garment export business. The current scenario is: {{scenario_title}}.\n\nPersona: a mid-level factory manager, merchandiser, buyer, or QC who speaks in 15 to 25 word sentences with normal business English. You know the industry well \u2014 fabric, production, shipping, claims, post-mortem \u2014 and you use trade terms fluently but explain any unusual abbreviation on first use. You push for specifics (numbers, dates, owners, due dates) and you do not accept vague answers.\n\nBehavior rules:\n- Stay in character. Push the conversation forward with concrete asks: 'by when exactly?', 'how many pieces?', 'who is the owner?', 'what is the unit cost?', 'can you document that?'.\n- Use industry jargon correctly: PO, PI, TT 30/70, LC, ETD, ETA, B/L, AQL 1.5/2.5/4.0, GSM, SPI, SPI, fusing, bar tack, rework, credit note, 8D, 5-why, root cause, CAPA, SOP, PDCA, KPI, COPQ, Pareto.\n- For shirt_production: ask about tech pack version, marker efficiency, SPI, pre-fuse test, AQL split, pre-shipment photos.\n- For order_management: ask about PI terms, payment method, ETD/ETA, booking, document set, FTA certificate.\n- For exception_handling: ask for evidence (photos, 8D report, RC), containment, corrective vs preventive action, credit note pool.\n- For post_mortem: ask for 5-why, fishbone categories, CAPA register, KPI trend, lessons learned, SOP update.\n- If the user gives a vague answer ('I will check', 'we will see'), push for a specific timeline or number.\n- If the user makes a terminology mistake, restate what they probably meant in correct terms, do not correct them directly.\n- Do not break character for grammar feedback. A separate layer handles that.\n- Each turn: 2 to 5 sentences. End with a question or next-step prompt 80% of the time.\n- Use natural business English: 'realistically', 'to be honest', 'let's be clear on this', 'let's put a number on it'.\n\nSample opener style: 'Hi, David from the IE department. I have your spec sheet in front of me. Is this still the latest version?'\n\nYou are roleplaying an experienced Chinese flyknit / warp-knit / woven / weft-knit factory engineer talking to a Chinese footwear / apparel / fabric buyer or merchandiser with 2-5 years of experience. The user is practicing professional English for production discussions.\n\nPersona: mid-level technical engineer. Speaks in 15-25 word sentences. Uses standard industry vocabulary (gauge, jacquard, guide bar, EPI/PPI, GSM, courses/wales, rib, interlock, fleece). Defines new terms only when clearly needed.\n\nBehavior rules:\n- Stay in character. Open with a clear purpose. Push the conversation forward: ask for numbers, ask for confirmation, push back on vague answers.\n- The current scenario is: {{scenario_title}}. Stay within that scenario's typical agenda \u2014 for flyknit: upper design, yarn, gauge, lead time, QC; for warp knit: structure, guide bars, inlay, mesh; for shuttle: weave structure, EPI/PPI, loom type, finishing; for weft knit: circular vs flat, jersey/interlock/rib/fleece, GSM, shrinkage.\n- If the user gives a vague answer ('I will check'), push for a specific timeline ('by when exactly?').\n- Use natural business follow-ups: 'What gauge are you using?', 'What's the target EPI?', 'Can you send a hand sample first?', 'Is that FOB Shanghai?'\n- Use hesitation fillers sparingly ('well...', 'let me check', 'to be honest') \u2014 it makes the conversation feel real.\n- Correctness feedback is handled out-of-band. Do not correct the user mid-conversation.\n- Each turn: 2-5 sentences. End with a question or next-step prompt 80% of the time.\n- Use industry jargon correctly. The user is expected to know MOQ, lead time, FOB, GSM, yarn count, EPI, PPI, gauge, jacquard, interlock.\n- Always drive toward a clear next step: a sample yardage, a lab dip, a strike-off, a price quote, a delivery date.",
  advanced: "You are roleplaying a senior overseas buyer, sourcing director, or third-party compliance auditor on a high-stakes call with a Chinese garment & textile supplier. The user is a senior Chinese export manager, merchandiser, or factory owner. Both sides speak fluent, idiomatic business English.\n\nPersona: a sharp, time-pressed buyer who knows the industry cold. Speaks in 20-35 word sentences with native-level idioms, hedging ('realistically', 'to be frank', 'let's be honest'), and full trade jargon. Pushes hard on price, lead time, compliance, sustainability. Often tests the user's negotiation skill with curveballs ('our buyer is benchmarking us, where can you really go?').\n\nBehavior rules:\n- Stay in character. Use the current scenario: {{scenario_title}}. Drive toward a concrete outcome: a PO, a price lock, a commitment on lead time, an audit closing, or a negotiated solution.\n- Speak naturally: 'Look, ...', 'Here's the thing ...', 'I want to be straight with you ...', 'Let me push back on that ...', 'Off the top of my head ...'\n- Use advanced trade terms fluently: dE / colorfastness, DUPRO / PSI, AQL 1.5/2.5/4.0, Section 301 tariffs, MPF/HMF, GOTS / GRS / OCS, UFLPA, B/L, telex release, ETD/ETA, CY/CFS, BSCI / SEDEX / SA8000, REACH / ZDHC, SGS / BV / Intertek, FOB / CIF / DDP / DAP / EXW, LC at sight / LC 60 days, TT 30/70, debit note, rework, side letter, scope certificate, transaction certificate.\n- Challenge the user: ask cost breakdown, ask for written commitments, ask about subcontractors, ask for compliance docs.\n- If the user waffles, call it out: 'I need a number, not a song and dance.' If the user gives a weak concession, raise the bar: 'That's still 10 cents over the target, where else can you trim?'\n- If the user is sharp, reward them with softer follow-ups: 'Numbers like that, I respect.'\n- Correctness feedback is handled out-of-band. Do not correct the user mid-conversation. But you may mirror and rephrase to model correct phrasing if it fits naturally.\n- Each turn: 3-6 sentences. Push for closure: 'Let me put a bow on this ...', 'To summarize ...', 'What do I tell my boss?'\n- When the scenario is winding down, drive to a clear next step with a date: 'Send the PI by Friday, I'll have the PO on Tuesday.'\n- Tone: professional, direct, occasionally warm \u2014 never rude. Real senior buyers are direct, not aggressive.\n\nYou are a senior technical account manager from a Chinese yarn / fabric / dye-house / print-house / seamless-garment supplier, with 10+ years of industry experience. You are talking to a senior Chinese garment factory merchandiser who handles large overseas accounts and may have deeper technical knowledge than you in some areas. Use natural, idiomatic business English, freely use industry jargon and abbreviations (Ne / Nm / Tex, GSM, EPI, PPI, courses, wales, jacquard, interlock, pique, mercerized, pre-shrunk, reactive dye, sublimation, registration tolerance, gsm loss, MOQ, lead time, FOB, CIF, etc.). Push the user on edge cases: hand feel expectations, color fastness targets, shrink tolerance, registration accuracy, sample yardage, color matching against Pantone / lab dips, lab dip approval, pre-production sample, TOP sample. Challenge the user if a spec is unrealistic or not cost-feasible. Always drive the conversation forward: a quotation, a lab dip, a sample yardage, a confirmation letter. Stay in your role as the supplier at all times.\n\nYou are roleplaying a senior counterpart in a Chinese garment export business \u2014 a plant director, sourcing director, head of QC, or external QC auditor. The current scenario is: {{scenario_title}}.\n\nPersona: a sharp, time-pressed, native-fluent business counterpart who knows the industry cold. Speaks in 20 to 35 word sentences with hedging ('realistically', 'to be frank', 'let's be honest'), idioms, and full trade jargon. Pushes hard on cost, lead time, compliance, accountability, and system fixes. Often tests the user's seniority with curveball questions about root cause, RACI, side letters, QBR KPIs, and PDCA discipline.\n\nBehavior rules:\n- Stay in character. Use the current scenario's real agenda. Drive toward a concrete outcome: a cut-off decision, a price lock, a side letter, a credit note pool, a CAPA register, a QBR commitment, an SOP update.\n- Speak naturally: 'Look, ...', 'Here's the thing ...', 'I want to be straight with you ...', 'Let me push back on that ...', 'Off the top of my head ...', 'Numbers, not narratives'.\n- Use advanced trade terms fluently: SPI, marker efficiency, Delta E, lab dip, top sample, pre-fuse test, 4-point system, AQL 1.5/2.5/4.0, Proforma Invoice, TT 30/70, LC at sight, B/L copy, telex release, FTA cert, Mill Test Report, COPQ, FMEA, fishbone, RACI, KPI scorecard, leading vs lagging indicators, 8D, RC/CA, side letter, claim prevention, force majeure scope, government action carve-out.\n- Challenge the user: ask for a cost breakdown, a written commitment, a RACI per CAPA, a 30/60/90-day verification, an FMEA on the critical process, a QBR dashboard, a CAPA closure rate.\n- If the user waffles, call it out: 'I need a number, not a song and dance.' If the user gives a weak concession, raise the bar: 'That is still 0.3% over target, where else can you trim?'.\n- If the user is sharp, reward them with softer follow-ups: 'Numbers like that, I respect.'\n- Do not correct grammar mid-conversation. You may mirror and rephrase to model correct phrasing if it fits naturally.\n- Each turn: 3 to 6 sentences. Push for closure with a date and a written confirmation.\n- Tone: professional, direct, occasionally warm \u2014 never rude. Real senior counterparts are direct, not aggressive.\n- When the scenario is winding down, drive to a clear next step with a date and a paper trail: 'Send the side letter by Friday, we close on the next QBR.'\n\nSample opener style: 'Look, I am going to be straight with you. Last quarter we missed three KPIs in a row. I need a frank analysis and a new framework, not a rehash.'\n\nYou are roleplaying a senior Chinese flyknit / warp-knit / woven / weft-knit factory engineer or technical director talking to a senior Chinese footwear brand sourcing manager, fabric merchandiser, or apparel factory owner. Both sides speak fluent, idiomatic business English with deep technical knowledge.\n\nPersona: a sharp, time-pressed technical expert who knows the production line cold. Speaks in 20-35 word sentences with native-level idioms, hedging ('realistically', 'to be frank', 'let's be honest'), and full trade jargon.\n\nBehavior rules:\n- Stay in character. Use the current scenario: {{scenario_title}}. Drive toward a concrete outcome: a sample yardage, a lab dip approval, a confirmed price, a locked lead time, or a negotiated solution.\n- Speak naturally: 'Look, ...', 'Here's the thing ...', 'I want to be straight with you ...', 'Let me push back on that ...', 'Off the top of my head ...'\n- Use advanced technical terms fluently: gauge (E14/E15/E18), intarsia, jacquard, tuck stitch, miss stitch, guide bar (GB1/GB2/GB3), pillar stitch, inlay, full-width weft insertion, EPI, PPI, reed, heald frame, shedding, beat-up, take-up, let-off, air-jet loom, rapier loom, water-jet loom, projectile loom, dobby, jacquard, plain weave, twill, satin, courses per cm (CPC), wales per inch (WPI), circular knitting, flat knitting, interlock, rib 1x1, rib 2x2, pique, 3-thread fleece, terry, velour, sinker, cam arrangement.\n- Challenge the user: ask for cost breakdown, ask for written commitments, ask about yarn suppliers, ask for shrinkage and fastness data.\n- If the user waffles, call it out: 'I need a number, not a song and dance.' If the user gives a weak concession, raise the bar: 'That's still 3 days over, where else can you trim?'\n- If the user is sharp, reward them with softer follow-ups: 'Numbers like that, I respect.'\n- Correctness feedback is handled out-of-band. Do not correct the user mid-conversation, but you may mirror and rephrase to model correct phrasing if it fits naturally.\n- Each turn: 3-6 sentences. Push for closure: 'Let me put a bow on this ...', 'To summarize ...', 'What do I tell my boss?'\n- When the scenario is winding down, drive to a clear next step with a date: 'Send the artwork by Friday, I'll have the strike-off by next Wednesday.'\n- Tone: professional, direct, occasionally warm \u2014 never rude. Real senior engineers are direct, not aggressive."
};

// src/utils/logger.ts
function createLogger(scope) {
  const emit = /* @__PURE__ */ __name((level, msg, fields) => {
    const payload = {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      scope,
      msg,
      ...fields ?? {}
    };
    if (level === "error") console.error(JSON.stringify(payload));
    else if (level === "warn") console.warn(JSON.stringify(payload));
    else if (level === "debug") console.debug(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  }, "emit");
  return {
    debug: /* @__PURE__ */ __name((msg, fields) => emit("debug", msg, fields), "debug"),
    info: /* @__PURE__ */ __name((msg, fields) => emit("info", msg, fields), "info"),
    warn: /* @__PURE__ */ __name((msg, fields) => emit("warn", msg, fields), "warn"),
    error: /* @__PURE__ */ __name((msg, fields) => emit("error", msg, fields), "error")
  };
}
__name(createLogger, "createLogger");

// src/services/content.ts
var log = createLogger("content");
var _scenarios = null;
var _dialogs = null;
var _vocabulary = null;
var _systemPrompts = null;
var _loaded = false;
function safeParse(raw2, label) {
  try {
    return JSON.parse(raw2);
  } catch (err) {
    log.warn(`Failed to parse ${label}: ${err.message}`);
    return null;
  }
}
__name(safeParse, "safeParse");
function asObject(input, label) {
  if (input == null) return null;
  if (typeof input === "string") return safeParse(input, label);
  return input;
}
__name(asObject, "asObject");
function defaultScenarios() {
  return [
    {
      id: "phone_meeting",
      title_zh: "\u7535\u8BDD\u4F1A\u8BAE",
      title_en: "Phone Meeting",
      icon: "\u{1F4DE}",
      description_zh: "\u4E0E\u6D77\u5916\u5BA2\u6237\u521D\u6B21/\u8DDF\u8FDB\u901A\u8BDD",
      difficulty_levels: ["beginner", "intermediate", "advanced"],
      ai_role: "\u6D77\u5916\u91C7\u8D2D\u5546 / \u5BA2\u6237",
      user_role: "\u4E2D\u56FD\u5916\u8D38\u4E1A\u52A1\u5458(\u670D\u88C5\u7EBA\u7EC7)",
      key_skills: ["opening call", "presenting samples", "negotiating price", "closing"]
    }
  ];
}
__name(defaultScenarios, "defaultScenarios");
function defaultDialogs() {
  const map = /* @__PURE__ */ new Map();
  const scenarios = defaultScenarios();
  for (const s of scenarios) {
    const rounds = [
      {
        round: 1,
        ai_message: `Hello, this is Mark from ABC Trading in New York. May I speak with Mr. Chen about the ${s.title_en}?`,
        ai_message_zh: "\u4F60\u597D,\u6211\u662F\u7EBD\u7EA6 ABC Trading \u7684 Mark,\u8BF7\u95EE\u9648\u5148\u751F\u5728\u5417?",
        expected_user_response_hint: "\u81EA\u6211\u4ECB\u7ECD\u5E76\u8BE2\u95EE\u6765\u610F",
        key_phrases: ["This is ...", "May I speak with ...", "How can I help you"],
        common_mistakes: "\u4E2D\u5F0F\u82F1\u8BED:This is Mark speaking \u540E\u9762\u4E0D\u8981\u52A0 I am",
        tips_zh: "\u63A5\u7535\u8BDD\u5148\u81EA\u62A5\u516C\u53F8,\u4E0D\u8981\u53EA\u62A5\u540D\u5B57"
      }
    ];
    map.set(s.id, [{ scenario_id: s.id, difficulty: "beginner", rounds }]);
  }
  return map;
}
__name(defaultDialogs, "defaultDialogs");
function defaultSystemPrompts() {
  return {
    beginner: "You are a friendly overseas buyer speaking with a Chinese garment export salesperson. Use simple, short sentences. Speak slowly. Stay in character. Keep each reply under 60 words. Industry context: apparel & textile.",
    intermediate: "You are an experienced overseas buyer (apparel / textile). Use natural business English, medium-length sentences. Stay in character. Keep replies under 90 words. Ask follow-up questions to push the conversation forward.",
    advanced: "You are a sharp, time-pressed overseas buyer / sourcing manager in the apparel & textile industry. Use idiomatic business English. Keep replies under 120 words but expect substantive answers. Push back on weak arguments."
  };
}
__name(defaultSystemPrompts, "defaultSystemPrompts");
function difficultyFileSuffix(d) {
  return d === "beginner" ? "" : `_${d}`;
}
__name(difficultyFileSuffix, "difficultyFileSuffix");
var dialogModules = import.meta.glob(
  "../../content/dialogs/*.json",
  { eager: true }
);
function extractDialogModule(entry) {
  if (entry && typeof entry === "object" && "default" in entry) {
    return entry.default;
  }
  return entry;
}
__name(extractDialogModule, "extractDialogModule");
function loadAll() {
  if (_loaded) return;
  log.info("Loading bundled content");
  const scenarios = asObject(scenarios_default, "scenarios.json");
  if (scenarios && Array.isArray(scenarios) && scenarios.length > 0) {
    _scenarios = scenarios;
    log.info(`Loaded ${scenarios.length} scenarios`);
  } else {
    log.warn("scenarios.json missing/empty; using defaults");
    _scenarios = defaultScenarios();
  }
  const dialogsMap = /* @__PURE__ */ new Map();
  const allDifficulties = ["beginner", "intermediate", "advanced"];
  for (const s of _scenarios) {
    const list = [];
    for (const diff of allDifficulties) {
      if (!s.difficulty_levels.includes(diff)) continue;
      const filename = `${s.id}${difficultyFileSuffix(diff)}.json`;
      const moduleEntry = Object.entries(dialogModules).find(
        ([path]) => path.endsWith(`/dialogs/${filename}`)
      );
      let data = moduleEntry ? extractDialogModule(moduleEntry[1]) : null;
      if (!data && diff !== "beginner") {
        const fallbackEntry = Object.entries(dialogModules).find(
          ([path]) => path.endsWith(`/dialogs/${s.id}.json`)
        );
        data = fallbackEntry ? extractDialogModule(fallbackEntry[1]) : null;
      }
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry && Array.isArray(entry.rounds)) {
            list.push({ ...entry, difficulty: entry.difficulty ?? diff });
          }
        }
      } else if (data && Array.isArray(data.rounds)) {
        list.push({ ...data, difficulty: diff });
      }
    }
    if (list.length === 0) {
      const defaults = defaultDialogs().get(s.id) ?? [];
      list.push(...defaults);
    }
    dialogsMap.set(s.id, list);
  }
  _dialogs = dialogsMap;
  const vocab = asObject(vocabulary_default, "vocabulary.json");
  if (vocab && Array.isArray(vocab) && vocab.length > 0) {
    _vocabulary = vocab;
    log.info(`Loaded ${vocab.length} vocabulary entries`);
  } else {
    log.warn("vocabulary.json missing/empty");
    _vocabulary = [];
  }
  const sp = asObject(system_prompts_default, "system_prompts.json");
  if (sp && typeof sp === "object" && (sp.beginner || sp.intermediate || sp.advanced)) {
    _systemPrompts = sp;
    log.info("Loaded system prompts");
  } else {
    log.warn("system_prompts.json missing/invalid; using defaults");
    _systemPrompts = defaultSystemPrompts();
  }
  _loaded = true;
}
__name(loadAll, "loadAll");
function getScenarios() {
  if (!_loaded) loadAll();
  return _scenarios ?? [];
}
__name(getScenarios, "getScenarios");
function getScenarioById(id) {
  if (!_loaded) loadAll();
  return (_scenarios ?? []).find((s) => s.id === id) ?? null;
}
__name(getScenarioById, "getScenarioById");
function getDialogsForScenario(scenarioId) {
  if (!_loaded) loadAll();
  return _dialogs?.get(scenarioId) ?? [];
}
__name(getDialogsForScenario, "getDialogsForScenario");
function getDialogForRound(scenarioId, difficulty, roundIndex) {
  const list = getDialogsForScenario(scenarioId);
  const entry = list.find((d) => d.difficulty === difficulty) ?? list[0];
  if (!entry) return null;
  const idx = Math.max(0, Math.min(roundIndex, entry.rounds.length - 1));
  return entry.rounds[idx] ?? null;
}
__name(getDialogForRound, "getDialogForRound");
function getSystemPrompt(difficulty) {
  if (!_loaded) loadAll();
  const sp = _systemPrompts ?? defaultSystemPrompts();
  return sp[difficulty] ?? sp.intermediate;
}
__name(getSystemPrompt, "getSystemPrompt");
function getVocabulary() {
  if (!_loaded) loadAll();
  return _vocabulary ?? [];
}
__name(getVocabulary, "getVocabulary");

// src/routes/scenarios.ts
var scenariosRoutes = new Hono2();
scenariosRoutes.get("/api/scenarios", (c) => {
  try {
    const list = getScenarios();
    return c.json({ items: list, count: list.length });
  } catch (err) {
    return c.json(
      { error: { code: "SCENARIOS_LIST_FAILED", message: err.message } },
      500
    );
  }
});
scenariosRoutes.get("/api/scenarios/:id", (c) => {
  const id = c.req.param("id");
  try {
    const scenario = getScenarioById(id);
    if (!scenario) {
      return c.json(
        { error: { code: "SCENARIO_NOT_FOUND", message: `scenario '${id}' not found` } },
        404
      );
    }
    const dialogs = getDialogsForScenario(id);
    return c.json({ scenario, dialogs });
  } catch (err) {
    return c.json(
      { error: { code: "SCENARIO_FETCH_FAILED", message: err.message } },
      500
    );
  }
});

// src/db.ts
async function runAsync(db, sql, args = []) {
  const stmt = db.prepare(sql).bind(...args);
  const r = await stmt.run();
  return {
    rowsAffected: r.meta.changes ?? 0,
    lastInsertRowid: Number(r.meta.last_row_id ?? 0)
  };
}
__name(runAsync, "runAsync");
async function getAsync(db, sql, args = []) {
  const stmt = db.prepare(sql).bind(...args);
  const row = await stmt.first();
  return row ?? void 0;
}
__name(getAsync, "getAsync");
async function allAsync(db, sql, args = []) {
  const stmt = db.prepare(sql).bind(...args);
  const r = await stmt.all();
  return r.results ?? [];
}
__name(allAsync, "allAsync");
async function bootstrapDb(db) {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      mode TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      total_score REAL,
      status TEXT NOT NULL DEFAULT 'active',
      round_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT,
      score REAL,
      fluency REAL,
      accuracy REAL,
      feedback_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS vocabulary_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL UNIQUE,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      last_seen INTEGER NOT NULL
    )`
  ];
  for (const sql of migrations) {
    await db.prepare(sql).run();
  }
}
__name(bootstrapDb, "bootstrapDb");

// src/services/session-manager.ts
var log2 = createLogger("session-manager");
function now() {
  return Date.now();
}
__name(now, "now");
function isValidDifficulty(d) {
  return d === "beginner" || d === "intermediate" || d === "advanced";
}
__name(isValidDifficulty, "isValidDifficulty");
function isValidMode(m) {
  return m === "free" || m === "repeat";
}
__name(isValidMode, "isValidMode");
function isValidRole(r) {
  return r === "user" || r === "assistant" || r === "system";
}
__name(isValidRole, "isValidRole");
var ValidationError = class extends Error {
  static {
    __name(this, "ValidationError");
  }
  code = "VALIDATION_ERROR";
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};
var NotFoundError = class extends Error {
  static {
    __name(this, "NotFoundError");
  }
  code = "NOT_FOUND";
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
};
async function createSession(db, input) {
  if (!isValidDifficulty(input.difficulty)) {
    throw new ValidationError(`invalid difficulty: ${String(input.difficulty)}`);
  }
  if (!isValidMode(input.mode)) {
    throw new ValidationError(`invalid mode: ${String(input.mode)}`);
  }
  if (!input.scenario_id || typeof input.scenario_id !== "string") {
    throw new ValidationError("scenario_id is required");
  }
  const id = crypto.randomUUID();
  const record = {
    id,
    scenario_id: input.scenario_id,
    difficulty: input.difficulty,
    mode: input.mode,
    started_at: now(),
    ended_at: null,
    total_score: null,
    status: "active",
    round_index: 0
  };
  try {
    await runAsync(
      db,
      `INSERT INTO sessions (id, scenario_id, difficulty, mode, started_at, status, round_index)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [record.id, record.scenario_id, record.difficulty, record.mode, record.started_at, record.status]
    );
  } catch (err) {
    log2.error(`Failed to insert session: ${err.message}`);
    throw err;
  }
  return record;
}
__name(createSession, "createSession");
function rowToSession(row) {
  if (!isValidDifficulty(row.difficulty) || !isValidMode(row.mode)) return null;
  return {
    id: row.id,
    scenario_id: row.scenario_id,
    difficulty: row.difficulty,
    mode: row.mode,
    started_at: row.started_at,
    ended_at: row.ended_at,
    total_score: row.total_score,
    status: row.status === "completed" ? "completed" : "active",
    round_index: row.round_index ?? 0
  };
}
__name(rowToSession, "rowToSession");
async function getSession(db, id) {
  if (!id) return null;
  try {
    const row = await getAsync(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return rowToSession(row);
  } catch (err) {
    log2.warn(`getSession failed for ${id}: ${err.message}`);
    return null;
  }
}
__name(getSession, "getSession");
function rowToMessage(r) {
  if (!isValidRole(r.role)) return null;
  return {
    id: r.id,
    session_id: r.session_id,
    role: r.role,
    content: r.content,
    audio_url: r.audio_url,
    score: r.score,
    fluency: r.fluency,
    accuracy: r.accuracy,
    feedback_json: r.feedback_json,
    created_at: r.created_at
  };
}
__name(rowToMessage, "rowToMessage");
async function getMessages(db, sessionId) {
  try {
    const rows = await allAsync(
      db,
      `SELECT id, session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at
       FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`,
      [sessionId]
    );
    return rows.map(rowToMessage).filter((m) => m !== null);
  } catch (err) {
    log2.warn(`getMessages failed for ${sessionId}: ${err.message}`);
    return [];
  }
}
__name(getMessages, "getMessages");
async function appendMessage(db, sessionId, input) {
  if (!isValidRole(input.role)) {
    throw new ValidationError(`invalid role: ${String(input.role)}`);
  }
  const createdAt = now();
  const feedbackJson = input.score ? JSON.stringify(input.score) : null;
  const { lastInsertRowid } = await runAsync(
    db,
    `INSERT INTO messages (session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      input.role,
      input.content,
      input.audioUrl ?? null,
      input.score?.overall_score ?? null,
      input.score?.fluency ?? null,
      input.score?.accuracy ?? null,
      feedbackJson,
      createdAt
    ]
  );
  return {
    id: lastInsertRowid,
    session_id: sessionId,
    role: input.role,
    content: input.content,
    audio_url: input.audioUrl ?? null,
    score: input.score?.overall_score ?? null,
    fluency: input.score?.fluency ?? null,
    accuracy: input.score?.accuracy ?? null,
    feedback_json: feedbackJson,
    created_at: createdAt
  };
}
__name(appendMessage, "appendMessage");
async function advanceRound(db, sessionId) {
  const rec = await getSession(db, sessionId);
  if (!rec) return 0;
  const next = rec.round_index + 1;
  try {
    await runAsync(db, `UPDATE sessions SET round_index = ? WHERE id = ?`, [next, sessionId]);
  } catch (err) {
    log2.warn(`Failed to advance round: ${err.message}`);
  }
  return next;
}
__name(advanceRound, "advanceRound");
async function completeSession(db, sessionId, totalScore) {
  const rec = await getSession(db, sessionId);
  if (!rec) return null;
  const endedAt = now();
  try {
    await runAsync(
      db,
      `UPDATE sessions SET ended_at = ?, total_score = ?, status = 'completed' WHERE id = ?`,
      [endedAt, totalScore, sessionId]
    );
  } catch (err) {
    log2.error(`Failed to complete session: ${err.message}`);
    throw err;
  }
  const messages = await getMessages(db, sessionId);
  return {
    totalScore: totalScore ?? 0,
    messageCount: messages.length,
    durationSec: Math.max(0, Math.round((endedAt - rec.started_at) / 1e3))
  };
}
__name(completeSession, "completeSession");
function toLlmContext(messages) {
  return messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }));
}
__name(toLlmContext, "toLlmContext");

// src/env.ts
function getMiniMaxEnv(env) {
  const apiKey = (env.MINIMAX_API_KEY ?? "").trim();
  return {
    apiKey,
    groupId: (env.MINIMAX_GROUP_ID ?? "").trim(),
    apiBase: (env.API_BASE ?? "https://api.minimax.chat").replace(/\/$/, ""),
    ttsVoice: env.MINIMAX_TTS_VOICE ?? "male-qn-qingse",
    ttsModel: env.MINIMAX_TTS_MODEL ?? "speech-2.8-turbo",
    asrModel: env.MINIMAX_ASR_MODEL ?? "asr-01",
    llmModel: env.MINIMAX_LLM_MODEL ?? "minimax-text-01",
    logLevel: env.LOG_LEVEL ?? "info"
  };
}
__name(getMiniMaxEnv, "getMiniMaxEnv");
function hasMiniMaxCredentials(mm) {
  return mm.apiKey.length > 0;
}
__name(hasMiniMaxCredentials, "hasMiniMaxCredentials");
function getAudioPublicBase(env) {
  return (env.AUDIO_PUBLIC_BASE ?? "").replace(/\/$/, "");
}
__name(getAudioPublicBase, "getAudioPublicBase");

// src/services/llm.ts
var log3 = createLogger("llm");
var SCORING_SYSTEM_PROMPT = `You are a friendly but rigorous English speaking coach for a Chinese export salesperson in the apparel & textile industry.

CRITICAL OUTPUT FORMAT \u2014 READ FIRST:
- Respond with ONLY a single valid JSON object. Nothing else.
- The FIRST character of your response must be { and the LAST character must be }.
- DO NOT wrap the JSON in markdown fences (no \`\`\`json or \`\`\`).
- DO NOT add any explanation, preamble, commentary, or prose before or after the JSON.
- DO NOT include any text outside the JSON object.
- The response must be parseable by JSON.parse() with zero preprocessing.
- If you violate this format, the system fails. JSON-only, always.

After each user utterance, evaluate it and return STRICT JSON with EXACTLY this shape (no prose, no markdown, no backticks):

{
  "overall_score": number,         // 0-100 integer
  "fluency": number,               // 0-100 integer
  "accuracy": number,              // 0-100 integer \u2014 grammar, vocabulary, collocation
  "key_issues": [string, string, string],  // up to 3 short English issue sentences (max 12 words each)
  "suggestion": string             // one English sentence of constructive advice (max 20 words)
}

Scoring rubric:
- 90-100: native-like, natural business English, no errors
- 75-89:  solid business English, minor slips
- 60-74:  understandable but noticeable grammar / word-choice issues
- 40-59:  frequent errors that may cause confusion
- 0-39:   hard to follow

Be honest, brief, and actionable. ALWAYS output valid JSON. Never wrap in markdown.

REMINDER: Your entire response must be a single JSON object starting with { and ending with }. No markdown, no fences, no prose outside the JSON. The first character is { and the last character is }.`;
function buildMockLlmResponse(req) {
  if (req.responseFormatJson && req.system.includes('"overall_score"')) {
    const mockScore = {
      overall_score: 78,
      fluency: 80,
      accuracy: 76,
      key_issues: [
        'Mind the article usage: "I am sales manager" needs "a sales manager".',
        "Use past simple for completed actions, not present perfect.",
        'Watch the preposition: "interested for" should be "interested in".'
      ],
      suggestion: "Read the sentence aloud once before sending; small prepositions often slip."
    };
    return {
      content: JSON.stringify(mockScore),
      model: "mock-minimax",
      mocked: true
    };
  }
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const reply = userText ? `(mock AI) I hear you \u2014 you said: "${userText.slice(0, 80)}". Let's continue.` : "(mock AI) Hello, how can I help you today?";
  return {
    content: reply,
    model: "mock-minimax",
    mocked: true
  };
}
__name(buildMockLlmResponse, "buildMockLlmResponse");
function buildRequestBody(req, mm) {
  const messages = [
    { role: "system", content: req.system },
    ...req.messages.map((m) => ({ role: m.role, content: m.content }))
  ];
  const body = {
    model: mm.llmModel,
    messages,
    temperature: req.temperature ?? 0.7
  };
  if (req.maxTokens !== void 0) body.max_tokens = req.maxTokens;
  return body;
}
__name(buildRequestBody, "buildRequestBody");
async function callRemote(mm, req) {
  const url = `${mm.apiBase}/v1/text/chatcompletion_v2`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${mm.apiKey}`
  };
  if (mm.groupId) headers["X-Group-Id"] = mm.groupId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3e4);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody(req, mm)),
      signal: controller.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`MiniMax LLM HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return {
      content,
      model: data.model ?? "unknown",
      mocked: false,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}
__name(callRemote, "callRemote");
async function chatCompletion(mm, req) {
  if (!hasMiniMaxCredentials(mm)) {
    log3.debug("No credentials, returning mock LLM response");
    return buildMockLlmResponse(req);
  }
  try {
    return await callRemote(mm, req);
  } catch (err) {
    log3.warn(`MiniMax LLM call failed, falling back to mock: ${err.message}`);
    const mock = buildMockLlmResponse(req);
    return { ...mock, content: mock.content + " [fallback]" };
  }
}
__name(chatCompletion, "chatCompletion");
function buildScoringSystemPrompt() {
  return SCORING_SYSTEM_PROMPT;
}
__name(buildScoringSystemPrompt, "buildScoringSystemPrompt");
function buildConversationSystemPrompt(scenarioSystemPrompt) {
  return `${scenarioSystemPrompt}

After the dialogue section, the user may request end-of-session feedback. When that happens, also return STRICT JSON with the exact same scoring shape as the scoring system prompt.`;
}
__name(buildConversationSystemPrompt, "buildConversationSystemPrompt");

// src/services/tts.ts
var log4 = createLogger("tts");
function buildMockTtsResponse() {
  const silentMp3 = new Uint8Array([
    255,
    251,
    144,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ]);
  return {
    audio: silentMp3.buffer,
    mime: "audio/mpeg",
    mocked: true
  };
}
__name(buildMockTtsResponse, "buildMockTtsResponse");
function hexToUint8Array(hex) {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}
__name(hexToUint8Array, "hexToUint8Array");
function buildRequestBody2(req, mm) {
  const voiceId = req.voiceId ?? mm.ttsVoice;
  const format = req.format ?? "mp3";
  const sampleRate = req.sampleRate ?? 24e3;
  return {
    model: mm.ttsModel,
    text: req.text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed: req.speed ?? 1,
      vol: req.volume ?? 1,
      pitch: req.pitch ?? 0
    },
    audio_setting: {
      audio_sample_rate: sampleRate,
      bit_rate: 128e3,
      format,
      channel: 1
    }
  };
}
__name(buildRequestBody2, "buildRequestBody");
async function callRemote2(mm, req) {
  const url = `${mm.apiBase}/v1/t2a_v2`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${mm.apiKey}`
  };
  if (mm.groupId) headers["X-Group-Id"] = mm.groupId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3e4);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody2(req, mm)),
      signal: controller.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`MiniMax TTS HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const statusCode = data?.base_resp?.status_code ?? 0;
    if (statusCode !== 0) {
      throw new Error(`MiniMax TTS API error [${statusCode}]: ${data?.base_resp?.status_msg ?? "unknown"}`);
    }
    const encoded = data.data?.audio ?? data.audio;
    if (!encoded) {
      throw new Error("MiniMax TTS response did not include audio data");
    }
    const looksLikeHex = /^[0-9a-fA-F]+$/.test(encoded) && encoded.length % 2 === 0;
    const audio = looksLikeHex ? hexToUint8Array(encoded) : Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    return {
      audio: audio.buffer,
      mime: "audio/mpeg",
      mocked: false
    };
  } finally {
    clearTimeout(timeout);
  }
}
__name(callRemote2, "callRemote");
async function textToAudio(mm, req) {
  if (!hasMiniMaxCredentials(mm)) {
    log4.debug("No credentials, returning mock TTS (silent mp3 header)");
    return buildMockTtsResponse();
  }
  try {
    return await callRemote2(mm, req);
  } catch (err) {
    log4.warn(`MiniMax TTS failed, falling back to mock: ${err.message}`);
    return buildMockTtsResponse();
  }
}
__name(textToAudio, "textToAudio");
var TTS_DEFAULT_VOICE = "male-qn-qingse";

// src/services/asr.ts
var log5 = createLogger("asr");
function asrWsUrl(mm) {
  let wsBase;
  if (mm.apiBase.startsWith("https://")) wsBase = mm.apiBase.replace(/^https/, "wss");
  else if (mm.apiBase.startsWith("http://")) wsBase = mm.apiBase.replace(/^http/, "ws");
  else wsBase = mm.apiBase;
  return `${wsBase}/v1/asr?model=${encodeURIComponent(mm.asrModel)}&language=en&format=mp3`;
}
__name(asrWsUrl, "asrWsUrl");
function transcribeBufferMock() {
  return { text: "", confidence: 0, language: "en", mocked: true };
}
__name(transcribeBufferMock, "transcribeBufferMock");
var AsrSession = class {
  static {
    __name(this, "AsrSession");
  }
  url;
  mm;
  ws = null;
  opened = false;
  closed = false;
  lastPartial = "";
  finalText = "";
  resolveFinal = null;
  rejectFinal = null;
  finalReceived = false;
  options;
  mockMode;
  constructor(mm, options = {}) {
    this.mm = mm;
    this.options = options;
    this.mockMode = !hasMiniMaxCredentials(mm);
    this.url = asrWsUrl(mm);
  }
  open() {
    if (this.mockMode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        this.ws = ws;
        ws.addEventListener("open", () => {
          this.opened = true;
          try {
            ws.send(
              JSON.stringify({
                type: "auth",
                api_key: this.mm.apiKey,
                group_id: this.mm.groupId,
                model: this.mm.asrModel,
                language: this.options.language ?? "en",
                sample_rate: this.options.sampleRate ?? 16e3
              })
            );
          } catch (err) {
            log5.warn(`ASR auth send failed: ${err.message}`);
          }
          resolve();
        });
        ws.addEventListener("error", (evt) => {
          const err = evt.error ?? new Error("ASR socket error");
          if (!this.opened) reject(err);
          else this.fail(err);
        });
        ws.addEventListener("message", (evt) => {
          let asrEvt;
          try {
            const text = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
            asrEvt = JSON.parse(text);
          } catch {
            log5.warn("ASR non-JSON message received, ignoring");
            return;
          }
          this.handleEvent(asrEvt);
        });
        ws.addEventListener("close", () => {
          if (!this.finalReceived) this.fail(new Error("ASR socket closed before final transcript"));
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  handleEvent(evt) {
    if (evt.error) {
      this.fail(new Error(`ASR error ${evt.error.code ?? ""}: ${evt.error.message ?? ""}`));
      return;
    }
    if (evt.type === "transcript_partial" && typeof evt.text === "string") {
      this.lastPartial = evt.text;
      return;
    }
    if (evt.type === "transcript_final" && typeof evt.text === "string") {
      this.finalReceived = true;
      this.finalText = evt.text;
      const result = {
        text: evt.text,
        confidence: evt.confidence,
        language: evt.language,
        mocked: false
      };
      if (this.resolveFinal) this.resolveFinal(result);
      this.close();
      return;
    }
  }
  sendAudio(chunk) {
    if (this.mockMode) return;
    if (!this.ws || !this.opened) return;
    try {
      const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      this.ws.send(data);
    } catch (err) {
      log5.warn(`ASR send failed: ${err.message}`);
    }
  }
  finish() {
    if (this.closed) {
      return Promise.resolve({ text: this.finalText, mocked: false });
    }
    if (this.mockMode) {
      this.closed = true;
      return Promise.resolve({ text: "", mocked: true, confidence: 0, language: "en" });
    }
    return new Promise((resolve, reject) => {
      this.resolveFinal = resolve;
      this.rejectFinal = reject;
      try {
        if (this.ws && this.opened) {
          this.ws.send(JSON.stringify({ type: "finish" }));
        } else {
          reject(new Error("ASR session not open"));
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  getLastPartial() {
    return this.lastPartial;
  }
  getFinalText() {
    return this.finalText;
  }
  close() {
    this.closed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        log5.warn(`ASR close failed: ${err.message}`);
      }
      this.ws = null;
    }
  }
  fail(err) {
    if (this.rejectFinal) {
      this.rejectFinal(err);
      this.rejectFinal = null;
      this.resolveFinal = null;
    }
    this.close();
  }
};
async function transcribeBuffer(mm, audio, options = {}) {
  if (!hasMiniMaxCredentials(mm)) {
    return transcribeBufferMock();
  }
  const session = new AsrSession(mm, options);
  try {
    await session.open();
    session.sendAudio(audio);
    const result = await session.finish();
    return result;
  } catch (err) {
    log5.warn(`ASR failed, returning mock: ${err.message}`);
    return transcribeBufferMock();
  } finally {
    session.close();
  }
}
__name(transcribeBuffer, "transcribeBuffer");

// src/services/scoring.ts
var log6 = createLogger("scoring");
var FALLBACK = {
  overall_score: 70,
  fluency: 70,
  accuracy: 70,
  key_issues: ["No major issues detected."],
  suggestion: "Keep practicing with native speakers to improve fluency."
};
function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
__name(clamp, "clamp");
function safeParseScore(raw2) {
  if (!raw2) return null;
  let cleaned = raw2.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed;
    const issuesRaw = obj.key_issues;
    const issues = Array.isArray(issuesRaw) ? issuesRaw.filter((s) => typeof s === "string").slice(0, 3) : [];
    return {
      overall_score: clamp(Number(obj.overall_score ?? 0), 0, 100),
      fluency: clamp(Number(obj.fluency ?? 0), 0, 100),
      accuracy: clamp(Number(obj.accuracy ?? 0), 0, 100),
      key_issues: issues.length > 0 ? issues : FALLBACK.key_issues,
      suggestion: typeof obj.suggestion === "string" ? obj.suggestion : FALLBACK.suggestion
    };
  } catch {
    return null;
  }
}
__name(safeParseScore, "safeParseScore");
async function scoreWithLlm(mm, userUtterance, contextMessages) {
  const messages = [
    ...contextMessages.slice(-6),
    { role: "user", content: userUtterance }
  ];
  try {
    const resp = await chatCompletion(mm, {
      system: buildScoringSystemPrompt(),
      messages,
      temperature: 0.3,
      maxTokens: 400,
      responseFormatJson: true
    });
    const parsed = safeParseScore(resp.content);
    if (parsed) return parsed;
    log6.warn(`LLM score JSON unparseable, using fallback. raw=${resp.content.slice(0, 120)}`);
    return FALLBACK;
  } catch (err) {
    log6.warn(`scoreWithLlm failed: ${err.message}`);
    return FALLBACK;
  }
}
__name(scoreWithLlm, "scoreWithLlm");
function normaliseForCompare(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
__name(normaliseForCompare, "normaliseForCompare");
function tokenSet(s) {
  return new Set(normaliseForCompare(s).split(" ").filter((t) => t.length > 0));
}
__name(tokenSet, "tokenSet");
function jaccardSimilarity(a, b) {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (aSet.size === 0 && bSet.size === 0) return 1;
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const t of aSet) if (bSet.has(t)) inter++;
  const uni = aSet.size + bSet.size - inter;
  return uni === 0 ? 0 : inter / uni;
}
__name(jaccardSimilarity, "jaccardSimilarity");
function scoreRepeat(target, userText) {
  if (!userText || !userText.trim()) {
    return {
      overall_score: 0,
      fluency: 0,
      accuracy: 0,
      key_issues: ["No speech detected. Please try again and speak clearly."],
      suggestion: "Press the record button and speak the sentence once more."
    };
  }
  const sim = jaccardSimilarity(target, userText);
  const overall = Math.round(sim * 100);
  const fluency = Math.round(sim * 100);
  const accuracy = Math.round(sim * 100);
  const targetTokens = tokenSet(target);
  const userTokens = tokenSet(userText);
  const missing = [];
  for (const t of targetTokens) if (!userTokens.has(t)) missing.push(t);
  const extra = [];
  for (const t of userTokens) if (!targetTokens.has(t)) extra.push(t);
  const keyIssues = [];
  if (missing.length > 0) keyIssues.push(`Missing words: ${missing.slice(0, 5).join(", ")}.`);
  if (extra.length > 0) keyIssues.push(`Extra / wrong words: ${extra.slice(0, 5).join(", ")}.`);
  if (sim < 0.5) keyIssues.push("Try to match the target sentence word-for-word first.");
  if (keyIssues.length === 0) keyIssues.push("Nice match \u2014 try saying it once more with smoother rhythm.");
  if (keyIssues.length > 3) keyIssues.length = 3;
  let suggestion;
  if (overall >= 90) suggestion = "Excellent match \u2014 focus on natural rhythm and intonation next.";
  else if (overall >= 70) suggestion = "Good \u2014 listen to the target once more and repeat with clearer word boundaries.";
  else if (overall >= 40) suggestion = "Re-listen to the target sentence and emphasise the content words.";
  else suggestion = "Re-play the target sentence, then repeat slowly word by word.";
  return {
    overall_score: clamp(overall, 0, 100),
    fluency: clamp(fluency, 0, 100),
    accuracy: clamp(accuracy, 0, 100),
    key_issues: keyIssues,
    suggestion
  };
}
__name(scoreRepeat, "scoreRepeat");

// src/services/audio.ts
var log7 = createLogger("audio");
async function saveAudioForSession(env, sessionId, audio, mime) {
  const publicBase = getAudioPublicBase(env);
  if (!publicBase) {
    log7.warn("AUDIO_PUBLIC_BASE not set \u2014 returning empty URL (frontend will fall back to base64 path)");
    return "";
  }
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const key = `audio/${sessionId}/${filename}`;
  try {
    await env.AUDIO.put(key, audio, {
      httpMetadata: { contentType: mime || "audio/mpeg" }
    });
    return `${publicBase}/${key}`;
  } catch (err) {
    log7.warn(`R2 put failed for ${key}: ${err.message}`);
    return "";
  }
}
__name(saveAudioForSession, "saveAudioForSession");

// src/routes/sessions.ts
var sessionsRoutes = new Hono2();
function isValidDifficulty2(d) {
  return d === "beginner" || d === "intermediate" || d === "advanced";
}
__name(isValidDifficulty2, "isValidDifficulty");
function isValidMode2(m) {
  return m === "free" || m === "repeat";
}
__name(isValidMode2, "isValidMode");
sessionsRoutes.post("/api/sessions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.scenario_id || typeof body.scenario_id !== "string") {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "scenario_id is required" } }, 400);
  }
  if (!isValidDifficulty2(body.difficulty)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "difficulty must be beginner|intermediate|advanced" } },
      400
    );
  }
  if (!isValidMode2(body.mode)) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "mode must be free|repeat" } }, 400);
  }
  const scenario = getScenarioById(body.scenario_id);
  if (!scenario) {
    return c.json(
      { error: { code: "SCENARIO_NOT_FOUND", message: `scenario '${body.scenario_id}' not found` } },
      404
    );
  }
  try {
    const rec = await createSession(c.env.DB, {
      scenario_id: body.scenario_id,
      difficulty: body.difficulty,
      mode: body.mode
    });
    return c.json(
      {
        session_id: rec.id,
        scenario_id: rec.scenario_id,
        difficulty: rec.difficulty,
        mode: rec.mode,
        status: rec.status,
        started_at: rec.started_at
      },
      201
    );
  } catch (err) {
    return c.json(
      { error: { code: "SESSION_CREATE_FAILED", message: err.message } },
      500
    );
  }
});
sessionsRoutes.get("/api/sessions/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const rec = await getSession(c.env.DB, id);
    if (!rec) {
      return c.json(
        { error: { code: "SESSION_NOT_FOUND", message: `session '${id}' not found` } },
        404
      );
    }
    const messages = await getMessages(c.env.DB, id);
    const userTurns = messages.filter((m) => m.role === "user");
    const scoresArr = userTurns.map((m) => typeof m.score === "number" ? m.score : null).filter((s) => s !== null);
    const avgScore = scoresArr.length > 0 ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length) : null;
    return c.json({
      ...rec,
      message_count: messages.length,
      user_turn_count: userTurns.length,
      avg_score: avgScore
    });
  } catch (err) {
    return c.json(
      { error: { code: "SESSION_FETCH_FAILED", message: err.message } },
      500
    );
  }
});
sessionsRoutes.get("/api/sessions/:id/prompts", async (c) => {
  try {
    const rec = await getSession(c.env.DB, c.req.param("id"));
    if (!rec) {
      return c.json(
        { error: { code: "SESSION_NOT_FOUND", message: `session '${c.req.param("id")}' not found` } },
        404
      );
    }
    const requestedDifficulty = c.req.query("difficulty");
    const difficulty = requestedDifficulty && isValidDifficulty2(requestedDifficulty) ? requestedDifficulty : rec.difficulty;
    const dialogs = getDialogsForScenario(rec.scenario_id);
    const entry = dialogs.find((d) => d.difficulty === difficulty) ?? dialogs[0];
    if (!entry || !Array.isArray(entry.rounds) || entry.rounds.length === 0) {
      return c.json({ items: [] });
    }
    const items = entry.rounds.map((r) => {
      const text = r.ai_message ?? "";
      if (!text) return null;
      return {
        id: String(r.round),
        text,
        translation: r.ai_message_zh,
        difficulty: entry.difficulty
      };
    }).filter((p) => p !== null);
    return c.json({ items });
  } catch (err) {
    return c.json(
      { error: { code: "PROMPTS_FAILED", message: err.message } },
      500
    );
  }
});
sessionsRoutes.post("/api/sessions/:id/messages", async (c) => {
  const id = c.req.param("id");
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: "SESSION_NOT_FOUND", message: `session '${id}' not found` } }, 404);
  }
  if (rec.status === "completed") {
    return c.json({ error: { code: "SESSION_COMPLETED", message: "session is already completed" } }, 409);
  }
  const body = await c.req.json().catch(() => ({}));
  let userText = typeof body.content === "string" ? body.content.trim() : "";
  const effectiveMode = isValidMode2(body.mode) ? body.mode : rec.mode;
  const mm = getMiniMaxEnv(c.env);
  if (!userText && typeof body.audio_base64 === "string" && body.audio_base64.length > 0) {
    try {
      const bin = atob(body.audio_base64);
      const audio = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
      const asr = await transcribeBuffer(mm, audio, { language: "en" });
      userText = (asr.text ?? "").trim();
      if (!userText) userText = "(no speech detected)";
    } catch (err) {
      userText = "(asr failed: " + err.message + ")";
    }
  }
  if (!userText) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "content or audio_base64 is required" } },
      400
    );
  }
  try {
    const userMsg = await appendMessage(c.env.DB, id, { role: "user", content: userText });
    const priorMessages = (await getMessages(c.env.DB, id)).filter((m) => m.id !== userMsg.id);
    const llmContext = toLlmContext(priorMessages);
    let score;
    if (effectiveMode === "repeat") {
      const targetDialog = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index);
      const target = targetDialog?.ai_message ?? "";
      score = scoreRepeat(target, userText);
    } else {
      score = await scoreWithLlm(mm, userText, llmContext);
    }
    try {
      await runAsync(
        c.env.DB,
        `UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`,
        [
          score.overall_score,
          score.fluency,
          score.accuracy,
          JSON.stringify(score),
          userMsg.id
        ]
      );
      userMsg.score = score.overall_score;
      userMsg.fluency = score.fluency;
      userMsg.accuracy = score.accuracy;
      userMsg.feedback_json = JSON.stringify(score);
    } catch {
    }
    let aiMessage = "";
    let audioUrl = null;
    if (effectiveMode === "repeat") {
      const targetDialog = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index);
      const target = targetDialog?.ai_message ?? "";
      aiMessage = score.overall_score >= 80 ? `Great job! You said: "${userText}". Let's move to the next sentence.` : `Good try. The target was: "${target}". Please listen and try again.`;
    } else {
      const systemPrompt = buildConversationSystemPrompt(getSystemPrompt(rec.difficulty));
      const contextMessages = [
        ...llmContext,
        { role: "user", content: userText }
      ];
      try {
        const resp = await chatCompletion(mm, {
          system: systemPrompt,
          messages: contextMessages,
          temperature: 0.7,
          maxTokens: 350
        });
        aiMessage = (resp.content ?? "").trim() || "(empty AI reply)";
      } catch (err) {
        aiMessage = `(AI unavailable: ${err.message})`;
      }
    }
    if (aiMessage && aiMessage.length > 0) {
      try {
        const tts = await textToAudio(mm, { text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
        if (!tts.mocked) {
          const url = await saveAudioForSession(c.env, id, tts.audio, tts.mime);
          audioUrl = url || null;
        }
      } catch {
      }
    }
    const aiMsg = await appendMessage(c.env.DB, id, { role: "assistant", content: aiMessage, audioUrl });
    await advanceRound(c.env.DB, id);
    return c.json({
      user_message: {
        id: userMsg.id,
        content: userMsg.content,
        created_at: userMsg.created_at
      },
      ai_message: aiMsg.content,
      ai_audio_url: aiMsg.audio_url,
      score,
      round_index: rec.round_index
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    }
    if (err instanceof NotFoundError) {
      return c.json({ error: { code: err.code, message: err.message } }, 404);
    }
    return c.json({ error: { code: "MESSAGE_FAILED", message: err.message } }, 500);
  }
});
sessionsRoutes.post("/api/sessions/:id/transcribe", async (c) => {
  const id = c.req.param("id");
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: "SESSION_NOT_FOUND", message: `session '${id}' not found` } }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.audio_base64 !== "string" || body.audio_base64.length === 0) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "audio_base64 is required" } }, 400);
  }
  try {
    const mm = getMiniMaxEnv(c.env);
    const bin = atob(body.audio_base64);
    const audio = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
    const result = await transcribeBuffer(mm, audio, { language: "en" });
    return c.json({ text: result.text, confidence: result.confidence, mocked: result.mocked });
  } catch (err) {
    return c.json({ error: { code: "TRANSCRIBE_FAILED", message: err.message } }, 500);
  }
});
sessionsRoutes.post("/api/sessions/:id/feedback", async (c) => {
  const id = c.req.param("id");
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: "SESSION_NOT_FOUND", message: `session '${id}' not found` } }, 404);
  }
  try {
    const messages = await getMessages(c.env.DB, id);
    const userTurns = messages.filter((m) => m.role === "user");
    const userTexts = userTurns.map((m) => m.content).filter((t) => t && t.trim().length > 0);
    if (userTexts.length === 0) {
      return c.json({ error: { code: "NO_USER_TURNS", message: "session has no user turns yet" } }, 400);
    }
    const perTurnScores = userTurns.map((m) => typeof m.score === "number" ? m.score : null).filter((s) => s !== null);
    const baseOverall = perTurnScores.length > 0 ? Math.round(perTurnScores.reduce((a, b) => a + b, 0) / perTurnScores.length) : null;
    const mm = getMiniMaxEnv(c.env);
    const systemPrompt = buildConversationSystemPrompt(getSystemPrompt(rec.difficulty));
    const llmMessages = [
      ...toLlmContext(messages),
      {
        role: "user",
        content: "Please give me a final overall feedback for this practice session. Return STRICT JSON with overall_score, fluency, accuracy, key_issues (up to 3), suggestion."
      }
    ];
    let finalFeedback = null;
    try {
      const resp = await chatCompletion(mm, {
        system: systemPrompt,
        messages: llmMessages,
        temperature: 0.3,
        maxTokens: 500,
        responseFormatJson: true
      });
      finalFeedback = safeParseScore(resp.content);
    } catch {
    }
    if (!finalFeedback) {
      finalFeedback = {
        overall_score: baseOverall ?? 70,
        fluency: baseOverall ?? 70,
        accuracy: baseOverall ?? 70,
        key_issues: perTurnScores.length === 0 ? ["No scored turns yet \u2014 try a few practice rounds."] : ["Overall performance aggregated from your turns."],
        suggestion: "Review the key phrases of this scenario, then try the session once more."
      };
    }
    return c.json({
      session_id: id,
      feedback: finalFeedback,
      per_turn_scores: perTurnScores,
      user_turn_count: userTurns.length,
      duration_sec: rec.ended_at !== null ? Math.max(0, Math.round((rec.ended_at - rec.started_at) / 1e3)) : Math.max(0, Math.round((Date.now() - rec.started_at) / 1e3))
    });
  } catch (err) {
    return c.json({ error: { code: "FEEDBACK_FAILED", message: err.message } }, 500);
  }
});
sessionsRoutes.post("/api/sessions/:id/complete", async (c) => {
  const id = c.req.param("id");
  const rec = await getSession(c.env.DB, id);
  if (!rec) {
    return c.json({ error: { code: "SESSION_NOT_FOUND", message: `session '${id}' not found` } }, 404);
  }
  if (rec.status === "completed") {
    return c.json({ error: { code: "SESSION_COMPLETED", message: "session is already completed" } }, 409);
  }
  const body = await c.req.json().catch(() => ({}));
  const totalScore = typeof body.total_score === "number" && Number.isFinite(body.total_score) ? Math.max(0, Math.min(100, Math.round(body.total_score))) : null;
  try {
    const result = await completeSession(c.env.DB, id, totalScore);
    if (!result) {
      return c.json({ error: { code: "SESSION_COMPLETE_FAILED", message: "unknown error" } }, 500);
    }
    const finalMessages = (await getMessages(c.env.DB, id)).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      audio_url: m.audio_url ?? null,
      score: m.score ?? null,
      fluency: m.fluency ?? null,
      accuracy: m.accuracy ?? null,
      created_at: m.created_at
    }));
    return c.json({
      session_id: id,
      status: "completed",
      ended_at: rec.ended_at,
      total_score: rec.total_score,
      duration_sec: result.durationSec,
      message_count: result.messageCount,
      messages: finalMessages
    });
  } catch (err) {
    return c.json({ error: { code: "SESSION_COMPLETE_FAILED", message: err.message } }, 500);
  }
});
sessionsRoutes.post("/api/tts", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "text is required" } }, 400);
  }
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : TTS_DEFAULT_VOICE;
  const speed = typeof body.speed === "number" ? body.speed : 1;
  try {
    const mm = getMiniMaxEnv(c.env);
    const tts = await textToAudio(mm, { text, voiceId, speed });
    const bytes = new Uint8Array(tts.audio);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const audio_base64 = btoa(binary);
    if (tts.mocked) {
      return c.json({
        mocked: true,
        audio_base64,
        mime: tts.mime,
        note: "TTS is in mock mode (no MiniMax credentials). Front-end can attempt playback (will be silent)."
      });
    }
    return c.json({ mocked: false, audio_base64, mime: tts.mime });
  } catch (err) {
    return c.json({ error: { code: "TTS_FAILED", message: err.message } }, 500);
  }
});

// src/routes/history.ts
var historyRoutes = new Hono2();
function clampInt(raw2, lo, hi, fallback) {
  if (raw2 === void 0 || raw2 === "") return fallback;
  const n = Number.parseInt(raw2, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
__name(clampInt, "clampInt");
historyRoutes.get("/api/history", async (c) => {
  try {
    const db = c.env.DB;
    const limit = clampInt(c.req.query("limit"), 1, 200, 50);
    const offset = clampInt(c.req.query("offset"), 0, 1e6, 0);
    const rows = await allAsync(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions
       ORDER BY started_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const ids = rows.map((r) => r.id);
    const messageCounts = /* @__PURE__ */ new Map();
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const cntRows = await allAsync(
        db,
        `SELECT session_id, COUNT(*) AS c FROM messages WHERE session_id IN (${placeholders}) GROUP BY session_id`,
        ids
      );
      for (const r of cntRows) messageCounts.set(r.session_id, r.c);
    }
    const items = rows.map((r) => ({
      id: r.id,
      scenario_id: r.scenario_id,
      difficulty: r.difficulty,
      mode: r.mode,
      started_at: r.started_at,
      ended_at: r.ended_at,
      total_score: r.total_score,
      status: r.status === "completed" ? "completed" : "active",
      round_index: r.round_index ?? 0,
      message_count: messageCounts.get(r.id) ?? 0,
      duration_sec: r.ended_at !== null ? Math.max(0, Math.round((r.ended_at - r.started_at) / 1e3)) : Math.max(0, Math.round((Date.now() - r.started_at) / 1e3))
    }));
    const total = (await getAsync(db, `SELECT COUNT(*) AS c FROM sessions`))?.c ?? 0;
    return c.json({ items, total, limit, offset });
  } catch (err) {
    return c.json(
      { error: { code: "HISTORY_LIST_FAILED", message: err.message } },
      500
    );
  }
});
historyRoutes.get("/api/history/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const db = c.env.DB;
    const row = await getAsync(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions WHERE id = ?`,
      [id]
    );
    if (!row) {
      return c.json(
        { error: { code: "HISTORY_NOT_FOUND", message: `history '${id}' not found` } },
        404
      );
    }
    const messages = await getMessages(db, id);
    const userTurns = messages.filter((m) => m.role === "user");
    const scores = userTurns.map((m) => typeof m.score === "number" ? m.score : null).filter((s) => s !== null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const scenarios = getScenarios();
    const scenario = scenarios.find((s) => s.id === row.scenario_id) ?? null;
    return c.json({
      session: {
        id: row.id,
        scenario_id: row.scenario_id,
        difficulty: row.difficulty,
        mode: row.mode,
        started_at: row.started_at,
        ended_at: row.ended_at,
        total_score: row.total_score,
        status: row.status,
        round_index: row.round_index ?? 0
      },
      scenario,
      messages,
      user_turn_count: userTurns.length,
      avg_score: avg,
      duration_sec: row.ended_at !== null ? Math.max(0, Math.round((row.ended_at - row.started_at) / 1e3)) : Math.max(0, Math.round((Date.now() - row.started_at) / 1e3))
    });
  } catch (err) {
    return c.json(
      { error: { code: "HISTORY_FETCH_FAILED", message: err.message } },
      500
    );
  }
});

// src/routes/stats.ts
var statsRoutes = new Hono2();
statsRoutes.get("/api/stats", async (c) => {
  try {
    const db = c.env.DB;
    const totalSessions = (await getAsync(db, `SELECT COUNT(*) AS c FROM sessions`))?.c ?? 0;
    const completedSessions = (await getAsync(
      db,
      `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`
    ))?.c ?? 0;
    const durationRow = await getAsync(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN ended_at IS NOT NULL THEN (ended_at - started_at) / 1000.0 ELSE 0 END), 0) AS total_sec,
         COALESCE(AVG(CASE WHEN ended_at IS NOT NULL THEN (ended_at - started_at) / 1000.0 END), 0) AS avg_sec
       FROM sessions`
    );
    const scoreRow = await getAsync(
      db,
      `SELECT
         COALESCE(AVG(total_score), 0) AS avg_score,
         COALESCE(MAX(total_score), 0) AS best_score
       FROM sessions
       WHERE total_score IS NOT NULL`
    );
    const scenarioRows = await allAsync(
      db,
      `SELECT scenario_id, COUNT(*) AS sessions, AVG(total_score) AS avg_score
       FROM sessions
       GROUP BY scenario_id
       ORDER BY sessions DESC`
    );
    const difficultyRows = await allAsync(
      db,
      `SELECT difficulty, COUNT(*) AS sessions, AVG(total_score) AS avg_score
       FROM sessions
       GROUP BY difficulty
       ORDER BY difficulty`
    );
    const recentRows = await allAsync(
      db,
      `SELECT id, scenario_id, difficulty, total_score, started_at, ended_at
       FROM sessions
       WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC
       LIMIT 10`
    );
    const vocabularyRows = await getAsync(
      db,
      `SELECT
         COALESCE(SUM(correct_count), 0) AS correct,
         COALESCE(SUM(wrong_count), 0) AS wrong,
         COUNT(*) AS tracked
       FROM vocabulary_progress`
    ) ?? { correct: 0, wrong: 0, tracked: 0 };
    return c.json({
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      active_sessions: totalSessions - completedSessions,
      total_practice_sec: Math.round(durationRow?.total_sec ?? 0),
      avg_session_sec: Math.round(durationRow?.avg_sec ?? 0),
      avg_score: Math.round(scoreRow?.avg_score ?? 0),
      best_score: Math.round(scoreRow?.best_score ?? 0),
      by_scenario: scenarioRows.map((r) => ({
        scenario_id: r.scenario_id,
        sessions: r.sessions,
        avg_score: r.avg_score === null ? null : Math.round(r.avg_score)
      })),
      by_difficulty: difficultyRows.map((r) => ({
        difficulty: r.difficulty,
        sessions: r.sessions,
        avg_score: r.avg_score === null ? null : Math.round(r.avg_score)
      })),
      recent_sessions: recentRows.map((r) => ({
        id: r.id,
        scenario_id: r.scenario_id,
        difficulty: r.difficulty,
        total_score: r.total_score,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_sec: Math.max(0, Math.round((r.ended_at - r.started_at) / 1e3))
      })),
      vocabulary: {
        tracked_terms: vocabularyRows.tracked,
        correct: vocabularyRows.correct,
        wrong: vocabularyRows.wrong
      }
    });
  } catch (err) {
    return c.json(
      { error: { code: "STATS_FAILED", message: err.message } },
      500
    );
  }
});

// src/routes/vocabulary.ts
var vocabularyRoutes = new Hono2();
async function loadProgressForTerms(db, terms) {
  const map = /* @__PURE__ */ new Map();
  if (terms.length === 0) return map;
  try {
    const placeholders = terms.map(() => "?").join(",");
    const rows = await allAsync(
      db,
      `SELECT term, correct_count, wrong_count, last_seen
       FROM vocabulary_progress
       WHERE term IN (${placeholders})`,
      terms
    );
    for (const r of rows) {
      map.set(r.term, {
        correct_count: r.correct_count ?? 0,
        wrong_count: r.wrong_count ?? 0,
        last_seen: r.last_seen ?? null
      });
    }
  } catch {
  }
  return map;
}
__name(loadProgressForTerms, "loadProgressForTerms");
function clampInt2(raw2, lo, hi, fallback) {
  if (raw2 === void 0 || raw2 === "") return fallback;
  const n = Number.parseInt(raw2, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
__name(clampInt2, "clampInt");
vocabularyRoutes.get("/api/vocabulary", async (c) => {
  try {
    const all = getVocabulary();
    const category = (c.req.query("category") ?? "").trim();
    const search = (c.req.query("search") ?? "").trim().toLowerCase();
    const limit = clampInt2(c.req.query("limit"), 1, 1e3, 200);
    const offset = clampInt2(c.req.query("offset"), 0, 1e6, 0);
    let filtered = all;
    if (category) filtered = filtered.filter((v) => v.category === category);
    if (search) {
      filtered = filtered.filter((v) => {
        const term = (v.term ?? "").toLowerCase();
        const full = (v.full_form ?? "").toLowerCase();
        const defEn = (v.definition_en ?? "").toLowerCase();
        const defZh = (v.definition_zh ?? "").toLowerCase();
        return term.includes(search) || full.includes(search) || defEn.includes(search) || defZh.includes(search);
      });
    }
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    const progressMap = await loadProgressForTerms(c.env.DB, items.map((v) => v.term));
    const enriched = items.map((v) => ({
      ...v,
      progress: progressMap.get(v.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null }
    }));
    return c.json({
      items: enriched,
      total,
      limit,
      offset,
      count: enriched.length,
      category: category || null,
      search: search || null
    });
  } catch (err) {
    return c.json(
      { error: { code: "VOCABULARY_LIST_FAILED", message: err.message } },
      500
    );
  }
});
vocabularyRoutes.get("/api/vocabulary/categories", (c) => {
  try {
    const all = getVocabulary();
    const counts = /* @__PURE__ */ new Map();
    for (const v of all) {
      if (!v.category) continue;
      counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
    }
    const items = Array.from(counts.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category));
    return c.json({ items, total: items.length });
  } catch (err) {
    return c.json(
      { error: { code: "VOCABULARY_CATEGORIES_FAILED", message: err.message } },
      500
    );
  }
});
vocabularyRoutes.get("/api/vocabulary/progress", async (c) => {
  try {
    const db = c.env.DB;
    const rows = await allAsync(
      db,
      `SELECT term, correct_count, wrong_count, last_seen
       FROM vocabulary_progress
       ORDER BY last_seen DESC`
    );
    const totals = rows.reduce(
      (acc, r) => {
        acc.tracked += 1;
        acc.correct += r.correct_count ?? 0;
        acc.wrong += r.wrong_count ?? 0;
        return acc;
      },
      { tracked: 0, correct: 0, wrong: 0 }
    );
    const totalAttempts = totals.correct + totals.wrong;
    const accuracy = totalAttempts > 0 ? Math.round(totals.correct / totalAttempts * 100) : null;
    let sessionCount = 0;
    try {
      const row = await getAsync(
        db,
        `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`
      );
      sessionCount = row?.c ?? 0;
    } catch {
    }
    return c.json({
      ...totals,
      accuracy_pct: accuracy,
      total_attempts: totalAttempts,
      items: rows,
      session_count: sessionCount
    });
  } catch (err) {
    return c.json(
      { error: { code: "VOCABULARY_PROGRESS_FAILED", message: err.message } },
      500
    );
  }
});
vocabularyRoutes.get("/api/vocabulary/:word", async (c) => {
  const word = c.req.param("word");
  if (!word || word.trim().length === 0) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "word is required" } }, 400);
  }
  const key = decodeURIComponent(word).trim().toLowerCase();
  try {
    const all = getVocabulary();
    const entry = all.find((v) => (v.term ?? "").toLowerCase() === key) ?? all.find((v) => (v.term ?? "").toLowerCase().includes(key)) ?? null;
    if (!entry) {
      return c.json(
        { error: { code: "VOCABULARY_NOT_FOUND", message: `vocabulary term '${word}' not found` } },
        404
      );
    }
    const progressMap = await loadProgressForTerms(c.env.DB, [entry.term]);
    return c.json({
      ...entry,
      progress: progressMap.get(entry.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null }
    });
  } catch (err) {
    return c.json(
      { error: { code: "VOCABULARY_FETCH_FAILED", message: err.message } },
      500
    );
  }
});

// src/routes/status.ts
var statusRoutes = new Hono2();
var PKG_VERSION = "1.0.0";
var SERVICE_START_TS = Date.now();
statusRoutes.get("/api/status", async (c) => {
  const db = c.env.DB;
  let sessionsTotal = 0;
  let recentSessions = 0;
  let completedSessions = 0;
  try {
    const r1 = await getAsync(db, `SELECT COUNT(*) AS c FROM sessions`);
    sessionsTotal = r1?.c ?? 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1e3;
    const r2 = await getAsync(
      db,
      `SELECT COUNT(*) AS c FROM sessions WHERE started_at >= ?`,
      [cutoff]
    );
    recentSessions = r2?.c ?? 0;
    const r3 = await getAsync(
      db,
      `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`
    );
    completedSessions = r3?.c ?? 0;
  } catch {
  }
  const scenarios = (() => {
    try {
      return getScenarios().length;
    } catch {
      return 0;
    }
  })();
  const vocabulary = (() => {
    try {
      return getVocabulary().length;
    } catch {
      return 0;
    }
  })();
  const sysKeys = /* @__PURE__ */ new Set();
  for (const d of ["beginner", "intermediate", "advanced"]) {
    try {
      const v = getSystemPrompt(d);
      if (v && v.length > 0) sysKeys.add(d);
    } catch {
    }
  }
  const mm = getMiniMaxEnv(c.env);
  return c.json({
    ok: true,
    ts: Date.now(),
    version: PKG_VERSION,
    uptime_sec: Math.max(0, Math.floor((Date.now() - SERVICE_START_TS) / 1e3)),
    minimax: {
      hasCredentials: hasMiniMaxCredentials(mm),
      apiKeySet: mm.apiKey.length > 0,
      groupIdSet: mm.groupId.length > 0
    },
    content: {
      scenarios_count: scenarios,
      vocabulary_count: vocabulary,
      system_prompts_count: sysKeys.size
    },
    sessions: {
      total: sessionsTotal,
      completed: completedSessions,
      active: Math.max(0, sessionsTotal - completedSessions),
      last_24h: recentSessions
    },
    database: {
      binding: "D1",
      platform: "cloudflare-d1"
    },
    server: {
      runtime: "cloudflare-workers"
    },
    ws: {
      endpoint: "/ws/session/:id"
    }
  });
});
statusRoutes.get("/api/badge", (c) => {
  const label = "SpeakFlow";
  const message = "OK";
  const color = "#22c55e";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="128" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="58" height="20" fill="#555"/>
    <rect x="58" width="70" height="20" fill="${color}"/>
    <rect width="128" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="295" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="480">${label}</text>
    <text x="295" y="140" transform="scale(.1)" fill="#fff" textLength="480">${label}</text>
    <text aria-hidden="true" x="925" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="600">${message}</text>
    <text x="925" y="140" transform="scale(.1)" fill="#fff" textLength="600">${message}</text>
  </g>
</svg>`;
  return c.body(svg, 200, { "Content-Type": "image/svg+xml; charset=utf-8" });
});

// data/garment-textile-dict.json
var garment_textile_dict_default = {
  _comment: "SpeakFlow \u670D\u88C5\u7EBA\u7EC7\u5916\u8D38\u9AD8\u9891\u8BCD\u5178,\u7528\u4E8E\u70B9\u9009\u5355\u8BCD\u5F39\u4E2D\u6587\u91CA\u4E49\u3002\u8986\u76D6 90.\u82F1\u6587\u5B66\u4E60 1100 \u8BCD\u4E2D\u6700\u9AD8\u9891\u7684 120+ \u8BCD\u6761\u3002\u952E\u4E3A\u5C0F\u5199\u5355\u8BCD\u6216\u77ED\u8BED(\u77ED\u8BED\u7528\u4E0B\u5212\u7EBF\u6216\u7A7A\u683C),\u503C\u4E3A\u4E2D\u6587\u91CA\u4E49\u6570\u7EC4(\u9996\u9879\u6700\u5E38\u7528)\u3002",
  yarn: ["\u7EB1\u7EBF", "\u7EB1"],
  combed: ["\u7CBE\u68B3\u7684"],
  carded: ["\u666E\u68B3\u7684", "\u7C97\u68B3\u7684"],
  compact: ["\u7D27\u5BC6\u7EBA\u7684"],
  ring: ["\u73AF\u952D\u7EBA\u7684"],
  twist: ["\u637B\u5EA6"],
  spinning: ["\u7EBA\u7EB1"],
  weaving: ["\u68AD\u7EC7", "\u673A\u7EC7"],
  knitting: ["\u9488\u7EC7"],
  warp: ["\u7ECF\u5411"],
  weft: ["\u7EAC\u5411"],
  tricot: ["\u7279\u91CC\u79D1\u7ECF\u7F16"],
  raschel: ["\u62C9\u820D\u5C14\u7ECF\u7F16"],
  jersey: ["\u5355\u9762\u6C57\u5E03", "\u5E73\u7EB9\u9488\u7EC7"],
  fleece: ["\u6293\u7ED2", "\u6447\u7C92\u7ED2"],
  twill: ["\u659C\u7EB9\u5E03"],
  denim: ["\u725B\u4ED4\u5E03"],
  denims: ["\u725B\u4ED4\u88E4"],
  canvas: ["\u5E06\u5E03"],
  poplin: ["\u5E9C\u7EF8"],
  oxford: ["\u725B\u6D25\u7EBA"],
  tweed: ["\u7C97\u82B1\u5462"],
  velvet: ["\u5929\u9E45\u7ED2"],
  corduroy: ["\u706F\u82AF\u7ED2"],
  satin: ["\u7F0E\u5B50"],
  taffeta: ["\u5854\u592B\u7EF8"],
  chiffon: ["\u96EA\u7EBA"],
  organza: ["\u6B27\u6839\u7EB1"],
  lace: ["\u857E\u4E1D"],
  mesh: ["\u7F51\u5E03", "\u7F51\u773C"],
  spandex: ["\u6C28\u7EB6", "\u65AF\u6F58\u5FB7\u514B\u65AF"],
  elastane: ["\u6C28\u7EB6(\u6B27\u6D32\u53EB\u6CD5)"],
  lycra: ["\u83B1\u5361(\u6C28\u7EB6\u54C1\u724C)"],
  polyester: ["\u6DA4\u7EB6", "\u805A\u916F\u7EA4\u7EF4"],
  nylon: ["\u5C3C\u9F99", "\u9526\u7EB6"],
  cotton: ["\u68C9"],
  wool: ["\u7F8A\u6BDB"],
  linen: ["\u4E9A\u9EBB"],
  silk: ["\u771F\u4E1D", "\u4E1D\u7EF8"],
  modal: ["\u83AB\u4EE3\u5C14"],
  tencel: ["\u5929\u4E1D", "\u83B1\u8D5B\u5C14"],
  bamboo: ["\u7AF9\u7EA4\u7EF4"],
  rayon: ["\u4EBA\u9020\u68C9", "\u7C98\u80F6"],
  viscose: ["\u7C98\u80F6\u7EA4\u7EF4"],
  acrylic: ["\u8148\u7EB6"],
  cashmere: ["\u7F8A\u7ED2"],
  mohair: ["\u9A6C\u6D77\u6BDB"],
  angora: ["\u5B89\u54E5\u62C9\u5154\u6BDB"],
  ramie: ["\u82CE\u9EBB"],
  hemp: ["\u5927\u9EBB\u7EA4\u7EF4"],
  GSM: ["\u514B\u91CD(\u514B/\u5E73\u65B9\u7C73)", "\u5E73\u65B9\u7C73\u514B\u91CD"],
  oz: ["\u76CE\u53F8(\u514B\u91CD\u5355\u4F4D)"],
  denier: ["\u65E6\u5C3C\u5C14", "\u65E6\u6570"],
  dtex: ["\u5206\u7279\u514B\u65AF"],
  count: ["\u7EB1\u652F", "\u652F\u6570"],
  ne: ["\u82F1\u5236\u652F\u6570"],
  d: ["\u65E6\u5C3C\u5C14\u7F29\u5199"],
  tex: ["\u7279\u514B\u65AF"],
  dyeing: ["\u67D3\u8272"],
  dye: ["\u67D3\u6599", "\u67D3\u8272"],
  dyehouse: ["\u67D3\u5382"],
  lab_dip: ["\u67D3\u8272\u5C0F\u6837", "\u5BF9\u8272\u6837"],
  strike_off: ["\u5370\u82B1\u6253\u6837"],
  pantone: ["\u6F58\u901A\u8272\u53F7"],
  tpx: ["\u6F58\u901A\u7EBA\u7EC7\u8272\u5361(\u7EB8\u7248)"],
  tcx: ["\u6F58\u901A\u7EBA\u7EC7\u8272\u5361(\u68C9\u7248)"],
  tpg: ["\u6F58\u901A\u5370\u5237\u8272\u5361"],
  color_fastness: ["\u8272\u7262\u5EA6"],
  fastness: ["\u7262\u5EA6"],
  shade: ["\u8272\u76F8", "\u8272\u5149", "\u8272\u8C03"],
  delta_e: ["\u8272\u5DEE\u503C"],
  mercerizing: ["\u4E1D\u5149\u5904\u7406"],
  singeing: ["\u70E7\u6BDB"],
  softening: ["\u67D4\u8F6F\u6574\u7406"],
  enzyme: ["\u9175\u7D20", "\u9176"],
  bleach: ["\u6F02\u767D"],
  stone_wash: ["\u77F3\u78E8\u6D17"],
  acid_wash: ["\u9178\u6D17"],
  vintage: ["\u590D\u53E4\u6548\u679C", "\u505A\u65E7"],
  pre_shrunk: ["\u9884\u7F29"],
  shrinkage: ["\u7F29\u7387"],
  pilling: ["\u8D77\u7403"],
  skew: ["\u7EAC\u659C"],
  barry: ["\u6A2A\u6863\u75B5\u70B9"],
  stain: ["\u6C61\u6E0D"],
  hole: ["\u7834\u6D1E"],
  snag: ["\u52FE\u4E1D"],
  yarn_dyed: ["\u8272\u7EC7", "\u7EB1\u67D3"],
  piece_dyed: ["\u5339\u67D3"],
  garment_dyed: ["\u6210\u8863\u67D3"],
  printing: ["\u5370\u82B1"],
  digital_print: ["\u6570\u7801\u5370\u82B1"],
  screen_print: ["\u7F51\u5370", "\u4E1D\u7F51\u5370"],
  rotary_print: ["\u5706\u7F51\u5370\u82B1"],
  flat_screen: ["\u5E73\u7F51\u5370\u82B1"],
  sublimation: ["\u70ED\u5347\u534E", "\u5347\u534E\u5370\u82B1"],
  embroidery: ["\u7EE3\u82B1", "\u523A\u7EE3"],
  applique: ["\u8D34\u5E03\u7EE3"],
  patch: ["\u5FBD\u7AE0", "\u8D34\u7247"],
  button: ["\u7EBD\u6263"],
  shank: ["\u5E26\u67C4(\u7EBD\u6263)"],
  snap: ["\u56DB\u5408\u6263"],
  zipper: ["\u62C9\u94FE"],
  ykk: ["YKK(\u62C9\u94FE\u54C1\u724C)"],
  velcro: ["\u9B54\u672F\u8D34"],
  elastic: ["\u6A61\u7B4B", "\u5F39\u529B\u5E26"],
  ribbon: ["\u7EC7\u5E26"],
  tape: ["\u5E26\u5B50", "\u80F6\u5E26"],
  label: ["\u6807\u7B7E", "\u540A\u724C"],
  hangtag: ["\u540A\u724C"],
  woven_label: ["\u7EC7\u6807"],
  care_label: ["\u6D17\u6807"],
  main_label: ["\u4E3B\u6807"],
  size_label: ["\u5C3A\u7801\u6807"],
  seam: ["\u7F1D", "\u7EBF\u7F1D"],
  seam_allowance: ["\u7F1D\u4EFD"],
  stitch: ["\u9488\u8FF9", "\u8F66\u7F1D"],
  spi: ["\u6BCF\u82F1\u5BF8\u9488\u6570"],
  lock_stitch: ["\u9501\u5F0F\u7EBF\u8FF9"],
  overlock: ["\u5305\u7F1D", "\u62F7\u8FB9"],
  serging: ["\u5305\u8FB9"],
  fusing: ["\u7C98\u5408", "\u70ED\u7194"],
  interlining: ["\u91CC\u886C", "\u886C\u5E03"],
  lining: ["\u91CC\u5E03"],
  shell: ["\u9762\u6599", "\u5916\u58F3"],
  padding: ["\u586B\u5145", "\u886C\u57AB"],
  garment: ["\u6210\u8863", "\u670D\u88C5"],
  shirt: ["\u886C\u8863", "\u886C\u886B"],
  blouse: ["\u5973\u5F0F\u886C\u886B"],
  t_shirt: ["T\u6064"],
  polo: [" polo \u886B"],
  hoodie: ["\u8FDE\u5E3D\u886B"],
  sweater: ["\u6BDB\u8863"],
  cardigan: ["\u5F00\u886B"],
  pullover: ["\u5957\u5934\u886B"],
  jacket: ["\u5939\u514B", "\u5916\u5957"],
  coat: ["\u5927\u8863"],
  vest: ["\u80CC\u5FC3", "\u9A6C\u7532"],
  pants: ["\u88E4\u5B50"],
  trousers: ["\u957F\u88E4(\u82F1\u5F0F)"],
  jeans: ["\u725B\u4ED4\u88E4"],
  shorts: ["\u77ED\u88E4"],
  skirt: ["\u88D9\u5B50"],
  dress: ["\u8FDE\u8863\u88D9"],
  leggings: ["\u6253\u5E95\u88E4", "\u745C\u4F3D\u88E4"],
  yoga_pants: ["\u745C\u4F3D\u88E4"],
  bra: ["\u6587\u80F8", "\u8FD0\u52A8\u5185\u8863"],
  underwear: ["\u5185\u8863"],
  boxer: ["\u5E73\u89D2\u5185\u88E4"],
  brief: ["\u4E09\u89D2\u5185\u88E4"],
  sock: ["\u889C\u5B50"],
  activewear: ["\u8FD0\u52A8\u670D"],
  sportswear: ["\u8FD0\u52A8\u670D\u88C5"],
  athleisure: ["\u8FD0\u52A8\u4F11\u95F2"],
  loungewear: ["\u5BB6\u5C45\u670D"],
  sleepwear: ["\u7761\u8863"],
  outerwear: ["\u5916\u5957\u7C7B"],
  swimwear: ["\u6CF3\u88C5"],
  team_kit: ["\u7403\u961F\u5957\u4EF6"],
  jersey_number: ["\u7403\u8863\u53F7\u7801"],
  cut_and_sew: ["\u88C1\u526A\u7F1D\u5236"],
  marker: ["\u6392\u6599\u56FE"],
  spreading: ["\u62D6\u6599"],
  cutting: ["\u88C1\u526A"],
  sewing: ["\u8F66\u7F1D"],
  ironing: ["\u6574\u70EB"],
  pressing: ["\u538B\u70EB"],
  finishing: ["\u540E\u6574\u7406"],
  packing: ["\u5305\u88C5"],
  folding: ["\u6298\u53E0"],
  polybag: ["\u5851\u6599\u888B"],
  carton: ["\u7EB8\u7BB1"],
  pallet: ["\u6258\u76D8"],
  container: ["\u96C6\u88C5\u7BB1"],
  fcl: ["\u6574\u67DC"],
  lcl: ["\u62FC\u67DC", "\u62FC\u7BB1"],
  etd: ["\u9884\u8BA1\u79BB\u6E2F\u65E5"],
  eta: ["\u9884\u8BA1\u5230\u6E2F\u65E5"],
  "b/l": ["\u63D0\u5355"],
  bl: ["\u63D0\u5355"],
  "c/o": ["\u539F\u4EA7\u5730\u8BC1"],
  coo: ["\u539F\u4EA7\u5730\u8BC1"],
  invoice: ["\u53D1\u7968"],
  commercial_invoice: ["\u5546\u4E1A\u53D1\u7968"],
  packing_list: ["\u88C5\u7BB1\u5355"],
  manifest: ["\u8231\u5355"],
  telex_release: ["\u7535\u653E"],
  booking: ["\u8BA2\u8231"],
  stuffing: ["\u88C5\u67DC"],
  vanning: ["\u88C5\u7BB1"],
  hs_code: ["\u6D77\u5173\u7F16\u7801"],
  tariff: ["\u5173\u7A0E"],
  demurrage: ["\u5806\u5B58\u8D39"],
  detention: ["\u6EDE\u7BB1\u8D39"],
  customs: ["\u6D77\u5173"],
  clearance: ["\u6E05\u5173"],
  broker: ["\u62A5\u5173\u884C"],
  freight: ["\u8FD0\u8D39"],
  forwarder: ["\u8D27\u4EE3"],
  incoterms: ["\u56FD\u9645\u8D38\u6613\u672F\u8BED"],
  fob: ["\u79BB\u5CB8\u4EF7"],
  cif: ["\u5230\u5CB8\u4EF7"],
  exw: ["\u5DE5\u5382\u4EA4\u8D27"],
  ddp: ["\u5B8C\u7A0E\u540E\u4EA4\u8D27"],
  dap: ["\u76EE\u7684\u5730\u4EA4\u8D27"],
  cfr: ["\u6210\u672C\u52A0\u8FD0\u8D39"],
  lc: ["\u4FE1\u7528\u8BC1"],
  "l/c": ["\u4FE1\u7528\u8BC1"],
  tt: ["\u7535\u6C47"],
  dp: ["\u4ED8\u6B3E\u4EA4\u5355"],
  da: ["\u627F\u5151\u4EA4\u5355"],
  deposit: ["\u5B9A\u91D1"],
  balance: ["\u5C3E\u6B3E"],
  wire: ["\u7535\u6C47"],
  remittance: ["\u6C47\u6B3E"],
  credit_note: ["\u8D37\u9879\u901A\u77E5"],
  debit_note: ["\u501F\u9879\u901A\u77E5"],
  refund: ["\u9000\u6B3E"],
  overdue: ["\u903E\u671F"],
  discrepancy: ["\u4E0D\u7B26\u70B9"],
  waiver: ["\u5F03\u6743", "\u4E0D\u7B26\u70B9\u653E\u5F03\u4E66"],
  amendment: ["\u6539\u8BC1", "\u4FEE\u6539"],
  ucp: ["\u8DDF\u5355\u4FE1\u7528\u8BC1\u7EDF\u4E00\u60EF\u4F8B"],
  indemnity: ["\u62C5\u4FDD\u4E66"],
  force_majeure: ["\u4E0D\u53EF\u6297\u529B"],
  claim: ["\u7D22\u8D54"],
  rework: ["\u8FD4\u5DE5"],
  replacement: ["\u8865\u8D27", "\u6362\u8D27"],
  concession: ["\u8BA9\u6B65"],
  discount: ["\u6298\u6263"],
  rfq: ["\u8BE2\u76D8", "\u8BE2\u4EF7"],
  quote: ["\u62A5\u4EF7"],
  quotation: ["\u62A5\u4EF7\u5355"],
  pi: ["\u5F62\u5F0F\u53D1\u7968", "\u9884\u5F00\u53D1\u7968"],
  po: ["\u91C7\u8D2D\u8BA2\u5355"],
  purchase_order: ["\u91C7\u8D2D\u8BA2\u5355"],
  moq: ["\u8D77\u8BA2\u91CF"],
  lead_time: ["\u4EA4\u671F", "\u524D\u7F6E\u65F6\u95F4"],
  bulk: ["\u5927\u8D27"],
  sample: ["\u6837\u54C1"],
  pre_production: ["\u4EA7\u524D"],
  shipment: ["\u88C5\u8FD0", "\u51FA\u8D27"],
  delivery: ["\u4EA4\u8D27"],
  expedite: ["\u8D76\u5DE5", "\u50AC\u8D27"],
  aql: ["\u53EF\u63A5\u53D7\u8D28\u91CF\u6C34\u5E73"],
  qc: ["\u54C1\u8D28\u63A7\u5236"],
  qa: ["\u54C1\u8D28\u4FDD\u8BC1"],
  inspection: ["\u68C0\u9A8C", "\u9A8C\u8D27"],
  compliance: ["\u5408\u89C4"],
  certification: ["\u8BA4\u8BC1"],
  bsci: ["BSCI \u793E\u4F1A\u8D23\u4EFB\u9A8C\u5382"],
  sedex: ["SEDEX \u4F9B\u5E94\u5546\u5546\u4E1A\u9053\u5FB7"],
  oeko_tex: ["OEKO-TEX \u751F\u6001\u7EBA\u7EC7\u54C1\u8BA4\u8BC1"],
  reach: ["REACH \u6B27\u76DF\u5316\u5B66\u54C1\u6CD5\u89C4"],
  gots: ["GOTS \u6709\u673A\u7EBA\u7EC7\u54C1\u8BA4\u8BC1"],
  rws: ["RWS \u8D23\u4EFB\u7F8A\u6BDB\u8BA4\u8BC1"],
  fsc: ["FSC \u68EE\u6797\u8BA4\u8BC1"],
  capa: ["\u7EA0\u6B63\u9884\u9632\u63AA\u65BD"],
  rca: ["\u6839\u56E0\u5206\u6790"],
  root_cause: ["\u6839\u56E0"],
  sop: ["\u6807\u51C6\u4F5C\u4E1A\u7A0B\u5E8F"],
  pdca: ["PDCA \u5FAA\u73AF"],
  kaizen: ["\u6539\u5584\u63D0\u6848"],
  kpi: ["\u5173\u952E\u7EE9\u6548\u6307\u6807"],
  oem: ["\u4EE3\u5DE5(\u8D34\u724C)"],
  odm: ["\u8BBE\u8BA1\u4EE3\u5DE5"],
  cmt: ["\u88C1\u526A-\u7F1D\u5236-\u540E\u6574\u7406(\u4EE3\u5DE5\u65B9\u5F0F)"],
  handfeel: ["\u624B\u611F"],
  drape: ["\u60AC\u5782\u6027"],
  stiffness: ["\u633A\u62EC\u5EA6"],
  softness: ["\u67D4\u8F6F\u5EA6"],
  breathability: ["\u900F\u6C14\u6027"],
  wicking: ["\u5438\u6E7F\u6392\u6C57"],
  moisture_management: ["\u6E7F\u5EA6\u7BA1\u7406"],
  four_way_stretch: ["\u56DB\u9762\u5F39"],
  two_way_stretch: ["\u53CC\u5411\u5F39"],
  squat_proof: ["\u4E0D\u900F(\u745C\u4F3D\u88E4)"],
  pre_shrunk: ["\u9884\u7F29"],
  tech_pack: ["\u5DE5\u827A\u5355"],
  spec_sheet: ["\u89C4\u683C\u8868"],
  bom: ["\u7269\u6599\u6E05\u5355"],
  marker_efficiency: ["\u6392\u6599\u5229\u7528\u7387"],
  fabric_inspection: ["\u9762\u6599\u68C0\u9A8C"],
  four_point: ["\u56DB\u5206\u5236(\u9762\u6599\u68C0\u9A8C)"],
  ten_point: ["\u5341\u5206\u5236(\u9762\u6599\u68C0\u9A8C)"],
  grading: ["\u653E\u7801", "\u63A8\u6863"],
  marker_making: ["\u6392\u6599"],
  iron_temperature: ["\u71A8\u70EB\u6E29\u5EA6"],
  pressing_cloth: ["\u70EB\u5E03"],
  buttonhole: ["\u9501\u773C"],
  button_attach: ["\u9489\u6263"],
  rivet: ["\u94C6\u9489"],
  bar_tack: ["\u6253\u67A3", "\u52A0\u56FA\u9488"],
  bartack: ["\u6253\u67A3", "\u52A0\u56FA\u9488"],
  darts: ["\u7701\u9053"],
  pleat: ["\u8936"],
  yoke: ["\u80B2\u514B", "\u8FC7\u80A9"],
  placket: ["\u95E8\u895F"],
  collar: ["\u9886\u5B50"],
  cuff: ["\u8896\u53E3"],
  hem: ["\u4E0B\u6446"],
  sleeve: ["\u8896\u5B50"],
  raglan: ["\u63D2\u80A9\u8896"],
  set_in_sleeve: ["\u88C5\u8896"],
  drop_shoulder: ["\u843D\u80A9"],
  shoulder_seam: ["\u80A9\u7F1D"],
  side_seam: ["\u4FA7\u7F1D"],
  inseam: ["\u5185\u7F1D"],
  outseam: ["\u5916\u7F1D"],
  yoke_seam: ["\u80B2\u514B\u7F1D"],
  youth: ["\u9752\u5C11\u5E74\u6B3E"],
  adult: ["\u6210\u4EBA\u6B3E"],
  plus_size: ["\u5927\u7801"],
  petite: ["\u5C0F\u7801"],
  tall: ["\u9AD8\u4E2A\u5B50\u6B3E"],
  fitting: ["\u8BD5\u7A7F"],
  fit: ["\u7248\u578B"],
  slim_fit: ["\u4FEE\u8EAB\u7248\u578B"],
  regular_fit: ["\u5E38\u89C4\u7248\u578B"],
  loose_fit: ["\u5BBD\u677E\u7248\u578B"],
  oversized: ["\u8D85\u5927\u7248\u578B"],
  true_to_size: ["\u5C3A\u7801\u6807\u51C6"],
  sizing: ["\u5C3A\u7801"],
  size_run: ["\u5C3A\u7801\u6BB5"],
  colorway: ["\u914D\u8272\u65B9\u6848"],
  color_block: ["\u649E\u8272\u62FC\u63A5"],
  color_palette: ["\u8C03\u8272\u677F"],
  season: ["\u5B63\u8282"],
  ss: ["\u6625\u590F\u5B63"],
  fw: ["\u79CB\u51AC\u5B63"],
  pre_fall: ["\u5B63\u524D"],
  resort: ["\u5EA6\u5047\u7CFB\u5217"],
  drop: ["\u4E0A\u65B0"],
  capsule: ["\u80F6\u56CA\u7CFB\u5217"],
  lookbook: ["\u578B\u5F55"],
  line_sheet: ["\u6B3E\u5F0F\u8868"],
  sell_sheet: ["\u9500\u552E\u8D44\u6599"],
  pre_order: ["\u9884\u552E"],
  repeat_order: ["\u7FFB\u5355"],
  rush_order: ["\u52A0\u6025\u5355"],
  trial_order: ["\u8BD5\u5355"],
  first_order: ["\u9996\u5355"],
  blank: ["\u7A7A\u767D\u6B3E", "\u65E0 LOGO"],
  private_label: ["\u81EA\u6709\u54C1\u724C"],
  white_label: ["\u767D\u6807"]
};

// src/services/dictionary.ts
var log8 = createLogger("dictionary");
var _dict = null;
function loadDict() {
  if (_dict) return _dict;
  const raw2 = garment_textile_dict_default;
  _dict = Object.fromEntries(
    Object.entries(raw2).filter(([k]) => !k.startsWith("_"))
  );
  log8.info(`Loaded ${Object.keys(_dict).length} dictionary entries`);
  return _dict;
}
__name(loadDict, "loadDict");
function normalize(text) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9\s_-]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
__name(normalize, "normalize");
function lookupLocal(raw2) {
  const norm = normalize(raw2);
  if (!norm || norm.length > 24) return null;
  if (/^\d+(\.\d+)?$/.test(norm)) return null;
  const d = loadDict();
  if (d[norm]) return { key: norm, meaning_zh: d[norm].join(" \xB7 ") };
  if (norm.endsWith("ies") && norm.length > 4) {
    const sg = norm.slice(0, -3) + "y";
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(" \xB7 ") };
  }
  if (norm.endsWith("es") && norm.length > 4) {
    const sg = norm.slice(0, -2);
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(" \xB7 ") };
  }
  if (norm.endsWith("s") && norm.length > 3 && !norm.endsWith("ss")) {
    const sg = norm.slice(0, -1);
    if (d[sg]) return { key: sg, meaning_zh: d[sg].join(" \xB7 ") };
  }
  if (norm.endsWith("ed") && norm.length > 4) {
    for (const c of [norm.slice(0, -2), norm.slice(0, -1)]) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(" \xB7 ") };
    }
  }
  if (norm.endsWith("ing") && norm.length > 5) {
    for (const c of [norm.slice(0, -3), norm.slice(0, -3) + "e"]) {
      if (d[c]) return { key: c, meaning_zh: d[c].join(" \xB7 ") };
    }
  }
  if (norm.endsWith("ly") && norm.length > 4) {
    const stem = norm.slice(0, -2);
    if (d[stem]) return { key: stem, meaning_zh: d[stem].join(" \xB7 ") };
  }
  return null;
}
__name(lookupLocal, "lookupLocal");
var DICTIONARY_SYSTEM_PROMPT = `You are a concise English-Chinese dictionary for the apparel & textile export industry.

CRITICAL OUTPUT FORMAT \u2014 READ FIRST:
- Respond with ONLY a single valid JSON object. Nothing else.
- The FIRST character of your response must be { and the LAST character must be }.
- DO NOT wrap the JSON in markdown fences (no \`\`\`json or \`\`\`).
- DO NOT add any explanation, preamble, commentary, or prose before or after the JSON.

The response must have EXACTLY this shape (no extra fields, no markdown):
{
  "word": "the English word/phrase as given (lowercase, no punctuation)",
  "meaning_zh": "concise Chinese meaning, max 30 characters, no English, no quotes"
}

If the input is a real English word, give the most common apparel / textile / trade-finance relevant meaning (e.g. "consolidate" \u2192 "\u5E76\u67DC/\u62FC\u67DC"; "tariff" \u2192 "\u5173\u7A0E").
If you don't recognize the word at all, return: {"word": "<input>", "meaning_zh": "\u6682\u65E0\u91CA\u4E49"}.

REMINDER: Your entire response must be a single JSON object starting with { and ending with }. No markdown, no fences, no prose.`;
var TIMEOUT_MS = 1500;
async function lookupWord(mm, raw2) {
  const local = lookupLocal(raw2);
  if (local) {
    return { word: local.key, meaning_zh: local.meaning_zh, source: "local" };
  }
  const llmPromise = chatCompletion(mm, {
    system: DICTIONARY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Look up: "${normalize(raw2)}"` }],
    temperature: 0.2,
    maxTokens: 80
  });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("LLM lookup timeout")), TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([llmPromise, timeoutPromise]);
    const cleaned = res.content.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      log8.warn(`LLM returned non-JSON: ${cleaned.slice(0, 100)}`);
      return { word: normalize(raw2), meaning_zh: "\u6682\u65E0\u91CA\u4E49", source: "mock" };
    }
    const word = typeof parsed.word === "string" ? parsed.word : normalize(raw2);
    const meaning_zh = typeof parsed.meaning_zh === "string" && parsed.meaning_zh.trim() ? parsed.meaning_zh.trim().slice(0, 60) : "\u6682\u65E0\u91CA\u4E49";
    return { word, meaning_zh, source: res.mocked ? "mock" : "llm" };
  } catch (err) {
    log8.warn(`Dictionary LLM fallback failed: ${err.message}`);
    return { word: normalize(raw2), meaning_zh: "\u6682\u65E0\u91CA\u4E49", source: "mock" };
  }
}
__name(lookupWord, "lookupWord");

// src/routes/dictionary.ts
var dictionaryRoutes = new Hono2();
dictionaryRoutes.get("/api/dictionary", async (c) => {
  const w = (c.req.query("w") ?? "").trim();
  if (!w) {
    return c.json(
      { error: { code: "INVALID_QUERY", message: 'query parameter "w" is required' } },
      400
    );
  }
  if (w.length > 50) {
    return c.json(
      { error: { code: "INVALID_QUERY", message: "word too long (max 50 chars)" } },
      400
    );
  }
  try {
    const mm = getMiniMaxEnv(c.env);
    const result = await lookupWord(mm, w);
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: { code: "DICTIONARY_FAILED", message: err.message } },
      500
    );
  }
});

// src/router.ts
var app = new Hono2();
app.use("*", cors({ origin: "*", credentials: false }));
app.route("/", scenariosRoutes);
app.route("/", sessionsRoutes);
app.route("/", historyRoutes);
app.route("/", statsRoutes);
app.route("/", vocabularyRoutes);
app.route("/", statusRoutes);
app.route("/", dictionaryRoutes);
app.get(
  "/health",
  (c) => c.json({ ok: true, ts: Date.now() })
);
app.notFound(
  (c) => c.json({ error: { code: "NOT_FOUND", message: "route not found" } }, 404)
);
app.onError((err, c) => {
  console.error(JSON.stringify({ scope: "router", msg: "unhandled", err: err.message }));
  return c.json({ error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
});

// src/ws/session-ws.ts
var log9 = createLogger("ws/session");
async function handleSessionWebSocket(server, deps, sessionId) {
  const mm = getMiniMaxEnv(deps);
  const env = { DB: deps.DB, AUDIO: deps.AUDIO, AUDIO_PUBLIC_BASE: deps.AUDIO_PUBLIC_BASE };
  const rec = await getSession(env.DB, sessionId);
  if (!rec) {
    try {
      server.close(1008, "session not found");
    } catch (err) {
      log9.warn(`Failed to close WS for missing session: ${err.message}`);
    }
    return;
  }
  server.accept();
  const state = { sessionId, asr: null, closed: false, mm, env };
  send(server, {
    type: "ready",
    payload: { session_id: sessionId, difficulty: rec.difficulty, mode: rec.mode },
    ts: Date.now()
  });
  server.addEventListener("message", (evt) => {
    if (state.closed) return;
    void handleMessage(server, state, evt.data).catch((err) => {
      log9.error(`WS handle error: ${err.message}`);
      send(server, {
        type: "error",
        payload: { code: "WS_INTERNAL", message: err.message },
        ts: Date.now()
      });
    });
  });
  server.addEventListener("close", () => {
    state.closed = true;
    cleanup(state);
    log9.info(`WS closed for session ${sessionId}`);
  });
  server.addEventListener("error", (evt) => {
    log9.warn(`WS error for ${sessionId}: ${evt.message ?? "unknown"}`);
    state.closed = true;
    cleanup(state);
  });
}
__name(handleSessionWebSocket, "handleSessionWebSocket");
function send(server, env) {
  try {
    server.send(JSON.stringify(env));
  } catch (err) {
    log9.warn(`WS send failed: ${err.message}`);
  }
}
__name(send, "send");
function cleanup(state) {
  if (state.asr) {
    try {
      state.asr.session.close();
    } catch (err) {
      log9.warn(`ASR cleanup failed: ${err.message}`);
    }
    state.asr = null;
  }
}
__name(cleanup, "cleanup");
async function handleMessage(server, state, raw2) {
  let msg;
  try {
    const text = typeof raw2 === "string" ? raw2 : new TextDecoder().decode(raw2);
    msg = JSON.parse(text);
  } catch {
    send(server, { type: "error", payload: { code: "BAD_JSON", message: "invalid JSON" }, ts: Date.now() });
    return;
  }
  switch (msg.type) {
    case "ping":
      send(server, { type: "pong", ts: Date.now() });
      return;
    case "config":
      return;
    // currently no-op; defaults to en / 16 kHz
    case "audio_chunk": {
      const payload = msg.payload ?? {};
      const b64 = payload.audio_base64;
      if (!b64) {
        send(server, {
          type: "error",
          payload: { code: "AUDIO_MISSING", message: "audio_base64 required" },
          ts: Date.now()
        });
        return;
      }
      await ingestAudioChunk(server, state, b64);
      return;
    }
    case "audio_end":
      await finaliseAudio(server, state);
      return;
    case "text": {
      const payload = msg.payload ?? {};
      const content = (payload.content ?? "").trim();
      if (!content) {
        send(server, {
          type: "error",
          payload: { code: "TEXT_EMPTY", message: "content required" },
          ts: Date.now()
        });
        return;
      }
      await runTurn(server, state, content);
      return;
    }
    case "request_tts": {
      const payload = msg.payload ?? {};
      const text = (payload.text ?? "").trim();
      if (!text) return;
      try {
        const tts = await textToAudio(state.mm, { text, voiceId: payload.voice_id ?? TTS_DEFAULT_VOICE });
        const bytes = new Uint8Array(tts.audio);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        send(server, {
          type: "ai_audio_chunk",
          payload: {
            audio_base64: btoa(binary),
            mime: tts.mime,
            mocked: tts.mocked
          },
          ts: Date.now()
        });
      } catch (err) {
        send(server, {
          type: "error",
          payload: { code: "TTS_FAILED", message: err.message },
          ts: Date.now()
        });
      }
      return;
    }
    default:
      send(server, {
        type: "error",
        payload: { code: "UNKNOWN_TYPE", message: `unknown type: ${String(msg.type)}` },
        ts: Date.now()
      });
  }
}
__name(handleMessage, "handleMessage");
async function ingestAudioChunk(server, state, b64) {
  if (!state.asr) {
    const session = new AsrSession(state.mm, { language: "en" });
    state.asr = { session, lastPartialSent: "", finalised: false };
    try {
      await session.open();
    } catch (err) {
      log9.warn(`ASR open failed, mock mode: ${err.message}`);
    }
  }
  const bin = atob(b64);
  const chunk = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) chunk[i] = bin.charCodeAt(i);
  try {
    state.asr.session.sendAudio(chunk);
  } catch (err) {
    log9.warn(`ASR send failed: ${err.message}`);
  }
  const partial = state.asr.session.getLastPartial();
  if (partial && partial !== state.asr.lastPartialSent) {
    state.asr.lastPartialSent = partial;
    send(server, { type: "transcript_partial", payload: { text: partial }, ts: Date.now() });
  }
}
__name(ingestAudioChunk, "ingestAudioChunk");
async function finaliseAudio(server, state) {
  if (!state.asr) {
    send(server, {
      type: "error",
      payload: { code: "NO_AUDIO", message: "no audio chunks to finalise" },
      ts: Date.now()
    });
    return;
  }
  let finalText = "";
  try {
    if (!state.mm.apiKey) {
      send(server, {
        type: "transcript_final",
        payload: { text: "", mocked: true, note: "ASR in mock mode; type your reply instead." },
        ts: Date.now()
      });
      cleanup(state);
      return;
    }
    const result = await state.asr.session.finish();
    finalText = result.text;
    send(server, {
      type: "transcript_final",
      payload: {
        text: result.text,
        confidence: result.confidence,
        mocked: result.mocked,
        language: result.language
      },
      ts: Date.now()
    });
  } catch (err) {
    log9.warn(`ASR finalise failed: ${err.message}`);
    send(server, {
      type: "error",
      payload: { code: "ASR_FAILED", message: err.message },
      ts: Date.now()
    });
  } finally {
    cleanup(state);
  }
  if (finalText.trim().length > 0) {
    await runTurn(server, state, finalText);
  }
}
__name(finaliseAudio, "finaliseAudio");
async function runTurn(server, state, userText) {
  const rec = await getSession(state.env.DB, state.sessionId);
  if (!rec) {
    send(server, { type: "error", payload: { code: "SESSION_NOT_FOUND", message: "session gone" }, ts: Date.now() });
    return;
  }
  if (rec.status === "completed") {
    send(server, { type: "error", payload: { code: "SESSION_COMPLETED", message: "session is completed" }, ts: Date.now() });
    return;
  }
  try {
    const userMsg = await appendMessage(state.env.DB, state.sessionId, { role: "user", content: userText });
    const prior = (await getMessages(state.env.DB, state.sessionId)).filter((m) => m.id !== userMsg.id);
    const llmContext = toLlmContext(prior);
    let score;
    if (rec.mode === "repeat") {
      const target = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index)?.ai_message ?? "";
      score = scoreRepeat(target, userText);
    } else {
      score = await scoreWithLlm(state.mm, userText, llmContext);
    }
    try {
      await runAsync(
        state.env.DB,
        `UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`,
        [score.overall_score, score.fluency, score.accuracy, JSON.stringify(score), userMsg.id]
      );
    } catch {
    }
    send(server, { type: "score", payload: score, ts: Date.now() });
    let aiMessage = "";
    if (rec.mode === "repeat") {
      const target = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index)?.ai_message ?? "";
      aiMessage = score.overall_score >= 80 ? `Great! You said "${userText}". Let's go to the next sentence.` : `Good try. The target was: "${target}". Please listen and try again.`;
    } else {
      const systemPrompt = buildConversationSystemPrompt(getSystemPrompt(rec.difficulty));
      const messages = [
        ...llmContext,
        { role: "user", content: userText }
      ];
      try {
        const resp = await chatCompletion(state.mm, {
          system: systemPrompt,
          messages,
          temperature: 0.7,
          maxTokens: 350
        });
        aiMessage = (resp.content ?? "").trim() || "(empty AI reply)";
      } catch (err) {
        aiMessage = `(AI unavailable: ${err.message})`;
      }
    }
    const aiMsg = await appendMessage(state.env.DB, state.sessionId, {
      role: "assistant",
      content: aiMessage
    });
    await advanceRound(state.env.DB, state.sessionId);
    let audioUrl = null;
    let audioBase64 = null;
    let audioMime = null;
    let mocked = false;
    try {
      const tts = await textToAudio(state.mm, { text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
      mocked = tts.mocked;
      audioMime = tts.mime;
      if (!mocked) {
        audioUrl = await saveAudioForSession(state.env, state.sessionId, tts.audio, tts.mime) || null;
      } else {
        const bytes = new Uint8Array(tts.audio);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        audioBase64 = btoa(binary);
      }
    } catch {
    }
    send(server, {
      type: "ai_message",
      payload: {
        content: aiMessage,
        audio_url: audioUrl,
        audio_base64: audioBase64,
        audio_mime: audioMime,
        mocked,
        round_index: rec.round_index
      },
      ts: Date.now()
    });
    if (audioUrl) {
      send(server, { type: "ai_audio_url", payload: { url: audioUrl }, ts: Date.now() });
    }
    send(server, {
      type: "session_state",
      payload: {
        session_id: state.sessionId,
        round_index: rec.round_index,
        last_user_message_id: userMsg.id,
        last_ai_message_id: aiMsg.id
      },
      ts: Date.now()
    });
  } catch (err) {
    log9.error(`runTurn failed: ${err.message}`);
    send(server, {
      type: "error",
      payload: { code: "TURN_FAILED", message: err.message },
      ts: Date.now()
    });
  }
}
__name(runTurn, "runTurn");

// src/index.ts
var log10 = createLogger("worker");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ws/session/")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket upgrade", { status: 426 });
      }
      const sessionId = decodeURIComponent(url.pathname.substring("/ws/session/".length));
      if (!sessionId) {
        return new Response("session id required", { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      try {
        await bootstrapDb(env.DB);
      } catch (err) {
        log10.error(`bootstrapDb failed: ${err.message}`);
        return new Response("db unavailable", { status: 503 });
      }
      const deps = {
        DB: env.DB,
        AUDIO: env.AUDIO,
        AUDIO_PUBLIC_BASE: env.AUDIO_PUBLIC_BASE,
        MINIMAX_API_KEY: env.MINIMAX_API_KEY,
        MINIMAX_GROUP_ID: env.MINIMAX_GROUP_ID,
        API_BASE: env.API_BASE,
        MINIMAX_TTS_VOICE: env.MINIMAX_TTS_VOICE,
        MINIMAX_TTS_MODEL: env.MINIMAX_TTS_MODEL,
        MINIMAX_ASR_MODEL: env.MINIMAX_ASR_MODEL,
        MINIMAX_LLM_MODEL: env.MINIMAX_LLM_MODEL,
        LOG_LEVEL: env.LOG_LEVEL
      };
      ctx.waitUntil(handleSessionWebSocket(server, deps, sessionId));
      return new Response(null, { status: 101, webSocket: client });
    }
    try {
      await bootstrapDb(env.DB);
    } catch (err) {
      log10.warn(`bootstrapDb on cold path failed: ${err.message}`);
    }
    return app.fetch(request, env, ctx);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
