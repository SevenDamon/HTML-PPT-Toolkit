# HTML PPT Author 使用说明

`html-ppt-author` 是一套面向可编辑 HTML 演示稿的 Codex Skill。它不负责替代视觉设计，而是确保 HTML PPT 能够继续编辑、稳定翻页、保存草稿、导出新版 HTML，并按需接入 PDF/PPTX 工作台。

发布地址：<https://github.com/SevenDamon/codexskill/tree/main/html-ppt-author>

## 安装

克隆 Skill 合集，然后把整个 `html-ppt-author/` 目录复制到 Codex Skills 目录。不要只复制 `SKILL.md`，因为编辑器、检查器和兼容协议都在配套目录中。

```powershell
git clone https://github.com/SevenDamon/codexskill.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.codex\skills" | Out-Null
Copy-Item -Recurse -Force ".\codexskill\html-ppt-author" "$env:USERPROFILE\.codex\skills\html-ppt-author"
```

安装后重启 Codex，或让客户端重新加载 Skills。完整工具包、Windows 启动器与本地导出工作台位于 <https://github.com/SevenDamon/HTML-PPT-Toolkit>。

## Skill、Full 转换和工作台有什么区别

| 名称 | 核心作用 | 需要记住的限制 |
| --- | --- | --- |
| `html-ppt-author` Skill | 给 Agent 提供制作规范、页面契约、编辑器和检查脚本，用来新建或改造可编辑 HTML PPT | 默认使用 Lite；Skill 本身不是 PDF/PPTX 导出后台 |
| 转换为 Full 编辑版 | 把工具栏永久安装到 HTML，生成可直接双击编辑的版本 | HTML 与同级 `html-ppt-editor/` 文件夹必须一起移动或分享 |
| HTML PPT 工作台 | 运行时临时外挂工具栏，并提供保存源文件、PDF/PPTX 导出服务 | 普通 HTML 只经工作台编辑，保存后不会因此永久带上工具栏 |

使用选择：Agent 新做 PPT 时调用 Skill；普通 HTML 想永久带工具栏时转换为 Full；编辑、保存源文件或导出 PDF/PPTX 时打开工作台。已经是最新版 Full 的 HTML 可以直接进工作台，不需要再次转换。

## 核心与发布关系

`html-ppt-toolkit` 是唯一维护源，编辑器、安装器和检查器都只在工具包中修改。`html-ppt-author` 是由工具包自动生成的便携 Skill，供 Codex 或其他 Agent 读取协议、制作新稿并安装同一套编辑器。

- 日常制作 HTML PPT：Agent 调用 Skill，默认使用 Lite。
- 把已有 HTML 转为带导出能力的编辑版：双击工具包的“把HTML变成通用编辑版”，固定使用 Full。
- 保存源文件、导出 PDF/PPTX：通过“启动HTML-PPT工作台”打开 Full 编辑版。
- 编辑器升级后：双击“构建并同步Skill”，自动重建 Skill 包、安装到 Codex，并校验文件哈希。

不要直接修改 `skill-package/html-ppt-author` 或已安装的 Skill；下次同步会覆盖这些生成结果。

## 与视觉设计 Skill 的正确配合顺序

`frontend-design` 和 `html-ppt-author` 可以在同一个任务中使用，但执行有明确先后：

1. `html-ppt-author` 先规定兼容结构，包括幻灯片 DOM、可编辑元素、翻页接口和动画标记。
2. `frontend-design` 在这些约束内完成版式、字体、配色和页面视觉。
3. `html-ppt-author` 最后安装 Lite 或 Full 工具栏，并运行兼容性检查。

```text
PPT 大纲与逐字稿
        ↓
html-ppt-author：确定可编辑结构
        ↓
frontend-design：完成视觉设计和 HTML 页面
        ↓
html-ppt-author：安装工具栏、检查和验收
        ↓
浏览器人工微调并导出新版 HTML
```

不要先让设计 Skill 完全自由地生成最终 HTML，再临时要求增加编辑功能。整页 Canvas、文字转图片、复杂 SVG 或封闭 iframe 可能导致页面只能观看，无法真正编辑。

## 快速开始：先说清楚目标

不要只说“调用 `html-ppt-author` 修改这个文件”。“修改”可能指内容调整、版式重做、结构修复、兼容性检查或安装编辑器，Agent 无法安全推断，因而会继续追问。

初始提示词至少应说明：

1. 要检查、升级还是修改内容。
2. 使用 Lite 还是 Full；没有 PDF/PPTX 需求时选 Lite。
3. 哪些内容和视觉必须保持不变。
4. 是否覆盖原文件；建议始终输出新文件。
5. 是否要求兼容性检查和浏览器实测。

## 可直接复制的初始提示词

将示例中的 `文件路径` 替换为实际 HTML 路径。

### 1. 已有 HTML 升级为 Lite 可编辑版

这是最常用的调用方式：

