# Compatibility contract

## DOM

The deck container must match `#deck`, `.stage`, or `[data-ppt-deck]`. Slides must match `.slide` or `[data-ppt-slide]`. Exactly one slide should be active at startup. Give every slide a unique stable id.

```html
<main id="deck" data-ppt-deck>
  <section id="p01" class="slide active" data-ppt-slide>...</section>
  <section id="p02" class="slide" data-ppt-slide>...</section>
</main>
```

Use a fixed 16:9 design canvas, preferably 1920 × 1080.

## Attributes

- `data-ppt-editable`: editable text.
- `data-ppt-image`: replaceable image.
- `data-ppt-draggable`: movable and resizable element.
- `data-ppt-animate`: progressive reveal item.
- `data-animation-order="N"`: reveal order.
- `data-ppt-protected`: protected structural element. A descendant explicitly marked with `data-ppt-editable` may still edit its text and text styling, while delete, drag, resize, and reveal animation remain locked. Do not mark page numbers, progress indicators, or navigation controls editable.

The editor incrementally discovers missing text even on partially annotated slides. Static text in protected headers, notes and content button labels is editable in place while protected layout/delete/reveal restrictions remain. Numeric page counters, progress indicators, navigation actions and editor UI stay locked. Set `data-ppt-text-locked` to opt a custom region out of automatic text discovery. Mixed containers wrap only missing direct text runs, preserving nested actions and marked content. Use explicit attributes for nonstandard components and protected structure.

Module inference includes borderless repeated semantic containers with multiple editable descendants, not just painted cards. Use `data-ppt-module` for explicit custom modules. Avoid selecting the slide/content root or a whole diagram when a smaller repeated node exists. Ctrl-click (Cmd-click on macOS) toggles temporary multi-selection; module mode selects the enclosing module, otherwise it selects the individual editable element. Normal clicks clear temporary multi-selection, while protected metadata and editor UI remain excluded.

Use `data-ppt-caption` for image captions that mix editable descriptive text with protected action labels. The editor wraps only direct text nodes in editable spans, leaving nested actions intact. It also recognizes `.evidence-image > span` and `figure > figcaption`; do not unlock all protected nodes. A caption inside protected structure edits in place instead of dragging its enclosing image group.

## Runtime

The shared editor provides page sorting, duplication, deletion, and undo/redo for sibling DOM slides (including Wise track slides). Hosts with captured slide arrays must listen for `hppt:pages-changed` and replace their array with `event.detail.slides`; preserve stable page identities for content-specific prompts/dialogs. Page numbers and directory labels may update, but content references must not be rewritten as positions. Iframe-template page management is not supported yet. Lite and Full both expose the page manager.

Expose `window.go(index)` for zero-based page jumps and `window.__getVisibleSlides()`. Support PageDown, PageUp, all four arrow keys, Space, and Enter. Prevent a standalone Alt signal from focusing the browser menu in presentation mode.

A next signal should reveal the next hidden item before changing slides, sorted by positive `data-animation-order`.

Elements with the same `data-hppt-reveal-group` on a slide reveal/hide together and share one animation order. Order normalization and timeline movement must preserve the group. Never wrap unrelated DOM nodes to implement simultaneous reveal. For module selection, target an existing unprotected card container and animate/move it as a unit; avoid nesting child reveal steps under an animated parent. The shared editor supports module picking and multi-selection for this workflow. Custom click/autoplay handlers should honor reveal groups; the SDK intercepts common presentation keys and `data-action="next/prev"` buttons.

## Persistence and export

Element/module copy uses one in-deck clipboard and computed-style DOM snapshots, not plain text. Toolbar copy/paste and Ctrl/Cmd+C/V retain editable descendants; noncollapsed text selections retain native text copying. Ctrl/Cmd+D duplicates the selected objects. Insert copies as positioned objects without reflowing existing content; regenerate DOM ids, local id references, editor keys and reveal group identities. Keep copied synchronized groups independent of their originals. Object roots use `data-hppt-object-copy` and full structural snapshots for undo/redo, drafts and export. Do not freeze editor-only visibility, selection outlines or reveal opacity into copied presentation styles. Arbitrary script event bindings and Canvas state are not cloned.

