"""
Penulis DOCX (WordprocessingML/OOXML) tanpa pustaka tambahan.

Dipanggil oleh build.py untuk menghasilkan versi Word dari glosarium:
halaman sampul, petunjuk baca, daftar isi (bidang TOC), tabel per kategori
(kepala tabel berulang tiap halaman, baris tidak terpotong), dan indeks A-Z
tiga kolom. Ukuran kertas A4 tegak.
"""
from __future__ import annotations

import datetime as _dt
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape as _xml_escape

# --------------------------------------------------------------------------- #
# Konstanta tata letak (satuan twip: 1 cm = 567 twip; 1 pt = 20 twip)
# --------------------------------------------------------------------------- #
PAGE_W, PAGE_H = 11906, 16838          # A4
MARGIN_LR, MARGIN_TB = 851, 1021       # 1,5 cm dan 1,8 cm
TEXT_W = PAGE_W - 2 * MARGIN_LR        # 10204 twip = 18 cm
COL_W = (620, 2100, 4200, TEXT_W - 620 - 2100 - 4200)   # No, Istilah, Pengertian, Fungsi

C_PRIMARY = "1F4E79"   # biru tua
C_ACCENT = "0B8F7A"    # hijau toska
C_MUTED = "5B6478"
C_LINE = "BFBFBF"
C_ZEBRA = "F2F6FB"
C_CODE = "EDEFF3"

W_NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')


def esc(s: str) -> str:
    return _xml_escape(s, {'"': "&quot;"})


