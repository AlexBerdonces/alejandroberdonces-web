#!/usr/bin/env python3
"""
Refresca ratingValue/ratingCount del bloque JSON-LD "rating-jsonld" en las
5 páginas del sitio (index.html, en/, fr/, ca/, it/) con los datos reales del
Mejorador de Prompts.

Fuente de datos: GET /stats del Worker de Cloudflare (mejorador-prompts),
sin token -> devuelve el agregado publico {"total": N, "media": X}.

No toca nada mas del bloque (name, url, applicationCategory...): parsea el
JSON existente, sustituye solo ratingValue/ratingCount y lo reserializa.

Pensado para ejecutarse desde .github/workflows/refresh-rating.yml (cron
diario). Sale con código 0 siempre que la actualización se complete bien,
tanto si hubo cambios como si no; el workflow decide si hace commit
comparando el diff de git.
"""
import json
import re
import sys
import urllib.request

STATS_URL = "https://mejorador-prompts.aberdonces.workers.dev/stats"
FILES = ["index.html", "en/index.html", "fr/index.html", "ca/index.html", "it/index.html"]

BLOCK_RE = re.compile(
    r'(<script type="application/ld\+json" id="rating-jsonld">)(.*?)(</script>)',
    re.DOTALL,
)


def fetch_stats():
    # Sin cabecera User-Agent, urllib envía "Python-urllib/3.x" por defecto,
    # que Cloudflare bloquea con 403 en los subdominios *.workers.dev (lo
    # trata como bot). Con un User-Agent de navegador normal, pasa sin
    # problema — confirmado el 21 jul 2026 tras el primer fallo en cron.
    req = urllib.request.Request(
        STATS_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; alejandroberdonces-web-bot/1.0; +https://alejandroberdonces.com)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw)
    total = int(data["total"])
    media = round(float(data["media"]), 2)
    return total, media


def update_file(path, total, media):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    match = BLOCK_RE.search(html)
    if not match:
        print(f"AVISO: no se encontro el bloque rating-jsonld en {path}", file=sys.stderr)
        return False

    prefix, body, suffix = match.groups()
    data = json.loads(body)
    agg = data.setdefault("aggregateRating", {})
    agg["ratingValue"] = f"{media:.2f}"
    agg["ratingCount"] = str(total)
    data["aggregateRating"] = agg

    new_body = "\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    new_html = html[: match.start()] + prefix + new_body + suffix + html[match.end():]

    if new_html == html:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_html)
    return True


def main():
    total, media = fetch_stats()
    print(f"Datos actuales: total={total} media={media:.2f}")

    any_changed = False
    for path in FILES:
        changed = update_file(path, total, media)
        print(f"  {path}: {'actualizado' if changed else 'sin cambios'}")
        any_changed = any_changed or changed

    if any_changed:
        print("RESULTADO: cambios aplicados")
    else:
        print("RESULTADO: sin cambios")


if __name__ == "__main__":
    main()
