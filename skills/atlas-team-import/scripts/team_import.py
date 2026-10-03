"""Document extraction and complete-team imports against live managed content."""
import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

def output(path, value):
    text = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    if path:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(text, encoding='utf8')
    else:
        print(text)

def extract(path):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    result = {'filename': Path(path).name, 'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(), 'paragraphs': [], 'links': [], 'nontext_parts': []}
    with ZipFile(path) as z:
        for name in z.namelist():
            if name.startswith(('word/media/', 'word/embeddings/', 'word/charts/')):
                result['nontext_parts'].append(name)
            if name in ('word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml') or name.startswith(('word/header', 'word/footer')) and name.endswith('.xml'):
                root = ET.fromstring(z.read(name))
                for index, p in enumerate(root.findall('.//w:p', ns)):
                    text = ''.join(t.text or '' for t in p.findall('.//w:t', ns))
                    if text.strip(): result['paragraphs'].append({'part': name, 'index': index, 'text': text})
            if name.startswith('word/') and name.endswith('.rels'):
                for rel in ET.fromstring(z.read(name)):
                    if rel.get('TargetMode') == 'External':
                        result['links'].append({'part': name, 'id': rel.get('Id'), 'url': rel.get('Target')})
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atlas', type=Path, required=True)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('extract'); s.add_argument('--docx', required=True); s.add_argument('--out', required=True)
    s = sub.add_parser('catalog'); s.add_argument('--query', default=''); s.add_argument('--out')
    s = sub.add_parser('compile'); s.add_argument('--plan', required=True); s.add_argument('--nodes', required=True); s.add_argument('--out', required=True)
    s = sub.add_parser('export'); s.add_argument('--id', required=True); s.add_argument('--out', required=True)
    s = sub.add_parser('check'); s.add_argument('--bundle', required=True); s.add_argument('--out'); s.add_argument('--build-out')
    s = sub.add_parser('apply'); s.add_argument('--bundle', required=True); s.add_argument('--revision', required=True); s.add_argument('--reason', required=True)
    args = parser.parse_args()
    if args.command == 'extract': output(args.out, extract(args.docx)); return
    root = args.atlas.resolve()
    if not (root/'content/manifest.json').exists(): raise ValueError('Select a managed atlas project')
    sys.path.insert(0, str(root))
    from cms.content import compile_modules, read
    from cms.store import Store, Conflict
    store = Store(root); snap = store.snapshot(); docs = compile_modules(snap['modules'])
    b, p = docs['baseline.json'], docs['projects.json']
    if args.command == 'catalog':
        records = [{**t, 'atlas_status': 'integrated' if any(x['id']==t['id'] for x in p['teams']) else 'awaiting_additions'} for t in docs['roster.json']['teams']]
        matches = lambda x: args.query.casefold() in json.dumps(x, ensure_ascii=False).casefold()
        complexity = [{'id':t['id'],'name':t['name'],'nodes':sum(x.get('owner')==t['id'] for x in p['nodes']),'relations':sum(x.get('owner')==t['id'] for k in ('edges','dependencies','enhancements') for x in p[k]),'routes':len(t['chains'])} for t in p['teams']]
        output(args.out, {'revision': snap['revision'], 'teams': list(filter(matches, records)), 'nodes': list(filter(matches, b['nodes']+p['nodes'])), 'themes': b['themes'], 'existing_complexity':complexity, 'unlisted_status': 'future_outlook'}); return
    spec = importlib.util.spec_from_file_location('atlas_json', root/'skills/atlas-json-author/scripts/atlas_json.py')
    author = importlib.util.module_from_spec(spec); spec.loader.exec_module(author)
    if args.command == 'compile': bundle = author.compile_plan(read(args.plan), read(args.nodes), b, p)
    elif args.command == 'export':
        team = next(t for t in p['teams'] if t['id']==args.id)
        bundle = {'format': 'space-atlas-team-bundle-1', 'team': team}
        for k in ('nodes','edges','dependencies','enhancements'): bundle[k]=[x for x in p[k] if x.get('owner')==args.id]
        used = {sid for x in [team,*bundle['nodes'],*bundle['edges'],*bundle['dependencies'],*bundle['enhancements']] for sid in x.get('source_ids',[])}
        bundle['sources']=[s for s in p['sources'] if s['id'] in used]
    else: bundle = read(args.bundle)
    author.validate(root, b, p, bundle)
    proposal = store.import_updates(bundle)
    if proposal['revision'] != snap['revision']: raise Conflict('Content changed during preparation; retry with fresh content')
    if args.command == 'apply':
        if args.revision != proposal['revision']: raise Conflict('Content changed; run check again')
        output(None, store.apply(args.revision, proposal['updates'], args.reason))
    elif args.command == 'check':
        report = proposal['preview']
        report['team_complexity'] = {'nodes':len(bundle['nodes']), 'relations':sum(len(bundle[k]) for k in ('edges','dependencies','enhancements')), 'routes':len(bundle['team']['chains'])}
        if args.build_out:
            from cms.build import build
            candidate = store.proposal(snap, proposal['updates'])['modules']
            built = build(root, candidate, root/args.build_out)
            report['trial_build'] = {'id': built['id'], 'counts': built['report']['counts'], 'geometry': built['report']['geometry']}
        output(args.out, report)
    else: output(args.out, bundle)

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf8')
    try: main()
    except (ValueError, KeyError, StopIteration) as e:
        print(str(e) or 'Team not found', file=sys.stderr); sys.exit(1)
