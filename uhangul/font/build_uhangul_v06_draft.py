#!/usr/bin/env python3
"""Build the uHangul v0.6-draft font from its JSON specification.

The builder makes complete private-use syllables by replacing only the onset
component of an existing Hangul syllable.  New consonants can therefore never
be encoded in final position. TH is the sole IPA exception and uses Greek θ.
"""
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

UHANGUL_ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = UHANGUL_ROOT / "spec" / "uhangul-v0.6-draft.json"
L = tuple("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
V = tuple("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
T = ("",) + tuple("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")


def load_spec():
    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    base = int(spec["spua"]["base"].removeprefix("U+"), 16)
    glyphs = [item for item in spec["glyphs"] if item.get("status") == "confirmed"]
    return spec, base, glyphs


def compose(onset, vowel, final):
    return chr(0xAC00 + ((L.index(onset) * 21 + V.index(vowel)) * 28 + T.index(final)))


def bounds(glyph_set, name):
    pen = BoundsPen(glyph_set)
    glyph_set[name].draw(pen)
    if not pen.bounds:
        raise ValueError(f"Empty source glyph: {name}")
    return pen.bounds


def transform(source, destination):
    sx0, sy0, sx1, sy1 = source
    dx0, dy0, dx1, dy1 = destination
    sx, sy = max(1, sx1 - sx0), max(1, sy1 - sy0)
    return ((dx1-dx0)/sx, 0, 0, (dy1-dy0)/sy, dx0 - sx0*(dx1-dx0)/sx, dy0 - sy0*(dy1-dy0)/sy)


def copied_outline(font, base_gs, source_gs, source, reference, output):
    pen = TTGlyphPen(base_gs)
    source_gs[source].draw(TransformPen(pen, transform(bounds(source_gs, source), bounds(base_gs, reference))))
    font["glyf"][output] = pen.glyph()
    font["hmtx"].metrics[output] = font["hmtx"].metrics.get(reference, (1000, 0))
    if "vmtx" in font: font["vmtx"].metrics[output] = font["vmtx"].metrics.get(reference, (1000, 0))


def cmap(font, mappings, base, legacy):
    all_maps = {}
    for table in font["cmap"].tables:
        if table.isUnicode(): all_maps.update(table.cmap)
    all_maps = {cp: name for cp, name in all_maps.items() if not any(start <= cp < end for start, end in legacy)}
    all_maps.update(mappings)
    # Rebuild every Unicode cmap table from the filtered mapping. Keeping an
    # older format-12 table would leave v0.5 private-use code points reachable.
    font["cmap"].tables = [table for table in font["cmap"].tables if not table.isUnicode()]
    table = CmapSubtable.newSubtable(12); table.platformID, table.platEncID, table.language = 3, 10, 0
    table.cmap = all_maps; font["cmap"].tables.append(table)


def build(base_path, output_path, fallback_path=None):
    spec, base, glyphs = load_spec()
    font = TTFont(str(base_path), recalcBBoxes=True, recalcTimestamp=False)
    if "glyf" not in font: raise ValueError("Base font must use TrueType glyf outlines")
    base_cmap, base_gs = font.getBestCmap(), font.getGlyphSet()
    fallback = TTFont(str(fallback_path)) if fallback_path else font
    fallback_cmap, fallback_gs = fallback.getBestCmap(), fallback.getGlyphSet()
    names, mapping, components = list(font.getGlyphOrder()), {}, {}
    for item in glyphs:
        token, reference_onset = item["id"], item["templateOnset"]
        glyph_character = item["glyph"][0]
        source_name = base_cmap.get(ord(glyph_character)) or fallback_cmap.get(ord(glyph_character))
        source_gs = base_gs if base_cmap.get(ord(glyph_character)) else fallback_gs
        for vi, vowel in enumerate(V):
            for ti, final in enumerate(T):
                template_name = base_cmap.get(ord(compose(reference_onset, vowel, final)))
                template = font["glyf"][template_name]
                if not template.isComposite() or not template.components: raise ValueError(f"Non-composite template: {template_name}")
                ref = template.components[0].glyphName
                key = (token, ref)
                if key not in components:
                    component = f"u06c_{token}_{ref}"
                    if source_name: copied_outline(font, base_gs, source_gs, source_name, ref, component)
                    else: raise ValueError(f"No source glyph for {token}")
                    components[key] = component; names.append(component)
                out = f"u06s_{token}_{vi:02d}_{ti:02d}"
                glyph = deepcopy(template); glyph.components[0].glyphName = components[key]
                font["glyf"][out] = glyph; font["hmtx"].metrics[out] = font["hmtx"].metrics[template_name]
                if "vmtx" in font: font["vmtx"].metrics[out] = font["vmtx"].metrics[template_name]
                names.append(out); mapping[base + ((glyphs.index(item)*21 + vi)*28 + ti)] = out
    seen, ordered = set(), []
    for name in names:
        if name not in seen: seen.add(name); ordered.append(name)
    font.setGlyphOrder(ordered); font["glyf"].glyphOrder = ordered
    # Some older WOFF2 sources omit hmtx entries for component-only glyphs.
    # Every generated component still needs a metric entry when serialized.
    for name in ordered:
        font["hmtx"].metrics.setdefault(name, (1000, 0))
        if "vmtx" in font: font["vmtx"].metrics.setdefault(name, (1000, 0))
    legacy = [(0xF8000, 0xF8000 + 7*21*28), (base, base + len(glyphs)*21*28)]
    cmap(font, mapping, base, legacy)
    for name_id, value in {1:"uHangul", 2:"Regular", 3:"uHangul:Version 0.6-draft", 4:"uHangul Regular", 5:"Version 0.6-draft", 6:"uHangul-Regular"}.items():
        font["name"].removeNames(nameID=name_id); font["name"].setName(value, name_id, 3, 1, 0x409); font["name"].setName(value, name_id, 3, 1, 0x412)
    if output_path.suffix.lower() == ".woff2": font.flavor = "woff2"
    output_path.parent.mkdir(parents=True, exist_ok=True); font.save(str(output_path), reorderTables=True)
    print(f"Built {output_path}: {len(mapping)} syllables, U+{min(mapping):X}..U+{max(mapping):X}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("base", type=Path); parser.add_argument("output", type=Path); parser.add_argument("--fallback", type=Path)
    args = parser.parse_args(); build(args.base, args.output, args.fallback)
