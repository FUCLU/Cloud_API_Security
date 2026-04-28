from ipaddress import ip_address, ip_network
from urllib.parse import urlparse
from fastapi import HTTPException

BLOCKED_RANGES = [
    ip_network("169.254.0.0/16"),
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
]


def validate_ssrf(url: str | None):
    """Protect against SSRF attacks"""
    if not url:
        return

    try:
        parsed = urlparse(url)
        if parsed.hostname:
            # Nếu hostname là IP
            ip = ip_address(parsed.hostname)
            for blocked in BLOCKED_RANGES:
                if ip in blocked:
                    raise HTTPException(
                        status_code=400, detail="SSRF blocked: Internal IP address"
                    )
    except ValueError:
        pass
