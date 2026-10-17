"""Workshop map validation: the same rule set as CI and the editor.

`assets/schemas/map-schema.json` is the single source of truth. CI
(scripts/validate-assets.cjs) and the editor (src/editor/map-validator.js)
compile it with ajv via src/levels/map-rules.js; this module validates the same
file with `jsonschema` and mirrors map-rules.js `semanticChecks`.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List

from jsonschema import Draft7Validator

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = Path(os.environ.get("MARBLES_MAP_SCHEMA_PATH", _REPO_ROOT / "assets" / "schemas" / "map-schema.json"))
_HANDLERS_PATH = Path(os.environ.get("MARBLES_ZONE_HANDLERS_PATH", _REPO_ROOT / "assets" / "schemas" / "zone-handlers.json"))

# Kept in sync with src/levels/map-normalize.js PRIMITIVE_ZONE_TYPES.
PRIMITIVE_ZONE_TYPES = frozenset({"box", "ramp", "mover", "spinner", "trigger"})


@lru_cache(maxsize=1)
def _validator() -> Draft7Validator:
    schema = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
    return Draft7Validator(schema)


@lru_cache(maxsize=1)
def _zone_types() -> frozenset:
    data = json.loads(_HANDLERS_PATH.read_text(encoding="utf-8"))
    return frozenset(data.get("handlers", []))


def _path(error) -> str:
    parts = ["map"]
    for p in error.absolute_path:
        parts.append(f"[{p}]" if isinstance(p, int) else f".{p}")
    return "".join(parts)


def map_errors(data: Any) -> List[str]:
    """Return human-readable errors; empty when the map is publishable.

    Unlike the editor (where unknown zone types are warnings while drafting),
    a published map must only use registered zone types.
    """
    errors = [f"{_path(e)}: {e.message}" for e in sorted(_validator().iter_errors(data), key=lambda e: list(e.absolute_path))]
    if not isinstance(data, dict):
        return errors or ["map: must be an object"]

    version = data.get("schemaVersion", 1)
    known = _zone_types()
    for i, zone in enumerate(data.get("zones") or []):
        ztype = zone.get("type") if isinstance(zone, dict) else None
        if not isinstance(ztype, str):
            continue
        if ztype not in known:
            errors.append(f"zones[{i}]: unknown type \"{ztype}\" — no zone handler registered")
        if ztype in PRIMITIVE_ZONE_TYPES and version < 2:
            errors.append(f"zones[{i}]: primitive \"{ztype}\" requires \"schemaVersion\": 2")
    if version < 2:
        if "goal" in data:
            errors.append('map.goal requires "schemaVersion": 2 (v1 maps use goals[])')
        if "rivals" in data:
            errors.append('map.rivals requires "schemaVersion": 2')
    if data.get("goal") and data.get("goals"):
        errors.append("map: set either goal (v2) or goals[], not both")
    return errors
