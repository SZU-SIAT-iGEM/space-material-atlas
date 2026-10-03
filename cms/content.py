"""Lossless modular content compiler; no web server dependency."""
from __future__ import annotations
import copy
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import atlas
import build_release

FILES = ('baseline.json', 'projects.json', 'roster.json', 'site-config.json')
OWNED = ('nodes', 'edges', 'dependencies', 'enhancements')
COLLECTIONS = {
    'baseline/themes': ('baseline.json', 'themes'),
    'baseline/nodes': ('baseline.json', 'nodes'),
    'baseline/edges': ('baseline.json', 'edges'),
    'sources/baseline': ('baseline.json', 'sources'),
    'shared/nodes': ('projects.json', 'nodes'),
    'sources/projects': ('projects.json', 'sources'),
}
TEAM_ID = re.compile(r'^\d{4}-[A-Za-z0-9_-]+$')

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def load_legacy(root):
    return {name: read(Path(root) / name) for name in FILES}

def split(documents):
    """Retain original metadata, values and collection order, including roster-only teams."""
    docs = copy.deepcopy(documents)
    b, p, r = (docs[n] for n in FILES[:3])
    modules = {}
    for module, (filename, key) in COLLECTIONS.items():
        values = docs[filename][key]
        modules[module] = [x for x in values if not x.get('owner')] if module == 'shared/nodes' else values
    by_team = {t['id']: t for t in p['teams']}
    by_roster = {t['id']: t for t in r['teams']}
    for tid in sorted(by_team.keys() | by_roster.keys()):
        if not TEAM_ID.fullmatch(tid):
            raise ValueError('Invalid team ID: ' + tid)
        team = by_team.get(tid)
        module = {'roster': by_roster.get(tid), 'team': team}
        module.update({key: [x for x in p[key] if x.get('owner') == tid] for key in OWNED})
        modules[f'teams/{tid[:4]}/{tid}'] = module
    # Preserve unowned relations too: migration must never discard valid input.
    modules['shared/relations'] = {key: [x for x in p[key] if not x.get('owner')] for key in OWNED[1:]}
    metadata, order = {}, {}
    for filename in FILES[:3]:
        metadata[filename] = {}
        for key, value in docs[filename].items():
            if isinstance(value, list) and (key in ('teams', 'nodes', 'edges', 'dependencies', 'enhancements', 'sources', 'themes')):
                order[f'{filename}/{key}'] = [x['id'] for x in value]
            else:
                metadata[filename][key] = value
    modules['site/config'] = docs['site-config.json']
    modules['manifest'] = {'format': 'space-atlas-content-1', 'metadata': metadata, 'order': order}
    return modules

def load_modules(directory):
    directory = Path(directory)
    return {p.relative_to(directory).with_suffix('').as_posix(): read(p)
            for p in sorted(directory.rglob('*.json'))}

def save_modules(directory, modules):
    for name, value in modules.items():
        if not valid_module_id(name):
            raise ValueError('Invalid module path: ' + name)
        write(Path(directory) / (name + '.json'), value)

def valid_module_id(name):
    return name in {*COLLECTIONS, 'shared/relations', 'site/config', 'manifest'} or bool(re.fullmatch(r'teams/\d{4}/\d{4}-[A-Za-z0-9_-]+', name))

