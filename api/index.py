import sys
from pathlib import Path

# Add project root to sys.path so 'backend' can be imported anywhere
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app

# Vercel serverless functions look for `app` or `handler`
handler = app
