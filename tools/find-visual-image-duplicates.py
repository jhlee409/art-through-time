#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "data" / "images"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
NORMALIZED_SIZE = (32, 32)
MAX_HASH_DISTANCE = 2
MAX_MEAN_PIXEL_DIFFERENCE = 3.0


def perceptual_record(file_path):
    with Image.open(file_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        normalized = np.asarray(image.resize(NORMALIZED_SIZE, Image.Resampling.LANCZOS), dtype=np.int16)
        gray = np.asarray(image.resize((9, 8), Image.Resampling.LANCZOS).convert("L"), dtype=np.int16)
        differences = gray[:, 1:] > gray[:, :-1]
        hash_value = 0
        for bit in differences.flatten():
            hash_value = (hash_value << 1) | int(bit)
        return {
            "path": file_path.relative_to(ROOT).as_posix(),
            "bytes": file_path.stat().st_size,
            "width": width,
            "height": height,
            "aspect": width / height if height else 0,
            "hash": hash_value,
            "pixels": normalized,
        }


def hamming_distance(left, right):
    return (left ^ right).bit_count()


def main():
    records = []
    errors = []
    for file_path in IMAGES.rglob("*"):
        if not file_path.is_file() or file_path.suffix.lower() not in EXTENSIONS:
            continue
        try:
            records.append(perceptual_record(file_path))
        except Exception as error:
            errors.append({"path": file_path.relative_to(ROOT).as_posix(), "error": str(error)})

    parent = list(range(len(records)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for left in range(len(records)):
        first = records[left]
        for right in range(left + 1, len(records)):
            second = records[right]
            if not first["aspect"] or abs(first["aspect"] - second["aspect"]) / max(first["aspect"], second["aspect"]) > 0.02:
                continue
            if hamming_distance(first["hash"], second["hash"]) > MAX_HASH_DISTANCE:
                continue
            pixel_difference = float(np.abs(first["pixels"] - second["pixels"]).mean())
            if pixel_difference <= MAX_MEAN_PIXEL_DIFFERENCE:
                union(left, right)

    grouped = {}
    for index, record in enumerate(records):
        grouped.setdefault(find(index), []).append(record)
    groups = []
    for items in grouped.values():
        if len(items) < 2:
            continue
        groups.append({
            "files": [
                {key: value for key, value in item.items() if key not in {"hash", "pixels", "aspect"}}
                for item in sorted(items, key=lambda item: (-item["bytes"], item["path"]))
            ]
        })
    groups.sort(key=lambda group: (-max(item["bytes"] for item in group["files"]), group["files"][0]["path"]))
    result = {"files": len(records), "groups": len(groups), "errors": errors, "items": groups}
    output = next((value.split("=", 1)[1] for value in sys.argv[1:] if value.startswith("--output=")), "")
    if output:
        target = (ROOT / output).resolve()
        target.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"file": target.relative_to(ROOT).as_posix(), "files": len(records), "groups": len(groups), "errors": len(errors)}))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
