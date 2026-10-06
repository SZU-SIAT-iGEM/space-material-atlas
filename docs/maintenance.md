# Content and engine maintenance

See [the documentation index](index.md) and [version rules](versioning.md).

## Content ownership

`content/` is the source of truth. `data/`, `layouts/`, `public/` and build stages are generated. Do not edit generated files to maintain the atlas.

| Module | Responsibility |
| --- | --- |
| `teams/YYYY/YYYY-ID.json` | One roster entry, optional modeled project, and its owned nodes and relations |
| `baseline/themes.json` | Topic identities, bilingual names, and colors |
| `baseline/nodes.json`, `baseline/edges.json` | Baseline graph |
| `shared/nodes.json`, `shared/relations.json` | Materials and processes referenced by several teams |
| `sources/baseline.json`, `sources/projects.json` | Source catalogs; records use `source_ids` |
| `site/config.json` | About, contact details and site configuration |
| `manifest.json` | Original document metadata and stable array ordering |

The compiler preserves original fields, nested bilingual content and array order. New records are appended in stable ID order. It derives team coverage and roster integration status. Source catalogs remain centralized to avoid diverging copies of a shared reference.

## Annual updates

1. Add a team with its actual year and a stable ID. A directory-only entry is **Awaiting additions**. A team with routes is **Integrated**; teams outside the roster are **Future outlook** and excluded from both counts. Node `future` flags describe application scenarios, not team integration.
2. Add project routes when material is available. Search for existing materials and processes before creating a node. Labels can change without changing the ID.
3. Provide both language versions, route steps, relation references and source IDs. Incomplete records can remain in local drafts.
4. Review the diff and impacted teams, routes and views. Enter the reason for the change and apply it.
5. Build a preview; inspect the relevant topic and overview. Then create a new release, for example `i2027.P0.1`.

Older teams remain in the current collection. The baseline may evolve alongside them. Old Wikis should use a named release's source or static package, rather than today's working collection.

## Shared changes and identity

Renaming a material means editing its bilingual label. Keep its ID. Deleting a referenced record fails validation. The shared-node merge tool rewrites relation endpoints and route references, then produces a diff. A merge that creates self-links is rejected until those relations are explicitly adjusted.

For a split, create the new nodes and update endpoints and route references in the same imported full-document change. For removal of an entire team, import the updated `projects.json` and `roster.json` together; the preview lists every removed item. Existing unknown/non-public fields are rejected explicitly, never silently dropped.

## Drafts and revisions

Drafts are local and excluded from builds. New-team drafts appear in the team directory. Applying changes requires the revision loaded when editing; a competing tab receives HTTP 409. Reload and reapply the saved changes to the current version. Failed validation does not update content.

Content commits use an OS lock, a prepared directory, a recovery journal and immutable before/after history. A restart recovers an interrupted directory swap. History and drafts live in `.state/`; back this directory up separately if you need local editorial history. Source exports include committed content only. Publishing never depends on the local history directory.

## Import and proofreading

Use [atlas-team-import](../skills/atlas-team-import/SKILL.md) to prepare whole-team documents and [the content rules](悬浮说明规范.md) for independent bilingual node prose.

Import accepts an existing team bundle, one named business JSON file, a four-file map, or `atlas.json`. A team bundle is the complete replacement for that team's owned route collection. Unrelated teams and fields are preserved. Existing shared sources cannot be overwritten through a team bundle.

The local text proofreader is available from Import & review. Its annotations are separate from content. Export corrected JSON and import it through the studio to validate and apply the change. A proofreading project is not a publishable atlas file.

## Layout contract

`web/core.js` and `scripts/atlas.py` project content into `{view,nodes,edges}`. Their projections are checked against each other. `web/layout-core.js` is the single geometric implementation used by Node and the browser, through `scripts/layout-cli.cjs`. Python rendering and the existing reader behavior are preserved.

The geometry signature includes projected identities, node dimensions, group membership, categories and endpoints. Descriptions and sources do not invalidate geometry. Previous successful layouts are reused per view when both geometry and the implementation hash match. Labels that change dimensions and structural edits trigger recalculation. Input order is stabilized by the content manifest; manual changes to ordering are deliberate layout changes.

The fixed layout fixtures cover both languages, reference coordinates, and Node/browser outputs. New topics derive views from the theme catalog; special legacy topic projection rules remain versioned code.

Do not remove the publication gates: missing paths, node overlap, node crossings and title collisions fail the build. Crossings, total route length and canvas growth are reported for comparison. Readability still needs a visual review; these checks cannot establish scientific or editorial correctness.

## Engine changes

Update the engine version when changing geometric behavior. Keep the bundled Viz version and license notices pinned. Run `node tests/test_layout.cjs` and the capacity probes, then inspect both full scenes and focused routes. If intentionally changing the baseline appearance, record and review replacement references; do not silently accept regression output.

Run `node scripts/benchmark_layout.cjs` to generate a local capacity report at `docs/layout-benchmark.json`. Keep generated reports out of source control. There is no guaranteed node-count limit: connectivity changes Graphviz's resource requirements. Some dense additions and large synthetic graphs hit the bundled Graphviz WASM limit; those builds stop, leaving the previous public build available. Split the affected topic or deliberately upgrade and validate the engine before publishing such a graph.

## Restore and rebuild

The version workspace compares a release's content with today's content before restoring it as a new revision. That operation uses the current engine. To rebuild the exact historical implementation, extract that release's `source.zip` into a new directory and run `python manage.py build`. The archive contains content, code, dependency versions, reference layouts and deployment settings.

Never overwrite a published version name. Corrections use a new submission, such as `i2026.P0.4`. A release contains source/static archives, content, layouts and checksums. The original release remains recoverable. See [versioning.md](versioning.md) for the P/R, baseline-round and submission-round convention.

## 本机维护速查

新增队伍从 Teams 开始，年份随队伍保存；共享节点从 Shared content 修改。资料不完整时先保存草稿。校验、查看差异并填写原因后才会应用到正式内容。公开图谱默认英文，支持中文，保留浏览、筛选、详情、动画和导出；编辑与校对只在本机工作台。

每次发布使用新的版本名称。恢复内容与重建历史引擎是两项不同操作：前者在工作台比较后应用；后者解压该版本的源码包重新构建。实体触屏、实际 Wiki CI 和科学事实核查需另行完成。

## Browser regression scripts

`tests/browser_studio.js` and `tests/browser_reader.js` export function expressions accepting a Playwright `page`; they are not standalone `node` programs. Start the studio at port 8765 and a static server for the built `public/` at port 8790 before running them through a Playwright page runner. Run from the project directory and create `.state/` for screenshots. The studio script edits a form temporarily and discards it: use a clean browser session without an unsaved human edit. The reader script checks public behavior even when the URL requests edit mode. Inspect results and screenshots, and record the tested source version.

Run relevant browser regressions after changing reader or studio behavior. Review actual-device interaction separately from browser size simulation.
