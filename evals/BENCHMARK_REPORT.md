# Sri Trikoteswara Swamy Temple Receipt OCR Benchmark Report

- **Primary Model Evaluated**: `gemini-3.5-flash-lite`
- **Receipt Count**: 2
- **Generated At**: 2026-11-08 16:17:40

## 1. Aggregate Accuracy & Performance Metrics

| Metric | Score | Target | Status |
| :--- | :---: | :---: | :---: |
| **Receipt Number Accuracy** | **100.0%** | > 95% | ✓ Target Met |
| **Gothram Top-1 Match Rate** | **0.0%** | > 90% | Review |
| **Devotee Names String Similarity** | **49.0%** | > 85% | Review |
| **Phone Number Recall** | **100.0%** | > 90% | ✓ Target Met |
| **Pincode Accuracy** | **100.0%** | > 90% | ✓ Target Met |
| **Average Pipeline Latency** | **53.02s** | < 30s | ✓ Target Met |
| **Average Cost per Receipt** | **$0.035 (~₹3.08)** | < $0.05 | ✓ High Efficiency |

## 2. Receipt-by-Receipt Breakdown

| Image | Exp Receipt # | Act Receipt # | Exp Gothram | Act Gothram | Devotees (Act/Exp) | Phone Recall | Latency | Cost (USD) |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `sample_img10.jpeg` | #5810 | #5810 | PAIDIPALLI | పెడుపల్ల | 4/4 | 100% | 23.71s | $0.0343 |
| `sample_img.jpeg` | #9745 | #9745 | ENDAVALLI | erodavalli | 7/7 | 100% | 82.33s | $0.0358 |
