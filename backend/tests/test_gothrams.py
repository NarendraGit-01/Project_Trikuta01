def test_create_and_search_gothram(client, admin_token):
    # Create Gothram
    create_payload = {
        "gothram_en": "KASHYAPA",
        "gothram_te": "కాశ్యప",
        "normalized_name": "KASYAPA",
        "variants": ["KASYAPA", "KASHYAPASA"],
        "approval_status": "APPROVED",
        "te_verified": True
    }
    res = client.post(
        "/api/v1/gothrams",
        json=create_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["gothram_en"] == "KASHYAPA"
    assert data["te_verified"] is True

    # Search by Telugu
    res_search_te = client.get("/api/v1/gothrams/search?q=కాశ్యప")
    assert res_search_te.status_code == 200
    results_te = res_search_te.json()
    assert len(results_te) >= 1
    assert results_te[0]["gothram_en"] == "KASHYAPA"

    # Search with phonetic variation (e.g. "KASYAP")
    res_search_en = client.get("/api/v1/gothrams/search?q=Kasyap")
    assert res_search_en.status_code == 200
    results_en = res_search_en.json()
    assert len(results_en) >= 1
    assert any(r["gothram_en"] == "KASHYAPA" for r in results_en)
