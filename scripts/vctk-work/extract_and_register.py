#!/usr/bin/env python3
"""
One-shot tool to:
  1. Read multiple VCTK parquet shards (from sanchit-gandhi/VCTK on Hugging Face)
  2. Pick ~25 diverse speakers covering different ages, genders, and accents
  3. Concatenate a few clips per speaker to get ~10-20 seconds of clean audio
  4. Save each as a WAV file under scripts/vctk-work/voices/
  5. Register each voice with the local Fish Speech API via /v1/references/add
  6. Emit a manifest.json the TS build picks up for display metadata

VCTK is licensed CC-BY 4.0 — attribution is added in DEPLOY.md.
"""
from __future__ import annotations

import glob
import io
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

import pyarrow.parquet as pq
import numpy as np
import soundfile as sf
import requests

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "voices"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FISH_URL = os.environ.get("FISH_SPEECH_API_URL", "http://localhost:8080")
FISH_KEY = os.environ.get("FISH_SPEECH_API_KEY", "")

TARGET_SECONDS = 14
MIN_SECONDS = 8
MAX_SECONDS = 20
TARGET_SPEAKERS = 25

ACCENT_TO_COUNTRY = {
    "English": ("United Kingdom", "uk"),
    "Scottish": ("Scotland", "sc"),
    "Irish": ("Ireland", "ie"),
    "Welsh": ("Wales", "wl"),
    "NorthernIrish": ("Northern Ireland", "ni"),
    "American": ("United States", "us"),
    "Canadian": ("Canada", "ca"),
    "Australian": ("Australia", "au"),
    "NewZealand": ("New Zealand", "nz"),
    "SouthAfrican": ("South Africa", "za"),
    "Indian": ("India", "in"),
    "Unknown": ("International", "xx"),
}


def age_bucket(age: int) -> str:
    if age == 0:
        return "adult"
    if age < 25:
        return "young"
    if age < 40:
        return "adult"
    return "older"


def load_speakers_from_shards(shards: list[Path]) -> dict:
    speakers: dict[str, list] = {}
    total_rows = 0
    for shard in shards:
        pf = pq.ParquetFile(shard)
        print(f"Reading {shard.name} ({pf.metadata.num_rows} rows)...")
        for batch in pf.iter_batches(
            batch_size=500,
            columns=["speaker_id", "audio", "text", "age", "gender", "accent"],
        ):
            df = batch.to_pandas()
            for _, row in df.iterrows():
                sid = str(row["speaker_id"])
                # Only keep up to 10 clips per speaker to save RAM
                if sid in speakers and len(speakers[sid]) >= 10:
                    continue
                audio_struct = row["audio"]
                if not isinstance(audio_struct, dict):
                    continue
                ab = audio_struct.get("bytes")
                if not isinstance(ab, (bytes, bytearray)) or len(ab) < 1000:
                    continue
                try:
                    data, sr = sf.read(io.BytesIO(ab), dtype="float32")
                except Exception:
                    continue
                if data.ndim > 1:
                    data = data.mean(axis=1)
                duration = len(data) / sr
                if duration < 1.5 or duration > 10:
                    continue
                meta = {
                    "age": int(row["age"]) if row["age"] not in (None, "", 0) else 0,
                    "gender": str(row["gender"]).upper().strip(),
                    "accent": str(row["accent"]).strip() or "Unknown",
                    "text": str(row["text"]).strip(),
                }
                speakers.setdefault(sid, []).append((data, sr, duration, meta))
                total_rows += 1
    print(f"Collected {total_rows} clips across {len(speakers)} speakers")
    return speakers


