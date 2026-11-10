# dsh-web-search-brave

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/v/dsh-web-search-brave" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/dm/dsh-web-search-brave" alt="npm downloads"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave"><img src="https://img.shields.io/github/stars/cnChenKai/dsh-web-search-brave" alt="GitHub stars"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cnChenKai/dsh-web-search-brave" alt="License"></a>
</p>

[English](README.md) | [中文](README.zh.md)

A [Brave Search](https://api.search.brave.com)-backed search provider for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web capability seam (`ctx.web`): it makes the built-in `web_search` tool run on Brave's Search Web API instead of the shipped DeepSeek route.

**DSH compatibility:** tested locally with `0.2.2-rc.1`. This checkout is version `0.2.5` and is **not published**; npm's latest published version is `0.2.4` and does not contain these local compatibility changes.

## Features

- **Clean snippets** - `text_decorations` defaults to false so snippets stay free of `<b>` highlight markers.
- **Dates** - `page_age` (ISO 8601) maps to the seam's `publishedAt`; human-readable `age` is ignored.
- **Keyed only** - Brave has no keyless mode; free tier: 2,000 queries/month at [api.search.brave.com](https://api.search.brave.com).

## Install

From this checkout, pack the unpublished local source and install the resulting tarball into the DSH profile (the absolute path is important because DSH runs pnpm inside the profile directory):

```sh
npm pack
TARBALL="$PWD/dsh-web-search-brave-0.2.5.tgz"
dsh plugin --profile web add "$TARBALL"
```

Run these commands in the repository root. Keep the tarball at that path while the profile uses the file dependency. Installing by package name instead fetches the older published npm release, not this checkout.

Set your API key through the credentials service, or export `BRAVE_API_KEY` in the environment that starts `dsh`. The current credential file format uses a `refs` mapping; preserve any existing entries if editing it directly:

```yaml
# $DSH_HOME/.credentials.yaml (default: ~/.dsh/.credentials.yaml)
version: 1
refs:
  BRAVE_API_KEY: <your-key>
records: {}
```

The bundle mounts the provider but does **not** select it. The shipped web profile pins `deepseek-official`, so select Brave in your profile patch, preserving the fetch provider you already use (the shipped default is `http`):

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: web
  config:
    searchProvider: brave
    fetchProvider: http
```

A patch replaces the entire `web` config, so retain any other settings you need. Restart DSH after changing the profile patch.

## License

MIT