def compile_modules(modules):
    m = modules.get('manifest', {})
    if m.get('format') != 'space-atlas-content-1':
        raise ValueError('Unsupported content format')
    unknown = [k for k in modules if not valid_module_id(k)]
    if unknown:
        raise ValueError('Unknown modules: ' + ', '.join(unknown))
    docs = copy.deepcopy(m['metadata'])
    b, p, r = (docs[n] for n in FILES[:3])
    for filename in FILES[:3]:
        for path in m['order']:
            if path.startswith(filename + '/'):
                docs[filename][path.split('/', 1)[1]] = []
    for module, (filename, key) in COLLECTIONS.items():
        docs[filename][key] = copy.deepcopy(modules[module])
    for key in OWNED[1:]:
        p[key] = copy.deepcopy(modules['shared/relations'][key])
    p['teams'], r['teams'] = [], []
    for name, value in sorted(modules.items()):
        if not name.startswith('teams/'):
            continue
        tid = name.rsplit('/', 1)[1]
        if name.split('/')[1] != tid[:4]:
            raise ValueError(f'{name}: directory year differs from ID')
        for field in ('team', 'roster'):
            t = value.get(field)
            if t and (t['id'] != tid or t['year'] != int(tid[:4])):
                raise ValueError(f'{name}: {field} ID/year differs from module')
        if value.get('roster'):
            r['teams'].append(copy.deepcopy(value['roster']))
        if value.get('team'):
            p['teams'].append(copy.deepcopy(value['team']))
        for key in OWNED:
            for item in value[key]:
                if item.get('owner') != tid:
                    raise ValueError(f'{name}/{key}: foreign or missing owner')
            p[key].extend(copy.deepcopy(value[key]))
    for filename in FILES[:3]:
        for key, values in docs[filename].items():
            if not isinstance(values, list) or f'{filename}/{key}' not in m['order']:
                continue
            rank = {id_: i for i, id_ in enumerate(m['order'][f'{filename}/{key}'])}
            values.sort(key=lambda x: (rank.get(x['id'], len(rank)), x['id']))
    p['coverage']['teams'] = len(p['teams'])
    p['coverage']['years'] = sorted({t['year'] for t in p['teams']})
    integrated = {t['id'] for t in p['teams']}
    for t in r['teams']:
        t['integrated'] = t['id'] in integrated
    docs['site-config.json'] = copy.deepcopy(modules['site/config'])
    return docs

def validate(documents):
    """Release rules plus cross-module integrity. Errors are actionable JSON paths."""
    b, p, roster = (documents[n] for n in FILES[:3])
    errors = []
    try:
        build_release.check_data(b, p)
        for name, records in [('nodes', b['nodes'] + p['nodes']), ('relations', atlas.all_relations(b,p)),
                              ('themes',b['themes']), ('sources',b['sources']+p['sources']),
                              ('routes',[c for t in p['teams'] for c in t['chains']])]:
            seen=set()
            for record in records:
                identifier=record.get('id','')
                if not isinstance(identifier,str) or not re.fullmatch(r'[A-Za-z0-9_:.-]+',identifier):
                    errors.append(f'{name}: unsafe or empty ID {identifier}')
                if identifier in seen: errors.append(f'{name}: duplicate ID {identifier}')
                seen.add(identifier)
        for filename, obj in documents.items():
            build_release.scan(obj, filename)
        ids = {}
        for name, values in [('sources', b['sources'] + p['sources']), ('roster', roster['teams'])]:
            seen = set()
            for item in values:
                id_ = item.get('id')
                if not id_ or id_ in seen:
                    errors.append(f'{name}: duplicate or empty ID {id_}')
                seen.add(id_)
            ids[name] = seen
        nodes = {n['id']: n for n in b['nodes'] + p['nodes']}
        relations = {e['id']: e for e in atlas.all_relations(b, p)}
        route_owners = {c['id']: t['id'] for t in p['teams'] for c in t['chains']}
        for theme in b['themes']:
            if not re.fullmatch(r'[A-Za-z0-9_-]+',theme['id']) or theme['id'] in {'overview','effects','remote'} or not atlas.label_ok(theme.get('label')):
                errors.append(f'themes/{theme["id"]}: reserved ID or missing bilingual label')
            if not re.fullmatch(r'#[0-9a-fA-F]{6}', theme.get('color', '')):
                errors.append(f'themes/{theme["id"]}/color: use a six-digit hex color')
        for entry in roster['teams']:
            if not TEAM_ID.fullmatch(entry['id']) or entry.get('year') != int(entry['id'][:4]) or not entry.get('name','').strip():
                errors.append(f'roster/{entry["id"]}: invalid ID, year or name')
        for item in [*nodes.values(), *relations.values()]:
            if item.get('route') and route_owners.get(item['route']) != item.get('owner'):
                errors.append(f'record/{item["id"]}: route belongs to another team')
        for node in nodes.values():
            for sid in node.get('source_ids', []):
                if sid not in ids['sources']:
                    errors.append(f'nodes/{node["id"]}/source_ids: missing {sid}')
        for team in p['teams']:
            tid = team['id']
            if not TEAM_ID.fullmatch(tid) or team.get('year') != int(tid[:4]):
                errors.append(f'teams/{tid}: invalid ID/year')
            if tid not in ids['roster']:
                errors.append(f'teams/{tid}: missing roster entry')
            if not team['chains']:
                errors.append(f'teams/{tid}: add a route before applying; incomplete projects can be saved as drafts')
            for route in team['chains']:
                if 'label' in route and not atlas.label_ok(route['label']):
                    errors.append(f'routes/{route["id"]}: missing bilingual label')
                if not route['step_ids']:
                    errors.append(f'routes/{route["id"]}: add at least one step; incomplete routes can be saved as drafts')
                for rid in route['edge_ids']:
                    if relations[rid].get('owner') != tid:
                        errors.append(f'routes/{route["id"]}: foreign relation {rid}')
                for nid in route['dependencies']:
                    if nid not in nodes or nodes[nid]['kind'] != 'process':
                        errors.append(f'routes/{route["id"]}: missing process {nid}')
        for rid in b['overview_edge_ids']:
            if rid not in {e['id'] for e in b['edges']}:
                errors.append(f'overview_edge_ids: missing {rid}')
        def urls(obj, path=''):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k in ('url', 'wiki', 'display_url', 'canonical_url') and isinstance(v, str) and v and not re.match(r'^(https?://|mailto:)', v, re.I):
                        errors.append(f'{path}/{k}: unsupported URL')
                    urls(v, path + '/' + k)
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    urls(v, f'{path}/{i}')
        urls(documents)
    except (KeyError, TypeError, ValueError, AttributeError) as e:
        errors.append(str(e))
    if errors:
        raise ValueError('\n'.join(errors))
    return {'teams': len(p['teams']), 'roster': len(roster['teams']),
            'nodes': len(b['nodes']) + len(p['nodes']), 'relations': len(atlas.all_relations(b, p)),
            'sources': len(b['sources']) + len(p['sources']), 'years': p['coverage']['years']}

