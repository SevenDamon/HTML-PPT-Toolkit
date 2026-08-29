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
- `data-ppt-protected`: protected structural element.

The editor discovers common headings, paragraphs, list items, cards, and images automatically. Use explicit attributes for nonstandard components and protected structure.

## Runtime

Expose `window.go(index)` for zero-based page jumps and `window.__getVisibleSlides()`. Support PageDown, PageUp, all four arrow keys, Space, and Enter. Prevent a standalone Alt signal from focusing the browser menu in presentation mode.

A next signal should reveal the next hidden item before changing slides, sorted by positive `data-animation-order`.

## Persistence and export

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
