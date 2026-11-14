import ipaddress
import json
import os
import re
import socket
import urllib.request
from typing import List, Optional
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# Fallback prefix hints if AWS IP ranges JSON cannot be fetched
_AWS_IPV6_PREFIX_HINTS = [
    ("2406:da12::/35", "ap-northeast-2"),
    ("2406:da14::/35", "ap-northeast-1"),
    ("2406:da18::/35", "ap-southeast-1"),
    ("2406:da1a::/35", "ap-south-1"),
    ("2406:da1c::/35", "ap-southeast-2"),
    ("2600:1f18::/32", "us-east-1"),
    ("2600:1f16::/32", "us-east-2"),
    ("2600:1f1c::/32", "us-west-1"),
    ("2600:1f14::/32", "us-west-2"),
    ("2a05:d014::/32", "eu-central-1"),
    ("2a05:d018::/32", "eu-west-1"),
    ("2a05:d01c::/32", "eu-west-2"),
]


def _detect_aws_region_from_ipv6(ipv6_str: str) -> Optional[str]:
    """Infer AWS region for an IPv6 address via fast prefix hints first, then AWS ip-ranges.json."""
    try:
        ip_obj = ipaddress.ip_address(ipv6_str)
    except ValueError:
        return None

    # 1. Instant 0ms prefix hint check
    for cidr, region in _AWS_IPV6_PREFIX_HINTS:
        if ip_obj in ipaddress.ip_network(cidr):
            return region

    # 2. Fallback to AWS ip-ranges.json for uncommon regions
    try:
        req = urllib.request.Request(
            "https://ip-ranges.amazonaws.com/ip-ranges.json",
            headers={"User-Agent": "TrikutaOCR/1.0"},
        )
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        best_prefix_len = -1
        best_region = None
        for entry in data.get("ipv6_prefixes", []):
            net = ipaddress.ip_network(entry["ipv6_prefix"])
            if ip_obj in net and net.prefixlen > best_prefix_len:
                best_prefix_len = net.prefixlen
                best_region = entry.get("region")
        if best_region:
            return best_region
    except Exception:
        pass
    return None


def _resolve_supabase_ipv4_url(url_str: str, engine_kwargs: dict):
    """
    If DATABASE_URL points to an IPv6-only Supabase direct host (db.<ref>.supabase.co)
    from an IPv4-only environment (e.g. Vercel serverless), transparently resolve and
    switch to Supabase's IPv4 Supavisor Session/Transaction Pooler.
    """
    try:
        u = make_url(url_str)
    except Exception:
        return url_str

    if not u.host:
        return url_str

    m = re.fullmatch(r"db\.([a-z0-9]+)\.supabase\.co", u.host, flags=re.IGNORECASE)
    if not m:
        return url_str

    project_ref = m.group(1)
    port = u.port or 5432

    # 1. Check if direct IPv6 actually connects in this environment (skip on Vercel which is strictly IPv4-only)
    ipv6_addr = None
    try:
        ipv6_info = socket.getaddrinfo(u.host, port, socket.AF_INET6)
        if ipv6_info:
            af, socktype, proto, _, sockaddr = ipv6_info[0]
            ipv6_addr = sockaddr[0]
            if not os.getenv("VERCEL"):
                with socket.socket(af, socktype, proto) as s:
                    s.settimeout(1.5)
                    s.connect(sockaddr)
                return url_str  # IPv6 works directly
    except OSError:
        pass

    # 2. Direct IPv6 unreachable or running on Vercel -> switch to Supavisor IPv4 pooler
    region = (_detect_aws_region_from_ipv6(ipv6_addr) if ipv6_addr else None) or "ap-northeast-2"
    base_user = (u.username or "postgres").split(".")[0]
    pooler_user = f"{base_user}.{project_ref}"

    candidate = u.set(host=f"aws-0-{region}.pooler.supabase.com", port=5432, username=pooler_user)
    print(f"Notice: Switched IPv6-only Supabase host to IPv4 pooler {candidate.host}:{candidate.port}")
    return candidate

db_url = settings.DATABASE_URL
# Supabase / cloud providers output postgres:// or postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    import psycopg2
    has_psycopg2 = True
except ImportError:
    has_psycopg2 = False

try:
    import psycopg
    has_psycopg = True
except ImportError:
    has_psycopg = False

if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    if has_psycopg2:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif has_psycopg:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Graceful fallback to SQLite when C database drivers are not installed locally or on serverless
if (db_url.startswith("postgresql://") or db_url.startswith("postgresql+")) and not has_psycopg2 and not has_psycopg:
    fallback_path = "/tmp/temple_receipts.db" if os.getenv("VERCEL") else "./temple_receipts.db"
    print(f"Notice: PostgreSQL driver not installed. Falling back to SQLite at {fallback_path}")
    db_url = f"sqlite:///{fallback_path}"

engine_kwargs = {"echo": False}

is_sqlite = db_url.startswith("sqlite")
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / Supabase connection pooling
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    if ("supabase" in db_url.lower() or os.getenv("VERCEL")) and "sslmode" not in db_url:
        engine_kwargs["connect_args"] = {"sslmode": "require"}
    db_url = _resolve_supabase_ipv4_url(db_url, engine_kwargs)

engine = create_engine(db_url, **engine_kwargs)

# Enable foreign keys for SQLite
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
