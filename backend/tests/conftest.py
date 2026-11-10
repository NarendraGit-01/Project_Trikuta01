import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_FILE = "./test_temple.db"
os.environ["APP_ENV"] = "testing"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-min-32-chars-long-secure!"

from backend.app.core.database import Base, get_db
from backend.app.core.security import get_password_hash
from backend.app.main import app
from backend.app.models.user import User

test_engine = create_engine(
    f"sqlite:///{TEST_DB_FILE}",
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    admin = User(
        username="admin",
        password_hash=get_password_hash("admin123"),
        full_name="Admin User",
        role="ADMIN",
        active=True,
    )
    staff = User(
        username="staff",
        password_hash=get_password_hash("staff123"),
        full_name="Staff User",
        role="STAFF",
        active=True,
    )
    db.add(admin)
    db.add(staff)
    db.commit()
    db.close()
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def staff_token(client):
    res = client.post("/api/v1/auth/login", json={"username": "staff", "password": "staff123"})
    assert res.status_code == 200
    return res.json()["access_token"]
