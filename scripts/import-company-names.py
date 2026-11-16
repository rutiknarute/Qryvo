"""Import the supplied ID/name catalogue without changing saved group membership."""
import csv
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'data/company-names-source.csv'
with source.open(encoding='utf-8-sig', newline='') as stream:
    rows = list(csv.DictReader(stream))
seed = json.loads((root / 'src/data/seed.json').read_text())
expected = {company_id for group in seed['groups'] for company_id in group['company_ids']}
names = {}
seen = set()
for row in rows:
    company_id = row['linkedin_company_id'].strip()
    if not company_id.isascii() or not company_id.isdigit() or company_id in seen:
        raise ValueError(f'Invalid or duplicate company ID: {company_id}.')
    seen.add(company_id)
    name = row['company_name'].strip()
    if name:
        names[company_id] = name
if seen != expected:
    raise ValueError(f'CSV IDs differ from the saved catalogue: {len(expected - seen)} missing, {len(seen - expected)} extra.')
resolutions_path = root / 'data/company-name-resolutions.json'
if resolutions_path.exists():
    for record in json.loads(resolutions_path.read_text()):
        company_id = record['id']
        name = record['name'].strip()
        if company_id not in expected or not name or record['url'] != f'https://www.linkedin.com/company/{company_id}/':
            raise ValueError(f'Invalid company-page resolution: {company_id}.')
        if company_id in names and names[company_id] != name:
            raise ValueError(f'Conflicting company-page resolution: {company_id}.')
        names[company_id] = name
result = {
    'source': 'Qryvo_LinkedIn_839_Company_IDs_with_Researched_Names.csv',
    'row_count': len(rows),
    'named_row_count': len(names),
    'unresolved_row_count': len(rows) - len(names),
    'names': dict(sorted(names.items())),
}
(root / 'src/data/company-names.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(f'Imported {len(names)} names; {len(rows) - len(names)} unresolved. All {len(seen)} catalogue IDs match.')
