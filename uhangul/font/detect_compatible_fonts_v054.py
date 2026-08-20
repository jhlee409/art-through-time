#!/usr/bin/env python3
"""uHangul v0.5.4 automatic compatible-font detector.

Finds:
1) a glyf-based TrueType base whose contextual reference Hangul syllables
   are composite glyphs; and
2) a font containing all seven source shapes needed by uHangul.

No font is modified. Results are written as JSON.
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path
from fontTools.ttLib import TTFont, TTCollection

TOKENS = ("F","V","Z","R","TH","X","CH")
SOURCE_CPS = (0x1157, 0x112B, 0x1140, 0x1119, 0x03B8, 0x1158, 0x1159)
REF_ONSETS = ("ㅍ","ㅂ","ㅅ","ㄹ","ㅎ")
L_LIST = tuple("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
V_LIST = tuple("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
T_LIST = ("",) + tuple("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")

def compose(onset, vowel, final=""):
    return chr(0xAC00 + ((L_LIST.index(onset)*21 + V_LIST.index(vowel))*28 + T_LIST.index(final)))

REQUIRED_TEMPLATE_CPS = tuple(
    ord(compose(o,v,t)) for o in REF_ONSETS for v in V_LIST for t in T_LIST
)
QUICK_TEMPLATE_CPS = tuple(
    ord(compose(o,v,t))
    for o in REF_ONSETS
    for v in ("ㅏ","ㅓ","ㅗ","ㅜ","ㅡ","ㅣ","ㅐ")
    for t in ("","ㄴ","ㄹ","ㅇ")
)

def safe_names(font):
    out = {"family":"","subfamily":"","full":""}
    if "name" not in font: return out
    for rec in font["name"].names:
        if rec.nameID not in (1,2,4): continue
        try: s = rec.toUnicode()
        except Exception: continue
        if rec.nameID == 1 and not out["family"]: out["family"] = s
        elif rec.nameID == 2 and not out["subfamily"]: out["subfamily"] = s
        elif rec.nameID == 4 and not out["full"]: out["full"] = s
    return out

def score_style(names, path):
    s = 0
    blob = " ".join([names.get("family",""), names.get("subfamily",""), Path(path).stem]).lower()
    if any(x in blob for x in ("regular","normal","book")): s += 20
    if any(x in blob for x in ("bold","black","heavy","extrabold","semibold")): s -= 30
    if any(x in blob for x in ("italic","oblique")): s -= 25
    if any(x in blob for x in ("dotum","gothic","sans")): s += 8
    return s

def open_single(path):
    # v0.5.4 intentionally skips TTC/OTC because the builder accepts a single font path.
    suffix = path.suffix.lower()
    if suffix in (".ttc",".otc"):
        return None, "collection_skipped"
    try:
        return TTFont(str(path), lazy=False, recalcBBoxes=False, recalcTimestamp=False), None
    except Exception as e:
        return None, f"open_error: {type(e).__name__}: {e}"

def source_check(path):
    font, err = open_single(path)
    if font is None: return None, err
    try:
        cmap = font.getBestCmap() or {}
        missing = [cp for cp in SOURCE_CPS if cp not in cmap]
        if missing:
            return None, "missing_source:" + ",".join(f"U+{cp:04X}" for cp in missing)
        gs = font.getGlyphSet()
        # Ensure source glyphs can actually be drawn and have non-empty bounds.
        from fontTools.pens.boundsPen import BoundsPen
        for cp in SOURCE_CPS:
            name = cmap[cp]
            pen = BoundsPen(gs)
            gs[name].draw(pen)
            if not pen.bounds:
                return None, f"empty_source:U+{cp:04X}"
        names = safe_names(font)
        return {
            "path": str(path),
            "family": names["family"],
            "subfamily": names["subfamily"],
            "score": 100 + score_style(names, path),
        }, None
    except Exception as e:
        return None, f"source_check_error:{type(e).__name__}:{e}"
    finally:
        try: font.close()
        except Exception: pass

def base_check(path):
    font, err = open_single(path)
    if font is None: return None, err
    try:
        if "glyf" not in font:
            return None, "no_glyf_table"
        cmap = font.getBestCmap() or {}

        # Quick rejection before the full 2,940-template test.
        miss = [cp for cp in QUICK_TEMPLATE_CPS if cp not in cmap]
        if miss:
            return None, f"missing_quick_templates:{len(miss)}"

        missing = [cp for cp in REQUIRED_TEMPLATE_CPS if cp not in cmap]
        if missing:
            return None, f"missing_templates:{len(missing)}"

        glyf = font["glyf"]
        # Every template used by the builder must be composite and have at least one component.
        for cp in REQUIRED_TEMPLATE_CPS:
            g = glyf[cmap[cp]]
            if not g.isComposite() or not getattr(g, "components", None):
                return None, f"non_composite_template:U+{cp:04X}"

        names = safe_names(font)
        score = 200 + score_style(names, path)
        # Prefer a base that also contains source jamo, reducing cross-font mismatch.
        source_count = sum(cp in cmap for cp in SOURCE_CPS)
        score += source_count * 3
        return {
            "path": str(path),
            "family": names["family"],
            "subfamily": names["subfamily"],
            "score": score,
            "sourceGlyphCount": source_count,
        }, None
    except Exception as e:
        return None, f"base_check_error:{type(e).__name__}:{e}"
    finally:
        try: font.close()
        except Exception: pass

def collect_fonts(search_dirs):
    seen = set()
    files = []
    for d in search_dirs:
        if not d: continue
        p = Path(os.path.expandvars(os.path.expanduser(d)))
        if not p.exists(): continue
        try:
            it = p.rglob("*") if p.name.lower() in ("fonts","font") or "microsoft" in str(p).lower() else p.glob("*")
            for f in it:
                if not f.is_file(): continue
                if f.suffix.lower() not in (".ttf",".otf",".ttc",".otc"): continue
                k = str(f.resolve()).lower()
                if k in seen: continue
                seen.add(k)
                files.append(f)
        except Exception:
            continue
    return files

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    ap.add_argument("--text-output")
    ap.add_argument("--search", action="append", default=[])
    args = ap.parse_args()

    env_dirs = [
        os.path.join(os.environ.get("WINDIR","C:\\Windows"), "Fonts"),
        os.path.join(os.environ.get("LOCALAPPDATA",""), "Microsoft", "Windows", "Fonts"),
        os.path.join(os.environ.get("USERPROFILE",""), "Documents", "Fonts"),
        os.path.join(os.environ.get("USERPROFILE",""), "Downloads"),
    ]
    search_dirs = []
    for p in env_dirs + args.search:
        if p and p not in search_dirs: search_dirs.append(p)

    files = collect_fonts(search_dirs)
    bases, sources = [], []
    rejects = {}
    for i,path in enumerate(files,1):
        b, be = base_check(path)
        if b: bases.append(b)
        s, se = source_check(path)
        if s: sources.append(s)
        if not b and not s:
            reason = be or se or "unknown"
            rejects[reason] = rejects.get(reason,0)+1

    bases.sort(key=lambda x:(-x["score"], x["path"].lower()))
    sources.sort(key=lambda x:(-x["score"], x["path"].lower()))

    pair = None
    if bases and sources:
        # Prefer same file when it satisfies both.
        source_by_path = {x["path"].lower():x for x in sources}
        for b in bases:
            if b["path"].lower() in source_by_path:
                pair = {"base":b, "source":source_by_path[b["path"].lower()], "sameFile":True}
                break
        if pair is None:
            pair = {"base":bases[0], "source":sources[0], "sameFile":False}

    result = {
        "version":"0.5.4",
        "success": pair is not None,
        "searchedDirectories": search_dirs,
        "fontFilesScanned": len(files),
        "compatibleBaseCount": len(bases),
        "compatibleSourceCount": len(sources),
        "selected": pair,
        "baseAlternatives": bases[:10],
        "sourceAlternatives": sources[:10],
        "rejectionSummary": dict(sorted(rejects.items(), key=lambda kv:-kv[1])[:20]),
    }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "uHangul v0.5.4 font auto-detection",
        "====================================",
        f"Scanned font files: {len(files)}",
        f"Compatible base fonts: {len(bases)}",
        f"Compatible old-jamo source fonts: {len(sources)}",
        "",
    ]
    if pair:
        lines += [
            "SELECTED",
            f"Base   : {pair['base']['path']}",
            f"        {pair['base']['family']} {pair['base']['subfamily']}",
            f"Source : {pair['source']['path']}",
            f"        {pair['source']['family']} {pair['source']['subfamily']}",
            f"Same file: {pair['sameFile']}",
            "",
            "STATUS: COMPATIBLE PAIR FOUND",
        ]
    else:
        lines += [
            "STATUS: NO COMPATIBLE PAIR FOUND",
            "",
            "The detector requires:",
            "- base: glyf-based TrueType with all contextual Hangul templates as composite glyphs",
            "- source: glyphs U+1157 U+112B U+1140 U+1119 U+03B8 U+1158 U+1159",
            "",
            "No file chooser was opened.",
        ]
    txt = "\n".join(lines)
    if args.text_output:
        Path(args.text_output).write_text(txt, encoding="utf-8")
    print(txt)
    return 0 if pair else 2

if __name__ == "__main__":
    raise SystemExit(main())
