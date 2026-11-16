"""Import supplied company names after checking every group, position, and ID."""
import csv
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'data/company-names-source.csv'
rows = list(csv.DictReader(source.open(encoding='utf-8-sig', newline='')))
seed = json.loads((root / 'src/data/seed.json').read_text())
expected = [(g['id'], str(i), company_id) for g in seed['groups'] for i, company_id in enumerate(g['company_ids'], 1)]
actual = [(r['group_id'], r['position_in_group'], r['linkedin_company_id']) for r in rows]
if actual != expected:
    raise ValueError('CSV group membership, position, or ordered company IDs differ from the saved catalogue.')
names = {}
for row in rows:
    company_id = row['linkedin_company_id']
    name = row['company_name'].strip()
    if not name:
        continue
    if company_id in names and names[company_id] != name:
        raise ValueError(f'Conflicting company names for ID {company_id}.')
    names[company_id] = name
result = {
    'source': 'company-names-source.csv',
    'row_count': len(rows),
    'named_row_count': sum(bool(r['company_name'].strip()) for r in rows),
    'names': dict(sorted(names.items())),
}
(root / 'src/data/company-names.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(f"Imported {len(names)} distinct company names across {result['named_row_count']} named rows; all {len(rows)} group entries match.")
