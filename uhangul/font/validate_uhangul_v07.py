#!/usr/bin/env python3
"""Validate the final uHangul v0.7 font."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
spec = json.loads((ROOT / "spec" / "uhangul-v0.7.json").read_text(encoding="utf-8"))
base = int(spec["spua"]["base"].removeprefix("U+"), 16)
tokens = spec["glyphs"]
font = TTFont(sys.argv[1])
cmap = font.getBestCmap()
expected = set(range(base, base + len(tokens) * 21 * 28))
actual = {codepoint for codepoint in cmap if base <= codepoint < base + len(tokens) * 21 * 28}
assert actual == expected, f"PUA mismatch: expected {len(expected)}, got {len(actual)}"
assert font["name"].getDebugName(5) == "Version 0.7", "font version metadata mismatch"
print(f"OK: {len(tokens)} onset sets / {len(expected)} syllables / final v0.7 font")
