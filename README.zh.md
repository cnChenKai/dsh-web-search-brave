# dsh-web-search-brave

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/v/dsh-web-search-brave" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/dm/dsh-web-search-brave" alt="npm downloads"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave"><img src="https://img.shields.io/github/stars/cnChenKai/dsh-web-search-brave" alt="GitHub stars"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cnChenKai/dsh-web-search-brave" alt="License"></a>
</p>

[English](README.md) | [中文](README.zh.md)

基于 [Brave Search](https://api.search.brave.com) 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 搜索 Provider，让内置的 `web_search` 工具走 Brave 搜索 Web API（`ctx.web` 能力接缝）。

**DSH 兼容性：** 已按 `0.2.0-rc.2` 验证。

## 特性

- **干净的摘要**：`text_decorations` 默认关闭，避免摘要中出现 `<b>` 高亮标记。
- **日期映射**：`page_age`（ISO 8601）映射到 `publishedAt`；人类可读的 `age` 会被忽略。
- **仅密钥模式**：Brave 无 keyless，免费档每月 2,000 次查询（[api.search.brave.com](https://api.search.brave.com)）。

## 安装

```sh
dsh plugin --profile web add dsh-web-search-brave
```

设置 API key：

```yaml
# ~/.dsh/.credentials.yaml
BRAVE_API_KEY: BSA...
```

切换 Provider（bundle 补丁会自动完成；手动切换方式）：

```yaml
# 你的 profile 的 cordis.patch.yml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: brave
```

## License

MIT
