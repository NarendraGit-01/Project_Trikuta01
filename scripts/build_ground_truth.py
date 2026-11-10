import json, os

os.makedirs("evals/expected", exist_ok=True)

ground_truth = {
    "sample_img": {
        "receipt_no": "9745",
        "date": "02/11/26",
        "gothram_raw": "Endavalli",
        "gothram_resolved": "ENDAVALLI",
        "gothram_te": "ఎండవల్లి",
        "language": "en",
        "people": [
            {"surname_raw": "Raoji", "given_name_raw": "Mahalakshmi", "surname_en": "Raoji", "given_name_en": "Mahalakshmi", "surname_te": "రావ్జీ", "given_name_te": "మహాలక్ష్మి"},
            {"surname_raw": "Raoji", "given_name_raw": "Sarvotham", "surname_en": "Raoji", "given_name_en": "Sarvotham", "surname_te": "రావ్జీ", "given_name_te": "సర్వోత్తం"},
            {"surname_raw": "Raoji", "given_name_raw": "Shwetha", "surname_en": "Raoji", "given_name_en": "Shwetha", "surname_te": "రావ్జీ", "given_name_te": "శ్వేత"},
            {"surname_raw": "Raoji", "given_name_raw": "Akshara", "surname_en": "Raoji", "given_name_en": "Akshara", "surname_te": "రావ్జీ", "given_name_te": "అక్షర"},
            {"surname_raw": "Raoji", "given_name_raw": "Shwetha", "surname_en": "Raoji", "given_name_en": "Shwetha", "surname_te": "రావ్జీ", "given_name_te": "శ్వేత"},
            {"surname_raw": "Raoji", "given_name_raw": "Abhiram", "surname_en": "Raoji", "given_name_en": "Abhiram", "surname_te": "రావ్జీ", "given_name_te": "అభిరామ్"},
            {"surname_raw": "Raoji", "given_name_raw": "Nupurti", "surname_en": "Raoji", "given_name_en": "Nupurti", "surname_te": "రావ్జీ", "given_name_te": "నుపూర్తి"}
        ],
        "address": "3-6-293/2/D, Hyderguda, Hyderabad",
        "pincode": "500029",
        "phones": ["7400481724"],
        "abhishekam_from": "10/11/26",
        "abhishekam_to": "08/12/26",
        "amount_rupees": "1000-00"
    },
    "sample_img2": {
        "receipt_no": "5815",
        "date": "10/10/2025",
        "gothram_raw": "మార్కండేయ",
        "gothram_resolved": "MARKANDEYA",
        "gothram_te": "మార్కండేయ",
        "language": "te",
        "people": [
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటరమణ", "surname_en": "Lolla", "given_name_en": "Venkataramana", "surname_te": "లొల్ల", "given_name_te": "వెంకటరమణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Venkatalakshmi", "surname_te": "లొల్ల", "given_name_te": "వెంకటలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సత్యనారాయణ", "surname_en": "Lolla", "given_name_en": "Veera Venkata Satyanarayana", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సత్యనారాయణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "కనకమహాలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Kanakamahalakshmi", "surname_te": "లొల్ల", "given_name_te": "కనకమహాలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సుబ్రహ్మణ్యం", "surname_en": "Lolla", "given_name_en": "Veera Venkata Subrahmanyam", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సుబ్రహ్మణ్యం"}
        ],
        "address": "అంగర, K.P. పురం మండలం, కోనసీమ జిల్లా",
        "pincode": "533307",
        "phones": ["9963950472", "8897794815"],
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount_rupees": "1000-00"
    },
    "sample_img3": {
        "receipt_no": "5815",
        "date": "10/10/2025",
        "gothram_raw": "మార్కండేయ",
        "gothram_resolved": "MARKANDEYA",
        "gothram_te": "మార్కండేయ",
        "language": "te",
        "people": [
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటరమణ", "surname_en": "Lolla", "given_name_en": "Venkataramana", "surname_te": "లొల్ల", "given_name_te": "వెంకటరమణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Venkatalakshmi", "surname_te": "లొల్ల", "given_name_te": "వెంకటలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సత్యనారాయణ", "surname_en": "Lolla", "given_name_en": "Veera Venkata Satyanarayana", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సత్యనారాయణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "కనకమహాలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Kanakamahalakshmi", "surname_te": "లొల్ల", "given_name_te": "కనకమహాలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సుబ్రహ్మణ్యం", "surname_en": "Lolla", "given_name_en": "Veera Venkata Subrahmanyam", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సుబ్రహ్మణ్యం"}
        ],
        "address": "అంగర, K.P. పురం మండలం, కోనసీమ జిల్లా",
        "pincode": "533307",
        "phones": ["9963950472", "8897794815"],
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount_rupees": "1000-00"
    },
    "sample_img4": {
        "receipt_no": "5817",
        "date": "12.10.2025",
        "gothram_raw": "శునకశీల",
        "gothram_resolved": "SAUNAKASA",
        "gothram_te": "శౌనకస",
        "language": "te",
        "people": [
            {"surname_raw": "మొండిరెడ్డి", "given_name_raw": "నాగరాజు", "surname_en": "Mondireddy", "given_name_en": "Nagaraju", "surname_te": "మొండిరెడ్డి", "given_name_te": "నాగరాజు"},
            {"surname_raw": "మొండిరెడ్డి", "given_name_raw": "పార్వతి", "surname_en": "Mondireddy", "given_name_en": "Parvati", "surname_te": "మొండిరెడ్డి", "given_name_te": "పార్వతి"},
            {"surname_raw": "మొండిరెడ్డి", "given_name_raw": "వినయ నాగదుర్గ వెంకట సాయి సూరి", "surname_en": "Mondireddy", "given_name_en": "Vinaya Nagadurga Venkata Sai Soori", "surname_te": "మొండిరెడ్డి", "given_name_te": "వినయ నాగదుర్గ వెంకట సాయి సూరి"},
            {"surname_raw": "మొండిరెడ్డి", "given_name_raw": "నాగదుర్గ విశ్వనాధ్", "surname_en": "Mondireddy", "given_name_en": "Nagadurga Viswanath", "surname_te": "మొండిరెడ్డి", "given_name_te": "నాగదుర్గ విశ్వనాధ్"}
        ],
        "address": "అంగర (పడమరఖండ్రిక), కపిలేశ్వరపురం మండలం, కోనసీమ జిల్లా",
        "pincode": None,
        "phones": ["9441795894"],
        "abhishekam_from": "22-10-2025",
        "abhishekam_to": "20-11-2025",
        "amount_rupees": "1000-00"
    },
    "sample_img5": {
        "receipt_no": "5812",
        "date": "10-10-25",
        "gothram_raw": "ఉలికాల",
        "gothram_resolved": "ULIKALA",
        "gothram_te": "ఉలికాల",
        "language": "te",
        "people": [
            {"surname_raw": "ఏలూరి", "given_name_raw": "నాగేశ్వరరావు (నాగు)", "surname_en": "Eluri", "given_name_en": "Nageswara Rao (Nagu)", "surname_te": "ఏలూరి", "given_name_te": "నాగేశ్వరరావు (నాగు)"},
            {"surname_raw": "ఏలూరి", "given_name_raw": "సత్యవేణి", "surname_en": "Eluri", "given_name_en": "Satyaveni", "surname_te": "ఏలూరి", "given_name_te": "సత్యవేణి"},
            {"surname_raw": "ఏలూరి", "given_name_raw": "పవన్ నాగ వర భద్ర సంతోష్", "surname_en": "Eluri", "given_name_en": "Pavan Naga Vara Bhadra Santosh", "surname_te": "ఏలూరి", "given_name_te": "పవన్ నాగ వర భద్ర సంతోష్"},
            {"surname_raw": "ఏలూరి", "given_name_raw": "భరత్ నాగ సాయి ఈశ్వర వసంత్", "surname_en": "Eluri", "given_name_en": "Bharat Naga Sai Eswara Vasant", "surname_te": "ఏలూరి", "given_name_te": "భరత్ నాగ సాయి ఈశ్వర వసంత్"},
            {"surname_raw": "ఏలూరి", "given_name_raw": "మహాలక్ష్మి", "surname_en": "Eluri", "given_name_en": "Mahalakshmi", "surname_te": "ఏలూరి", "given_name_te": "మహాలక్ష్మి"}
        ],
        "address": "అంగర, K.P. పురం మండలం",
        "pincode": "533307",
        "phones": ["9000146989"],
        "abhishekam_from": "22-10-25",
        "abhishekam_to": "20-11-25",
        "amount_rupees": "1000-00"
    },
    "sample_img6": {
        "receipt_no": "5816",
        "date": "10-10-2025",
        "gothram_raw": "పైడిపాల",
        "gothram_resolved": "PAIDIPALA",
        "gothram_te": "పైడిపాల",
        "language": "te",
        "people": [
            {"surname_raw": "తోటపల్లి", "given_name_raw": "శ్రీనివాసు", "surname_en": "Totapalli", "given_name_en": "Srinivasu", "surname_te": "తోటపల్లి", "given_name_te": "శ్రీనివాసు"},
            {"surname_raw": "తోటపల్లి", "given_name_raw": "సత్యవాణి", "surname_en": "Totapalli", "given_name_en": "Satyavani", "surname_te": "తోటపల్లి", "given_name_te": "సత్యవాణి"},
            {"surname_raw": "తోటపల్లి", "given_name_raw": "జయప్రలక్ష్మి సరళ", "surname_en": "Totapalli", "given_name_en": "Jayapralakshmi Sarala", "surname_te": "తోటపల్లి", "given_name_te": "జయప్రలక్ష్మి సరళ"},
            {"surname_raw": "తోటపల్లి", "given_name_raw": "శ్రీ సాయి సునీల్", "surname_en": "Totapalli", "given_name_en": "Sri Sai Sunil", "surname_te": "తోటపల్లి", "given_name_te": "శ్రీ సాయి సునీల్"},
            {"surname_raw": "బేడన", "given_name_raw": "నాగ వెంకట కృష్ణ", "surname_en": "Bedana", "given_name_en": "Naga Venkata Krishna", "surname_te": "బేడన", "given_name_te": "నాగ వెంకట కృష్ణ"},
            {"surname_raw": "తోటపల్లి", "given_name_raw": "హేమచంద్ర మల్లికార్జున రావు", "surname_en": "Totapalli", "given_name_en": "Hemachandra Mallikarjuna Rao", "surname_te": "తోటపల్లి", "given_name_te": "హేమచంద్ర మల్లికార్జున రావు"}
        ],
        "address": "తోటపల్లి, కౌతరపు రోడ్, కౌతవరం, కృష్ణా జిల్లా",
        "pincode": "533307",
        "phones": ["9908794696", "9652767626"],
        "abhishekam_from": "22-10-2025",
        "abhishekam_to": "20-11-2025",
        "amount_rupees": "1000-00"
    },
    "sample_img7": {
        "receipt_no": "5813",
        "date": "10/10/2025",
        "gothram_raw": "కాశ్యపస",
        "gothram_resolved": "KASHYAPA",
        "gothram_te": "కాశ్యప",
        "language": "te",
        "people": [
            {"surname_raw": "కోటినందిని", "given_name_raw": "సుబ్రహ్మణ్యం", "surname_en": "Kotinandini", "given_name_en": "Subrahmanyam", "surname_te": "కోటినందిని", "given_name_te": "సుబ్రహ్మణ్యం"},
            {"surname_raw": "కోటినందిని", "given_name_raw": "సత్యవతి", "surname_en": "Kotinandini", "given_name_en": "Satyavati", "surname_te": "కోటినందిని", "given_name_te": "సత్యవతి"},
            {"surname_raw": "కోటినందిని", "given_name_raw": "శ్రీనివాస్", "surname_en": "Kotinandini", "given_name_en": "Srinivas", "surname_te": "కోటినందిని", "given_name_te": "శ్రీనివాస్"}
        ],
        "address": "శ్రీనివాసపురం మండలం, అంగడం గ్రామం, కోనసీమ జిల్లా",
        "pincode": "533307",
        "phones": ["9603850122"],
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount_rupees": "1000-00"
    },
    "sample_img8": {
        "receipt_no": "5814",
        "date": "10/10/25",
        "gothram_raw": "మునుకుల",
        "gothram_resolved": "MUNUKULLA",
        "gothram_te": "మునుకుళ్ల",
        "language": "te/en",
        "people": [
            {"surname_raw": "గండి", "given_name_raw": "నమఃశివాయ", "surname_en": "Gandi", "given_name_en": "Namahsivaya", "surname_te": "గండి", "given_name_te": "నమఃశివాయ"},
            {"surname_raw": "గండి", "given_name_raw": "రత్నకుమారి", "surname_en": "Gandi", "given_name_en": "Ratnakumari", "surname_te": "గండి", "given_name_te": "రత్నకుమారి"},
            {"surname_raw": "గండి", "given_name_raw": "రామ్కుమార్", "surname_en": "Gandi", "given_name_en": "Ramkumar", "surname_te": "గండి", "given_name_te": "రామ్కుమార్"},
            {"surname_raw": "గండి", "given_name_raw": "పద్మావతి", "surname_en": "Gandi", "given_name_en": "Padmavati", "surname_te": "గండి", "given_name_te": "పద్మావతి"},
            {"surname_raw": "గండి", "given_name_raw": "కియాన్ష్", "surname_en": "Gandi", "given_name_en": "Kiyansh", "surname_te": "గండి", "given_name_te": "కియాన్ష్"},
            {"surname_raw": "గండి", "given_name_raw": "అయాన్ష్", "surname_en": "Gandi", "given_name_en": "Ayansh", "surname_te": "గండి", "given_name_te": "అయాన్ష్"}
        ],
        "address": "D.No: 4-16-4, Torronipeta, Near blind school, Mandapeta, East Godavari dist",
        "pincode": "533308",
        "phones": ["8099992999"],
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount_rupees": "1000-00"
    },
    "sample_img9": {
        "receipt_no": "5815",
        "date": "10/10/2025",
        "gothram_raw": "మార్కండేయ",
        "gothram_resolved": "MARKANDEYA",
        "gothram_te": "మార్కండేయ",
        "language": "te",
        "people": [
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటరమణ", "surname_en": "Lolla", "given_name_en": "Venkataramana", "surname_te": "లొల్ల", "given_name_te": "వెంకటరమణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వెంకటలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Venkatalakshmi", "surname_te": "లొల్ల", "given_name_te": "వెంకటలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సత్యనారాయణ", "surname_en": "Lolla", "given_name_en": "Veera Venkata Satyanarayana", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సత్యనారాయణ"},
            {"surname_raw": "లొల్ల", "given_name_raw": "కనకమహాలక్ష్మి", "surname_en": "Lolla", "given_name_en": "Kanakamahalakshmi", "surname_te": "లొల్ల", "given_name_te": "కనకమహాలక్ష్మి"},
            {"surname_raw": "లొల్ల", "given_name_raw": "వీర వెంకట సుబ్రహ్మణ్యం", "surname_en": "Lolla", "given_name_en": "Veera Venkata Subrahmanyam", "surname_te": "లొల్ల", "given_name_te": "వీర వెంకట సుబ్రహ్మణ్యం"}
        ],
        "address": "అంగర, K.P. పురం మండలం, కోనసీమ జిల్లా",
        "pincode": "533307",
        "phones": ["9963950472", "8897794815"],
        "abhishekam_from": "22/10/25",
        "abhishekam_to": "20/11/25",
        "amount_rupees": "1000-00"
    },
    "sample_img10": {
        "receipt_no": "5810",
        "date": "05-10-25",
        "gothram_raw": "పైడిపల్లి",
        "gothram_resolved": "PAIDIPALLI",
        "gothram_te": "పైడిపల్లి",
        "language": "te",
        "people": [
            {"surname_raw": "యడ్ల", "given_name_raw": "పట్టాభి రామయ్య", "surname_en": "Yadla", "given_name_en": "Pattabhi Ramayya", "surname_te": "యడ్ల", "given_name_te": "పట్టాభి రామయ్య"},
            {"surname_raw": "యడ్ల", "given_name_raw": "వరలక్ష్మి (ప్రసన్న)", "surname_en": "Yadla", "given_name_en": "Varalakshmi (Prasanna)", "surname_te": "యడ్ల", "given_name_te": "వరలక్ష్మి (ప్రసన్న)"},
            {"surname_raw": "యడ్ల", "given_name_raw": "శ్రీ చక్రధర్", "surname_en": "Yadla", "given_name_en": "Sri Chakradhar", "surname_te": "యడ్ల", "given_name_te": "శ్రీ చక్రధర్"},
            {"surname_raw": "యడ్ల", "given_name_raw": "శ్రీ వైష్ణవి", "surname_en": "Yadla", "given_name_en": "Sri Vaishnavi", "surname_te": "యడ్ల", "given_name_te": "శ్రీ వైష్ణవి"}
        ],
        "address": "D.No: 1-24, మెయిన్ రోడ్డు, పెట్రోల్ బంకు ప్రక్కన, అంగర",
        "pincode": "533307",
        "phones": ["9989496034"],
        "abhishekam_from": "22-10-25",
        "abhishekam_to": "20-11-25",
        "amount_rupees": "1000-00"
    },
    "sample_img11": {
        "receipt_no": "5811",
        "date": "10/10/2025",
        "gothram_raw": "ప్రగబలస",
        "gothram_resolved": "PAGADABALA",
        "gothram_te": "పగడబాల",
        "language": "te",
        "people": [
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "పుల్లయ్య", "surname_en": "Addepalli", "given_name_en": "Pullayya", "surname_te": "అద్దేపల్లి", "given_name_te": "పుల్లయ్య"},
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "రత్నవతి", "surname_en": "Addepalli", "given_name_en": "Ratnavati", "surname_te": "అద్దేపల్లి", "given_name_te": "రత్నవతి"},
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "నాగరాజు", "surname_en": "Addepalli", "given_name_en": "Nagaraju", "surname_te": "అద్దేపల్లి", "given_name_te": "నాగరాజు"},
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "సుబ్బలక్ష్మి", "surname_en": "Addepalli", "given_name_en": "Subbalakshmi", "surname_te": "అద్దేపల్లి", "given_name_te": "సుబ్బలక్ష్మి"},
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "సాయినాథ్ లిపిత్", "surname_en": "Addepalli", "given_name_en": "Sai Nath Lipith", "surname_te": "అద్దేపల్లి", "given_name_te": "సాయినాథ్ లిపిత్"},
            {"surname_raw": "అద్దేపల్లి", "given_name_raw": "సాయి లక్ష్మి గాయత్రీరాజ్", "surname_en": "Addepalli", "given_name_en": "Sai Lakshmi Gayatriraj", "surname_te": "అద్దేపల్లి", "given_name_te": "సాయి లక్ష్మి గాయత్రీరాజ్"}
        ],
        "address": "పెద్దాపురం, పెద్దాపురం మండలం, కాకినాడ జిల్లా",
        "pincode": None,
        "phones": ["7036075105", "7794026250"],
        "abhishekam_from": "22/10/2025",
        "abhishekam_to": "20/11/2025",
        "amount_rupees": "1000-00"
    }
}

for name, data in ground_truth.items():
    path = f"evals/expected/{name}.expected.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Generated {len(ground_truth)} verified golden dataset files in evals/expected/")
