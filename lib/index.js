import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { WebError } from "@deepseek-ai/dsh-web";

/**
 * Brave Search-backed provider for the web capability seam (ctx.web).
 * Calls the Brave Search Web API (GET {baseURL}/res/v1/web/search) with an
 * X-Subscription-Token key. No keyless mode: a key is required.
 */
const BRAVE_PROVIDER_ID = "brave";
const BRAVE_DEFAULT_BASE_URL = "https://api.search.brave.com";
const DEFAULT_API_KEY_ENV = "BRAVE_API_KEY";
const USER_AGENT = "deepseek-harness/0.2.1";

export const name = "web-search-brave";
export const inject = ["web"];

export const Config = z.object({
  apiKey: z.string().role("secret"),
  apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
  // Security: only the official endpoint is allowed unless explicitly opted in.
  // A custom baseURL still requires https and must never be used to exfiltrate
  // the API key to an arbitrary host.
  allowCustomBaseURL: z.boolean().default(false),
  // API count limit is 1-20 (default 20); the seam still enforces the bound.
  count: z.number().step(1).min(1).max(20).default(10),
  safesearch: z.union(["strict", "moderate", "off"]).default("moderate"),
  // text_decorations adds <b> highlight markers to snippets by default; the
  // seam renders raw text, so keep snippets clean.
  textDecorations: z.boolean().default(false),
  searchTimeoutMs: z.number().step(1).min(1).default(30000)
});

/** Official endpoint only. Rejects custom base URLs unless allowCustom is set. */
function resolveBaseURL(baseURL, allowCustom) {
  const canonical = (baseURL ?? BRAVE_DEFAULT_BASE_URL).replace(/\/+$/u, "");
  if (canonical === BRAVE_DEFAULT_BASE_URL) return canonical;
  if (allowCustom !== true) {
    throw new WebError(
      "custom baseURL " + JSON.stringify(canonical) + " is not allowed; only the official " + BRAVE_DEFAULT_BASE_URL + " is permitted unless allowCustomBaseURL: true",
      "WEB_PROVIDER_ERROR"
    );
  }
  if (!/^https:\/\//u.test(canonical)) {
    throw new WebError("custom baseURL must use https, got " + JSON.stringify(canonical), "WEB_PROVIDER_ERROR");
  }
  return canonical;
}

/**
 * Merge an upstream AbortSignal with a hard timeout. Uses AbortSignal.any so
 * either source cancels the request; a timeout aborts with a TimeoutError
 * reason while a caller cancellation keeps the caller's reason.
 */
function withTimeout(signal, timeoutMs) {
  if (timeoutMs == null || timeoutMs <= 0) return signal;
  const sources = [AbortSignal.timeout(timeoutMs)];
  if (signal !== void 0) sources.unshift(signal);
  return AbortSignal.any(sources);
}

function resolveOptions(ctx, config) {
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
  const literalApiKey = config.apiKey !== void 0 && config.apiKey.length > 0 ? config.apiKey : void 0;
  // Synchronous env snapshot for available() (the credentials store is async).
  const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
  const envKey = ambient !== void 0 && ambient.value.length > 0 ? ambient.value : "";
  const credentials = ctx.get("credentials");
  return {
    ...(literalApiKey === void 0 ? {} : { apiKey: literalApiKey }),
    envKey,
    // Presence of a credential resolver makes the provider provisionally
    // available. The key itself is resolved at search time, where a precise
    // WEB_PROVIDER_CREDENTIAL_MISSING error can be returned instead of making
    // configured-provider selection fail during an async startup probe.
    hasCredentialResolver: credentials !== void 0,
    resolveApiKey: async () => {
      if (credentials !== void 0) return (await credentials.resolve(apiKeyEnv))?.value;
      return envKey.length > 0 ? envKey : void 0;
    },
    apiKeyEnv,
    baseURL: resolveBaseURL(config.baseURL, config.allowCustomBaseURL === true),
    count: config.count ?? 10,
    safesearch: config.safesearch ?? "moderate",
    textDecorations: config.textDecorations ?? false,
    searchTimeoutMs: config.searchTimeoutMs ?? 30000
  };
}

