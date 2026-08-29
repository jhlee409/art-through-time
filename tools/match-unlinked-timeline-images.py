#!/usr/bin/env python3
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data" / "generated" / "unlinked-timeline-image-inventory.json"
REPORT = ROOT / "data" / "generated" / "unlinked-timeline-image-matches.json"
SIZE = (32, 32)


def descriptor(relative_path):
    file_path = ROOT / relative_path
    with Image.open(file_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        normalized = np.asarray(image.resize(SIZE, Image.Resampling.LANCZOS), dtype=np.int16)
        gray = np.asarray(image.resize((9, 8), Image.Resampling.LANCZOS).convert("L"), dtype=np.int16)
        differences = gray[:, 1:] > gray[:, :-1]
        hash_value = 0
        for bit in differences.flatten():
            hash_value = (hash_value << 1) | int(bit)
        histogram = np.concatenate([
            np.histogram(normalized[:, :, channel], bins=16, range=(0, 256), density=True)[0]
            for channel in range(3)
        ])
        return {
            "path": relative_path,
            "width": width,
            "height": height,
            "aspect": width / height if height else 0,
            "hash": hash_value,
            "pixels": normalized,
            "histogram": histogram,
        }


def hamming(left, right):
    return (left ^ right).bit_count()


def comparison(local, reference):
    aspect_difference = abs(local["aspect"] - reference["aspect"]) / max(local["aspect"], reference["aspect"], 0.001)
    pixel_difference = float(np.abs(local["pixels"] - reference["pixels"]).mean())
    histogram_difference = float(np.abs(local["histogram"] - reference["histogram"]).mean())
    hash_distance = hamming(local["hash"], reference["hash"])
    score = 100.0
    score -= min(45.0, hash_distance * 2.8)
    score -= min(30.0, pixel_difference * 0.85)
    score -= min(20.0, aspect_difference * 160.0)
    score -= min(10.0, histogram_difference * 180.0)
    return {
        "score": round(max(0.0, score), 3),
        "hashDistance": hash_distance,
        "pixelDifference": round(pixel_difference, 3),
        "aspectDifference": round(aspect_difference, 5),
        "histogramDifference": round(histogram_difference, 6),
    }


def main():
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    locals_by_path = {}
    local_errors = []
    for item in inventory["unlinked"]:
        try:
            locals_by_path[item["path"]] = descriptor(item["path"])
        except Exception as error:
            local_errors.append({"path": item["path"], "error": str(error)})

    candidates = []
    reference_errors = []
    for work in inventory["missing"]:
        if not work.get("referenceFile"):
            continue
        try:
            reference = descriptor(work["referenceFile"])
        except Exception as error:
            reference_errors.append({"key": work["key"], "error": str(error)})
            continue
        ranked = []
        for local_item in inventory["unlinked"]:
            local = locals_by_path.get(local_item["path"])
            if not local:
                continue
            metrics = comparison(local, reference)
            same_artist = local_item["folder"] == work["artistId"]
            priority_score = metrics["score"] + (3.0 if same_artist else 0.0)
            ranked.append({
                "localPath": local_item["path"],
                "sameArtistFolder": same_artist,
                "priorityScore": round(priority_score, 3),
                **metrics,
            })
        ranked.sort(key=lambda item: (-item["priorityScore"], item["localPath"]))
        top = ranked[:8]
        best = top[0] if top else None
        second = top[1] if len(top) > 1 else None
        candidates.append({
            **{key: work.get(key) for key in ("key", "artistId", "artist", "workId", "title", "englishTitle", "year", "qid", "referenceFile", "referenceUrl")},
            "topCandidates": top,
            "bestMargin": round((best["priorityScore"] - second["priorityScore"]), 3) if best and second else None,
        })

    # Exact or near-identical visual matches with a unique local file are safe to link.
    provisional = []
    for item in candidates:
        if not item["topCandidates"]:
            continue
        best = item["topCandidates"][0]
        margin = item.get("bestMargin") or 0
        exact = best["hashDistance"] <= 2 and best["pixelDifference"] <= 5 and best["aspectDifference"] <= 0.01
        strong = best["hashDistance"] <= 5 and best["pixelDifference"] <= 10 and best["aspectDifference"] <= 0.02 and margin >= 8
        if exact or strong:
            provisional.append({
                "key": item["key"],
                "artist": item["artist"],
                "title": item["title"],
                "workId": item["workId"],
                "localPath": best["localPath"],
                "confidence": "exact" if exact else "strong",
                "metrics": best,
            })
    by_path = {}
    for item in provisional:
        by_path.setdefault(item["localPath"], []).append(item)
    confirmed = [item for item in provisional if len(by_path[item["localPath"]]) == 1]
    conflicts = [items for items in by_path.values() if len(items) > 1]

    report = {
        "createdAt": inventory.get("createdAt"),
        "unlinkedFiles": len(inventory["unlinked"]),
        "missingWorks": len(inventory["missing"]),
        "referenceImages": len(candidates),
        "confirmed": confirmed,
        "conflicts": conflicts,
        "localErrors": local_errors,
        "referenceErrors": reference_errors,
        "items": candidates,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "unlinkedFiles": report["unlinkedFiles"],
        "missingWorks": report["missingWorks"],
        "referenceImages": report["referenceImages"],
        "confirmed": len(confirmed),
        "conflicts": len(conflicts),
        "localErrors": len(local_errors),
        "referenceErrors": len(reference_errors),
        "report": REPORT.relative_to(ROOT).as_posix(),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
