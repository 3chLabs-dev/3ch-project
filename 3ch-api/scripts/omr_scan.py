import argparse
import json
import sys
from collections import defaultdict

try:
    from PIL import Image, ImageFilter, ImageOps
except ImportError as exc:
    print(f"Pillow is required: {exc}", file=sys.stderr)
    sys.exit(2)

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    HAS_OPENCV = True
except ImportError:
    cv2 = None
    np = None
    HAS_OPENCV = False


def read_payload(payload_path: str):
    with open(payload_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def prepare_with_pillow(image: Image.Image) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    grayscale = ImageOps.autocontrast(grayscale)
    grayscale = grayscale.filter(ImageFilter.MedianFilter(size=3))
    return grayscale


def prepare_with_opencv(image: Image.Image) -> Image.Image:
    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    normalized = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX)
    thresholded = cv2.adaptiveThreshold(
        normalized,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15,
    )
    filtered = cv2.medianBlur(thresholded, 3)
    return Image.fromarray(filtered)


def prepare_image(image_path: str):
    image = Image.open(image_path)
    image = ImageOps.exif_transpose(image).convert("RGB")
    if HAS_OPENCV:
        return prepare_with_opencv(image), "opencv"
    return prepare_with_pillow(image), "pillow"


def read_darkness_rect(image, center_x, center_y, width_ratio, height_ratio):
    width, height = image.size
    box_width = max(10, round(width * width_ratio * 0.9))
    box_height = max(10, round(height * height_ratio * 0.9))
    start_x = max(0, round(center_x - box_width / 2))
    end_x = min(width - 1, round(center_x + box_width / 2))
    start_y = max(0, round(center_y - box_height / 2))
    end_y = min(height - 1, round(center_y + box_height / 2))

    pixels = image.load()
    total = 0
    dark = 0
    for y in range(start_y, end_y + 1):
        for x in range(start_x, end_x + 1):
            luminance = pixels[x, y]
            if luminance < 150:
                dark += 1
            total += 1

    return (dark / total) * 100 if total else 0.0


def scan_scenario(image, marks, darkness_threshold, margin_threshold):
    grouped = defaultdict(list)
    width, height = image.size

    for mark in marks:
        darkness = read_darkness_rect(
            image,
            mark["x"] * width,
            mark["y"] * height,
            mark["w"],
            mark["h"],
        )
        key = (mark["matchId"], mark["playerId"])
        grouped[key].append({"score": mark["score"], "darkness": darkness})

    result = {}
    recognized = 0
    for (match_id, player_id), items in grouped.items():
        ranked = sorted(items, key=lambda item: item["darkness"], reverse=True)
        if len(ranked) < 2:
            continue

        winner = ranked[0]
        runner_up = ranked[1]
        if winner["darkness"] < darkness_threshold:
            continue
        if winner["darkness"] - runner_up["darkness"] < margin_threshold:
            continue

        result.setdefault(match_id, {})[player_id] = winner["score"]
        recognized += 1

    return {"result": result, "recognizedCount": recognized}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = read_payload(args.payload)
    scenarios = payload.get("scenarios") or []
    darkness_threshold = float(payload.get("darknessThreshold", 20))
    margin_threshold = float(payload.get("marginThreshold", 3.5))

    if not scenarios:
        raise ValueError("At least one OMR scenario is required.")

    image, engine_name = prepare_image(args.image)
    scenario_summaries = []
    best = None

    for scenario in scenarios:
        summary = scan_scenario(
            image,
            scenario.get("marks") or [],
            darkness_threshold,
            margin_threshold,
        )
        scenario_name = scenario.get("name") or "unnamed"
        scenario_summaries.append({
            "name": scenario_name,
            "recognizedCount": summary["recognizedCount"],
        })
        if best is None or summary["recognizedCount"] > best["recognizedCount"]:
            best = {
                "name": scenario_name,
                "recognizedCount": summary["recognizedCount"],
                "result": summary["result"],
            }

    output = {
        "engine": f"python-{engine_name}",
        "scenario": best["name"],
        "recognizedCount": best["recognizedCount"],
        "result": best["result"],
        "scenarios": scenario_summaries,
    }
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
