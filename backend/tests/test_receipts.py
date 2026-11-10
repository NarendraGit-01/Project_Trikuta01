def test_receipt_lifecycle(client, staff_token):
    # 1. Create Receipt
    receipt_payload = {
        "receipt_no": "5813",
        "receipt_year": 2025,
        "receipt_date": "10/10/2025",
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount": "1000-00",
        "gothram_en": "KASHYAPA",
        "gothram_te": "కాశ్యప",
        "gothram_as_written": "కాశ్యపస",
        "address_en": "Srinivasapuram mandalam, Angadam gramam, Konaseema jilla",
        "address_te": "శ్రీనివాసపురం మండలం, అంగడం గ్రామం, కోనసీమ జిల్లా",
        "pincode": "533307",
        "status": "PENDING_VERIFICATION",
        "original_image_path": "receipts/5813_raw.jpg",
        "processing_cost": 0.0205,
        "processing_duration": 4.2,
        "persons": [
            {
                "position": 1,
                "given_name_en": "Subrahmanyam",
                "given_name_te": "సుబ్రహ్మణ్యం",
                "surname_en": "Kotinandini",
                "surname_te": "కోటినందిని",
                "verification_status": "UNVERIFIED"
            },
            {
                "position": 2,
                "given_name_en": "Satyavati",
                "given_name_te": "సత్యవతి",
                "surname_en": "Kotinandini",
                "surname_te": "కోటినందిని",
                "verification_status": "UNVERIFIED"
            }
        ],
        "phones": [
            {
                "number": "9603850122",
                "is_primary": True,
                "verification_status": "UNVERIFIED"
            }
        ]
    }

    res_create = client.post(
        "/api/v1/receipts",
        json=receipt_payload,
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_create.status_code == 200
    created = res_create.json()
    receipt_id = created["id"]
    assert created["receipt_no"] == "5813"
    assert len(created["persons"]) == 2
    assert len(created["phones"]) == 1
    assert created["status"] == "PENDING_VERIFICATION"

    # 2. Check Duplicate detection
    res_dup = client.post(
        "/api/v1/receipts/check-duplicate?receipt_no=5813&year=2025"
    )
    assert res_dup.status_code == 200
    assert res_dup.json()["is_duplicate"] is True

    # 3. Conflict on duplicate create
    res_conflict = client.post(
        "/api/v1/receipts",
        json=receipt_payload,
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_conflict.status_code == 409

    # 4. Update/Correct a field (e.g. correct pincode)
    update_payload = {
        "pincode": "533308"
    }
    res_update = client.patch(
        f"/api/v1/receipts/{receipt_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_update.status_code == 200
    assert res_update.json()["pincode"] == "533308"

    # 5. Confirm Receipt
    res_confirm = client.post(
        f"/api/v1/receipts/{receipt_id}/confirm",
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_confirm.status_code == 200
    confirmed = res_confirm.json()
    assert confirmed["status"] == "CONFIRMED"
    assert confirmed["persons"][0]["verification_status"] == "VERIFIED"
    assert confirmed["phones"][0]["verification_status"] == "VERIFIED"

    # 6. Search receipts by Telugu devotee name
    res_search = client.get("/api/v1/receipts?q=సుబ్రహ్మణ్యం")
    assert res_search.status_code == 200
    items = res_search.json()
    assert len(items) >= 1
    assert items[0]["receipt_no"] == "5813"
