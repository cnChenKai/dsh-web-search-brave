import { describe, it, expect } from "vitest";
import { mapBraveResponse, pickPublishedAt } from "../lib/index.js";

describe("mapBraveResponse", () => {
  it("maps web.results with page_age as publishedAt", () => {
    const result = mapBraveResponse({
      web: {
        results: [
          { title: "Brave One", url: "https://x.com", description: "desc", page_age: "2026-08-06T00:05:04" }
        ]
      }
    });
    expect(result.truncated).toBe(false);
    expect(result.sources[0]).toEqual({
      url: "https://x.com",
      title: "Brave One",
      snippet: "desc",
      publishedAt: "2026-08-06T00:05:04"
    });
  });

  it("ignores human-readable age for publishedAt", () => {
    const result = mapBraveResponse({
      web: { results: [{ url: "https://x.com", age: "2 hours ago" }] }
    });
    expect(result.sources[0].publishedAt).toBeUndefined();
    expect(result.sources[0].url).toBe("https://x.com");
  });

  it("drops url-less entries", () => {
    const result = mapBraveResponse({
      web: { results: [{ title: "no url" }, { url: "https://y.com" }] }
    });
    expect(result.sources).toHaveLength(1);
  });

  it("handles empty and missing responses", () => {
    expect(mapBraveResponse({}).sources).toEqual([]);
    expect(mapBraveResponse({ web: null }).sources).toEqual([]);
    expect(mapBraveResponse({ web: { results: [] } }).sources).toEqual([]);
  });
});

describe("pickPublishedAt", () => {
  it("prefers page_age (ISO) over human-readable age", () => {
    expect(pickPublishedAt({ page_age: "2026-08-01T00:00:00", age: "3 days ago" })).toBe("2026-08-01T00:00:00");
  });

  it("returns undefined for non-ISO values and empty objects", () => {
    expect(pickPublishedAt({ age: "2 hours ago" })).toBeUndefined();
    expect(pickPublishedAt({})).toBeUndefined();
    expect(pickPublishedAt(null)).toBeUndefined();
  });
});

import { resolveBaseURL, withTimeout, BraveSearchProvider } from "../lib/index.js";

const braveOptions = (overrides = {}) => ({
  apiKey: undefined,
  envKey: "",
  hasCredentialResolver: false,
  storeState: { current: false },
  ...overrides
});

describe("BraveSearchProvider.available", () => {
  it("returns false when no key is configured anywhere", () => {
    const p = new BraveSearchProvider(() => braveOptions(), { current: false });
    expect(p.available()).toBe(false);
  });

  it("returns true with a literal config key", () => {
    const p = new BraveSearchProvider(() => braveOptions({ apiKey: "BSA-key" }), { current: false });
    expect(p.available()).toBe(true);
  });

  it("returns true with an environment key", () => {
    const p = new BraveSearchProvider(() => braveOptions({ envKey: "BSA-key" }), { current: false });
    expect(p.available()).toBe(true);
  });

  it("returns true when a credential resolver is present before its async probe settles", () => {
    const p = new BraveSearchProvider(() => braveOptions({ hasCredentialResolver: true }), { current: false });
    expect(p.available()).toBe(true);
  });

  it("returns true when the credentials store holds the key (sampled at apply)", () => {
    const p = new BraveSearchProvider(() => braveOptions(), { current: true });
    expect(p.available()).toBe(true);
  });
});

describe("resolveBaseURL (brave)", () => {
  it("accepts the official endpoint by default", () => {
    expect(resolveBaseURL(undefined, false)).toBe("https://api.search.brave.com");
  });

  it("rejects custom baseURL unless explicitly allowed", () => {
    expect(() => resolveBaseURL("https://evil.example.com", false)).toThrow(/not allowed/);
  });

  it("rejects non-https custom baseURL even when opted in", () => {
    expect(() => resolveBaseURL("http://evil.example.com", true)).toThrow(/must use https/);
  });
});

describe("brave search timeout enforcement", () => {
  it("fails with WEB_PROVIDER_ERROR and a timeout message", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (_url, opts) => new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => {
        reject(opts.signal.reason ?? new DOMException("Aborted", "AbortError"));
      });
    });
    const provider = new BraveSearchProvider(() => braveOptions({
      apiKey: "BSA-key",
      baseURL: "https://api.search.brave.com",
      count: 5,
      safesearch: "moderate",
      textDecorations: false,
      searchTimeoutMs: 50
    }), { current: false });
    try {
      await expect(provider.search({ query: "x" })).rejects.toMatchObject({ code: "WEB_PROVIDER_ERROR" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
