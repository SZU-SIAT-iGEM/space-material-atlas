"""Python adapter to the shared Node/browser layout contract."""
import copy
import functools
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def implementation_key():
    return hashlib.sha256(b''.join((ROOT / p).read_bytes() for p in
        ['web/layout-core.js', 'scripts/layout-cli.cjs', 'vendor/viz.cjs'])).hexdigest()

def invoke(request):
    result = subprocess.run(['node', str(ROOT / 'scripts/layout-cli.cjs')],
        input=json.dumps(request, ensure_ascii=False), encoding='utf8',
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300)
    if result.returncode:
        model = request.get('model', {})
        raise RuntimeError(f'Graphviz layout failed for {model.get("view", "unknown")} '
                           f'({len(model.get("nodes", {}))} projected nodes, {len(model.get("edges", []))} relations). '
                           'The last valid release is retained. Inspect this view; run node scripts/benchmark_layout.cjs for a local capacity report.\n' + result.stderr)
    return json.loads(result.stdout)

@functools.lru_cache(maxsize=256)
def signature_json(model_json, lang, engine):
    shape = invoke({'model': json.loads(model_json), 'lang': lang, 'signatureOnly': True})['key']
    return shape, hashlib.sha256((shape + engine).encode()).hexdigest()

def keys(model, lang):
    return signature_json(json.dumps(model, ensure_ascii=False, separators=(',', ':')), lang, implementation_key())

def fingerprint(model, lang):
    return keys(model, lang)[1]

def layout(model, lang, digest):
    result = invoke({'model': model, 'lang': lang})
    result['geometry_key'] = result['fingerprint']
    result['fingerprint'] = digest
    result['implementation_key'] = implementation_key()
    return result

def reference(model, lang):
    path = ROOT / 'layout-reference' / f'{model["view"]}-{lang}.json'
    if not path.exists(): return None
    candidate = json.loads(path.read_text(encoding='utf8'))
    shape, digest = keys(model, lang)
    if candidate.get('geometry_key') == shape and candidate.get('implementation_key') == implementation_key():
        candidate['fingerprint'] = digest
        return candidate
    return None
