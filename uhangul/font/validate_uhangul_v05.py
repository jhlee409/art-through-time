#!/usr/bin/env python3
"""Structural validator for uHangul v0.5."""
from pathlib import Path
import argparse
from fontTools.ttLib import TTFont

SPUA_BASE=0xF8000
TOKENS=("F","V","Z","R","TH","X","CH")
REF={"F":"ㅍ","V":"ㅂ","Z":"ㅅ","R":"ㄹ","TH":"ㅅ","X":"ㅎ","CH":"ㅎ"}
L=tuple("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
V=tuple("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
T=("",)+tuple("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")

def compose(l,v,t=""):
    return chr(0xAC00+((L.index(l)*21+V.index(v))*28+T.index(t)))
def cp(tok,v,t=""):
    return SPUA_BASE+((TOKENS.index(tok)*21+V.index(v))*28+T.index(t))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("base",type=Path)
    ap.add_argument("font",type=Path)
    a=ap.parse_args()
    base=TTFont(str(a.base))
    out=TTFont(str(a.font))
    bc=base.getBestCmap()
    oc=out.getBestCmap()
    errors=[]

    expected=set(range(SPUA_BASE,SPUA_BASE+7*21*28))
    actual={c for c in oc if SPUA_BASE <= c < SPUA_BASE+7*21*28}
    if actual != expected:
        errors.append(f"SPUA discontinuity/missing: expected {len(expected)}, actual {len(actual)}")

    for tok in TOKENS:
        for v in V:
            for t in T:
                c=cp(tok,v,t)
                gn=oc.get(c)
                if not gn:
                    errors.append(f"missing U+{c:X}")
                    continue
                template_name=bc[ord(compose(REF[tok],v,t))]
                g=out["glyf"][gn]
                tg=base["glyf"][template_name]
                if out["hmtx"].metrics[gn] != base["hmtx"].metrics[template_name]:
                    errors.append(f"metric mismatch U+{c:X}")
                if not g.isComposite() or len(g.components) != len(tg.components):
                    errors.append(f"component structure mismatch U+{c:X}")
                    continue
                # Only onset component may differ.
                for i in range(1,len(g.components)):
                    a1,b1=g.components[i],tg.components[i]
                    if a1.glyphName != b1.glyphName or a1.getComponentInfo()[1] != b1.getComponentInfo()[1]:
                        errors.append(f"non-onset component changed U+{c:X}, component {i}")

    print(f"Expected extended syllables: {7*21*28}")
    print(f"Actual extended syllables:   {len(actual)}")
    print("New-final feature:            DISABLED by design")
    print(f"Errors:                       {len(errors)}")
    if errors:
        for e in errors[:30]:
            print(" -",e)
        raise SystemExit(1)
    print("VALIDATION PASSED")

if __name__=="__main__":
    main()
