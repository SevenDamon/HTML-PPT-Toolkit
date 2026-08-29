# Editor profiles

Use one shared runtime and choose capabilities at installation time. Do not maintain separate Lite and Full code forks.

| Capability | Lite | Full |
| --- | --- | --- |
| Edit text and text style | Yes | Yes |
| Add, move, resize, or delete elements | Yes | Yes |
| Replace local images | Yes | Yes |
| Configure progressive reveal order | Yes | Yes |
| Undo and redo | Yes | Yes |
| Save browser-local draft | Yes | Yes |
| Export an editable HTML copy | Yes | Yes |
| Page organization tools | No | Yes |
| Write changes to the source HTML | No | Yes, through local studio |
| Export PDF | No | Yes, through local studio |
| Export editable or visual PPTX | No | Yes, through local studio |

## Selection rule

Choose Lite unless the current user request explicitly needs source write-back, PDF, or PPTX. A deck created with Lite can later be reinstalled as Full without changing its slide content or editor annotations.

## Installation

```powershell
node scripts/install-editor.mjs input.html output.html --profile lite
node scripts/install-editor.mjs input.html output.html --profile full
```

The installer injects `window.HTML_PPT_EDITOR_PROFILE`, links the common CSS and JavaScript assets, and replaces a previously installed profile marker when rerun.

## Validation

```powershell
node scripts/check-deck.mjs output.html --profile lite
node scripts/check-deck.mjs output.html --profile full
```

The checker reports the detected profile and its expected capabilities. Full mode still needs an end-to-end local-studio test for source write-back, PDF, and PPTX generation.

## Optional narrow overrides

Only use feature overrides for an integration-specific exception:

```html
<script>
window.HTML_PPT_EDITOR_CONFIG = {
  profile: 'full',
  features: { visualPptx: false }
};
</script>
```

Do not use overrides to recreate a second profile taxonomy.
