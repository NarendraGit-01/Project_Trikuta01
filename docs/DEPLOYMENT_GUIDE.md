# Production Deployment Guide: Trikuta Temple Receipt OCR System

This guide outlines the steps required to deploy the **Sri Trikoteswara Swamy Temple Receipt Management System** to a production server (Ubuntu 22.04 LTS / Debian 12) with HTTPS, process management, and automated daily backups.

---

## 1. System Requirements

- **Operating System**: Ubuntu 22.04 LTS / Debian 12 (or Windows Server 2022)
- **CPU / RAM**: Minimum 2 vCPU, 4GB RAM (8GB recommended for concurrent OCR requests)
- **Storage**: 40GB+ SSD (for receipt image storage)
- **Python**: 3.12+
- **Node.js**: 20+ LTS

---

## 2. Server Setup & Repository Setup

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.12 python3.12-venv python3-pip git nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/temple-org/Proj_Trikuta_OCR.git /opt/trikuta
cd /opt/trikuta

# Create Python virtual environment
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Environment Configuration (`.env`)

Create `/opt/trikuta/.env`:

```ini
APP_NAME="Sri Trikoteswara Swamy Temple Receipt OCR System"
APP_ENV="production"
DEBUG=false

# Security: Generate a secure 32+ character key: openssl rand -hex 32
SECRET_KEY="generate-a-strong-random-secret-key-here"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database (SQLite with WAL mode)
DATABASE_URL="sqlite:///./temple_receipts.db"

# Storage
STORAGE_DIR="/opt/trikuta/data/storage"

# Google Gemini API
GOOGLE_API_KEY="YOUR_ACTUAL_GOOGLE_GEMINI_API_KEY"
GEMINI_PRIMARY_MODEL="gemini-3.5-flash-lite"
GEMINI_FALLBACK_MODEL="gemini-3.1-flash-lite"

# Temple Settings
TEMPLE_NAME_TE="శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము"
TEMPLE_NAME_EN="Sri Trikoteswara Swamy Vari Devasthanam"
TEMPLE_LOCATION="Kotappakonda"
RECEIPT_UNIQUENESS_POLICY="yearly"

# CORS (Your production domain)
CORS_ORIGINS=["https://trikuta-temple.org", "http://localhost:5173"]
```

---

## 4. Database Initialization

```bash
cd /opt/trikuta
source .venv/bin/activate

# Apply migrations
alembic upgrade head

# Seed 2,099 Master Gothrams
python -c "
from backend.app.core.database import SessionLocal
from backend.pipeline.gothram_matching import seed_gothram_master_db
db = SessionLocal()
seed_gothram_master_db(db)
db.close()
"
```

---

## 5. Frontend Production Build

```bash
cd /opt/trikuta/frontend
npm install
npm run build
# Built files are placed in /opt/trikuta/frontend/dist
```

---

## 6. Systemd Service Setup (Backend)

Create `/etc/systemd/system/trikuta-backend.service`:

```ini
[Unit]
Description=Trikuta Temple FastAPI Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/trikuta
EnvironmentFile=/opt/trikuta/.env
ExecStart=/opt/trikuta/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 3
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo chown -R www-data:www-data /opt/trikuta/data /opt/trikuta/temple_receipts.db
sudo systemctl daemon-reload
sudo systemctl enable trikuta-backend
sudo systemctl start trikuta-backend
sudo systemctl status trikuta-backend
```

---

## 7. Nginx Configuration

Create `/etc/nginx/sites-available/trikuta`:

```nginx
server {
    server_name trikuta-temple.org;

    # Frontend Single Page App
    location / {
        root /opt/trikuta/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25M;
        proxy_read_timeout 120s;
    }

    # Static Receipts & Samples Storage
    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable site and acquire SSL certificate:

```bash
sudo ln -s /etc/nginx/sites-available/trikuta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d trikuta-temple.org
```

---

## 8. Automated Daily Backups

Create `/opt/trikuta/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/trikuta"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# SQLite safe online backup using sqlite3 CLI
sqlite3 /opt/trikuta/temple_receipts.db ".backup '$BACKUP_DIR/temple_receipts_$DATE.db'"

# Tar image uploads
tar -czf "$BACKUP_DIR/images_$DATE.tar.gz" -C /opt/trikuta/data storage

# Remove backups older than 30 days
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

Add cron job (`crontab -e`):

```bash
# Run backup every night at 2:00 AM
0 2 * * * /opt/trikuta/scripts/backup.sh > /dev/null 2>&1
```
