"""One entry point for local editing, source export and iGEM CI builds."""
import argparse
import json
import sys
from pathlib import Path
from cms.content import ROOT, FILES, compile_modules, load_legacy, load_modules, read, save_modules, split, validate, write

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('migrate', help='Split the original four JSON files once, without modifying them')
    sub.add_parser('validate')
    compile_p = sub.add_parser('compile'); compile_p.add_argument('--out', default='data')
    build_p = sub.add_parser('build'); build_p.add_argument('--out', default='public')
    serve_p = sub.add_parser('serve'); serve_p.add_argument('--port', type=int, default=8765)
    source_p = sub.add_parser('export-source'); source_p.add_argument('--out', default='dist/space-atlas-managed-source.zip')
    ci_p = sub.add_parser('export-ci', help='Export complete source and CI configuration for building the static website'); ci_p.add_argument('--out', default='dist/space-atlas-managed-ci-source.zip')
    release_p = sub.add_parser('release'); release_p.add_argument('name'); release_p.add_argument('--notes', default='')
    args = parser.parse_args()
    if args.command == 'migrate':
        if (ROOT / 'content').exists(): raise ValueError('content already exists; migration will not overwrite it')
        documents = load_legacy(ROOT / 'data'); modules = split(documents)
        if compile_modules(modules) != documents: raise ValueError('Migration round-trip mismatch')
        counts = validate(documents); save_modules(ROOT / 'content', modules)
        for filename in FILES: write(ROOT / 'tests/fixtures/v7' / filename, documents[filename])
        print(json.dumps(counts)); return
    if args.command == 'serve':
        import uvicorn
        from cms.api import create_app
        uvicorn.run(create_app(ROOT), host='127.0.0.1', port=args.port); return
    modules = load_modules(ROOT / 'content'); docs = compile_modules(modules)
    if args.command == 'validate': print(json.dumps(validate(docs))); return
    if args.command == 'compile':
        validate(docs)
        destination = (ROOT / args.out).resolve()
        if ROOT not in destination.parents or destination == ROOT / 'content': raise ValueError('Invalid compile destination')
        for filename, value in docs.items(): write(destination / filename, value)
        print(destination); return
    from cms.build import build, export_source, release
    if args.command == 'build':
        result = build(ROOT, modules, ROOT / args.out)
        print(json.dumps({'build': result['id'], 'revision': result['revision'], 'counts': result['report']['counts']}))
    elif args.command in ('export-source', 'export-ci'): print(export_source(ROOT, modules, ROOT / args.out))
    elif args.command == 'release': print(json.dumps(release(ROOT, args.name, args.notes, modules), ensure_ascii=False))

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf8')
    try: main()
    except (ValueError, RuntimeError, FileNotFoundError) as e:
        print(str(e), file=sys.stderr); sys.exit(1)
