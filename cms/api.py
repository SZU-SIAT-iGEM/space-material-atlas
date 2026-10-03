"""Loopback-only local management API. Public artifacts contain no API dependency."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
import json
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from .content import ROOT, compile_modules, load_modules, read, validate
from .store import Store, Conflict
from .build import build, export_source, release, releases, release_modules

def create_app(root=ROOT):
    root = Path(root).resolve(); store = Store(root)
    app = FastAPI(title='Space Atlas · 内容工作台', docs_url=None, redoc_url=None)
    app.state.store = store
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='atlas-build')
    jobs = {}; jobs_lock = threading.Lock()
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]', 'testserver'])

    @app.middleware('http')
    async def local_origin(request, call_next):
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            origin = request.headers.get('origin')
            if origin and urlparse(origin).netloc != request.headers.get('host'):
                return JSONResponse({'detail': '只接受本机工作台的同源操作。'}, status_code=403)
            if request.headers.get('sec-fetch-site') == 'cross-site':
                return JSONResponse({'detail': 'Cross-site mutation rejected'}, status_code=403)
        response = await call_next(request)
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.exception_handler(Conflict)
    async def conflict(request, exc): return JSONResponse({'detail': str(exc)}, status_code=409)
    @app.exception_handler(ValueError)
    async def invalid(request, exc): return JSONResponse({'detail': str(exc)}, status_code=422)
    @app.exception_handler(FileNotFoundError)
    async def missing(request, exc): return JSONResponse({'detail': '文件或版本不存在。'}, status_code=404)
    @app.exception_handler(KeyError)
    async def missing_field(request, exc): return JSONResponse({'detail': '缺少必要字段：' + str(exc)}, status_code=422)

    @app.get('/api/state')
    def state(): return store.overview()

    @app.get('/api/modules/{key:path}')
    def module(key):
        current = store.snapshot()
        if key not in current['modules']:
            saved = store.draft(key)
            if saved:
                return {'revision': saved['revision'], 'id': key, 'data': saved['data'], 'draft': saved}
            raise ValueError('Module not found')
        return {'revision': current['revision'], 'id': key, 'data': current['modules'][key], 'draft': store.draft(key)}

    @app.post('/api/preview')
    def preview(body: dict): return store.preview(body['revision'], body['updates'])

    @app.post('/api/apply')
    def apply(body: dict): return store.apply(body['revision'], body['updates'], body.get('reason', ''))

    @app.put('/api/drafts/{key:path}')
    def draft(key, body: dict): return store.draft(key, body)

    @app.post('/api/import')
    def import_data(body: dict): return store.import_updates(body)

    @app.post('/api/merge-node')
    def merge(body: dict): return store.merge_node_updates(body['source'], body['target'])

    @app.get('/api/history')
    def history(): return store.history()

    @app.get('/api/releases')
    def versions(): return releases(root)

    @app.post('/api/restore-preview')
    def restore_preview(body: dict):
        if 'release' in body:
            modules = release_modules(root, body['release'])
        else:
            folder = (root / '.state/history' / body['history']).resolve()
            if folder.parent != (root / '.state/history').resolve(): raise ValueError('Invalid history ID')
            modules = load_modules(folder / ('before' if body.get('before') else 'content'))
        return store.restore_updates(modules)

    def submit(kind, operation):
        with jobs_lock:
            if any(v['status'] in ('queued', 'running') for v in jobs.values()):
                raise Conflict('已有构建正在执行，请等待完成。')
            id_ = uuid.uuid4().hex
            jobs[id_] = {'id': id_, 'kind': kind, 'status': 'queued'}
        def work():
            jobs[id_]['status'] = 'running'
            try:
                result = operation()
                jobs[id_].update(status='complete', result=result)
            except Exception as e:
                jobs[id_].update(status='failed', error=str(e))
        executor.submit(work)
        return jobs[id_]

    @app.post('/api/build')
    def build_job(body: dict):
        current = store.snapshot()
        if body.get('revision') != current['revision']: raise Conflict('请载入最新内容后构建。')
        def operation():
            result = build(root, current['modules'], root / 'public')
            return {'revision': result['revision'], 'preview_url': f'/preview/{result["id"]}/atlas.html?guide=0', 'report': result['report']}
        return submit('build', operation)

    @app.post('/api/releases')
    def release_job(body: dict):
        current = store.snapshot()
        if body.get('revision') != current['revision']: raise Conflict('请载入最新内容后发布。')
        return submit('release', lambda: release(root, body['name'], body.get('notes', ''), current['modules']))

    @app.post('/api/export-ci')
    @app.post('/api/export-source')
    def source_job(body: dict):
        current = store.snapshot()
        if body.get('revision') != current['revision']: raise Conflict('请载入最新内容后导出。')
        def operation():
            name = 'atlas-ci-source-' + current['revision'][:12] + '.zip'
            export_source(root, current['modules'], root / 'dist' / name)
            return {'url': '/downloads/' + name, 'revision': current['revision']}
        return submit('source', operation)

    @app.get('/api/jobs/{id_}')
    def job(id_: str):
        if id_ not in jobs: raise ValueError('Unknown job')
        return jobs[id_]

    @app.get('/downloads/{name}')
    def download(name: str):
        p = (root / 'dist' / name).resolve()
        if p.parent != (root / 'dist').resolve() or p.suffix != '.zip': raise ValueError('Invalid download')
        return FileResponse(p, filename=p.name)

    @app.get('/release-files/{name}/{kind}')
    def release_file(name: str, kind: str):
        directory = (root / 'releases' / name).resolve()
        if directory.parent != (root / 'releases').resolve() or kind not in ('source', 'static', 'manifest'): raise ValueError('Invalid release file')
        filename = kind + ('.json' if kind == 'manifest' else '.zip')
        return FileResponse(directory / filename, filename=name + '-' + filename)

    @app.get('/preview/{build_id}/{filename}')
    def preview_file(build_id: str, filename: str):
        folder = (root / '.build' / build_id).resolve()
        if folder.parent != (root / '.build').resolve() or filename not in ('atlas.html', 'index.html', 'atlas.json', 'iframe-demo.html'):
            raise ValueError('Invalid preview')
        if not (folder / 'build-report.json').exists(): raise ValueError('Build not validated')
        return FileResponse(folder / 'public' / filename)

    @app.get('/')
    def index(): return FileResponse(root / 'admin/index.html')

    @app.get('/tools/proofreader.html')
    def proofreader():
        documents = compile_modules(store.snapshot()['modules'])
        payload = json.dumps(documents, ensure_ascii=False).replace('<', '\\u003c')
        html = (root / 'web/proofreader.template.html').read_text(encoding='utf8')
        html = html.replace('__PROOF_DATA__', payload).replace('__DOWNLOAD_UTILS__', (root / 'web/download-utils.js').read_text(encoding='utf8'))
        return HTMLResponse(html)

    app.mount('/admin', StaticFiles(directory=root / 'admin'), name='admin')
    app.mount('/assets', StaticFiles(directory=root / 'assets'), name='assets')
    return app
