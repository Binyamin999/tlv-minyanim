/* Contrast audit — paste into the browser against a rendered artboard page.
 *
 * Why a browser snippet and not a Node script: the real contrast of a label
 * depends on what is actually painted behind it — nested translucent fills,
 * inherited opacity, tinted pill backgrounds. Only a live layout knows that.
 * Hand-calculating from source is how the wrong colour ships.
 *
 *   python3 scripts/render-artboards.py <files…>
 *   open http://localhost:4321/design/_preview.html
 *   then run this in the console (or via the browser tool)
 *
 * Text sitting on a PHOTOGRAPH is reported separately and NOT counted as a
 * failure: its background is image pixels, which this cannot see. Measure
 * those by sampling the image itself — see the notes in design/reference/.
 */
(() => {
  const parse = c => { const m = c.match(/[\d.]+/g);
    return m ? { r:+m[0], g:+m[1], b:+m[2], a: m[3] === undefined ? 1 : +m[3] } : null; };

  const lum = (r,g,b) => { const f = v => { v/=255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };

  const ratio = (a,b) => { const L1 = lum(a.r,a.g,a.b), L2 = lum(b.r,b.g,b.b);
    return (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05); };

  const over = (f,b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a),
                           b: f.b*f.a + b.b*(1-f.a), a: 1 });

  // Walk up compositing translucent fills until something opaque is found.
  function backdrop(el, root) {
    let cur = el, acc = null;
    while (cur && cur !== root) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (c.a === 1) return { col: acc, solid: true }; }
      cur = cur.parentElement;
    }
    return { col: acc, solid: false };   // not solid => almost certainly over a photo
  }

  const caps  = [...document.querySelectorAll('.cap')].map(c => c.textContent.trim());
  const panes = [...document.querySelectorAll('body > div')];
  const report = {};

  panes.forEach((pane, i) => {
    const label = caps[i] || `pane ${i}`;
    const root = pane.querySelector('div[dir="rtl"]');
    if (!root) return;

    const failures = [], overPhoto = [];
    let checked = 0, worst = Infinity, worstItem = '';

    for (const el of root.querySelectorAll('*')) {
      if (el.children.length || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (!fg || cs.visibility === 'hidden' || cs.display === 'none') continue;

      const bd = backdrop(el, root);
      const entry = { text: el.textContent.trim().slice(0, 26),
                      colour: cs.color, size: parseFloat(cs.fontSize) };

      if (!bd.solid) { overPhoto.push(entry); continue; }

      checked++;
      const eff = fg.a < 1 ? over(fg, bd.col) : fg;
      const cr  = ratio(eff, bd.col);
      const px  = parseFloat(cs.fontSize);
      const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
      const need = large ? 3 : 4.5;          // WCAG AA

      if (cr < worst) { worst = cr; worstItem = `${entry.text} — ${cs.color} @${px}px`; }
      if (cr < need) failures.push({ ...entry, ratio: +cr.toFixed(2), needs: need });
    }

    report[label] = {
      checked,
      failures: failures.length,
      worstRatio: +worst.toFixed(2),
      worstElement: worstItem,
      failing: failures,
      overPhotoNotMeasured: overPhoto.length,
    };
  });

  return report;
})();
