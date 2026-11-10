import json

with open('telugu_english_handwriting_ocr -V2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

with open('nb_outputs_inspect.txt', 'w', encoding='utf-8') as out:
    for i, cell in enumerate(nb['cells']):
        outs = cell.get('outputs', [])
        if outs:
            out.write(f"=== Cell {i} Outputs ({len(outs)} outputs) ===\n")
            for o in outs:
                otype = o.get('output_type')
                if otype == 'stream':
                    txt = ''.join(o.get('text', []))
                    out.write(f"  [stream {o.get('name')}]\n{txt}\n")
                elif otype in ('execute_result', 'display_data'):
                    data = o.get('data', {})
                    keys = [k for k in data.keys() if k != 'image/jpeg' and k != 'image/png']
                    txt = ''.join(data.get('text/plain', []))
                    out.write(f"  [{otype}] keys={list(data.keys())} non-img={keys} text={txt}\n")
                elif otype == 'error':
                    out.write(f"  [error] {o.get('ename')}: {o.get('evalue')}\n")
print("Inspection written to nb_outputs_inspect.txt")
