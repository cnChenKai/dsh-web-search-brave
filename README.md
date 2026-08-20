# dsh-web-search-brave

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/v/dsh-web-search-brave" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/dm/dsh-web-search-brave" alt="npm downloads"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave"><img src="https://img.shields.io/github/stars/cnChenKai/dsh-web-search-brave" alt="GitHub stars"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cnChenKai/dsh-web-search-brave" alt="License"></a>
</p>

[English](README.md) | [中文](README.zh.md)

A [Brave Search](https://api.search.brave.com)-backed search provider for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web capability seam (`ctx.web`): it makes the built-in `web_search` tool run on Brave's Search Web API instead of the shipped DeepSeek route.

## Features

- **Clean snippets** - `text_decorations` defaults to false so snippets stay free of `<b>` highlight markers.
- **Dates** - `page_age` (ISO 8601) maps to the seam's `publishedAt`; human-readable `age` is ignored.
- **Keyed only** - Brave has no keyless mode; free tier: 2,000 queries/month at [api.search.brave.com](https://api.search.brave.com).

## Install

```sh
dsh plugin --profile web add dsh-web-search-brave
```

Set your API key in DSH's credential store (recommended) or export it in the environment that starts `dsh web`:

```yaml
# ~/.dsh/.credentials.yaml
BRAVE_API_KEY: BSA...
```

Select the provider (the bundle patch does this automatically; to switch manually):

```yaml
# your profile's cordis.patch.yml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: brave
```

## License

MIT