def changes(before, after, path=''):
    """Bounded-by-content structural diff; lists with IDs are compared by identity."""
    if before == after:
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        result = []
        for key in sorted(before.keys() | after.keys()):
            if key not in before:
                result.append({'path': path + '/' + key, 'kind': 'added', 'after': after[key]})
            elif key not in after:
                result.append({'path': path + '/' + key, 'kind': 'removed', 'before': before[key]})
            else:
                result.extend(changes(before[key], after[key], path + '/' + key))
        return result
    if isinstance(before, list) and isinstance(after, list) and all(isinstance(v, dict) and 'id' in v for v in before + after):
        return changes({v['id']: v for v in before}, {v['id']: v for v in after}, path)
    return [{'path': path, 'kind': 'changed', 'before': before, 'after': after}]

def impact(documents, identifiers):
    b, p = documents['baseline.json'], documents['projects.json']
    identifiers = set(identifiers)
    identifiers |= {n['id'] for n in b['nodes']+p['nodes']
                    if identifiers.intersection([n.get('owner'), n.get('route'), n.get('theme')])}
    links = [e for e in atlas.all_relations(b, p) if identifiers.intersection([e['id'], e['source'], e['target'], *e.get('source_ids', [])])]
    nodes = [n for n in b['nodes'] + p['nodes'] if identifiers.intersection([n['id'], *n.get('source_ids', [])])]
    touched = identifiers | {n['id'] for n in nodes}
    links += [e for e in atlas.all_relations(b, p) if touched.intersection([e['source'], e['target']])]
    owners = {e.get('owner') for e in links} | {n.get('owner') for n in nodes}
    teams = [t['id'] for t in p['teams'] if t['id'] in owners or identifiers.intersection([t['id'], *t.get('source_ids', [])])]
    routes = sorted({e['route'] for e in links if e.get('route')})
    views = [v for v in ['overview', 'effects', *atlas.theme_views(b)] if any(e['id'] in {x['id'] for x in links} for e in atlas.projection(b, p, v)['edges'])]
    return {'teams': sorted(teams), 'routes': routes, 'views': views, 'relations': sorted({e['id'] for e in links})}
