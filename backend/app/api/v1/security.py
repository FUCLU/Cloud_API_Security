from fastapi import APIRouter, HTTPException, Query

from app.security.ssrf_guard import SSRFBlocked, validate_outbound_url


router = APIRouter(prefix="/api/v1/security", tags=["security"])


@router.get("/url-check")
def check_url(url: str = Query(..., min_length=1)):
    """
    SSRF-safe URL validation endpoint for security evidence.
    It validates the outbound URL but intentionally does not fetch it.
    """
    try:
        return validate_outbound_url(url)
    except SSRFBlocked as exc:
        raise HTTPException(status_code=400, detail=str(exc))