# --------------------------------------------------------------------------- #
# Pembangun elemen kecil
# --------------------------------------------------------------------------- #
def rpr(*, bold=False, italic=False, color=None, size=None, font=None, style=None,
        shade=None, caps=False) -> str:
    parts = []
    if style:
        parts.append(f'<w:rStyle w:val="{style}"/>')
    if font:
        parts.append(f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>')
    if bold:
        parts.append("<w:b/><w:bCs/>")
    if italic:
        parts.append("<w:i/><w:iCs/>")
    if caps:
        parts.append("<w:caps/>")
    if color:
        parts.append(f'<w:color w:val="{color}"/>')
    if size:
        parts.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
    if shade:
        parts.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>')
    return f"<w:rPr>{''.join(parts)}</w:rPr>" if parts else ""


def run(text: str, **fmt) -> str:
    return f'<w:r>{rpr(**fmt)}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'


def tab_run() -> str:
    return "<w:r><w:tab/></w:r>"


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


_INLINE_RE = re.compile(r"(\*\*.+?\*\*|`[^`]+`)")


def inline_runs(text: str, **base) -> str:
    """Ubah teks dengan penanda **tebal** dan `kode` menjadi rangkaian run."""
    out = []
    for tok in _INLINE_RE.split(text):
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            out.append(run(tok[2:-2], bold=True, **base))
        elif tok.startswith("`") and tok.endswith("`"):
            out.append(run(tok[1:-1], font="Consolas", shade=C_CODE, **base))
        else:
            out.append(run(tok, **base))
    return "".join(out)


def para(content: str = "", *, style=None, jc=None, before=None, after=None, line=None,
         keep_next=False, page_break_before=False, tabs=None, border_bottom=None,
         border_top=None, ind_left=None, ind_hanging=None, sect=None) -> str:
    p = []
    if style:
        p.append(f'<w:pStyle w:val="{style}"/>')
    if keep_next:
        p.append("<w:keepNext/>")
    if page_break_before:
        p.append("<w:pageBreakBefore/>")
    if border_top or border_bottom:
        b = []
        if border_top:
            b.append(f'<w:top w:val="single" w:sz="{border_top[1]}" w:space="4" w:color="{border_top[0]}"/>')
        if border_bottom:
            b.append(f'<w:bottom w:val="single" w:sz="{border_bottom[1]}" w:space="4" w:color="{border_bottom[0]}"/>')
        p.append(f"<w:pBdr>{''.join(b)}</w:pBdr>")
    if tabs:
        tab_xml = []
        for v, pos, leader in tabs:
            leader_attr = ' w:leader="dot"' if leader else ""
            tab_xml.append(f'<w:tab w:val="{v}" w:pos="{pos}"{leader_attr}/>')
        p.append("<w:tabs>" + "".join(tab_xml) + "</w:tabs>")
    if before is not None or after is not None or line is not None:
        a = []
        if before is not None:
            a.append(f'w:before="{before}"')
        if after is not None:
            a.append(f'w:after="{after}"')
        if line is not None:
            a.append(f'w:line="{line}" w:lineRule="auto"')
        p.append(f"<w:spacing {' '.join(a)}/>")
    if ind_left is not None or ind_hanging is not None:
        a = []
        if ind_left is not None:
            a.append(f'w:left="{ind_left}"')
        if ind_hanging is not None:
            a.append(f'w:hanging="{ind_hanging}"')
        p.append(f"<w:ind {' '.join(a)}/>")
    if jc:
        p.append(f'<w:jc w:val="{jc}"/>')
    if sect:
        p.append(sect)
    ppr = f"<w:pPr>{''.join(p)}</w:pPr>" if p else ""
    return f"<w:p>{ppr}{content}</w:p>"


def bookmark(name: str, bid: int, inner: str) -> str:
    return f'<w:bookmarkStart w:id="{bid}" w:name="{name}"/>{inner}<w:bookmarkEnd w:id="{bid}"/>'


def hyperlink_anchor(anchor: str, text: str, **fmt) -> str:
    return (f'<w:hyperlink w:anchor="{anchor}" w:history="1">'
            f'{run(text, style="Hyperlink", **fmt)}</w:hyperlink>')


def field(instr: str, cached: str = "", dirty: bool = False) -> str:
    """Bidang sederhana dalam satu paragraf (PAGE, NUMPAGES, dsb.)."""
    d = ' w:dirty="true"' if dirty else ""
    return (f'<w:r><w:fldChar w:fldCharType="begin"{d}/></w:r>'
            f'<w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
            f'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
            f'<w:r><w:t xml:space="preserve">{esc(cached)}</w:t></w:r>'
            f'<w:r><w:fldChar w:fldCharType="end"/></w:r>')


# --------------------------------------------------------------------------- #
# Tabel
# --------------------------------------------------------------------------- #
def cell(paragraphs: str, width: int, *, fill=None, valign="top") -> str:
    tc = [f'<w:tcW w:w="{width}" w:type="dxa"/>']
    if fill:
        tc.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>')
    if valign:
        tc.append(f'<w:vAlign w:val="{valign}"/>')
    return f"<w:tc><w:tcPr>{''.join(tc)}</w:tcPr>{paragraphs}</w:tc>"


def table(rows: list[str], widths: tuple[int, ...], *, border_color=C_LINE) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    borders = "".join(
        f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"))
    return (
        "<w:tbl><w:tblPr>"
        '<w:tblStyle w:val="TableGrid"/>'
        f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
        f"<w:tblBorders>{borders}</w:tblBorders>"
        '<w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="85" w:type="dxa"/>'
        '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>'
        '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"{''.join(rows)}</w:tbl>"
    )


def header_row(labels: list[str], widths: tuple[int, ...], fill=C_PRIMARY) -> str:
    cells = "".join(
        cell(para(run(lbl, bold=True, color="FFFFFF"), style="TabelKepala"), w, fill=fill, valign="center")
        for lbl, w in zip(labels, widths))
    return f"<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>{cells}</w:tr>"


def glossary_row(no: int, term: str, definition: str, function: str, zebra: bool) -> str:
    fill = C_ZEBRA if zebra else None
    cells = [
        cell(para(run(str(no), color=C_MUTED), style="TabelNo"), COL_W[0], fill=fill),
        cell(para(inline_runs(term, bold=True, color=C_PRIMARY), style="TabelIsi"), COL_W[1], fill=fill),
        cell(para(inline_runs(definition), style="TabelIsi"), COL_W[2], fill=fill),
        cell(para(inline_runs(function), style="TabelIsi"), COL_W[3], fill=fill),
    ]
    return f"<w:tr><w:trPr><w:cantSplit/></w:trPr>{''.join(cells)}</w:tr>"


# --------------------------------------------------------------------------- #
# Bagian dokumen
# --------------------------------------------------------------------------- #
def sect_pr(*, cols: int = 1, title_pg: bool = False, final: bool = False) -> str:
    inner = (
        '<w:headerReference w:type="default" r:id="rIdHeader"/>'
        '<w:footerReference w:type="default" r:id="rIdFooter"/>'
        '<w:type w:val="nextPage"/>'
        f'<w:pgSz w:w="{PAGE_W}" w:h="{PAGE_H}"/>'
        f'<w:pgMar w:top="{MARGIN_TB}" w:right="{MARGIN_LR}" w:bottom="{MARGIN_TB}" w:left="{MARGIN_LR}" '
        'w:header="567" w:footer="567" w:gutter="0"/>'
        + (f'<w:cols w:num="{cols}" w:space="284"/>' if cols > 1 else '<w:cols w:space="708"/>')
        + ("<w:titlePg/>" if title_pg else "")
        + '<w:docGrid w:linePitch="360"/>'
    )
    return f"<w:sectPr>{inner}</w:sectPr>"


def cover(cats, title: str, subtitle: str, total: int, today: str) -> str:
    e_n = sum(len(c.entries) for c in cats if c.fase == "E")
    f_n = total - e_n
    out = []
    out.append(para("", after=2400))
    out.append(para(run("GLOSARIUM", bold=True, color=C_ACCENT, size=36, caps=True), jc="left", after=0))
    out.append(para(run(title, bold=True, color=C_PRIMARY, size=64), after=120, line=240))
    out.append(para(run(subtitle, color=C_MUTED, size=28), after=240, border_bottom=(C_ACCENT, 24)))
    out.append(para(run("Kamus istilah Teknik Komputer dan Jaringan untuk siswa SMK: setiap istilah dijelaskan dengan "
                        "bahasa yang mudah dipahami beserta fungsinya, disusun mengikuti elemen Capaian Pembelajaran "
                        "Kurikulum Merdeka.", size=22, color="333333"), after=360, line=300))
    stat = f"{total:,} istilah".replace(",", ".") + f"  ·  {len(cats)} kategori"
    if e_n and f_n:
        stat += f"  ·  Fase E: {e_n}  ·  Fase F: {f_n}"
    out.append(para(run(stat, bold=True, color=C_PRIMARY, size=24), after=480))

    # tabel ringkas kategori
    widths = (900, 5900, 1400, 2004)
    rows = [header_row(["Kode", "Kategori", "Fase", "Jumlah istilah"], widths)]
    for i, c in enumerate(cats):
        fill = C_ZEBRA if i % 2 else None
        rows.append(
            "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
            + cell(para(run(c.code, bold=True, color=C_PRIMARY), style="TabelNo"), widths[0], fill=fill)
            + cell(para(hyperlink_anchor(f"kat_{c.code}", c.title, size=19), style="TabelIsi"), widths[1], fill=fill)
            + cell(para(run(f"Fase {c.fase}", color=C_ACCENT if c.fase == "E" else "7B3FA0", bold=True), style="TabelNo"), widths[2], fill=fill)
            + cell(para(run(str(len(c.entries))), style="TabelNo"), widths[3], fill=fill)
            + "</w:tr>")
    rows.append(
        "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
        + cell(para(run(""), style="TabelNo"), widths[0], fill="E3EAF3")
        + cell(para(run("Total", bold=True), style="TabelIsi"), widths[1], fill="E3EAF3")
        + cell(para(run(""), style="TabelNo"), widths[2], fill="E3EAF3")
        + cell(para(run(str(total), bold=True), style="TabelNo"), widths[3], fill="E3EAF3")
        + "</w:tr>")
    out.append(table(rows, widths))
    out.append(para(run(f"Dihasilkan otomatis oleh tools/build.py pada {today}. Sumber: folder fase-e/ dan fase-f/ "
                        "di repositori glosarium-tkj.", italic=True, color=C_MUTED, size=16), before=360))
    out.append(page_break())
    return "".join(out)


def guide_and_toc(cats, bid_start: int) -> tuple[str, int]:
    bid = bid_start
    out = []
    out.append(para(bookmark("tentang", bid, run("Tentang Glosarium Ini")), style="Heading1")); bid += 1
    paras = [
        "Glosarium ini menghimpun istilah yang dipelajari siswa SMK Program Keahlian Teknik Jaringan Komputer dan "
        "Telekomunikasi (TJKT) pada Fase E (kelas X, mata pelajaran Dasar-Dasar TJKT) dan Konsentrasi Keahlian "
        "Teknik Komputer dan Jaringan (TKJ) pada Fase F (kelas XI–XII). Pengelompokan bab mengikuti elemen "
        "Capaian Pembelajaran sehingga guru dapat langsung memakainya sebagai lampiran modul ajar.",
        "Setiap istilah dijelaskan dengan kalimat sederhana, sering disertai analogi kehidupan sehari-hari dan "
        "contoh angka nyata (kecepatan, jarak, nomor port, biaya), lalu ditutup dengan fungsi atau kegunaannya "
        "dalam praktik. Untuk istilah yang berupa ancaman atau serangan, kolom fungsi berisi tujuan penyerang "
        "sekaligus cara pencegahannya.",
    ]
    for t in paras:
        out.append(para(run(t), style="Normal", after=120, line=276))

    out.append(para(run("Cara membaca tabel"), style="Heading2"))
    items = [
        ("No", "nomor urut global; sama dengan nomor pada versi HTML, Markdown, dan CSV sehingga mudah dirujuk."),
        ("Istilah", "istilah utama, biasanya disertai singkatan/kepanjangan atau padanan bahasa Inggrisnya."),
        ("Pengertian", "penjelasan ringkas dengan bahasa siswa."),
        ("Fungsi / Kegunaan", "untuk apa istilah itu dipakai atau mengapa penting; untuk serangan berisi tujuan penyerang dan pencegahannya."),
    ]
    for k, v in items:
        out.append(para(run("•  ") + run(k + " — ", bold=True) + run(v), after=60, ind_left=284, ind_hanging=284))
    out.append(para(run("Teks dengan latar abu-abu seperti ") + run("ip address print", font="Consolas", shade=C_CODE)
                    + run(" adalah perintah atau nama berkas yang diketik apa adanya."), before=120, after=120))
    out.append(para(run("Saran pemakaian"), style="Heading2"))
    tips = [
        "Siswa: bacalah kolom Pengertian lebih dulu, lalu uji diri dengan menutup kolom Fungsi dan menebaknya.",
        "Guru: setiap bab dapat dicetak terpisah sebagai lampiran modul ajar elemen terkait; nomor global memudahkan penyusunan soal.",
        "Persiapan UKK/sertifikasi (MTCNA, CCNA): fokus pada Bagian B, khususnya bab 09–13.",
    ]
    for t in tips:
        out.append(para(run("•  ") + run(t), after=60, ind_left=284, ind_hanging=284))

    # Daftar isi (bidang TOC dengan isi cache berupa tautan)
    # judul daftar isi sengaja bukan Heading agar tidak ikut masuk ke dalam TOC
    out.append(para(run("Daftar Isi", bold=True, color=C_PRIMARY, size=34), page_break_before=True, after=160, keep_next=True))
    out.append(para(run("Nomor halaman akan muncul setelah daftar isi diperbarui (di Word: klik kanan → Update Field → "
                        "Update entire table; di LibreOffice: Tools → Update → Update All).",
                        italic=True, color=C_MUTED, size=18), after=160))
    first = True
    entries = []
    current_fase = None
    for c in cats:
        if c.fase != current_fase:
            current_fase = c.fase
            label = ("Bagian A — Fase E (Kelas X): Dasar-Dasar TJKT" if c.fase == "E"
                     else "Bagian B — Fase F (Kelas XI–XII): Konsentrasi Keahlian TKJ")
            entries.append(("TOC1", f"bag_{c.fase}", label))
        entries.append(("TOC2", f"kat_{c.code}", f"{c.code} · {c.title}  ({len(c.entries)} istilah)"))
    entries.append(("TOC1", "indeks", "Indeks Istilah A–Z"))
    for style, anchor, text in entries:
        content = hyperlink_anchor(anchor, text)
        if first:
            content = ('<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
                       '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r>'
                       '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' + content)
            first = False
        out.append(para(content, style=style, tabs=[("right", TEXT_W, True)]))
    out.append(para('<w:r><w:fldChar w:fldCharType="end"/></w:r>'))
    return "".join(out), bid


def category_section(c, bid: int, first_in_fase: bool) -> tuple[str, int]:
    out = []
    if first_in_fase:
        label = ("Bagian A — Fase E (Kelas X): Dasar-Dasar TJKT" if c.fase == "E"
                 else "Bagian B — Fase F (Kelas XI–XII): Konsentrasi Keahlian TKJ")
        out.append(para(bookmark(f"bag_{c.fase}", bid, run(label)), style="Heading1", page_break_before=True)); bid += 1
        intro = ("Bab 01–08 memuat istilah dasar yang dipelajari di kelas X: dunia kerja dan wirausaha TJKT, perkembangan "
                 "teknologi, K3LH, perangkat keras, sistem operasi, dasar jaringan, media transmisi/telekomunikasi, "
                 "serta alat ukur dan alat kerja." if c.fase == "E" else
                 "Bab 09–14 memuat istilah konsentrasi keahlian TKJ kelas XI–XII: perencanaan dan pengalamatan, jaringan "
                 "kabel/nirkabel/VoIP, pemasangan dan konfigurasi perangkat, keamanan jaringan, administrasi server, "
                 "serta troubleshooting dan pemeliharaan.")
        out.append(para(run(intro, color=C_MUTED), after=240, line=276))
    out.append(para(bookmark(f"kat_{c.code}", bid, run(f"{c.code} · {c.title}")), style="Heading2",
                    page_break_before=not first_in_fase)); bid += 1
    out.append(para(run("Fase: ", bold=True, color=C_MUTED, size=18) + run(c.fase_label, size=18)
                    + run("    Elemen CP: ", bold=True, color=C_MUTED, size=18) + inline_runs(c.elemen, size=18),
                    after=60, keep_next=True))
    out.append(para(run("Ringkasan: ", bold=True, color=C_MUTED, size=18) + inline_runs(c.ringkasan, size=18),
                    after=160, keep_next=True, line=264))
    rows = [header_row(["No", "Istilah", "Pengertian", "Fungsi / Kegunaan"], COL_W)]
    for i, e in enumerate(c.entries):
        rows.append(glossary_row(e.no_global, e.term, e.definition, e.function, zebra=bool(i % 2)))
    out.append(table(rows, COL_W))
    out.append(para("", after=0))
    return "".join(out), bid


def index_section(cats, bid: int) -> str:
    items = [(e.term, c.code) for c in cats for e in c.entries]
    items.sort(key=lambda t: (re.sub(r"[^0-9a-zA-Z ]", "", t[0]).lower() or t[0].lower()))
    out = []
    out.append(para(bookmark("indeks", bid, run("Indeks Istilah A–Z")), style="Heading1"))
    out.append(para(run("Angka di belakang istilah adalah kode bab tempat istilah itu dijelaskan.",
                        italic=True, color=C_MUTED, size=16), after=120))
    current = None
    for term, code in items:
        letter = (re.sub(r"[^0-9a-zA-Z]", "", term)[:1] or "#").upper()
        if letter != current:
            current = letter
            out.append(para(run(letter if letter != "#" else "Lainnya", bold=True, color=C_ACCENT, size=22),
                            before=120, after=40, keep_next=True, border_bottom=(C_ACCENT, 6)))
        out.append(para(run(term, size=16) + run(f"  {code}", size=16, color=C_MUTED, bold=True),
                        after=0, line=228, ind_left=170, ind_hanging=170))
    return "".join(out)


# --------------------------------------------------------------------------- #
# Part XML statis
# --------------------------------------------------------------------------- #
def styles_xml() -> str:
    def style(sid, name, kind="paragraph", based="Normal", next_="Normal", ppr="", rpr_="", qformat=True, ui=None):
        head = f'<w:style w:type="{kind}" w:styleId="{sid}"><w:name w:val="{name}"/>'
        if based and kind != "table":
            head += f'<w:basedOn w:val="{based}"/>'
        if next_ and kind == "paragraph":
            head += f'<w:next w:val="{next_}"/>'
        if ui is not None:
            head += f'<w:uiPriority w:val="{ui}"/>'
        if qformat:
            head += "<w:qFormat/>"
        return head + (f"<w:pPr>{ppr}</w:pPr>" if ppr else "") + (f"<w:rPr>{rpr_}</w:rPr>" if rpr_ else "") + "</w:style>"

    s = [f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles {W_NS}>']
    s.append('<w:docDefaults><w:rPrDefault><w:rPr>'
             '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/>'
             '<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="id-ID" w:eastAsia="en-US" w:bidi="ar-SA"/>'
             '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="259" w:lineRule="auto"/>'
             '</w:pPr></w:pPrDefault></w:docDefaults>')
    s.append('<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>')
    s.append('<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/>'
             '<w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>')
    s.append('<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/>'
             '<w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar>'
             '<w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/>'
             '<w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>')
    s.append(style("Heading1", "heading 1",
                   ppr='<w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/>',
                   rpr_=f'<w:b/><w:bCs/><w:color w:val="{C_PRIMARY}"/><w:sz w:val="34"/><w:szCs w:val="34"/>', ui=9))
    s.append(style("Heading2", "heading 2",
                   ppr=f'<w:keepNext/><w:keepLines/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="{C_ACCENT}"/></w:pBdr>'
                       '<w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/>',
                   rpr_=f'<w:b/><w:bCs/><w:color w:val="{C_PRIMARY}"/><w:sz w:val="28"/><w:szCs w:val="28"/>', ui=9))
    s.append(style("Heading3", "heading 3",
                   ppr='<w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/>',
                   rpr_=f'<w:b/><w:bCs/><w:color w:val="{C_ACCENT}"/><w:sz w:val="24"/><w:szCs w:val="24"/>', ui=9))
    s.append(style("TOC1", "toc 1", ppr='<w:spacing w:before="120" w:after="40"/>',
                   rpr_='<w:b/><w:bCs/>', qformat=False, ui=39))
    s.append(style("TOC2", "toc 2", ppr='<w:spacing w:after="20"/><w:ind w:left="284"/>', qformat=False, ui=39))
    s.append(style("TabelIsi", "Tabel Isi", ppr='<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>',
                   rpr_='<w:sz w:val="18"/><w:szCs w:val="18"/>', qformat=False))
    s.append(style("TabelNo", "Tabel Nomor", based="TabelIsi", ppr='<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>',
                   rpr_='<w:sz w:val="18"/><w:szCs w:val="18"/>', qformat=False))
    s.append(style("TabelKepala", "Tabel Kepala", based="TabelIsi", ppr='<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>',
                   rpr_='<w:b/><w:bCs/><w:color w:val="FFFFFF"/><w:sz w:val="18"/><w:szCs w:val="18"/>', qformat=False))
    s.append(style("Header", "header", ppr='<w:tabs><w:tab w:val="right" w:pos="10204"/></w:tabs><w:spacing w:after="0"/>',
                   rpr_=f'<w:color w:val="{C_MUTED}"/><w:sz w:val="16"/><w:szCs w:val="16"/>', qformat=False, ui=99))
    s.append(style("Footer", "footer", ppr='<w:spacing w:after="0"/><w:jc w:val="center"/>',
                   rpr_=f'<w:color w:val="{C_MUTED}"/><w:sz w:val="16"/><w:szCs w:val="16"/>', qformat=False, ui=99))
    s.append('<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/>'
             f'<w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="{C_PRIMARY}"/><w:u w:val="none"/></w:rPr></w:style>')
    s.append('<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>'
             '<w:uiPriority w:val="39"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>'
             '<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>')
    s.append("</w:styles>")
    return "".join(s)


def settings_xml() -> str:
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings {W_NS}>'
            '<w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/>'
            '<w:characterSpacingControl w:val="doNotCompress"/>'
            '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
            '</w:settings>')


def header_xml(left: str, right: str) -> str:
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr {W_NS}>'
            + para(run(left) + tab_run() + run(right), style="Header", border_bottom=(C_LINE, 4))
            + "</w:hdr>")


def footer_xml() -> str:
    return (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr {W_NS}>'
            + para(run("Halaman ") + field("PAGE", "1") + run(" dari ") + field("NUMPAGES", "1"), style="Footer")
            + "</w:ftr>")


def content_types_xml() -> str:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
            '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
            '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            '</Types>')


def root_rels_xml() -> str:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
            '</Relationships>')


