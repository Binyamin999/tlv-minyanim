#!/usr/bin/env python3
"""Render .dc.html artboards as a plain browsable page.

Artboard files need a runtime that is only injected when the design canvas is
published, so they do not open in a browser on their own. This strips the
wrapper, resolves the {{holes}} from renderVals(), and emits one standalone
page — which means the designer can actually look at its own work instead of
reasoning about it.

Both states of every boolean prop are rendered side by side.

    python3 scripts/render-artboards.py Main.dc.html HybridE.dc.html
    -> design/_preview.html, then open it via the static server
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design" / "_preview.html"


def parse(path: Path):
    src = path.read_text(encoding="utf-8")
    head = re.search(r"<helmet>(.*?)</helmet>", src, re.S).group(1)
    body = re.search(r"</helmet>(.*?)</x-dc>", src, re.S).group(1)
    # the artboard's own root width, so desktop boards are not squeezed into 375
    m = re.search(r'<div dir="rtl" style="width:\s*(\d+)px', body)
    width = int(m.group(1)) if m else 375
    # key: <prop> ? 'a' : 'b'  ->  {key: (prop, when_true, when_false)}
    vals = dict(
        (m[0], (m[1], m[2], m[3]))
        for m in re.findall(
            r"(\w+)\s*:\s*(\w+)\s*\?\s*'([^']*)'\s*:\s*'([^']*)'", src
        )
    )
    return head, body, vals, width


def resolve(body: str, vals: dict, state: dict) -> str:
    out = body
    for key, (prop, yes, no) in vals.items():
        out = out.replace("{{" + key + "}}", yes if state.get(prop) else no)
    unresolved = set(re.findall(r"\{\{(\w+)\}\}", out))
    if unresolved:
        print(f"  !! unresolved holes: {sorted(unresolved)}", file=sys.stderr)
    return out


def main(files):
    # Each pane carries its OWN <helmet>. This used to be one shared `head`
    # reassigned inside the loop, so only the LAST artboard's styles survived
    # and then applied to every pane. Rendering a day board beside a night one
    # therefore painted the day board's links in the night board's orange —
    # and a contrast audit run on that preview reported failures that do not
    # exist in the artboard, which is worse than no audit at all.
    #
    # Each pane is now its own iframe, which is also how the real canvas runs
    # them: a document per artboard, no shared cascade.
    panes = []
    for name in files:
        path = ROOT / name
        if not path.exists():
            sys.exit(f"no such artboard: {name}")
        head, body, vals, width = parse(path)
        stem = path.name.replace(".dc.html", "")
        props = sorted({p for (p, _, _) in vals.values()})
        combos = [({}, "normal")]
        for p in props:
            combos.append(({p: True}, p))
        if len(props) > 1:
            combos.append(({p: True for p in props}, "+".join(props)))
        for state, label in combos:
            panes.append(
                (f"{stem} — {label}", head, resolve(body, vals, state), width)
            )

    html = [
        '<!doctype html><html><head><meta charset="utf-8">',
        "<title>artboard preview</title>",
        "<style>body{margin:0;background:#3a3a3a;display:flex;gap:24px;"
        "padding:20px;align-items:flex-start;overflow-x:auto}"
        ".cap{color:#fff;font:600 12px system-ui;margin-bottom:8px}"
        "iframe{border:0;display:block;background:#fff}</style>",
        "</head><body>",
    ]
    for label, head, body, width in panes:
        doc = (
            '<!doctype html><html><head><meta charset="utf-8">'
            f'<base href="/">{head}'
            "<style>html,body{margin:0}</style></head>"
            f"<body>{body}</body></html>"
        )
        # srcdoc is an HTML attribute, so the document has to survive being one.
        # Ampersand first, or it double-escapes the quotes it just introduced.
        srcdoc = doc.replace("&", "&amp;").replace('"', "&quot;")
        html.append(
            f'<div><div class="cap">{label}</div>'
            f'<iframe width="{width}" height="900" srcdoc="{srcdoc}" '
            f'data-label="{label}" loading="eager"></iframe></div>'
        )
    # Grow each frame to its content once it has laid out, so nothing is clipped
    # and a screenshot shows the whole board.
    html.append(
        "<script>addEventListener('load',()=>{for(const f of "
        "document.querySelectorAll('iframe')){try{const d=f.contentDocument;"
        "f.height=Math.max(d.body.scrollHeight,d.documentElement.scrollHeight)+2;"
        "}catch(e){}}});</script>"
    )
    html.append("</body></html>")

    OUT.write_text("\n".join(html), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} — {len(panes)} panes, one document each")


if __name__ == "__main__":
    main(sys.argv[1:] or ["Main.dc.html"])