class BraveSearchProvider {
  /**
   * @param options - resolved options supplier.
   * @param storeState - mutable { current: boolean } sampled by apply() from
   *   the credentials store (describe is async, so this is the closest the
   *   synchronous available() can get to store state).
   */
  constructor(options, storeState) {
    this.options = options;
    this.storeState = storeState;
  }
  get id() {
    return BRAVE_PROVIDER_ID;
  }
  /**
   * Synchronous usability check. A credential service is provisionally usable:
   * it resolves asynchronously at search time, so rejecting it here would race
   * the optional startup probe and hide a valid stored key from selection.
   */
  available() {
    const options = this.options();
    return (options.apiKey?.length ?? 0) > 0 || options.envKey.length > 0 || options.hasCredentialResolver === true || this.storeState?.current === true;
  }
  async search(request, signal) {
    const options = this.options();
    const apiKey = await this.apiKey(options, signal);
    throwIfSearchAborted(signal);
    const url = new URL(options.baseURL + "/res/v1/web/search");
    url.searchParams.set("q", request.query);
    url.searchParams.set("count", String(request.maxResults ?? options.count));
    url.searchParams.set("safesearch", options.safesearch);
    url.searchParams.set("text_decorations", String(options.textDecorations));
    url.searchParams.set("country", "all");
    const effectiveSignal = withTimeout(signal, options.searchTimeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "error",
        headers: {
          "x-subscription-token": apiKey,
          "accept": "application/json",
          "user-agent": USER_AGENT
        },
        ...(effectiveSignal !== void 0 ? { signal: effectiveSignal } : {})
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new WebError("Brave search timed out after " + options.searchTimeoutMs + "ms", "WEB_PROVIDER_ERROR", { cause: error });
      }
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      throw new WebError("Brave search request failed: " + String(error), "WEB_PROVIDER_ERROR", { cause: error });
    }
    if (!response.ok) {
      throw new WebError(await apiErrorMessage(response, "Brave"), "WEB_PROVIDER_ERROR");
    }
    try {
      return mapBraveResponse(await response.json());
    } catch (error) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      if (error instanceof WebError) throw error;
      throw new WebError("Brave returned an unprocessable response body: " + String(error), "WEB_PROVIDER_ERROR", { cause: error });
    }
  }
  async apiKey(options, signal) {
    throwIfSearchAborted(signal);
    if (options.apiKey !== void 0 && options.apiKey.length > 0) return options.apiKey;
    let resolved;
    try {
      resolved = await abortable(options.resolveApiKey?.() ?? Promise.resolve(void 0), signal);
    } catch (error) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      throw new WebError("Brave search credential resolution failed: " + String(error), "WEB_PROVIDER_ERROR", { cause: error });
    }
    if (resolved !== void 0 && resolved.length > 0) return resolved;
    throw new WebError(
      "Brave search has no API key for " + JSON.stringify(options.apiKeyEnv ?? DEFAULT_API_KEY_ENV) +
      "; store it through the credentials service, export it in the launching environment, or set a literal apiKey in the web-search-brave config",
      "WEB_PROVIDER_CREDENTIAL_MISSING"
    );
  }
}

function mapBraveResponse(body) {
  const results = Array.isArray(body?.web?.results) ? body.web.results : [];
  const sources = results
    .filter((item) => typeof item?.url === "string" && item.url.length > 0)
    .map((item) => {
      const source = { url: item.url };
      if (typeof item.title === "string" && item.title.length > 0) source.title = item.title;
      if (typeof item.description === "string" && item.description.length > 0) source.snippet = item.description;
      const date = pickPublishedAt(item);
      if (date !== void 0) source.publishedAt = date;
      return source;
    });
  return { sources, truncated: false };
}

/** Brave: page_age is the ISO 8601 date (publishedAt); age is human-readable. */
function pickPublishedAt(item) {
  for (const key of ["page_age", "age"]) {
    const value = item?.[key];
    if (typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value))) return value;
  }
  return void 0;
}

export function apply(ctx, config) {
  let current = () => config;
  // Keep a best-effort store-state sample for contexts where the credentials
  // service is later removed. Normal availability no longer depends on this
  // async probe: resolveOptions exposes the live resolver provisionally, and
  // search() resolves it before requesting Brave.
  const storeState = { current: false };
  const credentials = ctx.get("credentials");
  if (credentials !== void 0) {
    const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV);
    credentials.describe(apiKeyEnv).then((info) => {
      storeState.current = info?.configured === true;
    }).catch(() => {});
  }
  ctx.web.registerSearchProvider(new BraveSearchProvider(() => resolveOptions(ctx, current()), storeState));
}

function abortable(operation, signal) {
  if (signal === void 0) return operation;
  if (signal.aborted) return Promise.reject(searchAborted(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(searchAborted(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then((value) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error(String(error).replace(/^Error: /u, ""), { cause: error }));
    });
  });
}

function throwIfSearchAborted(signal) {
  if (signal?.aborted === true) throw searchAborted(signal);
}

function searchAborted(signal, fallback) {
  return new WebError("Brave search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function apiErrorMessage(response, provider) {
  let message = provider + " API error (HTTP " + response.status + ")";
  try {
    const parsed = await response.json();
    const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
    if (detail !== void 0 && detail.length > 0) message = detail;
  } catch {
    // non-JSON error body: keep the status-line message
  }
  return message;
}

export { BRAVE_PROVIDER_ID, BRAVE_DEFAULT_BASE_URL, DEFAULT_API_KEY_ENV, BraveSearchProvider, mapBraveResponse, pickPublishedAt, resolveBaseURL, withTimeout };
