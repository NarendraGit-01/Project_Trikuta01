"""
Supabase Credentials Verification Script
Run this locally to verify:
1. PostgreSQL Database connection (DATABASE_URL)
2. Table creation (receipts, persons, staged_images, etc.)
3. Supabase Storage API & Bucket access (SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET)

Usage:
  python test_supabase.py
"""

import os
import sys

# Load from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "receipts").strip()

print("=" * 60)
print("🔍 SUPABASE CREDENTIALS DIAGNOSTIC")
print("=" * 60)

# Mask helper
def mask(val: str, show_start=4, show_end=4) -> str:
    if not val:
        return "<NOT SET>"
    if len(val) <= show_start + show_end:
        return "***"
    return f"{val[:show_start]}...{val[-show_end:]}"

print(f"DATABASE_URL:    {mask(DATABASE_URL, 12, 8)}")
print(f"SUPABASE_URL:    {SUPABASE_URL or '<NOT SET>'}")
print(f"SUPABASE_KEY:    {mask(SUPABASE_KEY, 8, 8)}")
print(f"SUPABASE_BUCKET: {SUPABASE_BUCKET}")
print("-" * 60)

# -------------------------------------------------------------
# Test 1: PostgreSQL Database Connection & Table Creation
# -------------------------------------------------------------
print("\n[1/2] Testing PostgreSQL Database Connection...")
if not DATABASE_URL:
    print("❌ DATABASE_URL is empty!")
else:
    db_url = DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(db_url, pool_pre_ping=True)
        with engine.connect() as conn:
            res = conn.execute(text("SELECT version();")).fetchone()
            print(f"✅ Database connected successfully!")
            print(f"   Server: {res[0] if res else 'PostgreSQL'}")

        # Now test creating all application tables on Supabase
        print("\n   Ensuring all tables exist on Supabase database...")
        from backend.app.core.database import Base, engine as app_engine
        import backend.app.models  # load all models
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables verified/created on Supabase!")

    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\n👉 Tip for Supabase PostgreSQL URL:")
        print("   In Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI")
        print("   Use 'Transaction pooler' (port 6543) or 'Session pooler' (port 5432).")
        print("   Format: postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres")

# -------------------------------------------------------------
# Test 2: Supabase Storage REST API
# -------------------------------------------------------------
print("\n[2/2] Testing Supabase Storage Bucket...")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL or SUPABASE_KEY is missing!")
else:
    try:
        import httpx
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        }

        # Check buckets
        bucket_url = f"{SUPABASE_URL}/storage/v1/bucket"
        res = httpx.get(bucket_url, headers=headers, timeout=10.0)

        if res.status_code == 200:
            buckets = [b.get("id") or b.get("name") for b in res.json()]
            print(f"✅ Storage API authorized successfully!")
            print(f"   Existing buckets: {buckets}")

            if SUPABASE_BUCKET in buckets:
                print(f"✅ Bucket '{SUPABASE_BUCKET}' exists and is accessible!")
            else:
                print(f"⚠️  Bucket '{SUPABASE_BUCKET}' not found in {buckets}.")
                print(f"   Attempting to create public bucket '{SUPABASE_BUCKET}'...")
                create_res = httpx.post(
                    bucket_url,
                    headers=headers,
                    json={"id": SUPABASE_BUCKET, "name": SUPABASE_BUCKET, "public": True},
                    timeout=10.0
                )
                if create_res.status_code in (200, 201):
                    print(f"✅ Bucket '{SUPABASE_BUCKET}' created as public successfully!")
                else:
                    print(f"❌ Failed to create bucket automatically: {create_res.status_code} {create_res.text}")
                    print("   Please create a bucket named 'receipts' manually in Supabase Dashboard -> Storage.")

            # Test upload of a tiny 1-byte file
            test_path = "_test_probe.txt"
            upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{test_path}"
            upload_headers = {**headers, "Content-Type": "text/plain", "x-upsert": "true"}
            up_res = httpx.post(upload_url, headers=upload_headers, content=b"OK", timeout=10.0)
            if up_res.status_code in (200, 201):
                print(f"✅ Storage write test succeeded! Uploaded {test_path} to '{SUPABASE_BUCKET}'.")
                # Clean up probe file
                del_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}"
                httpx.request("DELETE", del_url, headers=headers, json={"prefixes": [test_path]}, timeout=10.0)
            else:
                print(f"❌ Upload test failed ({up_res.status_code}): {up_res.text}")
                print("   Make sure SUPABASE_KEY is the 'service_role' secret key, not the anon key.")
        else:
            print(f"❌ Storage API rejected request ({res.status_code}): {res.text}")
            print("   Check that SUPABASE_URL and SUPABASE_KEY match Supabase Project Settings -> API.")

    except Exception as e:
        print(f"❌ Storage test failed with exception: {e}")

print("\n" + "=" * 60)
print("Diagnostic Complete.")
print("=" * 60)
