import ipaddress
import socket
from urllib.parse import urlparse


BLOCKED_HOSTNAMES = {"localhost"}
BLOCKED_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("100.100.100.200"),
}


class SSRFBlocked(ValueError):
    pass


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or ip in BLOCKED_METADATA_IPS
    )


def validate_outbound_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise SSRFBlocked("SSRF blocked: scheme not allowed")

    if not parsed.hostname:
        raise SSRFBlocked("SSRF blocked: missing hostname")

    hostname = parsed.hostname.strip().lower()
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".localhost"):
        raise SSRFBlocked("SSRF blocked: localhost hostname")

    try:
        direct_ip = ipaddress.ip_address(hostname)
    except ValueError:
        direct_ip = None

    if direct_ip and _is_blocked_ip(direct_ip):
        raise SSRFBlocked(f"SSRF blocked: unsafe ip {direct_ip}")

    try:
        resolved = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise SSRFBlocked("SSRF blocked: hostname cannot be resolved")

    resolved_ips = sorted({item[4][0] for item in resolved})
    for raw_ip in resolved_ips:
        ip_obj = ipaddress.ip_address(raw_ip)
        if _is_blocked_ip(ip_obj):
            raise SSRFBlocked(f"SSRF blocked: unsafe resolved ip {ip_obj}")

    return {
        "allowed": True,
        "scheme": parsed.scheme,
        "hostname": hostname,
        "resolved_ips": resolved_ips,
    }
