// Bake browser-only image effects into local image pixels before editable capture.
// Text remains in the DOM so the converter can retain editable text objects.
export async function prepareVisualAssets(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const style = document.createElement('style');
    style.textContent = '[data-hppt-visual-baked]::before,[data-hppt-visual-baked]::after{display:none!important}';
    document.head.appendChild(style);
  });
  const count = await page.evaluate(() => window.__getVisibleSlides().length);
  let bakedImages = 0;
  for (let index = 0; index < count; index++) {
    await page.evaluate(async index => {
      window.go(index);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(Array.from(document.querySelectorAll('#deck > .slide.active img')).map(image => image.decode().catch(() => {})));
    }, index);
    const targets = await page.evaluate(() => {
      const slide = document.querySelector('#deck > .slide.active');
      const groups = new Set();
      for (const image of slide.querySelectorAll('img')) {
        const parent = image.parentElement;
        if (parent === slide) continue;
        const overlay = ['::before', '::after'].some(pseudo => {
          const style = getComputedStyle(parent, pseudo);
          return style.content !== 'none' && /gradient\(/.test(style.backgroundImage);
        });
        if (overlay) groups.add(parent);
      }
      const nodes = [...groups, ...Array.from(slide.querySelectorAll('img')).filter(image => !Array.from(groups).some(group => group.contains(image)))];
      return nodes.map((node, index) => {
        const key = 'visual-' + index;
        node.setAttribute('data-hppt-visual-target', key);
        return {key, group: groups.has(node)};
      });
    });
    for (const target of targets) {
      const locator = page.locator('#deck > .slide.active [data-hppt-visual-target="' + target.key + '"]');
      if (!await locator.isVisible()) continue;
      const bounds = await locator.boundingBox();
      if (!bounds || bounds.width < 1 || bounds.height < 1) continue;
      let textStyles = [];
      try {
        textStyles = await locator.evaluate((node, group) => {
          const scope = group ? node : node.parentElement;
          const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
          const parents = new Set();
          while (walker.nextNode()) if (walker.currentNode.textContent.trim()) parents.add(walker.currentNode.parentElement);
          return Array.from(parents).map((element, index) => {
            const properties = ['color', '-webkit-text-fill-color', 'text-shadow'].map(name => ({
              name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name)
            }));
            element.setAttribute('data-hppt-capture-text', String(index));
            element.style.setProperty('color', 'transparent', 'important');
            element.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
            element.style.setProperty('text-shadow', 'none', 'important');
            return {index, root: element === scope, properties};
          });
        }, target.group);
        const pixels = await locator.screenshot({type: 'png', animations: 'disabled'});
        const data = 'data:image/png;base64,' + pixels.toString('base64');
        await locator.evaluate((node, {data, group}) => {
          if (group) {
            node.querySelectorAll('img').forEach(image => image.remove());
            node.setAttribute('data-hppt-visual-baked', '');
            node.style.setProperty('background-image', 'url("' + data + '")', 'important');
            node.style.setProperty('background-size', '100% 100%', 'important');
            node.style.setProperty('background-repeat', 'no-repeat', 'important');
          } else {
            node.src = data;
            node.removeAttribute('srcset');
            node.style.setProperty('object-fit', 'fill', 'important');
            node.style.setProperty('object-position', 'center', 'important');
          }
        }, {data, group: target.group});
        bakedImages++;
      } finally {
        await locator.evaluate((node, {saved, group}) => saved.forEach(({index, root, properties}) => {
          const scope = group ? node : node.parentElement;
          const element = root ? scope : scope.querySelector('[data-hppt-capture-text="' + index + '"]');
          if (!element) return;
          properties.forEach(({name, value, priority}) => {
            if (value) element.style.setProperty(name, value, priority);
            else element.style.removeProperty(name);
          });
          element.removeAttribute('data-hppt-capture-text');
        }), {saved: textStyles, group: target.group});
      }
    }
  }
  await page.evaluate(() => window.go(0));
  return {bakedImages};
}

export async function exportWithVisualAssets(browser, url, exporter, options) {
  const context = await browser.newContext({viewport: {width: 1920, height: 1080}, ignoreHTTPSErrors: true});
  try {
    const page = await context.newPage();
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('#deck > .slide.active');
    const visual = await prepareVisualAssets(page);
    const result = await exporter(page, options);
    return {...result, ...visual};
  } finally {
    await context.close();
  }
}
