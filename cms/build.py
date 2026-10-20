"""Reproducible static builds and self-contained, immutable release archives."""
from __future__ import annotations
import hashlib
import copy
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
from pathlib import Path
from .content import FILES, compile_modules, digest, load_modules, read, save_modules, validate, write
from .store import Store

SOURCE_DIRS = ('cms', 'admin', 'web', 'scripts', 'assets', 'vendor', 'skills', 'tests', 'ci', 'docs', 'layout-reference')
SOURCE_FILES = ('manage.py', 'requirements.txt', 'requirements-dev.txt', 'requirements-lock.txt',
                '.gitlab-ci.yml', '.gitignore', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'start-admin.cmd', 'deployment.json',
                '文本校对与队伍导出说明.md', 'JSON与展示模式使用说明.md')

def copy_sources(root, destination):
    root, destination = Path(root), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    for name in SOURCE_DIRS:
        if (root / name).exists():
            shutil.copytree(root / name, destination / name, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for name in SOURCE_FILES:
        if (root / name).exists(): shutil.copyfile(root / name, destination / name)
    # Capture deployment inputs in the exported source as well as the staged build.
    config = read(root / 'deployment.json') if (root / 'deployment.json').exists() else {}
    if os.environ.get('ATLAS_BRAND_URL'):
        config.update(profile='igem', brand_asset_url=os.environ['ATLAS_BRAND_URL'])
    if config.get('profile') == 'igem':
        from urllib.parse import urlparse
        url = urlparse(config.get('brand_asset_url') or '')
        if url.scheme != 'https' or url.netloc != 'static.igem.wiki':
            raise ValueError('iGEM builds require the uploaded icon URL on https://static.igem.wiki in ATLAS_BRAND_URL or deployment.json')
    write(destination / 'deployment.json', config)

def archive(directory, target):
    """Stable paths, timestamps and ordering. No host paths in generated archives."""
    target = Path(target); target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(Path(directory).rglob('*')):
            if p.is_file():
                info = zipfile.ZipInfo(p.relative_to(directory).as_posix(), (2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, p.read_bytes())
    return target

def hashes(directory):
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(Path(directory).rglob('*')) if p.is_file() and '__pycache__' not in p.parts}

def run(command, cwd, log):
    proc = subprocess.run(command, cwd=cwd, encoding='utf8', errors='replace',
                          env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONDONTWRITEBYTECODE': '1'},
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=900)
    log.append({'command': command, 'output': proc.stdout, 'exit_code': proc.returncode})
    if proc.returncode:
        raise ValueError(proc.stdout[-16000:])
    return proc.stdout

def build(root, modules=None, output=None, check=True):
    root = Path(root).resolve()
    modules = modules if modules is not None else Store(root).snapshot()['modules']
    documents = compile_modules(modules); counts = validate(documents)
    revision = digest(modules)
    id_ = time.strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:8]
    stage = root / '.build' / id_; stage.mkdir(parents=True)
    copy_sources(root, stage)
    save_modules(stage / 'content', modules)
    for filename, obj in documents.items(): write(stage / 'data' / filename, obj)
    previous = None
    last = root / '.state/last-build.json'
    if last.exists():
        previous = read(last)
        old_layouts = root / '.build' / previous['id'] / 'layouts'
        if old_layouts.exists():
            (stage / 'layouts').mkdir()
            # Retain only current views. Fingerprints check every cached scene.
            views = {'overview', 'effects', *[t['id'] for t in documents['baseline.json']['themes']]}
            for p in old_layouts.glob('*.json'):
                if read(p).get('view') in views: shutil.copyfile(p, stage / 'layouts' / p.name)
    log = []
    try:
        run([sys.executable, '-B', 'scripts/build_release.py'], stage, log)
        run([sys.executable, '-B', 'scripts/check_geometry.py'], stage, log)
        if check:
            for command in [['node', 'scripts/test_core.cjs'], ['node', 'scripts/test_viewport.cjs'], ['node', 'tests/test_team_status.cjs'],
                            [sys.executable, '-B', 'scripts/test_release.py'], [sys.executable, '-B', 'scripts/test_json_skill.py']]:
                run(command, stage, log)
        geometry = read(stage / 'geometry-check.json')
        layout_summary = {p.stem: {k: read(p)[k] for k in ('width', 'height', 'fingerprint')}
                          for p in (stage / 'layouts').glob('*.json')}
        report = {'revision': revision, 'counts': counts, 'geometry': geometry,
                  'layouts': layout_summary, 'artifacts': hashes(stage / 'public'), 'checks': log}
        prior = previous.get('report', {}) if previous else {}
        report['comparison'] = {'previous_revision': previous['revision'] if previous else None,
            'layouts': {name: {'reused': value['fingerprint'] == prior.get('layouts', {}).get(name, {}).get('fingerprint'),
                'width_delta': value['width'] - prior.get('layouts', {}).get(name, {}).get('width', value['width']),
                'height_delta': value['height'] - prior.get('layouts', {}).get(name, {}).get('height', value['height'])}
                for name, value in layout_summary.items()},
            'overview_before': prior.get('geometry', {}).get('overview_comparison', {}),
            'overview_after': geometry.get('overview_comparison', {})}
        # A successful build becomes visible as a directory transaction; previous build is retained.
        if output is not None:
            dest = Path(output).resolve()
            if dest == root or root not in dest.parents or dest.name in SOURCE_DIRS or dest.name in ('content', 'data'):
                raise ValueError('Build output must be a dedicated directory inside the project')
            prepared = stage / 'publish'; shutil.copytree(stage / 'public', prepared)
            backup = stage / 'previous-public'
            if dest.exists(): dest.rename(backup)
            try: prepared.rename(dest)
            except Exception:
                if backup.exists(): backup.rename(dest)
                raise
        write(stage / 'build-report.json', report)
        write(root / '.state' / 'last-build.json', {'id': id_, 'revision': revision, 'report': report})
        return {'id': id_, 'revision': revision, 'stage': str(stage), 'report': report}
    except Exception as e:
        write(stage / 'failure.json', {'error': str(e), 'checks': log})
        raise

