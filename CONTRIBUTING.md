# 参与开发

请先读 `AGENTS.md`。问题反馈请包含工具箱版本、浏览器、复现步骤和最小 HTML 示例；避免上传含个人信息或未获授权的真实课件。

## 从源码运行

需要 Node.js 22+；Windows 桌面启动器需要 .NET Framework 和 Windows PowerShell 或 PowerShell 7。

```powershell
git clone https://github.com/SevenDamon/HTML-PPT-Toolkit.git
cd HTML-PPT-Toolkit
npm ci --prefix vendor/export-engine
node vendor/export-engine/node_modules/playwright-core/cli.js install chromium-headless-shell
node scripts/build-skill.mjs
node scripts/check-deck.mjs examples/demo.html --profile lite
node studio/server.mjs --file examples/demo.html
```

核心转换源码和许可已在仓库中，不依赖 Codex 私有目录。可选的 `DASHI_PPT_PROJECT` 仅用于兼容已有环境及复用构建依赖。

## 维护位置

- `editor/`：共享编辑器唯一源；Lite/Full 使用配置区分。
- `skill/`：Skill 文档唯一源。
- `skill-package/html-ppt-author/`：生成的完整安装包，勿手工改。
- `studio/`：本地保存、导出与页面适配。
- `vendor/export-engine/`：固定的 MIT 转换源码及依赖清单。
- `launcher/`：Windows 启动器及作者资源。

修改后运行相关的 `scripts/test-*.mjs` 或 smoke 测试。编辑器或 Skill 变化后执行 `node scripts/build-skill.mjs`；需要更新本机安装时加 `--install`。不要提交用户课件、导出文件、密钥或本机运行时目录。

## 完整分发包

Windows 上先执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-launcher.ps1`，再执行 `node scripts/build-portable.mjs <不存在的输出目录>`。浏览器可通过 `PORTABLE_BROWSER_DIR` 复用，Node 许可可通过 `NODE_LICENSE_FILE` 复用；否则构建时下载。输出含源码、Skill、Node、转换依赖、导出浏览器及许可文件。测试完整包的保存与两种导出后，压缩为 Release 附件，不提交大体积运行时到 Git。
