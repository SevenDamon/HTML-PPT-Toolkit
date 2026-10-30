# HTML PPT 兼容契约 0.1

## 最小结构

```html
<main id="deck" data-ppt-deck>
  <section class="slide active" data-ppt-slide id="p01">...</section>
  <section class="slide" data-ppt-slide id="p02">...</section>
</main>
```

工具默认识别：

- 演示容器：`#deck`、`.stage` 或 `[data-ppt-deck]`
- 页面：`.slide` 或 `[data-ppt-slide]`
- 当前页：`.active`、`[aria-current="true"]` 或 `[data-active="true"]`

每页应有唯一 `id`。推荐主讲页 `p01`、`p02`，备用页 `b01`、`b02`。

## 建议尺寸

演示画布应固定为 16:9，推荐设计尺寸 `1920 × 1080`。页面缩放应由外层舞台或 CSS transform 完成，不要在保存时把缩放后的像素位置写回内容。

## 元素语义

工具会自动发现常见文本和图片，也可通过属性明确控制：

```html
<h1 data-ppt-editable data-ppt-draggable>标题</h1>
<img data-ppt-image data-ppt-draggable src="assets/photo.png" alt="照片">
<div data-ppt-animate data-animation-order="1">逐步出现</div>
<span data-ppt-protected>页码</span>
```

- `data-ppt-editable`：允许编辑文字。
- `data-ppt-image`：允许双击替换本地图片。
- `data-ppt-draggable`：允许拖动和调整尺寸。
- `data-ppt-animate`：加入逐步出现序列。
- `data-animation-order`：正整数，数字越小越先出现。
- `data-ppt-protected`：结构元素，不允许删除、移动或缩放。若容器内部某段文案需要编辑，可在具体文字节点上同时声明 `data-ppt-editable`；这只开放文字内容与文字样式，不开放结构操作。页码、进度条和导航控件不要添加该标记。

编辑器运行时添加的 `data-hppt-*` 属性属于持久化状态，可以随 HTML 保存。

## 翻页接口

推荐暴露：

```js
window.go = function (index) { /* 跳转到从 0 开始的页面索引 */ };
window.__getVisibleSlides = function () { return [...document.querySelectorAll('.slide')]; };
```

页面至少应支持 `PageDown/PageUp`、方向键、空格和 Enter。演示模式应拦截翻页笔可能产生的单独 `Alt` 信号。

## 动画约定

同一页内，按 `data-animation-order` 从小到大显示。下一页信号应优先推进本页尚未显示的动画元素；全部显示后再切换页面。上一页信号的回退策略由演示稿自行决定。

编辑器只管理“是否参与”和“出现顺序”，不强制覆盖页面自己的视觉动画样式。

## 导出约定

- 导出前应把当前 DOM 修改写入一份 HTML 快照。
- UI、选框、对齐线等编辑器临时节点不得进入导出内容。
- 本地替换图片应尽量转成 Data URL；无法嵌入时保留相对路径并提示用户连同素材目录一起迁移。
- PPTX 可编辑性以文字和基础形状为保证目标；复杂效果允许视觉回退。
- iframe 模板应同时提供“可编辑 PPTX”和“保真图片版 PPTX”，名称必须明确，不能把整页图片版称为可编辑。
- 第三方外层品牌栏只能通过可恢复的本地演示状态隐藏；不得默认删除脚本、版权元数据或不可恢复地改写原文件。

## Wise PPT 轨道式页面

带有 `data-runtime="wise-ppt-deck"` 的页面通常使用 `#deck > #deck-stage > #track > .slide`，通过轨道位移而不是 `.active` 控制当前页。共享编辑器应：

- 使用 `data-hppt-icon` 等私有属性，避免触发宿主的 `[data-icon]` 扫描器；
- 在不覆盖现有接口的前提下，将 `WisePPTRuntime.go(index)` 桥接为 `window.go(index)`；
- 让 `window.__getVisibleSlides()` 返回 `#track > .slide`；
- 仅在导出临时快照中把轨道页面规范化为 `#deck > .slide.active`，不得改变源文件的运行结构。

## 工具栏位置

- 工具栏应提供独立拖拽把手，不能把拖动手势与编辑开关混在一起。
- 拖动范围必须限制在当前浏览器或 iframe 的可视区域内，窗口尺寸变化后自动拉回可见区域。
- 展开内容高于可视区域时必须允许滚动，并至少保证工具栏头部始终可见。
- 工具栏尺寸应可在 70%–130% 范围内调节并本地记忆，默认使用较紧凑的 90%。
- 文本框应同时支持“移动模式”拖动和普通编辑模式直接按住拖动；整页容器不得被误判为单个元素的拖动组。
