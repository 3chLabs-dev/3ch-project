import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def normalized_result(value):
    return {
        str(match_id): {str(player_id): int(score) for player_id, score in scores.items()}
        for match_id, scores in (value or {}).items()
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--scanner", default=str(Path(__file__).with_name("omr_scan.py")))
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases = manifest.get("cases") or []
    if not cases:
        raise ValueError("Manifest must contain at least one case.")

    total_matches = 0
    correct_matches = 0
    recognized_matches = 0
    case_rows = []

    for case in cases:
        image_path = (manifest_path.parent / case["image"]).resolve()
        payload = case["payload"]
        expected = normalized_result(case["expected"])
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as handle:
            json.dump(payload, handle, ensure_ascii=False)
            payload_path = handle.name

        completed = subprocess.run(
            [sys.executable, args.scanner, "--image", str(image_path), "--payload", payload_path],
            check=True,
            capture_output=True,
            text=True,
        )
        actual = normalized_result(json.loads(completed.stdout).get("result"))
        correct = sum(actual.get(match_id) == scores for match_id, scores in expected.items())
        recognized = sum(match_id in actual for match_id in expected)
        total = len(expected)
        total_matches += total
        correct_matches += correct
        recognized_matches += recognized
        case_rows.append({
            "name": case.get("name") or image_path.name,
            "correct": correct,
            "recognized": recognized,
            "total": total,
        })

    precision = correct_matches / recognized_matches if recognized_matches else 0
    recall = correct_matches / total_matches if total_matches else 0
    output = {
        "correctMatches": correct_matches,
        "recognizedMatches": recognized_matches,
        "totalMatches": total_matches,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "cases": case_rows,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
