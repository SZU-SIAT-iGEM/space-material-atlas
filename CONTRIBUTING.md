# Contributing

Use issues and pull requests in [space-material-atlas](https://github.com/SZU-SIAT-iGEM/space-material-atlas). Include the affected team/node, language, source and proposed change for a content correction. Contributions use the applicable [project licenses](docs/licensing.md); retain third-party attribution.

## Content

1. Edit the current module in `content/` through the local studio, or export a complete team bundle before changing it.
2. Preserve stable IDs and all unrelated routes. Search shared nodes before creating a new material or process.
3. Keep the graph as compact as comparable teams. Put implementation details in independent bilingual node descriptions, following the [content rules](docs/悬浮说明规范.md).
4. Use the [team-import skill](skills/atlas-team-import/SKILL.md) or the studio to validate the bundle, inspect the diff and affected references, then apply with a reason.
5. Build a preview and check the relevant overview/topic views, both languages, node details, search, team focus and iframe behavior.

A roster entry without a route is Awaiting additions. Teams outside the roster are Future outlook and are not counted. A node's Future flag describes its application scenario independently of team status.

## Code and layout

Run the Python suite and layout contracts described in [README](README.md). Keep content, projection, layout and rendering boundaries separate. Preserve shared layout rules; avoid team-specific branches. Geometry changes require deliberate reference updates and review.

For layout capacity changes, run `node scripts/benchmark_layout.cjs`. Check desktop, tablet, portrait and landscape views when changing interface behavior. Distinguish browser size simulation, gesture logic tests and physical-device testing.

See [maintenance](docs/maintenance.md) for drafts, revision checks, reference changes and the browser regression scripts.

## Documentation and releases

Keep public documentation focused on using, extending and deploying the project. Keep personal review notes, development logs, trial-import evidence and generated benchmark output outside the public documentation.

Update relevant instructions and links with code changes. README screenshots use Friskoli / SZU-SIAT-China and live in `docs/images/`. Export complete source with `python manage.py export-ci`; named releases follow the [version rules](docs/versioning.md). Do not commit local drafts, caches or credentials.