Editor chrome uses shared `--hppt-ui-*` surface, text, accent, border, shadow and font tokens. Page management keeps the settings sidebar separate from the scrolling thumbnail area; window dragging/resizing must clamp within the viewport. These window controls are editor UI only and must not alter slide content or exported presentation geometry. When upgrading a portable HTML, remove only the recognizable inline shared runtime and its `data-shared-editor` stylesheet; preserve all host scripts and content.

Page backgrounds chosen from local files must be embedded as Data URLs, participate in page-style snapshots, and survive HTML export and reopening. Offer cover/contain fitting and removal. Display the selected canvas aspect ratio and recommended pixels (16:9: 1920×1080, optional 3840×2160); make crop-vs-letterbox behavior explicit.

Image controls use a non-modal draggable contextual bar. Live slider input and numeric input share values; commit one history entry per completed gesture. Persist flip transforms in the independent CSS `scale` property so rotation and drag translation compose correctly. Mark the entire bar with `data-hppt-ui` and remove it from exports. Clamp it to the viewport and hide it when selection or the active page changes.

Blank pages inherit the selected page's computed background and canvas size, without copying content. Their styles and newly created page DOM must be part of structural snapshots so color edits, page creation, undo/redo, and drafts remain consistent. Image effects are persisted as inline CSS (independent `rotate`, `border-radius`, `clip-path`, `mask-image`, `opacity`); rotation must not overwrite drag translation. Image effects apply to IMG nodes. Shape masks replace rectangle clipping, while gradient masks compose with shape masks. Editable PPTX may rasterize or simplify these effects.

Persist edits in the DOM. Prefer Data URLs for replaced local images. Exclude editor UI, selection boxes, guides, and transient nodes from exported snapshots.

HTML retains HTML editing and animation. PDF is static. PPTX should keep text and basic shapes editable where supported; complex CSS may use a visual fallback. HTML animation does not imply PowerPoint animation.

## Editor profile marker

Installed decks must declare one explicit editor profile before loading the shared runtime:

```html
<script data-html-ppt-profile>window.HTML_PPT_EDITOR_PROFILE="lite";</script>
```

Valid values are `lite` and `full`. If the marker is missing, the runtime defaults to `lite` for safety. A deck may supply `window.HTML_PPT_EDITOR_CONFIG.features` for narrow feature overrides, but profile selection should remain the normal integration path.

Lite is self-contained browser editing: edit text, replace images, move/resize elements, configure reveal order, undo/redo, save a browser draft, and export an editable HTML copy. Full exposes the same editor plus save-source, PDF, and PPTX controls. Those Full operations require the local studio or equivalent handlers; they cannot work from a directly opened `file://` document.

## Iframe template decks

Some exported courseware wraps the real presentation in `iframe.content-iframe[srcdoc]` and stores pages as encoded `<template class="page-data">` blocks. Treat this as the `iframe-template` format. Install `html-ppt-frame-adapter.js` together with the editor runtime. The adapter edits the active inner frame and persists changes as page state in the outer HTML.

Offer two clearly named PPTX modes for this format. Editable mode flattens each loaded iframe into a computed-style DOM snapshot before conversion, so text and basic shapes remain PowerPoint objects where supported. Visual mode exports each page as a whole-slide image for higher fidelity. Complex masks, filters, gradients, interactions, and some media may still rasterize; HTML animation never becomes PowerPoint animation. Never describe the visual mode as editable.

If the outer shell contains third-party branding, only provide a reversible local focus mode or user-directed element hiding. Preserve scripts and metadata by default, and remind the user to confirm they have permission to alter or hide attribution.

## Wise PPT track decks

A deck declaring `data-runtime="wise-ppt-deck"` commonly stores slides under `#deck > #deck-stage > #track > .slide` and navigates by translating the track instead of toggling `.active`. Keep toolbar metadata namespaced with `data-hppt-*`; never add generic `data-icon` attributes that the host runtime may scan. Bridge `WisePPTRuntime.go(index)` to `window.go(index)` only when the standard hook is absent, and expose `window.__getVisibleSlides()` for the track slides.

For PDF/PPTX, normalize the track into direct `#deck > .slide` children only inside the temporary export snapshot. Do not rewrite the source deck's visual runtime. Editable PPTX remains best-effort for complex SVG and custom components; use the visual PPTX mode when fidelity matters more than object editability.
