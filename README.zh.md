# dsh-web-search-brave

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/v/dsh-web-search-brave" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/dsh-web-search-brave"><img src="https://img.shields.io/npm/dm/dsh-web-search-brave" alt="npm downloads"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave"><img src="https://img.shields.io/github/stars/cnChenKai/dsh-web-search-brave" alt="GitHub stars"></a>
  <a href="https://github.com/cnChenKai/dsh-web-search-brave/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cnChenKai/dsh-web-search-brave" alt="License"></a>
</p>

[English](README.md) | [中文](README.zh.md)

基于 [Brave Search](https://api.search.brave.com) 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 搜索 Provider，让内置的 `web_search` 工具走 Brave 搜索 Web API（`ctx.web` 能力接缝）。

**DSH 兼容性：** `0.2.5` 版已在本地使用 `0.2.2-rc.1` 测试。

## 特性

- **干净的摘要**：`text_decorations` 默认关闭，避免摘要中出现 `<b>` 高亮标记。
- **日期映射**：`page_age`（ISO 8601）映射到 `publishedAt`；人类可读的 `age` 会被忽略。
- **仅密钥模式**：Brave 无 keyless，免费档每月 2,000 次查询（[api.search.brave.com](https://api.search.brave.com)）。

## 安装

将 npm 包安装到目标 DSH profile（需要时将 `web` 替换为目标 profile）：

```sh
dsh plugin --profile web add dsh-web-search-brave@0.2.5
```


通过 credentials 服务保存 API key，或在启动 `dsh` 的环境中导出 `BRAVE_API_KEY`。当前凭据文件使用 `refs` 映射；手动编辑时保留已有条目：

```yaml
# $DSH_HOME/.credentials.yaml（默认 ~/.dsh/.credentials.yaml）
version: 1
refs:
  BRAVE_API_KEY: <your-key>
records: {}
```

Bundle 只挂载 provider，**不会**自动选中它。默认 web profile 固定使用 `deepseek-official`；请在 profile 补丁中选择 Brave，并保留原先使用的 fetch provider（默认值为 `http`）：

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: web
  config:
    searchProvider: brave
    fetchProvider: http
```

补丁会替换整个 `web` 配置，请同时保留其他需要的设置。修改 profile 补丁后重启 DSH。

## License

MIT
