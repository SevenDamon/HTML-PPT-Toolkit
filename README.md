# HTML PPT Toolkit

一套面向离线 HTML 演示稿的通用工具，不绑定某一场课程内容。

当前版本：`0.7.5`

项目仓库：<https://github.com/SevenDamon/HTML-PPT-Toolkit>

## 获取与运行

### Windows 直接使用

1. 下载或克隆本仓库。
2. 双击 `HTML-PPT-Toolkit.exe`。
3. 在窗口中选择“转换为 Full 编辑版”“打开 HTML PPT 工作台”或“构建并同步 Skill”。

```powershell
git clone https://github.com/SevenDamon/HTML-PPT-Toolkit.git
cd HTML-PPT-Toolkit
```

运行转换、检查和本地工作台需要 [Node.js](https://nodejs.org/) 18 或更高版本。网页内的文字、图片、图形和布局编辑不依赖在线服务；PDF/PPTX 导出还需要本机安装 `dashiai-ppt` Skill 所带的转换引擎，或通过环境变量 `DASHI_PPT_PROJECT` 指向兼容引擎目录。

> 仓库目前以 Windows 使用体验为主。核心编辑器和 Node.js 脚本可跨平台使用，但 EXE、CMD、PowerShell 启动入口仅面向 Windows。

## 先看懂三者区别

| 功能 | 一句话作用 | 工具栏是否永久进入 HTML | 主要使用场景 |
| --- | --- | --- | --- |
| `html-ppt-author` Skill | 告诉 Agent 怎样制作符合规范的可编辑 HTML PPT，并附带便携编辑器 | Agent 可按需要安装 Lite 或 Full | 让 Agent 从大纲制作新 PPT，或由 Agent 改造旧 PPT |
| 转换为 Full 编辑版 | 把工具栏永久安装到现有 HTML，并复制配套的 `html-ppt-editor/` 目录 | 是 | 希望以后直接双击 HTML 也能编辑，或升级旧编辑器 |
| HTML PPT 工作台 | 临时给网页外挂工具栏，同时提供保存源文件、PDF 和 PPTX 后台 | 否；普通 HTML 保存后仍是普通 HTML | 本机编辑、保存源文件、导出 PDF/PPTX |

最简单的判断：

- 让 Agent 新做 PPT：用 Skill。默认 Lite；如果要导出 PDF/PPTX，直接要求 Agent 制作 Full。
- 已有普通 HTML，希望直接双击也能编辑：先“转换为 Full 编辑版”。
- 只想立即编辑或导出：直接用工作台打开，不必先转换。
- 已经是最新版 Full HTML：直接用工作台，不要重复转换。

Full HTML 直接双击时可以编辑和导出新版 HTML；“保存回源文件”、PDF 和 PPTX 仍必须通过工作台。移动或分享 Full HTML 时，要把 HTML 和同级 `html-ppt-editor/` 文件夹一起带走。

它分为四层，并且只有一套编辑器核心：

- `editor/`：可嵌入任意兼容 HTML 演示稿的前端编辑器。工具栏采用紧凑双列分组，通过 `⠿` 把手可拖动位置，顶部 `− / +` 可在 70%–130% 之间调整大小，位置与尺寸均自动保存。数字输入格隐藏浏览器原生的大号上下箭头，采用居中等宽数字显示，仍可点击直接输入。新增文本框在普通状态下可直接拖动；文字进入编辑状态后，框内左键拖动用于选择文字，拖动选中框的青色边框用于移动，八个圆形控制点用于缩放。文字颜色和字号都支持整框修改，也支持先选择局部文字后只修改选区；直接从原有文字开始框选时会自动识别所属文本框并启用文字工具。支持文字编辑、添加文字、图片添加/替换/裁剪，以及 HTML/CSS 图形的显式选择；图形库可添加矩形、圆角矩形、圆/椭圆、三角形、菱形、五边形、六边形、平行四边形、梯形、燕尾箭头、右箭头和五角星，并支持移动缩放、填充色、边框、圆角、透明度和层级调整；同时支持对齐线、动画顺序、撤销/重做、本地草稿和导出 HTML。
- `studio/`：本地工作台。除前端编辑能力外，提供保存源文件、导出 PDF 和导出可继续编辑的 PPTX。
- `scripts/`：安装与兼容性检查工具。
- `skill/`：Skill 的维护源；`skill-package/html-ppt-author/` 和 Codex 中已安装的 Skill 都由它自动生成。

## 唯一核心与两种入口

`html-ppt-toolkit` 是唯一维护源。编辑器、安装器和检查器只在这里修改；`html-ppt-author` Skill 是便携发布包，不再单独维护另一套逻辑。

- Agent 新建或改造 HTML PPT：使用 `html-ppt-author`，默认安装 Lite，只保留网页内编辑与导出 HTML。
- 把现有 HTML 转成完整编辑工作稿：使用“把HTML变成通用编辑版”，固定安装 Full。
- 保存回源 HTML、导出 PDF/PPTX：使用“启动HTML-PPT工作台”。工作台会尊重已有的明确 Lite/Full 配置；没有配置时按 Full 打开。
- 修改核心后：双击“构建并同步Skill”，重建便携 Skill、安装到 Codex，并逐文件校验哈希。

不要直接修改 `skill-package/html-ppt-author/` 或本机 `$CODEX_HOME/skills/html-ppt-author/`，它们都是生成结果。

## 最快使用方式

日常只需要记住并双击 `HTML-PPT-Toolkit.exe`，也可以使用 `HTML-PPT工具箱.cmd` 打开同一个窗口。窗口中包含“转换为 Full 编辑版”“打开 HTML PPT 工作台”“构建并同步 Skill”和“使用说明”入口；原来的三个 CMD 仍作为底层功能保留。EXE 的可重复构建源码位于 `launcher/`，构建脚本为 `scripts/build-launcher.ps1`。

把一个 HTML 演示稿拖到 `启动HTML-PPT工作台.cmd` 上，或双击启动器后选择文件。

工作台会在浏览器中打开演示稿。网页内修改可保存回源文件；保存前会在源文件旁生成带时间戳的 `.bak-...` 备份。

## 给现有 HTML 安装编辑器

最简单的方式：把原 HTML 拖到 `把HTML变成通用编辑版.cmd` 上，或者双击该脚本后选择文件。它固定生成 Full 编辑版，并自动：

1. 保留原文件；
2. 生成 `原文件名_通用编辑版.html`；
3. 安装共享编辑器；
4. 清理本工具早期版本的旧工具栏；
5. 运行兼容性检查；
6. 询问是否立即用工作台打开。

如需命令行操作，也可以使用下面的方式。

```powershell
node scripts/install-editor.mjs "D:\deck.html" "D:\deck-lite.html" --profile lite
node scripts/install-editor.mjs "D:\deck.html" "D:\deck-full.html" --profile full
```

如页面已经包含旧版编辑工具栏，可创建一份移除旧运行时的副本：

```powershell
node scripts/install-editor.mjs "D:\deck.html" "D:\deck-通用工具版.html" --profile full --strip-legacy
```

安装脚本会把编辑器复制到目标 HTML 同级的 `html-ppt-editor/` 目录，并写入相对路径引用。这样整个目录可以一起迁移。

## 兼容性检查

```powershell
node scripts/check-deck.mjs "D:\deck.html" --profile lite
node scripts/check-deck.mjs "D:\deck.html" --profile full
```

详细页面契约见 [SPEC.md](SPEC.md)。示例见 `examples/demo.html`。

## Agent / Codex 协作

配套 Skill 的维护源位于 `skill/`，构建结果位于 `skill-package/html-ppt-author/`，本机安装名为 `$html-ppt-author`。以后让 Agent 新建或迁移 HTML PPT 时调用这个 Skill，它会先遵守统一页面契约，再安装共享编辑器并运行兼容性检查。

核心升级后运行：

```powershell
node scripts/build-skill.mjs --install
```

也可以直接双击 `构建并同步Skill.cmd`。

Skill 自带编辑器运行时和安装脚本，因此不依赖本培训项目的目录。把 Skill 与 `html-ppt-toolkit/` 一起复制到另一台电脑时，网页编辑能力可以独立迁移；PDF/PPTX 仍要求目标电脑具备 Node.js 和 DashiAI PPT 转换引擎。

Skill 也单独发布在 [`SevenDamon/codexskill`](https://github.com/SevenDamon/codexskill) 的 `html-ppt-author/` 目录。只需要 Agent 制作规范与 Lite 网页编辑能力时，可以仅安装该目录；需要 Full 的源文件写回和 PDF/PPTX 后端时，仍需本工具包。

## 开发与验证

```powershell
npm run build-skill
node scripts/check-deck.mjs examples/demo.html --profile lite
npm run studio -- --file examples/demo.html
```

工作台启动后，把控制台输出的本地页面 URL 传给浏览器测试脚本：

```powershell
node scripts/smoke-test.mjs "http://127.0.0.1:5537/examples/demo.html"
node scripts/test-selective-text-color.mjs "http://127.0.0.1:5537/examples/demo.html"
node scripts/test-shape-library.mjs "http://127.0.0.1:5537/examples/demo.html"
node scripts/test-text-selection-border-move.mjs "http://127.0.0.1:5537/examples/demo.html"
```

`smoke-test-iframe.mjs` 需要传入一个实际的 iframe 模板课件 URL，不应对标准示例页运行。

修改编辑器核心后运行 `npm run sync-skill`，会从 `skill/` 重建 `skill-package/html-ppt-author/`，并同步到本机 Codex Skills 目录。生成包不应手工维护。

## 能力边界

- HTML 导出保留网页版本中的编辑能力和网页动效。
- PDF 是静态页面快照，不包含动效。
- PPTX 会尽量把文字与基础形状转换为 PowerPoint 可编辑对象；复杂 CSS、蒙版、滤镜、图表和特殊视觉可能栅格化或降级。
- HTML 动效不会自动转换为 PowerPoint 动画。两套动画引擎的数据模型不同，强行等价转换会产生不稳定结果。
- 直接用 `file://` 打开时，浏览器安全限制下只能导出 HTML；保存源文件、PDF、PPTX 需要通过本地工作台打开。

## iframe 模板课件

工具现已识别“外层网页 + `iframe srcdoc` + 多个 `template.page-data`”的课件格式，例如飞象老师导出的互动课件。转换脚本会自动安装 iframe 适配器：

- 工具栏显示在当前真正的课件页面内；
- 切换页面后自动重新挂载；
- 修改以页面状态保存在完整外层 HTML 中；
- “切换专注显示”只做可恢复的临时隐藏；“点选删除页面元素”会在保存源 HTML 或导出 HTML 时永久移除所选可见 DOM 节点，并可用“撤回上次页面删除”在保存前恢复；课件主体、承载 iframe、脚本和元数据默认受保护；
- PDF 使用视觉截图导出；
- `PPT` 导出可编辑版：把 iframe 页面展开后，将文字和基础形状转换为 PowerPoint 对象；
- `IMG` 导出保真版：每页作为整页图片，视觉更稳，但内容不可逐项编辑。

可编辑版的文字和基础形状可以在 PowerPoint 中修改，但复杂蒙版、渐变、滤镜、交互组件和部分图片效果仍可能栅格化；网页动效也不会变成 PowerPoint 动画。需要完全保真时使用 `IMG`，需要继续改字和改基础形状时使用 `PPT`。隐藏或删除第三方品牌标识前，应确认你对课件拥有相应使用和修改权限。
