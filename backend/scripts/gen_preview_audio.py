#!/usr/bin/env python3
"""批量生成音色预览音频"""
import json
import subprocess
import sys
from pathlib import Path

VOICES_JSON = Path(__file__).parent.parent / "src/main/resources/voices.json"
OUTPUT_DIR = Path(__file__).parent.parent / "src/main/resources/static/voices"
PREVIEW_TEXT = "你真是太厉害了，打遍天下无敌手。"
EDGE_TTS = "/Users/happy/.local/bin/edge-tts"


def main():
    with open(VOICES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total = 0
    success = 0
    for cat in data["categories"]:
        for v in cat["voices"]:
            total += 1
            voice_id = v["id"]
            voice_name = v["voice"]
            file_name = v["file"]
            rate = v.get("rate", "")
            pitch = v.get("pitch", "")

            out_path = OUTPUT_DIR / file_name
            # 已存在则跳过（除非加 --force）
            if out_path.exists() and "--force" not in sys.argv:
                print(f"  跳过 {file_name}（已存在）")
                success += 1
                continue

            raw_tmp = f"/tmp/preview_raw_{voice_id}.mp3"

            # edge-tts 生成
            cmd = [EDGE_TTS, "--voice", voice_name, "--text", PREVIEW_TEXT, "--write-media", raw_tmp]
            if rate:
                cmd.append(f"--rate={rate}")
            if pitch:
                cmd.append(f"--pitch={pitch}")

            try:
                subprocess.run(cmd, capture_output=True, timeout=30, check=True)
            except Exception as e:
                print(f"  FAIL edge-tts {voice_id}: {e}")
                continue

            # ffmpeg 转标准格式
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", raw_tmp, "-ar", "44100", "-ab", "128k", "-ac", "1", "-f", "mp3", str(out_path)],
                    capture_output=True, timeout=30, check=True
                )
            except Exception as e:
                print(f"  FAIL ffmpeg {voice_id}: {e}")
                continue
            finally:
                Path(raw_tmp).unlink(missing_ok=True)

            success += 1
            print(f"  OK {file_name}")

    print(f"\n完成: {success}/{total}")


if __name__ == "__main__":
    main()
