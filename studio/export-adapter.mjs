// Serialized into the export snapshot, where the engine requires #deck > .slide.
export function normalizeExportDeck() {
  function normalize() {
    if (document.querySelector('#deck > .slide')) return;
    const config = window.HTML_PPT_EDITOR_CONFIG || {};
    const source = document.querySelector(config.deckSelector || '#stage,.stage,[data-ppt-deck]');
    if (!source) return;
    const candidates = typeof window.__getVisibleSlides === 'function'
      ? Array.from(window.__getVisibleSlides())
      : Array.from(source.querySelectorAll(config.slideSelector || '.slide,[data-ppt-slide]'));
    const slides = candidates.filter(slide => source.contains(slide) && !slide.hidden);
    if (!slides.length || document.getElementById('deck')) return;
    const dimensions = slides.map(slide => {
      const style = getComputedStyle(slide);
      return {width: parseFloat(style.width) || 1920, height: parseFloat(style.height) || 1080};
    });
    const deck = document.createElement('main');
    deck.id = 'deck';
    deck.className = source.className;
    deck.dataset.hpptExportNormalized = 'generic';
    // Preserve inherited typography when the original stage supplies it.
    const sourceStyle = getComputedStyle(source);
    ['color', 'font-family', 'font-size', 'line-height'].forEach(property => {
      deck.style.setProperty(property, sourceStyle.getPropertyValue(property));
    });
    slides.forEach((slide, index) => {
      const {width, height} = dimensions[index];
      const scale = Math.min(1920 / width, 1080 / height);
      slide.classList.add('slide');
      slide.style.setProperty('position', 'absolute', 'important');
      slide.style.setProperty('inset', 'auto', 'important');
      slide.style.setProperty('left', ((1920 - width * scale) / 2) + 'px', 'important');
      slide.style.setProperty('top', ((1080 - height * scale) / 2) + 'px', 'important');
      slide.style.setProperty('width', width + 'px', 'important');
      slide.style.setProperty('height', height + 'px', 'important');
      slide.style.setProperty('margin', '0', 'important');
      slide.style.setProperty('transform-origin', '0 0', 'important');
      slide.style.setProperty('transform', 'scale(' + scale + ')', 'important');
      deck.appendChild(slide);
    });
    const style = document.createElement('style');
    style.textContent = `
      html,body{margin:0!important;width:1920px!important;height:1080px!important;overflow:hidden!important}
      body>:not(#deck){display:none!important}
      #deck[data-hppt-export-normalized="generic"]{display:block!important;position:relative!important;inset:auto!important;width:1920px!important;height:1080px!important;margin:0!important;padding:0!important;transform:none!important;overflow:hidden!important}
      #deck[data-hppt-export-normalized="generic"]>.slide{display:none!important;visibility:hidden!important}
      #deck[data-hppt-export-normalized="generic"]>.slide.active{display:block!important;visibility:visible!important}
      #deck .hppt-step-hidden,#deck .ppt-step-hidden{opacity:1!important;visibility:visible!important;transform:none!important}
    `;
    document.head.appendChild(style);
    document.body.appendChild(deck);
    window.__getVisibleSlides = () => slides.slice();
    window.go = index => {
      const next = Math.max(0, Math.min(slides.length - 1, Number(index) || 0));
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === next);
        slide.toggleAttribute('data-deck-active', i === next);
      });
      return next;
    };
    window.go(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize, {once: true});
  else normalize();
}
