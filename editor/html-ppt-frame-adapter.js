(function (topWindow) {
  'use strict';
  if (topWindow.__htmlPptFrameAdapter) return;

  var hostFrame = document.querySelector('iframe.content-iframe[srcdoc], iframe[data-ppt-frame-host][srcdoc]');
  if (!hostFrame) return;

  var assetBase = new URL('html-ppt-editor/', topWindow.location.href);
  var configuredProfile = String(topWindow.HTML_PPT_EDITOR_PROFILE || (topWindow.HTML_PPT_EDITOR_CONFIG && topWindow.HTML_PPT_EDITOR_CONFIG.profile) || '').toLowerCase();
  var profile = configuredProfile === 'lite' ? 'lite' : 'full';
  var fullProfile = profile === 'full';
  var states = readStates();
  var settings = states.__settings && typeof states.__settings === 'object' ? states.__settings : { focusMode: false, hiddenSelectors: [], deletedSelectors: [] };
  settings.hiddenSelectors = Array.isArray(settings.hiddenSelectors) ? settings.hiddenSelectors : [];
  settings.deletedSelectors = Array.isArray(settings.deletedSelectors) ? settings.deletedSelectors : [];
  var controllerDocument = null;
  var currentFrame = null;
  var currentApi = null;
  var currentIndex = -1;
  var observer = null;
  var attachTimer = null;
  var visibilityTimer = null;

  topWindow.__htmlPptFrameAdapter = {
    format: 'iframe-template',
    capture: captureCurrent,
    states: states
  };
  applyOuterSettings();

  function readStates() {
    var node = document.getElementById('hppt-frame-state');
    if (!node) return {};
    try { return JSON.parse(node.textContent || '{}'); } catch (error) { return {}; }
  }

  function writeStates() {
    states.__settings = settings;
    var node = document.getElementById('hppt-frame-state');
    if (!node) {
      node = document.createElement('script');
      node.id = 'hppt-frame-state';
      node.type = 'application/json';
      document.body.appendChild(node);
    }
    node.textContent = JSON.stringify(states).replace(/<\/script/gi, '<\\/script');
  }

  function activeIndex() {
    if (!controllerDocument) return 0;
    var items = Array.from(controllerDocument.querySelectorAll('.cw-thumb-item'));
    var index = items.findIndex(function (item) { return item.classList.contains('active'); });
    return index < 0 ? 0 : index;
  }

  function mainFrame() {
    if (!controllerDocument) return null;
    return controllerDocument.querySelector('.cw-content-canvas iframe') ||
      Array.from(controllerDocument.querySelectorAll('iframe')).find(function (frame) {
        return frame.parentElement && frame.parentElement.classList.contains('cw-content-canvas');
      }) || null;
  }

  function captureCurrent() {
    if (!currentApi || currentIndex < 0) return;
    try {
      states[String(currentIndex)] = currentApi.snapshot();
      writeStates();
    } catch (error) {}
  }

  function attachController() {
    try { controllerDocument = hostFrame.contentDocument; } catch (error) { controllerDocument = null; }
    if (!controllerDocument || !controllerDocument.body) return scheduleAttach();

    controllerDocument.addEventListener('pointerdown', function (event) {
      if (event.target.closest('.cw-thumb-item,.cw-prev,.cw-next,.cw-play-btn')) captureCurrent();
    }, true);

    if (observer) observer.disconnect();
    observer = new MutationObserver(function () { scheduleMainFrame(); });
    observer.observe(controllerDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['srcdoc', 'class'] });
    scheduleMainFrame();
  }

  function scheduleAttach() {
    clearTimeout(attachTimer);
    attachTimer = setTimeout(attachController, 250);
  }

  function scheduleMainFrame() {
    clearTimeout(attachTimer);
    attachTimer = setTimeout(function () {
      var frame = mainFrame();
      if (!frame) return scheduleMainFrame();
      if (frame !== currentFrame) {
        captureCurrent();
        currentFrame = frame;
        frame.addEventListener('load', function () { injectEditor(frame); });
      }
      injectEditor(frame);
    }, 80);
  }

  function injectEditor(frame) {
    var frameDocument, frameWindow;
    try { frameDocument = frame.contentDocument; frameWindow = frame.contentWindow; } catch (error) { return; }
    if (!frameDocument || !frameDocument.body || !frameWindow) return;
    var index = activeIndex();
    if (frameDocument.documentElement.dataset.hpptFrameReady === '1') {
      currentIndex = index;
      currentApi = frameWindow.__htmlPptEditor || currentApi;
      if (currentApi && currentApi.refresh) currentApi.refresh();
      scheduleEditorVisibility(frame);
      return;
    }
    frameDocument.documentElement.dataset.hpptFrameReady = '1';
    frameDocument.body.dataset.pptDeck = '';
    frameDocument.body.dataset.pptSlide = '';
    frameDocument.body.classList.add('active');

    frameWindow.HTML_PPT_EDITOR_PROFILE = profile;
    frameWindow.HTML_PPT_EDITOR_CONFIG = {
      profile: profile,
      deckSelector: 'body',
      slideSelector: '[data-ppt-slide]',
      deckIsSlide: true,
      designWidth: 960,
      designHeight: 540,
      draftKey: 'html-ppt-editor-v1:' + topWindow.location.pathname + ':frame-' + index,
      showFocusMode: fullProfile,
      showVisualPptx: fullProfile,
      saveSourceHandler: function (payload) { return saveEmbedded(index, payload.state); },
      exportHtmlHandler: function (payload) { return exportEmbeddedHtml(index, payload.state); },
      officeExportHandler: function (format, payload) { return exportEmbeddedOffice(format, index, payload.state, payload.mode); },
      titleEditHandler: editOuterTitle,
      focusModeHandler: toggleFocusMode,
      watermarkSelectHandler: selectOuterElement,
      outerUndoHandler: undoOuterDelete
    };

    var link = frameDocument.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('html-ppt-editor.css', assetBase).href;
    frameDocument.head.appendChild(link);

    var script = frameDocument.createElement('script');
    script.src = new URL('html-ppt-editor.js', assetBase).href;
    script.dataset.autoInit = 'false';
    script.onload = function () {
      try {
        var api = frameWindow.HtmlPptEditor.init(frameWindow.HTML_PPT_EDITOR_CONFIG);
        currentIndex = index;
        currentApi = api;
        if (states[String(index)]) api.applyState(states[String(index)]);
        setTimeout(function () { if (api.refresh) api.refresh(); }, 120);
        setTimeout(function () { if (api.refresh) api.refresh(); }, 700);
      scheduleEditorVisibility(frame);
      } catch (error) { console.warn('HTML PPT iframe adapter:', error); }
    };
    frameDocument.body.appendChild(script);
  }

  function scheduleEditorVisibility(frame) {
    clearTimeout(visibilityTimer);
    visibilityTimer = setTimeout(function () { keepEditorInVisibleCanvas(frame); }, 60);
  }

  function keepEditorInVisibleCanvas(frame) {
    var frameDocument, frameWindow;
    try { frameDocument = frame.contentDocument; frameWindow = frame.contentWindow; } catch (error) { return; }
    if (!frameDocument || !frameWindow) return;
    var dock = frameDocument.querySelector('.hppt-dock');
    if (!dock) return;
    var frameRect = frame.getBoundingClientRect();
    var clip = frame.closest('.cw-content-area') || frame.closest('.cw-content-wrapper') || frame.parentElement;
    var clipRect = clip ? clip.getBoundingClientRect() : frameRect;
    var scaleX = frameRect.width / Math.max(frameWindow.innerWidth, 1);
    var scaleY = frameRect.height / Math.max(frameWindow.innerHeight, 1);
    var inset = 10;
    var minX = (Math.max(clipRect.left, 0) - frameRect.left) / Math.max(scaleX, .001) + inset;
    var minY = (Math.max(clipRect.top, 0) - frameRect.top) / Math.max(scaleY, .001) + inset;
    var maxX = (Math.min(clipRect.right, topWindow.innerWidth) - frameRect.left) / Math.max(scaleX, .001) - dock.offsetWidth - inset;
    var maxY = (Math.min(clipRect.bottom, topWindow.innerHeight) - frameRect.top) / Math.max(scaleY, .001) - Math.min(dock.offsetHeight, 56) - inset;
    var visibleBottom = (Math.min(clipRect.bottom, topWindow.innerHeight) - frameRect.top) / Math.max(scaleY, .001) - inset;
    var left = Number.parseFloat(dock.style.left);
    var top = Number.parseFloat(dock.style.top);
    if (!Number.isFinite(left)) left = frameWindow.innerWidth - dock.offsetWidth - 18;
    if (!Number.isFinite(top)) top = 16;
    left = Math.max(minX, Math.min(left, Math.max(minX, maxX)));
    top = Math.max(minY, Math.min(top, Math.max(minY, maxY)));
    dock.style.left = left + 'px';
    dock.style.right = 'auto';
    dock.style.top = top + 'px';
    var actions = dock.querySelector('.hppt-actions');
    var dockHeight = Math.max(92, visibleBottom - top);
    dock.style.maxHeight = dockHeight + 'px';
    if (actions) {
      var head = dock.querySelector('.hppt-dock-head');
      actions.style.maxHeight = Math.max(84, dockHeight - (head ? head.offsetHeight : 34) - 14) + 'px';
    }
    if (!dock.dataset.hpptVisibleBound) {
      dock.dataset.hpptVisibleBound = '1';
      dock.addEventListener('click', function () { setTimeout(function () { keepEditorInVisibleCanvas(frame); }, 0); });
    }
  }

  async function saveEmbedded(index, state) {
    states[String(index)] = state;
    writeStates();
    var response = await fetch('/api/save-source', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: outerHtml() })
    });
    if (!response.ok) throw new Error(await response.text());
  }

  async function exportEmbeddedHtml(index, state) {
    states[String(index)] = state;
    writeStates();
    downloadBlob(new Blob([outerHtml()], { type: 'text/html;charset=utf-8' }), fileBase() + '_编辑版_' + stamp() + '.html');
  }

  async function exportEmbeddedOffice(format, index, state, mode) {
    states[String(index)] = state;
    writeStates();
    var editable = format === 'pptx' && mode !== 'visual';
    var response = await fetch('/api/project-export?format=' + format, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html: editable ? await exportEditableDeckHtml() : exportDeckHtml(), fileName: fileBase(), title: document.title, exportMode: format === 'pptx' && !editable ? 'screenshot' : 'default' })
    });
    if (!response.ok) throw new Error(await response.text());
    downloadBlob(await response.blob(), fileBase() + '_' + stamp() + '.' + format);
  }

  function applyOuterSettings() {
    if (settings.title) document.title = settings.title;
    document.documentElement.classList.toggle('hppt-focus-mode', !!settings.focusMode);
    var style = document.getElementById('hppt-frame-focus-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'hppt-frame-focus-style';
      document.head.appendChild(style);
    }
    var selectors = ['.watermark-overlay', '.ai-badge', '.watermark-content'].concat(settings.hiddenSelectors || []);
    style.textContent = '[data-hppt-outer-deleted]{display:none!important;opacity:0!important;pointer-events:none!important}' +
      'html.hppt-focus-mode ' + selectors.join(',html.hppt-focus-mode ') + '{display:none!important;opacity:0!important;pointer-events:none!important}' +
      'html.hppt-focus-mode .iframe-container{padding:0!important}' +
      'html.hppt-focus-mode .content-iframe{border:0!important;border-radius:0!important;box-shadow:none!important}';
    Array.from(document.querySelectorAll('[data-hppt-outer-deleted]')).forEach(function (node) { node.removeAttribute('data-hppt-outer-deleted'); });
    settings.deletedSelectors.forEach(function (selector) {
      try { Array.from(document.querySelectorAll(selector)).forEach(function (node) { if (!isProtectedOuterTarget(node)) node.setAttribute('data-hppt-outer-deleted', ''); }); } catch (error) {}
    });
  }

  function editOuterTitle(value) {
    if (arguments.length === 0) return document.title || '';
    settings.title = String(value).trim();
    document.title = settings.title;
    writeStates();
    return settings.title;
  }

  function toggleFocusMode() {
    var restoring = settings.focusMode || settings.hiddenSelectors.length;
    settings.focusMode = !restoring;
    if (restoring) settings.hiddenSelectors = [];
    applyOuterSettings();
    writeStates();
    return { active: settings.focusMode };
  }

  function selectOuterElement() {
    settings.focusMode = false;
    applyOuterSettings();
    return new Promise(function (resolve) {
      var previous = null;
      function cleanup() {
        document.removeEventListener('pointerover', hover, true);
        document.removeEventListener('pointerout', leave, true);
        document.removeEventListener('pointerdown', pick, true);
        document.removeEventListener('keydown', cancel, true);
        if (previous) { previous.style.outline = previous.dataset.hpptOldOutline || ''; delete previous.dataset.hpptOldOutline; }
      }
      function hover(event) {
        var rawTarget = event.target;
        var target = rawTarget && (rawTarget.closest('.watermark-overlay') || rawTarget.closest('.ai-badge') || rawTarget.closest('.watermark-content') || rawTarget);
        if (!target || target === document.body || target === document.documentElement || target.closest('[data-hppt-ui]')) return;
        if (previous && previous !== target) previous.style.outline = previous.dataset.hpptOldOutline || '';
        previous = target;
        if (previous.dataset.hpptOldOutline === undefined) previous.dataset.hpptOldOutline = previous.style.outline || '';
        previous.style.outline = '3px dashed #d76432';
      }
      function leave(event) {
        if (event.target === previous) previous.style.outline = previous.dataset.hpptOldOutline || '';
      }
      function pick(event) {
        var rawTarget = event.target;
        var target = rawTarget && (rawTarget.closest('.watermark-overlay') || rawTarget.closest('.ai-badge') || rawTarget.closest('.watermark-content') || rawTarget);
        if (!target || target === document.body || target === document.documentElement) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isProtectedOuterTarget(target)) {
          cleanup();
          applyOuterSettings();
          resolve({ protected: true });
          return;
        }
        var selector = uniqueSelector(target);
        if (selector && settings.deletedSelectors.indexOf(selector) < 0) settings.deletedSelectors.push(selector);
        cleanup();
        applyOuterSettings();
        writeStates();
        resolve({ deleted: !!selector, selector: selector });
      }
      function cancel(event) {
        if (event.key !== 'Escape') return;
        cleanup();
        applyOuterSettings();
        resolve({ cancelled: true });
      }
      document.addEventListener('pointerover', hover, true);
      document.addEventListener('pointerout', leave, true);
      document.addEventListener('pointerdown', pick, true);
      document.addEventListener('keydown', cancel, true);
    });
  }

  function undoOuterDelete() {
    var selector = settings.deletedSelectors.pop();
    if (!selector) return { restored: false };
    applyOuterSettings();
    writeStates();
    return { restored: true, selector: selector };
  }

  function isProtectedOuterTarget(target) {
    if (!target || target === hostFrame || target.contains(hostFrame)) return true;
    if (/^(HTML|HEAD|BODY|SCRIPT|STYLE|LINK|META|TITLE|IFRAME|MAIN)$/i.test(target.tagName || '')) return true;
    if (target.id === 'hppt-frame-state' || target.id === 'hppt-frame-focus-style') return true;
    return !!target.closest('[data-hppt-ui],[data-html-ppt-profile]');
  }

  function uniqueSelector(element) {
    if (element.id) return '#' + cssEscape(element.id);
    var known = ['watermark-overlay', 'ai-badge', 'watermark-content'];
    for (var i = 0; i < known.length; i++) if (element.classList.contains(known[i])) return '.' + known[i];
    var path = [];
    for (var node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      var part = node.tagName.toLowerCase();
      if (node.classList.length) part += '.' + Array.from(node.classList).slice(0, 3).map(cssEscape).join('.');
      else {
        var nth = 1, sibling = node.previousElementSibling;
        while (sibling) { if (sibling.tagName === node.tagName) nth++; sibling = sibling.previousElementSibling; }
        part += ':nth-of-type(' + nth + ')';
      }
      path.unshift(part);
    }
    return path.join(' > ');
  }

  function cssEscape(value) {
    return topWindow.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  async function exportEditableDeckHtml() {
    if (!controllerDocument) throw new Error('课件页面尚未加载完成');
    var frames = Array.from(controllerDocument.querySelectorAll('.cw-thumb-preview iframe'));
    if (!frames.length) throw new Error('没有发现内嵌课件页面');
    var slides = [];
    for (var i = 0; i < frames.length; i++) {
      var content = await flattenFrame(frames[i].srcdoc, states[String(i)] || null);
      slides.push('<section class="slide' + (i === 0 ? ' active' : '') + '" id="p' + String(i + 1).padStart(2, '0') + '"><div class="frame-content">' + content + '</div></section>');
    }
    return '<!doctype html><html class="static-mode"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}.deck{position:relative;width:1920px;height:1080px}.slide{position:absolute;inset:0;display:none;width:1920px;height:1080px;overflow:hidden}.slide.active{display:block}.frame-content{position:absolute;left:0;top:0;width:960px;height:540px;overflow:hidden;transform:scale(2);transform-origin:0 0}</style></head><body><main id="deck" class="deck">' + slides.join('') + '</main><script>var slides=[...document.querySelectorAll(".slide")];window.go=function(i){slides.forEach(function(s,n){s.classList.toggle("active",n===i)})};window.__getVisibleSlides=function(){return slides};<\/script></body></html>';
  }

  async function flattenFrame(srcdoc, state) {
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:960px;height:540px;border:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(frame);
    try {
      await new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { reject(new Error('等待课件页面加载超时')); }, 12000);
        frame.onload = function () { clearTimeout(timer); resolve(); };
        frame.srcdoc = prepareSlide(srcdoc, state);
      });
      for (var wait = 0; wait < 80 && !frame.contentWindow.__htmlPptEditor; wait++) await delay(50);
      await delay(120);
      var sourceDocument = frame.contentDocument;
      var sourceBody = sourceDocument.body;
      var cloneBody = sourceBody.cloneNode(true);
      var sourceElements = [sourceBody].concat(Array.from(sourceBody.querySelectorAll('*')));
      var cloneElements = [cloneBody].concat(Array.from(cloneBody.querySelectorAll('*')));
      var properties = ['position','inset','left','top','right','bottom','width','height','min-width','min-height','max-width','max-height','display','visibility','float','clear','overflow','overflow-x','overflow-y','box-sizing','flex','flex-basis','flex-direction','flex-flow','flex-grow','flex-shrink','flex-wrap','align-content','align-items','align-self','justify-content','justify-items','justify-self','gap','row-gap','column-gap','grid','grid-area','grid-template','grid-template-columns','grid-template-rows','grid-column','grid-row','place-content','place-items','margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','border','border-width','border-style','border-color','border-radius','background','background-color','background-image','background-position','background-size','background-repeat','color','font','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration','text-transform','text-indent','white-space','overflow-wrap','word-break','opacity','transform','transform-origin','filter','box-shadow','object-fit','object-position','z-index','clip-path'];
      sourceElements.forEach(function (source, index) {
        var clone = cloneElements[index];
        if (!clone) return;
        var computed = frame.contentWindow.getComputedStyle(source);
        properties.forEach(function (property) {
          var value = computed.getPropertyValue(property);
          if (value) clone.style.setProperty(property, value);
        });
        clone.style.setProperty('animation', 'none');
        clone.style.setProperty('transition', 'none');
        if (source.tagName === 'IMG') clone.setAttribute('src', source.currentSrc || source.src || source.getAttribute('src') || '');
      });
      var sourceCanvases = Array.from(sourceBody.querySelectorAll('canvas'));
      Array.from(cloneBody.querySelectorAll('canvas')).forEach(function (canvas, index) {
        try {
          var image = document.createElement('img');
          image.src = sourceCanvases[index].toDataURL('image/png');
          image.style.cssText = canvas.style.cssText;
          canvas.replaceWith(image);
        } catch (error) { canvas.remove(); }
      });
      Array.from(cloneBody.querySelectorAll('[data-hppt-ui],.hppt-removed,script,style,link[rel="stylesheet"],link[rel="modulepreload"]')).forEach(function (node) { node.remove(); });
      Array.from(cloneBody.querySelectorAll('[contenteditable]')).forEach(function (node) { node.removeAttribute('contenteditable'); });
      return cloneBody.innerHTML;
    } finally {
      frame.remove();
    }
  }

  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function outerHtml() {
    var clone = document.documentElement.cloneNode(true);
    Array.from(clone.querySelectorAll('[data-hppt-ui]')).forEach(function (node) { node.remove(); });
    Array.from(clone.querySelectorAll('[data-hppt-outer-deleted]')).forEach(function (node) { node.remove(); });
    return '<!doctype html>\n' + clone.outerHTML;
  }

  function exportDeckHtml() {
    if (!controllerDocument) throw new Error('课件页面尚未加载完成');
    var frames = Array.from(controllerDocument.querySelectorAll('.cw-thumb-preview iframe'));
    if (!frames.length) throw new Error('没有发现内嵌课件页面');
    var slides = frames.map(function (frame, index) {
      var srcdoc = prepareSlide(frame.srcdoc, states[String(index)] || null);
      return '<section class="slide' + (index === 0 ? ' active' : '') + '" id="p' + String(index + 1).padStart(2, '0') + '"><iframe srcdoc="' + escapeAttribute(srcdoc) + '"></iframe></section>';
    }).join('');
    return '<!doctype html><html class="static-mode"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}.deck{position:relative;width:1920px;height:1080px}.slide{position:absolute;inset:0;display:none;width:1920px;height:1080px;overflow:hidden}.slide.active{display:block}.slide iframe{border:0;width:960px;height:540px;transform:scale(2);transform-origin:0 0}</style></head><body><main id="deck" class="deck">' + slides + '</main><script>var slides=[...document.querySelectorAll(".slide")];window.go=function(i){slides.forEach(function(s,n){s.classList.toggle("active",n===i)})};window.__getVisibleSlides=function(){return slides};<\/script></body></html>';
  }

  function prepareSlide(srcdoc, state) {
    var stateJson = JSON.stringify(state || null).replace(/<\/script/gi, '<\\/script');
    var injection = '<link rel="stylesheet" href="html-ppt-editor/html-ppt-editor.css"><script>document.documentElement.classList.add("static-mode");window.HTML_PPT_EDITOR_CONFIG={deckSelector:"body",slideSelector:"[data-ppt-slide]",deckIsSlide:true,designWidth:960,designHeight:540};<\/script><script src="html-ppt-editor/html-ppt-editor.js" data-auto-init="false"><\/script><script>document.addEventListener("DOMContentLoaded",function(){document.body.dataset.pptDeck="";document.body.dataset.pptSlide="";document.body.classList.add("active");var hpptStaticApi=HtmlPptEditor.init(window.HTML_PPT_EDITOR_CONFIG);var hpptStaticState=' + stateJson + ';if(hpptStaticState)hpptStaticApi.applyState(hpptStaticState)});<\/script>';
    if (/<\/head>/i.test(srcdoc)) return srcdoc.replace(/<\/head>/i, injection + '</head>');
    return injection + srcdoc;
  }

  function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function downloadBlob(blob, name) {
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(anchor.href); }, 1500);
  }

  function fileBase() {
    try { return decodeURIComponent(location.pathname.split('/').pop()).replace(/\.html?$/i, '') || 'presentation'; }
    catch (error) { return 'presentation'; }
  }

  function stamp() {
    return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  }

  hostFrame.addEventListener('load', attachController);
  topWindow.addEventListener('resize', function () { if (currentFrame) scheduleEditorVisibility(currentFrame); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleAttach);
  else scheduleAttach();
})(window);