def export_source(root, modules, target):
    root = Path(root).resolve()
    folder = root / '.build' / ('source-' + uuid.uuid4().hex)
    copy_sources(root, folder)
    save_modules(folder / 'content', modules)
    write(folder / 'source-manifest.json', {'format': 'space-atlas-source-1', 'version': modules['site/config']['version'], 'content_revision': digest(modules),
                                          'counts': validate(compile_modules(modules)), 'source_hashes': hashes(folder)})
    return archive(folder, target)

def release_identity(name):
    import re
    match = re.fullmatch(r'i(\d{4})\.([PR])(0|[1-9]\d*)\.(0|[1-9]\d*)', name)
    if not match:
        raise ValueError('版本格式应为 i年份.P或R基础图轮次.提交轮次，例如 i2026.P0.2。')
    year, phase, baseline, submission = match.groups()
    return {'year': int(year), 'phase': phase, 'baseline_round': int(baseline), 'submission_round': int(submission)}

def release(root, name, notes='', modules=None):
    identity = release_identity(name)
    root = Path(root).resolve()
    destination = root / 'releases' / name
    if destination.exists(): raise ValueError('此发布版本已存在，请使用新的修订号。')
    modules = copy.deepcopy(modules if modules is not None else Store(root).snapshot()['modules'])
    modules['site/config']['version'] = name
    result = build(root, modules)
    stage = Path(result['stage'])
    package = stage / 'release'; package.mkdir()
    save_modules(package / 'content', modules)
    shutil.copytree(stage / 'layouts', package / 'layouts')
    export_source(root, modules, package / 'source.zip')
    archive(stage / 'public', package / 'static.zip')
    source_hashes = {}
    for p in ['web/layout-core.js', 'vendor/viz.cjs', 'scripts/atlas.py', 'scripts/build_viewer.py']:
        source_hashes[p] = hashlib.sha256((root / p).read_bytes()).hexdigest()
    manifest = {'format': 'space-atlas-release-1', 'name': name, 'version': identity, 'notes': notes,
                'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'revision': result['revision'],
                'python': sys.version.split()[0], 'node': subprocess.check_output(['node','--version'], text=True).strip(),
                'counts': result['report']['counts'], 'implementation': source_hashes,
                'artifact_hashes': result['report']['artifacts'], 'files': hashes(package)}
    write(package / 'manifest.json', manifest)
    destination.parent.mkdir(exist_ok=True)
    package.rename(destination)
    return manifest

def releases(root):
    def order(item):
        v = release_identity(item['name'])
        return v['year'], v['baseline_round'], v['submission_round'], v['phase'] == 'R'
    return sorted((read(p) for p in (Path(root) / 'releases').glob('*/manifest.json')), key=order, reverse=True)

def release_modules(root, name):
    directory = (Path(root) / 'releases' / name).resolve()
    if directory.parent != (Path(root) / 'releases').resolve(): raise ValueError('Invalid release')
    manifest = read(directory / 'manifest.json')
    modules = load_modules(directory / 'content')
    if digest(modules) != manifest['revision']: raise ValueError('Release content checksum mismatch')
    return modules
