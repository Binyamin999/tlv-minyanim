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
 * It also runs against a REAL page — /he, /en, either mode — in which case
 * there is one "pane", the document, labelled by its path. Same maths either
 * way, so a number measured on the artboard and a number measured on the built
 * page mean the same thing and can be compared.
 *
 * Text sitting on a PHOTOGRAPH is reported separately and NOT counted as a
 * failure: its background is image pixels, which this cannot see. Measure
 * those by sampling the image itself — see the notes in design/reference/.
 */
(() => {
  /* Colours are resolved through a canvas rather than by reading the digits
     out of the string.
     `color-mix()` — which is how the sunset warming is expressed — computes in
     oklab, and `getComputedStyle` hands back `oklab(0.72 0.13 0.11)`. A regex
     that takes the first three numbers reads that as rgb(0.72, 0.13, 0.11),
     i.e. black, and then cheerfully reports a 1.07:1 failure on a colour that
     is actually fine. Painting one pixel and reading it back is what the
     screen does, so it is what this should do: it handles rgb, oklab, lab,
     color(), currentColor-resolved values and anything Chrome learns next. */
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.globalCompositeOperation = 'copy';   // write the alpha, do not blend it

  const parse = c => {
    if (!c) return null;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = c;                     // an unparseable colour stays black
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };

  const lum = (r,g,b) => { const f = v => { v/=255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };

  const ratio = (a,b) => { const L1 = lum(a.r,a.g,a.b), L2 = lum(b.r,b.g,b.b);
    return (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05); };

  /* Source-over with alpha on BOTH sides.
     The earlier version assumed whatever was behind was already opaque, which
     is true for one translucent fill on a solid ground and false the moment
     there are two — a tinted pill inside a translucent card inside the page.
     It then reported a `#FF7A45` pill on a dark card as near-white behind,
     i.e. a 2.23:1 failure, when what is painted is 5.13:1 and fine. Precisely
     the case the header of this file says only a live layout knows about, so
     getting it wrong here defeats the whole exercise. */
  const over = (f,b) => {
    const a = f.a + b.a * (1 - f.a);
    if (a === 0) return { r:0, g:0, b:0, a:0 };
    const mix = (fc, bc) => (fc*f.a + bc*b.a*(1 - f.a)) / a;
    return { r: mix(f.r,b.r), g: mix(f.g,b.g), b: mix(f.b,b.b), a };
  };

  const CLEAR = { r:0, g:0, b:0, a:0 };

  // Walk up compositing translucent fills until the stack is opaque.
  function backdrop(el, root) {
    let cur = el, acc = CLEAR;
    while (cur && cur !== root) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) {
        acc = over(acc, c);
        if (acc.a >= 0.999) return { col: acc, solid: true };
      }
      cur = cur.parentElement;
    }
    return { col: acc, solid: false };   // not solid => almost certainly over a photo
  }

  // Artboard preview: one pane per captioned board. Real page: one pane, the
  // document. `backdrop()` stops at the root, so the root must be the element
  // that actually paints the page's ground — <body> on a real page.
  const artboard = document.querySelector('.cap') !== null;
  const caps  = artboard
    ? [...document.querySelectorAll('.cap')].map(c => c.textContent.trim())
    : [`${location.pathname} — ${document.documentElement.dataset.mode ?? 'mode?'}`];
  const panes = artboard ? [...document.querySelectorAll('body > div')] : [document.body];
  const report = {};

  panes.forEach((pane, i) => {
    const label = caps[i] || `pane ${i}`;
    const root = artboard ? pane.querySelector('div[dir="rtl"]') : document.documentElement;
    if (!root) return;

    const failures = [], overPhoto = [];
    let checked = 0, worst = Infinity, worstItem = '';

    for (const el of root.querySelectorAll('*')) {
      if (el.children.length || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (!fg || cs.visibility === 'hidden' || cs.display === 'none') continue;
      // Clipped-to-nothing screen-reader text. It carries the same colour on
      // the same backdrop as the label beside it, so measuring it only doubles
      // every line of the report — and nobody can read it either way.
      const box = el.getBoundingClientRect();
      if (box.width * box.height <= 4) continue;

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
