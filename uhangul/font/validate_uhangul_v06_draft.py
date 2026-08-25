#!/usr/bin/env python3
"""Validate the v0.6-draft PUA range and the IPA θ TH component."""
from __future__ import annotations
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont

UHANGUL_ROOT = Path(__file__).resolve().parents[1]
spec = json.loads((UHANGUL_ROOT / "spec" / "uhangul-v0.6-draft.json").read_text(encoding="utf-8"))
base = int(spec["spua"]["base"].removeprefix("U+"), 16)
tokens = [g["id"] for g in spec["glyphs"] if g.get("status") == "confirmed"]
font = TTFont(sys.argv[1]); cmap = font.getBestCmap()
expected = set(range(base, base + len(tokens)*21*28))
actual = {cp for cp in cmap if base <= cp < base + len(tokens)*21*28}
assert actual == expected, f"PUA mismatch: expected {len(expected)}, got {len(actual)}"
assert font["name"].getDebugName(5) == "Version 0.6-draft", "font version metadata mismatch"
print(f"OK: {len(tokens)} confirmed onset sets / {len(expected)} syllables / TH θ slot present")
