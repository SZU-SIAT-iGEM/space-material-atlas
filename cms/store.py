"""Versioned file store with optimistic concurrency and recoverable directory transactions."""
from __future__ import annotations
import contextlib
import copy
import json
import os
import shutil
import threading
import time
import uuid
from pathlib import Path
from .content import (FILES, OWNED, changes, compile_modules, digest, impact, load_modules,
                      read, save_modules, split, validate, valid_module_id, write)

class Conflict(ValueError):
    pass

class Store:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.directory = self.root / 'content'
        self.state = self.root / '.state'
        self.state.mkdir(exist_ok=True)
        self.mutex = threading.RLock()
        with self.lock():
            self.recover()

    @contextlib.contextmanager
    def lock(self):
        with self.mutex:
            with (self.state / 'content.lock').open('a+b') as f:
                if f.tell() == 0:
                    f.write(b'0'); f.flush()
                f.seek(0)
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
                else:
                    import fcntl
                    fcntl.flock(f, fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    f.seek(0)
                    if os.name == 'nt':
                        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        fcntl.flock(f, fcntl.LOCK_UN)

    def recover(self):
        journal = self.state / 'pending.json'
        if not journal.exists():
            return
        record = read(journal)
        transaction = self.state / 'transactions' / record['id']
        if not self.directory.exists() and (transaction / 'before').exists():
            (transaction / 'before').rename(self.directory)
        if not self.directory.exists():
            raise RuntimeError('Interrupted transaction: no recoverable content')
        history = self.state / 'history' / record['id']
        prepared = history / 'prepared.json'
        if prepared.exists() and digest(load_modules(self.directory)) == read(prepared)['next_revision']:
            prepared.replace(history / 'record.json')
        journal.unlink()

    def snapshot(self):
        with self.lock():
            self.recover()
            modules = load_modules(self.directory)
            return {'revision': digest(modules), 'modules': modules}

    def overview(self):
        current = self.snapshot()
        documents = compile_modules(current['modules'])
        counts = validate(documents)
        return {'revision': current['revision'], 'counts': counts,
                'modules': [{'id': k, 'count': len(v) if isinstance(v, list) else None}
                            for k, v in current['modules'].items()], 'documents': documents,
                'drafts': [{'id': p.relative_to(self.state / 'drafts').as_posix()[:-5],
                            'name': read(p).get('data', {}).get('roster', {}).get('name', p.stem)
                            if isinstance(read(p).get('data'), dict) else p.stem}
                           for p in sorted((self.state / 'drafts').rglob('*.json'))]}

    def proposal(self, current, updates):
        modules = copy.deepcopy(current['modules'])
        for key, value in updates.items():
            if not valid_module_id(key):
                raise ValueError('Unknown module: ' + key)
            if value is None:
                if not key.startswith('teams/'):
                    raise ValueError('Required collection cannot be removed')
                modules.pop(key, None)
            else:
                modules[key] = value
        documents = compile_modules(modules)
        counts = validate(documents)
        delta = changes(current['modules'], modules)
        identifiers = set()
        for change in delta:
            identifiers.update(change['path'].split('/'))
            for field in ('before', 'after'):
                value = change.get(field)
                if isinstance(value, dict) and 'id' in value:
                    identifiers.add(value['id'])
        before = compile_modules(current['modules'])
        affected_before = impact(before, identifiers)
        affected_after = impact(documents, identifiers)
        affected = {k: sorted(set(affected_before[k]) | set(affected_after[k])) for k in affected_before}
        return {'revision': current['revision'], 'next_revision': digest(modules), 'modules': modules,
                'changes': delta, 'impact': affected, 'counts': counts}

    def preview(self, revision, updates):
        current = self.snapshot()
        if revision != current['revision']:
            raise Conflict('内容已有更新，请重新载入后比较修改。')
        result = self.proposal(current, updates)
        return {k: v for k, v in result.items() if k != 'modules'}

    def apply(self, revision, updates, reason):
        if not reason.strip():
            raise ValueError('请填写修改原因。')
        with self.lock():
            self.recover()
            modules = load_modules(self.directory)
            current = {'revision': digest(modules), 'modules': modules}
            if revision != current['revision']:
                raise Conflict('内容已有更新，请重新载入后比较修改。')
            proposed = self.proposal(current, updates)
            if not proposed['changes']:
                return {k: v for k, v in proposed.items() if k != 'modules'}
            id_ = time.strftime('%Y%m%dT%H%M%S', time.gmtime()) + '-' + uuid.uuid4().hex[:10]
            folder = self.state / 'transactions' / id_
            save_modules(folder / 'after', proposed['modules'])
            record = {'id': id_, 'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                      'reason': reason, **{k: v for k, v in proposed.items() if k != 'modules'}}
            # Persist both sides before changing the active pointer.
            history = self.state / 'history' / id_
            save_modules(history / 'before', modules)
            save_modules(history / 'content', proposed['modules'])
            write(history / 'prepared.json', record)
            write(self.state / 'pending.json', {'id': id_})
            self.directory.rename(folder / 'before')
            try:
                (folder / 'after').rename(self.directory)
            except Exception:
                (folder / 'before').rename(self.directory)
                raise
            (history / 'prepared.json').rename(history / 'record.json')
            (self.state / 'pending.json').unlink()
            for key in updates:
                (self.state / 'drafts' / (key + '.json')).unlink(missing_ok=True)
            return {k: v for k, v in record.items() if k != 'modules'}

    def history(self):
        return [read(p) for p in sorted((self.state / 'history').glob('*/record.json'), reverse=True)]

    def draft(self, key, payload=None):
        if not valid_module_id(key):
            raise ValueError('Invalid module')
        path = self.state / 'drafts' / (key + '.json')
        if payload is not None:
            with self.lock():
                temporary = path.with_suffix('.pending')
                write(temporary, payload)
                temporary.replace(path)
        return read(path) if path.exists() else None

    def import_updates(self, payload):
        current = self.snapshot()
        docs = compile_modules(current['modules'])
        if 'filename' in payload:
            if payload['filename'] not in FILES:
                raise ValueError('Unknown business JSON file')
            docs[payload['filename']] = copy.deepcopy(payload['data'])
        elif payload.get('format') == 'space-atlas-team-bundle-1':
            team = payload['team']; tid = team['id']
            p = docs['projects.json']
            # A bundle represents the complete team: omitted branches are shown as removals.
            if not all(isinstance(payload.get(key), list) for key in (*OWNED, 'sources')):
                raise ValueError('队伍 bundle 必须包含全部集合。')
            p['teams'] = [t for t in p['teams'] if t['id'] != tid] + [copy.deepcopy(team)]
            for key in OWNED:
                p[key] = [x for x in p[key] if x.get('owner') != tid] + copy.deepcopy(payload[key])
            others = [x for key in (*OWNED, 'teams') for x in p[key] if x.get('owner', x.get('id')) != tid]
            foreign_sources = {sid for x in others for sid in x.get('source_ids', [])}
            sources = {s['id']: s for s in p['sources']}
            for source in payload['sources']:
                sid = source['id']
                if sid in foreign_sources and sid in sources and sources[sid] != source:
                    raise ValueError('共享来源需在来源管理中修改：' + sid)
                sources[sid] = copy.deepcopy(source)
            p['sources'] = list(sources.values())
            if tid not in {t['id'] for t in docs['roster.json']['teams']}:
                docs['roster.json']['teams'].append({'id': tid, 'year': team['year'], 'name': team['name'],
                                                    'wiki': team.get('url', ''), 'integrated': True})
        elif 'baseline' in payload and 'projects' in payload:
            docs['baseline.json'] = copy.deepcopy(payload['baseline'])
            docs['projects.json'] = copy.deepcopy(payload['projects'])
            if 'roster' in payload: docs['roster.json'] = copy.deepcopy(payload['roster'])
            if 'config' in payload: docs['site-config.json'] = copy.deepcopy(payload['config'])
        elif all(name in payload for name in FILES):
            docs = copy.deepcopy(payload)
        else:
            raise ValueError('无法识别导入文件，请选择业务 JSON 文件类型，或导入完整图谱/队伍 bundle。')
        # Normalize derived coverage and roster flags before saving, so repeating
        # the same complete-team import has no second metadata-only change.
        proposed = split(compile_modules(split(docs)))
        # Keep historical ordering for stable layouts; append new IDs deterministically.
        proposed['manifest']['order'] = current['modules']['manifest']['order']
        updates = {key: proposed.get(key) for key in proposed.keys() | current['modules'].keys()
                   if proposed.get(key) != current['modules'].get(key)}
        return {'revision': current['revision'], 'updates': updates,
                'preview': self.preview(current['revision'], updates)}

    def merge_node_updates(self, old, new):
        current = self.snapshot()
        docs = compile_modules(current['modules'])
        b, p = docs['baseline.json'], docs['projects.json']
        nodes = {n['id']: n for n in b['nodes'] + p['nodes']}
        if old == new or old not in nodes or new not in nodes:
            raise ValueError('请选择两个不同的现有节点。')
        for d in (b, p):
            d['nodes'] = [n for n in d['nodes'] if n['id'] != old]
            for key in ('edges', 'dependencies', 'enhancements'):
                for edge in d.get(key, []):
                    for end in ('source', 'target'):
                        if edge[end] == old: edge[end] = new
                    if edge['source'] == edge['target']:
                        raise ValueError('合并会产生自连接，请先调整关系：' + edge['id'])
        for team in p['teams']:
            for chain in team['chains']:
                for key in ('step_ids', 'dependencies'):
                    chain[key] = list(dict.fromkeys(new if n == old else n for n in chain[key]))
        return self.import_updates(docs)

    def restore_updates(self, modules):
        current = self.snapshot()
        updates = {k: modules.get(k) for k in current['modules'].keys() | modules.keys()}
        return {'revision': current['revision'], 'updates': updates,
                'preview': self.preview(current['revision'], updates)}