> 调用 `html-ppt-author` Skill，把 `文件路径` 升级为 Lite 可编辑版。保持原有内容、页序、视觉和动画不变，不覆盖原文件，输出一份新的 HTML。支持文字编辑、添加文字、图片替换、拖动缩放、删除元素、动画顺序调整、撤回重做、浏览器草稿和导出新版 HTML。完成后运行兼容性检查并进行浏览器测试。除非发现无法安全处理的结构性问题，否则直接执行，不需要再次确认需求。

Lite 不包含工具栏中的“页面整理”分组，也不会提供修改网页标题、专注显示或点选隐藏页面元素等页面级工具。

### 2. 只检查，不修改文件

> 调用 `html-ppt-author` 检查 `文件路径` 的页面结构、翻页笔兼容性、动画结构和可编辑性。只输出检查报告，不修改任何文件。

### 3. 已有 HTML 升级为 Full 可编辑版

> 调用 `html-ppt-author` Skill，把 `文件路径` 升级为 Full 可编辑版。保持原有内容、页序和视觉不变，不覆盖原文件。除网页编辑能力外，接入保存源 HTML、导出 PDF 和可编辑 PPTX 功能。完成后运行兼容性检查，并通过本地 HTML PPT 工作台实际测试保存和导出。除非存在结构性阻碍，否则直接执行。

Full 依赖本地工作台。如果目标电脑没有工作台，只安装工具栏并不能凭空获得 PDF/PPTX 后端能力。

### 4. 修改指定内容后安装编辑器

必须列出具体修改项：

> 调用 `html-ppt-author` 修改 `文件路径`：第一，交换第4页和第5页；第二，把第8页标题改为“这里填写新标题”；第三，其他内容和视觉保持不变；第四，最后安装 Lite 编辑器。输出新文件，不覆盖原文件，并完成兼容性检查和浏览器测试。

### 5. 从 PPT 大纲制作新的 HTML

在同一个任务中指定 `html-ppt-author` 和 `frontend-design`：

> 请先读取 `html-ppt-author` 的兼容协议，确定可编辑的幻灯片结构，再使用 `frontend-design` 根据 PPT 大纲设计并制作 HTML PPT。制作时遵守文字、图片、拖动、保护元素、翻页和动画标记要求。页面完成后继续使用 `html-ppt-author` 安装 Lite 工具栏，运行兼容性检查并进行浏览器测试。

需要 Full 时，把最后一句改为：

> 页面完成后安装 Full 工具栏，并通过本地 HTML PPT 工作台测试保存源 HTML、导出 PDF 和可编辑 PPTX。

## Agent 的实际执行步骤

收到明确指令后，Agent 应依次完成：

1. 读取项目规则、兼容协议，以及需要时的 Lite/Full 配置说明。
2. 检查目标 HTML，识别标准幻灯片或 iframe 模板结构。
3. 确认稳定页 ID、16:9 画布、翻页接口和翻页笔按键。
4. 标记可编辑文字、可替换图片、可拖动元素、动画元素和保护元素。
5. 修复必要的兼容性问题，但不擅自改变未授权的内容和视觉。
6. 安装指定的 Lite 或 Full 工具栏，并输出新文件。
7. 运行兼容性检查。
8. 在浏览器中测试翻页、编辑、添加文字、拖动和动画顺序等基本操作。
9. Full 模式还要通过本地工作台实际测试写回、PDF 和 PPTX。
10. 返回输出文件、检查结果和仍存在的限制。

## Lite 与 Full

### Lite

适合大多数 HTML PPT：

- 编辑和添加文字
- 调整字号与颜色
- 替换图片
- 移动、缩放和删除元素
- 设置逐步出现及出现顺序
- 撤回与重做
- 保存浏览器草稿
- 导出仍可编辑的新版 HTML

Lite 不包含“页面整理”工具栏分组。

### Full

包含 Lite 的全部能力，另外提供：

- 页面整理工具
- 写回源 HTML
- 导出 PDF
- 导出可编辑 PPTX
- 在适用的 iframe 课件中导出保真图片版 PPTX

Full 的写回、PDF 和 PPTX 功能需要配套的本地工作台。直接以 `file://` 打开 HTML 时，浏览器不能自行完成这些操作。

## 安装工具栏

```powershell
node scripts/install-editor.mjs input.html output.html --profile lite
node scripts/install-editor.mjs input.html output.html --profile full
```

如果没有指定配置档，默认使用 Lite。重复安装可以切换配置档，不需要重做 PPT 内容。

## 兼容性检查

```powershell
node scripts/check-deck.mjs output.html --profile lite
node scripts/check-deck.mjs output.html --profile full
```

检查通过只代表结构和配置符合要求。Full 模式的 PDF/PPTX 仍应在本地工作台中进行实际导出测试。

## 迁移到其他 Agent

迁移时复制整个 `html-ppt-author` 目录，不要只复制 `SKILL.md`：

```text
html-ppt-author/
├─ SKILL.md
├─ README.md
├─ agents/
├─ assets/
├─ references/
└─ scripts/
```

其他支持 Codex Skill 规范的 Agent 可以直接加载。普通 Agent 即使不支持自动调用 Skill，也可以读取 `SKILL.md`、兼容协议和脚本后按相同流程执行。Lite 最容易迁移；Full 还需要目标电脑具备本地工作台。
