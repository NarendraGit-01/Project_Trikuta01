def test_health_check(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "app_name" in data


def test_login_success(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "ADMIN"
    assert data["username"] == "admin"


def test_login_invalid_password(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401


def test_get_me(client, staff_token):
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {staff_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "staff"
    assert data["role"] == "STAFF"


def test_admin_role_enforcement(client, staff_token, admin_token):
    # Staff cannot view user administration
    res_staff = client.get("/api/v1/users", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff.status_code == 403

    # Admin can view user administration
    res_admin = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    assert len(res_admin.json()) >= 2
