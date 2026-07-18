# Device-token auth for Marbles cloud API (Phase 1)
import re
from fastapi import Header, HTTPException

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def parse_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[7:].strip()
    if not UUID_RE.match(token):
        raise HTTPException(status_code=401, detail="Invalid device token")
    return token


async def require_device_token(
    authorization: str = Header(..., alias="Authorization"),
) -> str:
    return parse_bearer_token(authorization)


def verify_user_id(user_id: str, token: str) -> None:
    if user_id != token:
        raise HTTPException(status_code=403, detail="User ID does not match token")
