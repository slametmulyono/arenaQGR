#!/usr/bin/env python3
"""
Build script Glosarium TKJ.

Membaca file sumber Markdown di fase-e/ dan fase-f/, memvalidasi tabelnya,
lalu menghasilkan:
  - GLOSARIUM-LENGKAP.md   : satu file gabungan dengan daftar isi & nomor global
  - INDEKS-A-Z.md          : indeks istilah alfabetis -> kategori
  - glosarium-tkj.csv      : data tabular (UTF-8 BOM, bisa dibuka di Excel)
  - index.html             : glosarium interaktif (cari, filter fase/kategori)
  - GLOSARIUM-TKJ.docx     : versi Word lengkap (+ GLOSARIUM-TKJ-FASE-E/F.docx)

Pemakaian:  python3 tools/build.py        (dijalankan dari folder glosarium-tkj/)
Tidak membutuhkan pustaka tambahan.
"""
from __future__ import annotations

import csv
import html
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIRS = [ROOT / "fase-e", ROOT / "fase-f"]

ROW_RE = re.compile(r"^\|\s*(\d+)\s*\|(.*)\|\s*$")
H1_RE = re.compile(r"^#\s+(.*)$")
META_RE = re.compile(r"\*\*(Fase|Elemen CP|Ringkasan):\*\*")


@dataclass
class Entry:
    no_local: int
    term: str
    definition: str
    function: str
    category: "Category" = field(repr=False, default=None)
    no_global: int = 0


@dataclass
class Category:
    code: str          # contoh: "06"
    title: str         # contoh: "Dasar-Dasar Jaringan Komputer"
    fase: str          # "E" atau "F"
    fase_label: str    # "E (Kelas X)"
    elemen: str
    ringkasan: str
    path: Path
    entries: list[Entry] = field(default_factory=list)

    @property
    def rel_path(self) -> str:
        return self.path.relative_to(ROOT).as_posix()


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def split_cells(body: str) -> list[str]:
    """Memecah isi baris tabel berdasarkan '|' (tanpa dukungan escape; sumber
    memang dilarang memakai karakter pipa di dalam sel)."""
    return [c.strip() for c in body.split("|")]


def parse_file(path: Path, problems: list[str]) -> Category:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    title, fase_label, elemen, ringkasan = "", "", "", ""
    for line in lines:
        m = H1_RE.match(line)
        if m and not title:
            title = m.group(1).strip()
        # satu baris blockquote bisa memuat beberapa penanda, mis. "**Fase:** … · **Elemen CP:** …"
        marks = list(META_RE.finditer(line))
        for i, m in enumerate(marks):
            key = m.group(1)
            end = marks[i + 1].start() if i + 1 < len(marks) else len(line)
            val = line[m.end(1) + 3:end].strip().rstrip("·").strip()
            if key == "Fase":
                fase_label = val
            elif key == "Elemen CP":
                elemen = val
            elif key == "Ringkasan":
                ringkasan = val

    code, _, clean_title = title.partition("·")
    code = code.strip()
    clean_title = clean_title.strip() or title
    fase = "E" if fase_label.upper().startswith("E") else "F"

    cat = Category(code, clean_title, fase, fase_label, elemen, ringkasan, path)

    expected = 1
    for ln, line in enumerate(lines, 1):
        m = ROW_RE.match(line)
        if not m:
            if line.startswith("|") and not line.startswith("| No") and not line.startswith("|--") and not line.startswith("|---"):
                problems.append(f"{path.name}:{ln}: baris tabel tidak dikenali -> {line[:60]}")
            continue
        no = int(m.group(1))
        cells = split_cells(m.group(2))
        if len(cells) != 3:
            problems.append(f"{path.name}:{ln}: jumlah kolom {len(cells)+1} (harus 4) -> {line[:60]}")
            continue
        term, definition, function = cells
        if not term or not definition or not function:
            problems.append(f"{path.name}:{ln}: ada sel kosong pada istilah no {no}")
        if no != expected:
            problems.append(f"{path.name}:{ln}: nomor {no} tidak berurutan (diharapkan {expected})")
        expected = no + 1
        term_clean = re.sub(r"^\*\*(.*)\*\*$", r"\1", term).strip()
        cat.entries.append(Entry(no, term_clean, definition, function, cat))
    if not cat.entries:
        problems.append(f"{path.name}: tidak ada baris tabel yang terbaca")
    return cat


