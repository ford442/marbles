# Health Check Routes
from fastapi import APIRouter
from ..services.index import health_check

router = APIRouter()


@router.get("/")
def home():
    return {"status": "online", "provider": "Google Cloud Storage"}


@router.get("/api/health")
async def health():
    """Returns storage manager status and index counts."""
    status = await health_check()
    return {"status": "online", "storage": status}