def doc_rels_xml() -> str:
    base = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'<Relationship Id="rIdStyles" Type="{base}styles" Target="styles.xml"/>'
            f'<Relationship Id="rIdSettings" Type="{base}settings" Target="settings.xml"/>'
            f'<Relationship Id="rIdHeader" Type="{base}header" Target="header1.xml"/>'
            f'<Relationship Id="rIdFooter" Type="{base}footer" Target="footer1.xml"/>'
            '</Relationships>')


def core_xml(title: str, now_iso: str) -> str:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<dc:title>{esc(title)}</dc:title><dc:subject>Glosarium istilah TKJ Kurikulum Merdeka</dc:subject>'
            '<dc:creator>Glosarium TKJ (tools/build.py)</dc:creator><cp:keywords>TKJ; TJKT; jaringan; glosarium; SMK</cp:keywords>'
            '<dc:language>id-ID</dc:language>'
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:created>'
            f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now_iso}</dcterms:modified>'
            '</cp:coreProperties>')


def app_xml() -> str:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
            'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            '<Application>Glosarium TKJ build.py</Application></Properties>')


# --------------------------------------------------------------------------- #
# Titik masuk
# --------------------------------------------------------------------------- #
def write_docx(path: Path, cats, *, title: str, subtitle: str, header_right: str) -> Path:
    total = sum(len(c.entries) for c in cats)
    now = _dt.datetime.now()
    today = now.strftime("%d-%m-%Y")
    body = [cover(cats, title, subtitle, total, today)]
    bid = 1
    guide, bid = guide_and_toc(cats, bid)
    body.append(guide)
    seen_fase = set()
    for c in cats:
        first = c.fase not in seen_fase
        seen_fase.add(c.fase)
        sec, bid = category_section(c, bid, first)
        body.append(sec)
    # pemisah seksi: seksi utama (satu kolom, halaman sampul tanpa header)
    body.append(para("", sect=sect_pr(cols=1, title_pg=True)))
    body.append(index_section(cats, bid))
    document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {W_NS}><w:body>'
                + "".join(body) + sect_pr(cols=3) + "</w:body></w:document>")

    parts = {
        "[Content_Types].xml": content_types_xml(),
        "_rels/.rels": root_rels_xml(),
        "word/_rels/document.xml.rels": doc_rels_xml(),
        "word/document.xml": document,
        "word/styles.xml": styles_xml(),
        "word/settings.xml": settings_xml(),
        "word/header1.xml": header_xml(title if len(title) < 60 else "Glosarium TKJ", header_right),
        "word/footer1.xml": footer_xml(),
        "docProps/core.xml": core_xml(title, now.strftime("%Y-%m-%dT%H:%M:%SZ")),
        "docProps/app.xml": app_xml(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data.encode("utf-8"))
    return path