def load_all() -> tuple[list[Category], list[str]]:
    problems: list[str] = []
    cats: list[Category] = []
    for d in SOURCE_DIRS:
        for p in sorted(d.glob("*.md")):
            if ".part" in p.name:
                problems.append(f"{p.name}: file part belum digabung")
                continue
            cats.append(parse_file(p, problems))
    n = 0
    for c in cats:
        for e in c.entries:
            n += 1
            e.no_global = n
    # deteksi istilah ganda (hanya peringatan)
    seen: dict[str, str] = {}
    for c in cats:
        for e in c.entries:
            k = e.term.lower()
            if k in seen and seen[k] != c.code:
                problems.append(f"PERINGATAN duplikat istilah '{e.term}' di kategori {seen[k]} dan {c.code}")
            seen.setdefault(k, c.code)
    return cats, problems


# --------------------------------------------------------------------------- #
# Konversi inline Markdown -> HTML / teks polos
# --------------------------------------------------------------------------- #
def md_inline_to_html(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return s


def md_inline_to_text(s: str) -> str:
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    return s


def slug(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s.lower())
    return re.sub(r"[\s_]+", "-", s).strip("-")


# --------------------------------------------------------------------------- #
# Output: Markdown gabungan
# --------------------------------------------------------------------------- #
def write_combined_md(cats: list[Category]) -> Path:
    total = sum(len(c.entries) for c in cats)
    e_total = sum(len(c.entries) for c in cats if c.fase == "E")
    f_total = total - e_total
    out: list[str] = []
    out.append("# Glosarium TKJ Lengkap — Fase E dan Fase F\n")
    out.append("> File ini dihasilkan otomatis oleh `tools/build.py` dari file sumber di `fase-e/` dan `fase-f/`. "
               "Untuk mengubah isi, sunting file sumbernya lalu jalankan ulang skrip.\n")
    out.append(f"**Total istilah: {total}** · Fase E: {e_total} istilah dalam "
               f"{sum(1 for c in cats if c.fase == 'E')} kategori · Fase F: {f_total} istilah dalam "
               f"{sum(1 for c in cats if c.fase == 'F')} kategori\n")
    out.append("Kolom tabel: **No** (nomor global) · **Istilah** · **Pengertian** (penjelasan sederhana untuk siswa SMK) · "
               "**Fungsi / Kegunaan** (untuk istilah serangan/ancaman: tujuan penyerang dan cara pencegahan).\n")
    out.append("## Daftar Isi\n")
    for fase, label in (("E", "Fase E (Kelas X) — Dasar-Dasar Teknik Jaringan Komputer dan Telekomunikasi"),
                        ("F", "Fase F (Kelas XI–XII) — Konsentrasi Keahlian Teknik Komputer dan Jaringan")):
        out.append(f"**{label}**\n")
        for c in cats:
            if c.fase == fase:
                out.append(f"- [{c.code} · {c.title}](#{slug(c.code + ' ' + c.title)}) — {len(c.entries)} istilah")
        out.append("")
    out.append("Lihat juga: [Indeks A–Z](INDEKS-A-Z.md) · [Versi interaktif (HTML)](index.html) · [CSV untuk Excel](glosarium-tkj.csv)\n")

    current_fase = None
    for c in cats:
        if c.fase != current_fase:
            current_fase = c.fase
            out.append("\n---\n")
            out.append("# BAGIAN " + ("A — FASE E (KELAS X)" if c.fase == "E" else "B — FASE F (KELAS XI–XII)") + "\n")
        out.append(f"## {c.code} · {c.title}\n")
        out.append(f"> **Fase:** {c.fase_label} · **Elemen CP:** {c.elemen}\n>\n> **Ringkasan:** {c.ringkasan}\n")
        out.append("| No | Istilah | Pengertian | Fungsi / Kegunaan |")
        out.append("|---:|---|---|---|")
        for e in c.entries:
            out.append(f"| {e.no_global} | **{e.term}** | {e.definition} | {e.function} |")
        out.append("")
    p = ROOT / "GLOSARIUM-LENGKAP.md"
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    return p


# --------------------------------------------------------------------------- #
# Output: Indeks A-Z
# --------------------------------------------------------------------------- #
def write_index_md(cats: list[Category]) -> Path:
    items = []
    for c in cats:
        for e in c.entries:
            items.append((e.term, c))
    items.sort(key=lambda t: re.sub(r"[^0-9a-zA-Z ]", "", t[0]).lower() or t[0].lower())
    out = ["# Indeks Istilah A–Z\n",
           "> Daftar semua istilah secara alfabetis beserta kategori tempat penjelasannya berada. "
           "Dihasilkan otomatis oleh `tools/build.py`.\n"]
    letters = sorted({(re.sub(r"[^0-9a-zA-Z]", "", t)[:1] or "#").upper() for t, _ in items})
    out.append(" · ".join(f"[{l}](#{l.lower() if l != '#' else 'lainnya'})" for l in letters) + "\n")
    current = None
    for term, c in items:
        letter = (re.sub(r"[^0-9a-zA-Z]", "", term)[:1] or "#").upper()
        if letter != current:
            current = letter
            out.append(f"\n## {letter if letter != '#' else 'Lainnya'}\n")
        out.append(f"- **{term}** — [{c.code} · {c.title}]({c.rel_path}) (Fase {c.fase})")
    p = ROOT / "INDEKS-A-Z.md"
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    return p


# --------------------------------------------------------------------------- #
# Output: CSV
# --------------------------------------------------------------------------- #
def write_csv(cats: list[Category]) -> Path:
    p = ROOT / "glosarium-tkj.csv"
    with p.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["No", "Fase", "Kode Kategori", "Kategori", "No dalam Kategori", "Istilah", "Pengertian", "Fungsi / Kegunaan"])
        for c in cats:
            for e in c.entries:
                w.writerow([e.no_global, f"Fase {c.fase}", c.code, c.title, e.no_local, e.term,
                            md_inline_to_text(e.definition), md_inline_to_text(e.function)])
    return p