def pick_diverse(speakers: dict, n: int) -> list:
    entries = []
    for sid, clips in speakers.items():
        if not clips:
            continue
        meta = clips[0][3]
        entries.append({
            "sid": sid,
            "accent": meta["accent"],
            "gender": meta["gender"],
            "age": meta["age"],
            "age_bucket": age_bucket(meta["age"]),
            "clips": clips,
        })

    by_bucket: dict[tuple, list] = defaultdict(list)
    for e in entries:
        key = (e["accent"], e["gender"], e["age_bucket"])
        by_bucket[key].append(e)

    buckets_sorted = sorted(by_bucket.keys())
    picked = []
    idx = 0
    while len(picked) < n and buckets_sorted:
        key = buckets_sorted[idx % len(buckets_sorted)]
        pool = by_bucket[key]
        if pool:
            picked.append(pool.pop(0))
        buckets_sorted = [k for k in buckets_sorted if by_bucket[k]]
        idx += 1
    return picked


def concat_clips(clips: list) -> tuple[np.ndarray, int]:
    if not clips:
        return np.zeros(0, dtype="float32"), 22050
    sr = clips[0][1]
    out: list[np.ndarray] = []
    total = 0.0
    silence = np.zeros(int(sr * 0.25), dtype="float32")
    for data, this_sr, dur, _meta in clips:
        if this_sr != sr:
            continue
        if total + dur > MAX_SECONDS:
            break
        if out:
            out.append(silence)
            total += 0.25
        out.append(data.astype("float32"))
        total += dur
        if total >= TARGET_SECONDS:
            break
    audio = np.concatenate(out) if out else np.zeros(0, dtype="float32")
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 0:
        audio = audio * (0.707 / peak)
    return audio, sr


def register(reference_id: str, audio_path: Path, text: str) -> bool:
    url = FISH_URL.rstrip("/") + "/v1/references/add"
    headers = {"ngrok-skip-browser-warning": "true"}
    if FISH_KEY:
        headers["Authorization"] = f"Bearer {FISH_KEY}"
    with open(str(audio_path), "rb") as f:
        files = {
            "id": (None, reference_id),
            "text": (None, text),
            "audio": (audio_path.name, f, "audio/wav"),
        }
        r = requests.post(url, headers=headers, files=files, timeout=60)
    if r.status_code != 200:
        print(f"  register {reference_id}: HTTP {r.status_code} {r.text[:200]}")
        return False
    return True


def main():
    shards = sorted(Path(s) for s in glob.glob(str(HERE / "shard*.parquet")))
    if not shards:
        print("No parquet shards found", file=sys.stderr)
        sys.exit(1)
    print(f"Using {len(shards)} shards: {[s.name for s in shards]}")

    speakers = load_speakers_from_shards(shards)
    print(f"Got {len(speakers)} candidate speakers")

    picked = pick_diverse(speakers, TARGET_SPEAKERS)
    print(f"Picked {len(picked)} diverse speakers\n")

    results = []
    for entry in picked:
        sid = entry["sid"]
        clips = entry["clips"]
        audio, sr = concat_clips(clips)
        if audio.size == 0 or len(audio) / sr < MIN_SECONDS:
            print(f"  {sid}: too short, skipping")
            continue

        accent = entry["accent"]
        country, country_code = ACCENT_TO_COUNTRY.get(accent, ("International", "xx"))
        gender = "female" if entry["gender"].startswith("F") else "male"
        ab = entry["age_bucket"]

        ref_id = f"vctk-{country_code}-{gender}-{ab}-{sid.lower()}"
        out_wav = OUT_DIR / f"{ref_id}.wav"
        sf.write(str(out_wav), audio, sr, subtype="PCM_16")

        text = " ".join(
            c[3]["text"] for c in clips[: min(3, len(clips))] if c[3]["text"]
        )
        if not text:
            text = "Hello, this is a sample voice."

        print(
            f"{ref_id}  gender={gender} accent={accent} country={country} "
            f"age={entry['age']} dur={len(audio)/sr:.1f}s"
        )

        ok = register(ref_id, out_wav, text)
        if not ok:
            continue

        results.append({
            "ref_id": ref_id,
            "country": country,
            "country_code": country_code,
            "gender": gender,
            "age": entry["age"],
            "age_bucket": ab,
            "accent": accent,
            "speaker_id": sid,
            "text": text,
        })

    manifest_path = HERE / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nWrote manifest: {manifest_path} ({len(results)} voices registered)")


if __name__ == "__main__":
    main()
