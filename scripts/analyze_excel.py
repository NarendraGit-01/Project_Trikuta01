import openpyxl, re
from collections import Counter

wb = openpyxl.load_workbook('Gothrams-Surname List.xlsx', read_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
wb.close()

header = rows[0]
data = rows[1:]

print(f"Header: {header}")
print(f"Total data rows: {len(data)}")

# Column analysis
col0_vals = [r[0] for r in data if r and len(r) > 0 and r[0] is not None]
col1_vals = [r[1] for r in data if r and len(r) > 1 and r[1] is not None]
col2_vals = [r[2] for r in data if r and len(r) > 2 and r[2] is not None]

print(f"Col 0 (Combined): total={len(col0_vals)}, unique={len(set(col0_vals))}")
print(f"Col 1 (Gothram):  total={len(col1_vals)}, unique={len(set(col1_vals))}")
print(f"Col 2 (Surname):  total={len(col2_vals)}, unique={len(set(col2_vals))}")

# Check clean gothrams
gothram_clean = [str(g).strip().upper() for g in col1_vals]
unique_gothrams = sorted(set(gothram_clean))
print(f"Unique normalized gothrams: {len(unique_gothrams)}")

# Check clean surnames
surname_clean = [str(s).strip().upper() for s in col2_vals]
unique_surnames = sorted(set(surname_clean))
print(f"Unique normalized surnames: {len(unique_surnames)}")

# Look for anomalies in Gothrams
anomalies = []
for g in unique_gothrams:
    if not re.fullmatch(r'[A-Z]+', g):
        anomalies.append(g)
print(f"\nNon-alphabetic Gothram entries ({len(anomalies)}):")
for a in anomalies[:30]:
    print(f"  {a}")

# Check Gothrams per surname distribution
surname_to_gothrams = {}
for g, s in zip(gothram_clean, surname_clean):
    surname_to_gothrams.setdefault(s, set()).add(g)

counts = [len(gs) for gs in surname_to_gothrams.values()]
print(f"\nSurnames having multiple gothrams:")
counter = Counter(counts)
for c in sorted(counter.keys())[:10]:
    print(f"  Surnames mapped to {c} gothram(s): {counter[c]}")

# Top surnames with most gothrams
top_surnames = sorted(surname_to_gothrams.items(), key=lambda x: -len(x[1]))[:5]
print("\nTop 5 surnames with multiple gothrams:")
for s, gs in top_surnames:
    print(f"  {s}: {len(gs)} gothrams -> {sorted(list(gs))[:5]}...")

# Top gothrams with most surnames
gothram_to_surnames = {}
for g, s in zip(gothram_clean, surname_clean):
    gothram_to_surnames.setdefault(g, set()).add(s)

top_gothrams = sorted(gothram_to_surnames.items(), key=lambda x: -len(x[1]))[:5]
print("\nTop 5 gothrams with most surnames:")
for g, ss in top_gothrams:
    print(f"  {g}: {len(ss)} surnames -> {sorted(list(ss))[:5]}...")