# --------------------------------------------------------------------------- #
# Output: HTML interaktif
# --------------------------------------------------------------------------- #
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Glosarium TKJ — Fase E &amp; Fase F</title>
<meta name="description" content="Kamus istilah Teknik Komputer dan Jaringan (TKJ) untuk siswa SMK: pengertian sederhana dan fungsinya, mencakup materi Fase E dan Fase F Kurikulum Merdeka.">
<style>
  :root{
    --bg:#f4f6fb;--card:#ffffff;--ink:#1c2333;--muted:#5b6478;--line:#e1e5ee;
    --brand:#0f5fbf;--brand-2:#0b8f7a;--chip:#eef3fb;--chip-on:#0f5fbf;--mark:#fff1a8;
    --e:#0b8f7a;--f:#a14ec2;
  }
  @media (prefers-color-scheme:dark){
    :root{--bg:#0f1420;--card:#171d2b;--ink:#e8ecf5;--muted:#a3acc2;--line:#28324a;
      --brand:#6aa7ff;--brand-2:#3fd0b5;--chip:#1f2940;--chip-on:#2f6fe0;--mark:#7a6a00;--e:#3fd0b5;--f:#d29bea;}
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Helvetica Neue",Arial,sans-serif;
       background:var(--bg);color:var(--ink);line-height:1.5}
  header{background:linear-gradient(120deg,var(--brand),var(--brand-2));color:#fff;padding:28px 20px 22px}
  header .wrap{max-width:1200px;margin:0 auto}
  header h1{margin:0 0 6px;font-size:clamp(1.4rem,2.6vw,2rem);letter-spacing:.2px}
  header p{margin:0;opacity:.95;max-width:900px}
  .stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .stat{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:4px 12px;font-size:.9rem}
  main{max-width:1200px;margin:0 auto;padding:18px 16px 60px}
  .controls{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:12px;
            position:sticky;top:0;z-index:5;box-shadow:0 6px 18px rgba(0,0,0,.05)}
  .search{display:flex;gap:8px;align-items:center}
  .search input{flex:1;font-size:1rem;padding:11px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}
  .search input:focus{outline:2px solid var(--brand);border-color:transparent}
  .search button{padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--chip);color:var(--ink);cursor:pointer}
  .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .row label{font-size:.85rem;color:var(--muted);margin-right:4px}
  .chip{border:1px solid var(--line);background:var(--chip);color:var(--ink);border-radius:999px;padding:6px 12px;font-size:.88rem;cursor:pointer;user-select:none}
  .chip[aria-pressed="true"]{background:var(--chip-on);color:#fff;border-color:transparent}
  select{padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:.9rem;max-width:100%}
  .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;color:var(--muted);font-size:.9rem}
  .meta a{color:var(--brand)}
  .cat-head{margin:26px 0 8px;padding:12px 14px;background:var(--card);border-left:6px solid var(--brand);border-radius:10px;border:1px solid var(--line);border-left-width:6px}
  .cat-head h2{margin:0 0 4px;font-size:1.15rem}
  .cat-head p{margin:0;color:var(--muted);font-size:.9rem}
  .cat-head .badge{margin-left:8px}
  .badge{display:inline-block;font-size:.72rem;font-weight:600;border-radius:6px;padding:2px 7px;color:#fff;vertical-align:middle;letter-spacing:.3px}
  .badge.E{background:var(--e)} .badge.F{background:var(--f)}
  table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  th{background:var(--chip);text-align:left;font-size:.85rem;padding:10px 12px;border-bottom:1px solid var(--line)}
  td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.95rem}
  tr:last-child td{border-bottom:none}
  td.no{width:52px;color:var(--muted);font-variant-numeric:tabular-nums}
  td.term{width:22%;font-weight:700}
  td.def{width:44%}
  code{background:var(--chip);padding:1px 5px;border-radius:5px;font-size:.88em}
  mark{background:var(--mark);color:inherit;padding:0 2px;border-radius:3px}
  .empty{padding:40px;text-align:center;color:var(--muted);background:var(--card);border:1px dashed var(--line);border-radius:12px;margin-top:20px}
  .totop{position:fixed;right:16px;bottom:16px;background:var(--brand);color:#fff;border:none;border-radius:999px;padding:10px 14px;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.2);display:none}
  footer{max-width:1200px;margin:0 auto;padding:0 16px 40px;color:var(--muted);font-size:.85rem}
  @media (max-width:760px){
    thead{display:none}
    table,tbody,tr,td{display:block;width:100%}
    tr{border-bottom:8px solid var(--bg)}
    td{border-bottom:1px dashed var(--line)}
    td.no{display:inline-block;width:auto;font-weight:700;color:var(--brand)}
    td.term{display:inline-block;width:auto;font-size:1.05rem}
    td.def::before{content:"Pengertian";display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    td.fn::before{content:"Fungsi / Kegunaan";display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
  }
  @media print{
    header{background:none;color:#000;padding:0 0 10px}
    .controls,.totop,footer .noprint{display:none}
    main{max-width:none;padding:0}
    table{border-radius:0}
    td,th{font-size:9.5pt;padding:4px 6px}
    .cat-head{break-after:avoid}
    tr{break-inside:avoid}
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <h1>Glosarium TKJ — Fase E &amp; Fase F</h1>
    <p>Kamus istilah Teknik Komputer dan Jaringan untuk siswa SMK: pengertian yang mudah dipahami beserta fungsinya, disusun mengikuti elemen Capaian Pembelajaran Dasar-Dasar TJKT (Fase E) dan Konsentrasi Keahlian TKJ (Fase F) Kurikulum Merdeka.</p>
    <div class="stats" id="stats"></div>
  </div>
</header>
<main>
  <section class="controls" aria-label="Pencarian dan filter">
    <div class="search">
      <input id="q" type="search" placeholder="Cari istilah, misalnya: subnetting, VLAN, OTDR, phishing, DHCP…" autocomplete="off" aria-label="Cari istilah">
      <button id="clear" type="button" title="Bersihkan pencarian">Bersihkan</button>
      <button id="print" type="button" title="Cetak / simpan PDF">Cetak</button>
    </div>
    <div class="row" id="fase-row">
      <label>Fase:</label>
      <button class="chip" data-fase="all" aria-pressed="true">Semua</button>
      <button class="chip" data-fase="E" aria-pressed="false">Fase E (Kelas X)</button>
      <button class="chip" data-fase="F" aria-pressed="false">Fase F (Kelas XI–XII)</button>
      <label style="margin-left:8px">Kategori:</label>
      <select id="cat"><option value="all">Semua kategori</option></select>
      <label style="margin-left:8px"><input type="checkbox" id="termonly"> cari di nama istilah saja</label>
    </div>
    <div class="meta">
      <span id="count"></span>
      <span>Sumber Markdown: <a href="GLOSARIUM-LENGKAP.md">GLOSARIUM-LENGKAP.md</a> · <a href="GLOSARIUM-TKJ.docx">Word (DOCX)</a> · <a href="glosarium-tkj.csv">CSV</a> · <a href="INDEKS-A-Z.md">Indeks A–Z</a></span>
    </div>
  </section>
  <div id="results"></div>
  <div class="empty" id="empty" hidden>Tidak ada istilah yang cocok. Coba kata kunci lain atau ubah filter.</div>
</main>
<button class="totop" id="totop" type="button" aria-label="Kembali ke atas">↑ Atas</button>
<footer>
  <p>Disusun untuk pembelajaran SMK Program Keahlian TJKT / Konsentrasi Keahlian TKJ. Kolom <em>Fungsi / Kegunaan</em> pada istilah serangan berisi tujuan penyerang dan cara pencegahannya. Dihasilkan otomatis oleh <code>tools/build.py</code>.</p>
</footer>
<script id="data" type="application/json">__DATA__</script>
<script>
(function(){
  const DATA = JSON.parse(document.getElementById('data').textContent);
  const cats = DATA.categories, entries = DATA.entries;
  const tmp = document.createElement('div');
  const toText = h => { tmp.innerHTML = h; return tmp.textContent || ''; };
  entries.forEach(e => { e.term_text = toText(e.term); e.def_text = toText(e.def); e.fn_text = toText(e.fn); });
  const $ = s => document.querySelector(s);
  const q = $('#q'), results = $('#results'), empty = $('#empty'), count = $('#count'), catSel = $('#cat'), termOnly = $('#termonly');
  let fase = 'all';

  // statistik
  const eN = entries.filter(e=>e.fase==='E').length, fN = entries.length-eN;
  $('#stats').innerHTML = `<span class="stat">${entries.length} istilah</span><span class="stat">${cats.length} kategori</span><span class="stat">Fase E: ${eN}</span><span class="stat">Fase F: ${fN}</span>`;

  // isi dropdown kategori
  cats.forEach(c => { const o=document.createElement('option'); o.value=c.code; o.textContent=`${c.code} · ${c.title} (Fase ${c.fase})`; catSel.appendChild(o); });

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const strip = s => s.replace(/<[^>]+>/g,'');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function highlight(htmlStr, terms){
    if(!terms.length) return htmlStr;
    // hanya sorot di luar tag HTML
    const re = new RegExp('('+terms.map(esc).join('|')+')','gi');
    return htmlStr.split(/(<[^>]+>)/g).map(part => part.startsWith('<') ? part : part.replace(re,'<mark>$1</mark>')).join('');
  }

  function render(){
    const raw = q.value.trim();
    const terms = raw ? norm(raw).split(/\s+/).filter(Boolean) : [];
    const selCat = catSel.value;
    const only = termOnly.checked;
    let shown = 0;
    const frag = document.createDocumentFragment();
    cats.forEach(c => {
      if(fase!=='all' && c.fase!==fase) return;
      if(selCat!=='all' && c.code!==selCat) return;
      const rows = entries.filter(e => {
        if(e.cat!==c.code) return false;
        if(!terms.length) return true;
        const hay = norm(only ? e.term_text : (e.term_text+' '+e.def_text+' '+e.fn_text));
        return terms.every(t => hay.includes(t));
      });
      if(!rows.length) return;
      shown += rows.length;
      const head = document.createElement('div'); head.className='cat-head';
      head.innerHTML = `<h2>${c.code} · ${c.title}<span class="badge ${c.fase}">Fase ${c.fase}</span></h2><p><strong>Elemen CP:</strong> ${c.elemen}</p><p>${c.ringkasan}</p>`;
      frag.appendChild(head);
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>No</th><th>Istilah</th><th>Pengertian</th><th>Fungsi / Kegunaan</th></tr></thead>';
      const tb = document.createElement('tbody');
      const rawTerms = raw ? raw.split(/\s+/).filter(Boolean) : [];
      rows.forEach(e => {
        const tr = document.createElement('tr');
        tr.id = 'i'+e.no;
        tr.innerHTML = `<td class="no">${e.no}</td><td class="term">${highlight(e.term,rawTerms)}</td><td class="def">${only?e.def:highlight(e.def,rawTerms)}</td><td class="fn">${only?e.fn:highlight(e.fn,rawTerms)}</td>`;
        tb.appendChild(tr);
      });
      table.appendChild(tb); frag.appendChild(table);
    });
    results.replaceChildren(frag);
    empty.hidden = shown>0;
    count.textContent = `Menampilkan ${shown} dari ${entries.length} istilah` + (raw?` untuk "${raw}"`:'');
    // sinkron URL (agar bisa dibagikan)
    const p = new URLSearchParams(); if(raw) p.set('q',raw); if(fase!=='all') p.set('fase',fase); if(selCat!=='all') p.set('kat',selCat);
    try { history.replaceState(null,'', p.toString()? '?'+p.toString() : location.pathname); } catch(_) { /* dibuka via file:// */ }
  }

  let t; q.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(render,120); });
  $('#clear').addEventListener('click', ()=>{ q.value=''; render(); q.focus(); });
  $('#print').addEventListener('click', ()=>window.print());
  catSel.addEventListener('change', render);
  termOnly.addEventListener('change', render);
  document.querySelectorAll('#fase-row .chip').forEach(b => b.addEventListener('click', ()=>{
    document.querySelectorAll('#fase-row .chip').forEach(x=>x.setAttribute('aria-pressed','false'));
    b.setAttribute('aria-pressed','true'); fase=b.dataset.fase; render();
  }));
  const totop = $('#totop');
  window.addEventListener('scroll', ()=>{ totop.style.display = window.scrollY>600 ? 'block':'none'; });
  totop.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
  // keyboard: tekan "/" untuk fokus ke pencarian
  window.addEventListener('keydown', e => { if(e.key==='/' && document.activeElement!==q){ e.preventDefault(); q.focus(); } });

  // baca parameter URL
  const sp = new URLSearchParams(location.search);
  if(sp.get('q')) q.value = sp.get('q');
  if(sp.get('fase')){ fase = sp.get('fase'); document.querySelectorAll('#fase-row .chip').forEach(x=>x.setAttribute('aria-pressed', x.dataset.fase===fase?'true':'false')); }
  if(sp.get('kat')) catSel.value = sp.get('kat');
  render();
})();
</script>
</body>
</html>
"""


def write_html(cats: list[Category]) -> Path:
    data = {
        "categories": [
            {"code": c.code, "title": c.title, "fase": c.fase, "elemen": md_inline_to_html(c.elemen),
             "ringkasan": md_inline_to_html(c.ringkasan), "count": len(c.entries)}
            for c in cats
        ],
        "entries": [
            {"no": e.no_global, "cat": c.code, "fase": c.fase,
             "term": md_inline_to_html(e.term), "def": md_inline_to_html(e.definition), "fn": md_inline_to_html(e.function)}
            for c in cats for e in c.entries
        ],
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    p = ROOT / "index.html"
    p.write_text(HTML_TEMPLATE.replace("__DATA__", payload), encoding="utf-8")
    return p


# --------------------------------------------------------------------------- #
# Output: DOCX (Word) — lihat docx_writer.py
# --------------------------------------------------------------------------- #
def write_docx_files(cats: list[Category]) -> list[Path]:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from docx_writer import write_docx  # noqa: E402

    outs = [write_docx(ROOT / "GLOSARIUM-TKJ.docx", cats, title="Glosarium TKJ",
                       subtitle="Fase E & Fase F — Kurikulum Merdeka (SMK TJKT / TKJ)",
                       header_right="Fase E & Fase F · Kurikulum Merdeka")]
    for fase, sub, hdr in (("E", "Fase E (Kelas X) — Dasar-Dasar TJKT", "Fase E · Kelas X · Dasar-Dasar TJKT"),
                           ("F", "Fase F (Kelas XI–XII) — Konsentrasi Keahlian TKJ", "Fase F · Kelas XI–XII · TKJ")):
        subset = [c for c in cats if c.fase == fase]
        if subset:
            outs.append(write_docx(ROOT / f"GLOSARIUM-TKJ-FASE-{fase}.docx", subset, title="Glosarium TKJ",
                                   subtitle=sub, header_right=hdr))
    return outs


# --------------------------------------------------------------------------- #
def main() -> int:
    cats, problems = load_all()
    errors = [p for p in problems if not p.startswith("PERINGATAN")]
    warnings = [p for p in problems if p.startswith("PERINGATAN")]
    for w in warnings:
        print("  ", w)
    if errors:
        print("Ditemukan kesalahan pada file sumber:")
        for e in errors:
            print("  ", e)
        return 1
    outputs = [write_combined_md(cats), write_index_md(cats), write_csv(cats), write_html(cats)]
    outputs += write_docx_files(cats)
    total = sum(len(c.entries) for c in cats)
    print(f"OK: {total} istilah dari {len(cats)} kategori")
    for c in cats:
        print(f"  [{c.fase}] {c.code} {c.title:<58} {len(c.entries):>4}")
    for o in outputs:
        print("  ->", o.relative_to(ROOT).as_posix(), f"({o.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
