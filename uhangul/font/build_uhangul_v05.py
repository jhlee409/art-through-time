#!/usr/bin/env python3
"""uHangul v0.5 onset-only font builder.

Invariant
---------
* The six uHangul consonants are ONSET ONLY.
* Vowels, finals, advance width, baseline, and all non-onset components are
  copied verbatim from an existing complete Hangul syllable used as a
  contextual template.
* Only component[0] (the contextual onset in the tested Hangul base) is
  replaced by a normalized vector outline of the new consonant.

SPUA-A mapping
--------------
cp = U+F8000 + ((new_onset_index * 21 + vowel_index) * 28 + final_index)
Range: U+F8000..U+F8DC7 (3,528 syllables)
"""
from __future__ import annotations
import argparse
from copy import deepcopy
from pathlib import Path
from typing import Dict, Tuple

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

SPUA_BASE = 0xF8000
TOKENS = ("F", "V", "Z", "R", "TH", "X")
TOKEN_INFO = {
    "F":  (0x1157, "ㅍ", "/f/", "ᅗ"),
    "V":  (0x112B, "ㅂ", "/v/", "ᄫ"),
    "Z":  (0x1140, "ㅅ", "/z/", "ᅀ"),
    "R":  (0x111B, "ㄹ", "/ɹ/", "ᄛ"),
    "TH": (0x03B8, "ㅅ", "/θ/", "θ"),
    "X":  (0x1158, "ㅎ", "/x/", "ᅘ"),
}
L_LIST = tuple("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
V_LIST = tuple("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
T_LIST = ("",) + tuple("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")

def compose_hangul(onset: str, vowel: str, final: str = "") -> str:
    return chr(0xAC00 + ((L_LIST.index(onset) * 21 + V_LIST.index(vowel)) * 28 + T_LIST.index(final)))

def extended_cp(token: str, vowel: str, final: str = "") -> int:
    return SPUA_BASE + ((TOKENS.index(token) * 21 + V_LIST.index(vowel)) * 28 + T_LIST.index(final))

def glyph_bounds(glyphset, glyph_name: str):
    pen = BoundsPen(glyphset)
    glyphset[glyph_name].draw(pen)
    if not pen.bounds:
        raise ValueError(f"Glyph has no bounds: {glyph_name}")
    return pen.bounds

def exact_bbox_transform(src_bounds, dst_bounds):
    sx0, sy0, sx1, sy1 = src_bounds
    dx0, dy0, dx1, dy1 = dst_bounds
    sw, sh = max(1, sx1-sx0), max(1, sy1-sy0)
    dw, dh = max(1, dx1-dx0), max(1, dy1-dy0)
    xs, ys = dw/sw, dh/sh
    return (xs, 0, 0, ys, dx0-sx0*xs, dy0-sy0*ys)

def add_outline_component(font, base_gs, src_gs, src_name, dst_ref_component, output_name):
    pen = TTGlyphPen(base_gs)
    tpen = TransformPen(
        pen,
        exact_bbox_transform(
            glyph_bounds(src_gs, src_name),
            glyph_bounds(base_gs, dst_ref_component),
        ),
    )
    src_gs[src_name].draw(tpen)
    font["glyf"][output_name] = pen.glyph()
    font["hmtx"].metrics[output_name] = font["hmtx"].metrics.get(dst_ref_component, (1000, 0))
    if "vmtx" in font:
        font["vmtx"].metrics[output_name] = font["vmtx"].metrics.get(dst_ref_component, (1000, 0))

def add_full_unicode_cmap(font, mapping: Dict[int, str]):
    full = {}
    for table in font["cmap"].tables:
        if table.isUnicode():
            full.update(table.cmap)
    # Remove mappings from the retired seven-token layout before adding the
    # current six-token layout.  This prevents the abolished CH glyphs from
    # remaining addressable in a rebuilt font.
    full = {cp: name for cp, name in full.items() if not (SPUA_BASE <= cp < SPUA_BASE + 7 * 21 * 28)}
    full.update(mapping)
    font["cmap"].tables = [
        t for t in font["cmap"].tables
        if not (t.platformID == 3 and t.platEncID == 10 and t.format == 12)
    ]
    t = CmapSubtable.newSubtable(12)
    t.platformID, t.platEncID, t.language = 3, 10, 0
    t.cmap = full
    font["cmap"].tables.append(t)

def rename_font(font):
    nt = font["name"]
    vals = {
        1:"uHangul", 2:"Regular", 3:"uHangul:Version 0.5",
        4:"uHangul Regular", 5:"Version 0.5", 6:"uHangul-Regular",
        16:"uHangul", 17:"Regular"
    }
    for nid in list(vals) + [20]:
        nt.removeNames(nameID=nid)
    for nid, val in vals.items():
        nt.setName(val, nid, 3, 1, 0x409)
        nt.setName(val, nid, 3, 1, 0x412)

def find_source(cp, primary_cmap, primary_gs, fallback_cmap, fallback_gs):
    if cp in primary_cmap:
        return primary_cmap[cp], primary_gs
    if fallback_cmap and cp in fallback_cmap:
        return fallback_cmap[cp], fallback_gs
    raise ValueError(f"No source glyph for U+{cp:04X}")

def build(base_path: Path, output_path: Path, old_jamo_path: Path | None = None):
    font = TTFont(str(base_path), recalcBBoxes=True, recalcTimestamp=False)
    if "glyf" not in font:
        raise ValueError("Base font must be TrueType/glyf based")
    base_cmap = font.getBestCmap()
    base_gs = font.getGlyphSet()

    source_font = TTFont(str(old_jamo_path)) if old_jamo_path else font
    source_cmap = source_font.getBestCmap()
    source_gs = source_font.getGlyphSet()

    sources = {}
    for token in TOKENS:
        cp, ref_onset, _, _ = TOKEN_INFO[token]
        name, gs = find_source(cp, base_cmap, base_gs, source_cmap, source_gs)
        sources[token] = (name, gs, ref_onset)

    order = list(font.getGlyphOrder())
    component_cache = {}
    spua = {}

    for token in TOKENS:
        src_name, src_gs, ref_onset = sources[token]
        for vowel in V_LIST:
            for final in T_LIST:
                template_char = compose_hangul(ref_onset, vowel, final)
                template_name = base_cmap.get(ord(template_char))
                if not template_name:
                    raise ValueError(f"Missing template: {template_char}")
                template = font["glyf"][template_name]
                if not template.isComposite() or not template.components:
                    raise ValueError(f"Template is not composite: {template_char}")

                ref_component = template.components[0].glyphName
                key = (token, ref_component)
                if key not in component_cache:
                    cname = f"u05c_{token}_{ref_component}"
                    add_outline_component(font, base_gs, src_gs, src_name, ref_component, cname)
                    component_cache[key] = cname
                    order.append(cname)

                new_glyph = deepcopy(template)
                new_glyph.components[0].glyphName = component_cache[key]
                out_name = f"u05s_{token}_{V_LIST.index(vowel):02d}_{T_LIST.index(final):02d}"
                font["glyf"][out_name] = new_glyph
                font["hmtx"].metrics[out_name] = font["hmtx"].metrics[template_name]
                if "vmtx" in font:
                    font["vmtx"].metrics[out_name] = font["vmtx"].metrics[template_name]
                order.append(out_name)
                spua[extended_cp(token, vowel, final)] = out_name

    seen, final_order = set(), []
    existing = set(font["glyf"].glyphs)
    for name in order:
        if name in existing and name not in seen:
            seen.add(name)
            final_order.append(name)
    font.setGlyphOrder(final_order)
    font["glyf"].glyphOrder = final_order
    add_full_unicode_cmap(font, spua)
    rename_font(font)

    if output_path.suffix.lower() == ".woff2":
        font.flavor = "woff2"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(output_path), reorderTables=True)
    return {
        "syllables": len(spua),
        "contextual_components": len(component_cache),
        "spua_start": min(spua),
        "spua_end": max(spua),
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--old-jamo", type=Path,
                    help="Optional source font for old jamo missing from base")
    args = ap.parse_args()
    stats = build(args.base, args.output, args.old_jamo)
    print(f"Built: {args.output}")
    print(f"Syllables: {stats['syllables']}")
    print(f"Contextual onset components: {stats['contextual_components']}")
    print(f"SPUA: U+{stats['spua_start']:X}..U+{stats['spua_end']:X}")

if __name__ == "__main__":
    main()
