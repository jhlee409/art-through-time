#!/usr/bin/env python3
"""Build the final uHangul v0.7 font from its JSON specification."""
from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "spec" / "uhangul-v0.7.json"
L = tuple("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
V = tuple("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
T = ("",) + tuple("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")


def compose(onset, vowel, final):
    return chr(0xAC00 + ((L.index(onset) * 21 + V.index(vowel)) * 28 + T.index(final)))


def glyph_bounds(glyph_set, name):
    pen = BoundsPen(glyph_set)
    glyph_set[name].draw(pen)
    if not pen.bounds:
        raise ValueError(f"Empty source glyph: {name}")
    return pen.bounds


def outline(font, base_gs, source_gs, source, reference, output):
    sx0, sy0, sx1, sy1 = glyph_bounds(source_gs, source)
    dx0, dy0, dx1, dy1 = glyph_bounds(base_gs, reference)
    sx, sy = max(1, sx1 - sx0), max(1, sy1 - sy0)
    matrix = ((dx1 - dx0) / sx, 0, 0, (dy1 - dy0) / sy, dx0 - sx0 * (dx1 - dx0) / sx, dy0 - sy0 * (dy1 - dy0) / sy)
    pen = TTGlyphPen(base_gs)
    source_gs[source].draw(TransformPen(pen, matrix))
    font["glyf"][output] = pen.glyph()
    font["hmtx"].metrics[output] = font["hmtx"].metrics.get(reference, (1000, 0))
    if "vmtx" in font:
        font["vmtx"].metrics[output] = font["vmtx"].metrics.get(reference, (1000, 0))


def build(base_path, output_path, fallback_path=None):
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    base = int(spec["spua"]["base"].removeprefix("U+"), 16)
    tokens = spec["glyphs"]
    font = TTFont(str(base_path), recalcBBoxes=True, recalcTimestamp=False)
    if "glyf" not in font:
        raise ValueError("Base font must use TrueType glyf outlines")
    cmap, glyph_set = font.getBestCmap(), font.getGlyphSet()
    fallback = TTFont(str(fallback_path)) if fallback_path else font
    fallback_cmap, fallback_set = fallback.getBestCmap(), fallback.getGlyphSet()
    names, mapping, components = list(font.getGlyphOrder()), {}, {}
    for token_index, item in enumerate(tokens):
        token, onset, character = item["id"], item["templateOnset"], item["glyph"]
        source = cmap.get(ord(character)) or fallback_cmap.get(ord(character))
        source_set = glyph_set if cmap.get(ord(character)) else fallback_set
        if not source:
            raise ValueError(f"No source glyph for {token}")
        for vowel_index, vowel in enumerate(V):
            for final_index, final in enumerate(T):
                template_name = cmap[ord(compose(onset, vowel, final))]
                template = font["glyf"][template_name]
                if not template.isComposite() or not template.components:
                    raise ValueError(f"Non-composite template: {template_name}")
                reference = template.components[0].glyphName
                component_key = (token, reference)
                if component_key not in components:
                    component = f"u07c_{token}_{reference}"
                    outline(font, glyph_set, source_set, source, reference, component)
                    components[component_key] = component
                    names.append(component)
                output = f"u07s_{token}_{vowel_index:02d}_{final_index:02d}"
                glyph = deepcopy(template)
                glyph.components[0].glyphName = components[component_key]
                font["glyf"][output] = glyph
                font["hmtx"].metrics[output] = font["hmtx"].metrics[template_name]
                if "vmtx" in font:
                    font["vmtx"].metrics[output] = font["vmtx"].metrics[template_name]
                names.append(output)
                mapping[base + ((token_index * 21 + vowel_index) * 28 + final_index)] = output
    ordered = list(dict.fromkeys(names))
    font.setGlyphOrder(ordered)
    font["glyf"].glyphOrder = ordered
    for name in ordered:
        font["hmtx"].metrics.setdefault(name, (1000, 0))
        if "vmtx" in font:
            font["vmtx"].metrics.setdefault(name, (1000, 0))
    old_ranges = [(0xF8000, 7 * 21 * 28), (0xFA000, 6 * 21 * 28), (base, len(tokens) * 21 * 28)]
    all_maps = {}
    for table in font["cmap"].tables:
        if table.isUnicode():
            all_maps.update(table.cmap)
    all_maps = {cp: name for cp, name in all_maps.items() if not any(start <= cp < start + size for start, size in old_ranges)}
    all_maps.update(mapping)
    font["cmap"].tables = [table for table in font["cmap"].tables if not table.isUnicode()]
    table = CmapSubtable.newSubtable(12)
    table.platformID, table.platEncID, table.language, table.cmap = 3, 10, 0, all_maps
    font["cmap"].tables.append(table)
    for name_id, value in {1: "uHangul", 2: "Regular", 3: "uHangul:Version 0.7", 4: "uHangul Regular", 5: "Version 0.7", 6: "uHangul-Regular"}.items():
        font["name"].removeNames(nameID=name_id)
        font["name"].setName(value, name_id, 3, 1, 0x409)
        font["name"].setName(value, name_id, 3, 1, 0x412)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(output_path), reorderTables=True)
    print(f"Built {output_path}: {len(mapping)} syllables, U+{min(mapping):X}..U+{max(mapping):X}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("base", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--fallback", type=Path)
    args = parser.parse_args()
    build(args.base, args.output, args.fallback)
