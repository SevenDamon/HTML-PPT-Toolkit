# 许可证与第三方组件

本项目原创工具箱、编辑器、Skill 和文档使用根目录的 MIT 许可证。

## 转换引擎

`vendor/export-engine/packages/html-deck-to-pptx/src/` 中的 `editable.mjs` 和 `screenshot.mjs` 来自 DashiAI PPT 的 `html-deck-to-pptx`（包版本 0.1.0，本次取自 runtime 0.1.36）。保留原始源码及同目录上级的 `LICENSE` 和包元数据：Copyright (c) 2026 DashiAI PPT contributors，MIT。

这两份转换源码固定随仓库发布；不要求用户安装 DashiAI Skill。`vendor/export-engine/scripts/` 是本项目的浏览器启动适配代码，适用根目录 MIT 许可，不是第三方转换源码。

## 完整发布包依赖

Windows Full ZIP 另含 Node.js、Playwright/Chromium 及转换依赖。这些组件不改用本项目许可证，须遵循各自的许可证和声明。完整依赖清单见 ZIP 内 `PORTABLE-INFO.json`；具体许可见各组件随包文件：

| 组件 | 许可位置 / 说明 |
| --- | --- |
| Node.js | `runtime/node/LICENSE`（含第三方声明） |
| Playwright Core | `vendor/export-engine/node_modules/playwright-core/LICENSE`、`NOTICE` |
| PptxGenJS | `vendor/export-engine/node_modules/pptxgenjs/LICENSE` |
| pdf-lib、pngjs 及其依赖 | 各自 `node_modules` 包内 LICENSE/NOTICE |
| Chromium、FFmpeg 等浏览器运行时 | `runtime/browsers/` 内组件附带的 LICENSE、credits 和声明 |

构建脚本完整复制运行时包和依赖，不剥离许可证；再次分发时也应保留这些文件。Git 仓库不保存下载的浏览器和 Node 二进制，完整包通过 GitHub Releases 分发。

## 作者标识与用户课件

关于窗口中的作者名称、个人微信及公众号二维码是作者联系信息，不代表给衍生项目提供身份背书。第三方课件、图片和品牌标识不因使用此工具而获得额外许可；它们不属于本仓库的示例内容或许可证授权范围。
