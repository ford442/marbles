"""Unit tests for Marbles cloud merge and replay validation."""
import base64
import sys
import unittest
from pathlib import Path

# Allow importing storage package from repo root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from storage.models_marbles import CampaignSavePayload
from storage.services.marbles import (
    REPLAY_MAGIC,
    REPLAY_PREFIX,
    REPLAY_VERSION,
    merge_campaign_save,
    merge_level_progress,
    validate_replay_blob,
)
from fastapi import HTTPException


def _minimal_replay_blob(level_id: str = "tutorial") -> str:
    level_bytes = level_id.encode("utf-8")
    header = bytearray()
    header.extend(REPLAY_MAGIC)
    header.append(REPLAY_VERSION)
    header.append(len(level_bytes))
    header.extend(level_bytes)
    header.extend((0).to_bytes(2, "little"))  # frame count
    header.extend((0).to_bytes(2, "little"))  # duration ms
    b64 = base64.b64encode(bytes(header)).decode("ascii")
    return REPLAY_PREFIX + b64


class TestMergeProgress(unittest.TestCase):
    def test_merge_level_best_time(self):
        merged = merge_level_progress(
            {"completed": True, "bestTime": 40, "medal": "silver"},
            {"completed": True, "bestTime": 32, "medal": "bronze"},
        )
        self.assertEqual(merged["bestTime"], 32)
        self.assertEqual(merged["medal"], "silver")

    def test_merge_campaign_unlocks(self):
        incoming = CampaignSavePayload(
            version=1,
            freePlay=False,
            unlockedChapters=["tutorial"],
            unlockedMarbles=["classic_red"],
            levels={},
            revision=1,
        )
        existing = {
            "version": 1,
            "freePlay": True,
            "unlockedChapters": ["tutorial", "classic"],
            "unlockedMarbles": ["classic_blue"],
            "levels": {"tutorial": {"completed": True, "bestTime": 25, "medal": "gold"}},
            "revision": 3,
        }
        merged = merge_campaign_save(incoming, existing)
        self.assertTrue(merged["freePlay"])
        self.assertIn("classic", merged["unlockedChapters"])
        self.assertIn("classic_blue", merged["unlockedMarbles"])
        self.assertEqual(merged["levels"]["tutorial"]["bestTime"], 25)
        self.assertEqual(merged["revision"], 4)


class TestReplayValidation(unittest.TestCase):
    def test_valid_blob(self):
        blob = _minimal_replay_blob("tutorial")
        validate_replay_blob(blob, "tutorial")

    def test_rejects_bad_prefix(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_replay_blob("bad:data", "tutorial")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_rejects_level_mismatch(self):
        blob = _minimal_replay_blob("other")
        with self.assertRaises(HTTPException) as ctx:
            validate_replay_blob(blob, "tutorial")
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
