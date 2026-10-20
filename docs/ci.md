# Static publishing and iGEM CI/CD

The pipeline below builds the working source; named releases retain their own source archives.

## One build path

`python manage.py build` compiles modular content, validates references, generates/reuses layouts, checks geometry and packages the reader. It requires Python 3.11+ and Node 22+; it does not import FastAPI or require an active backend. Viz 3.25.0 is vendored. Studio dependencies are pinned in `requirements-lock.txt`.

The standalone `.gitlab-ci.yml` has a test job and a Pages job. The Pages job builds from source and retains both `public/` and the source ZIP. Its base image is pinned to `node:22.14.0-bookworm`.

## Existing Wiki

Commit the complete extracted source into a subdirectory, such as `space-atlas/`. Keep the existing Wiki's Pages job, license, rules and main build. Append the commands from `ci/wiki-integration.yml` after that main build. Do not replace its entire `.gitlab-ci.yml` with this project's standalone file.

The output is copied into `public/space-atlas/`. It supports a relative iframe source such as `./space-atlas/atlas.html?embed=1&lang=en`. Adjust the relative path for the host page. `iframe-demo.html` demonstrates the existing focus, view and reset messaging API.

## Images and the iGEM upload service

The 2026 iGEM template requires coding assets in the team GitLab repository and images/icons/fonts on the iGEM upload infrastructure. It also prohibits runtime dependencies on external CDNs. See the [2026 official template guidance distributed with team repositories](https://gitlab.igem.org/2026/kit) and the [Wiki deliverable entry point](https://teams.igem.org/go/deliverables/wiki).

This reader embeds its code, data and generated SVG diagrams and uses system fonts. For a Wiki release, upload `assets/steward.svg` with the team's upload tool. Set the resulting exact `https://static.igem.wiki/...` URL in `deployment.json` with `"profile": "igem"`, or set the CI variable `ATLAS_BRAND_URL`. Only that host is accepted for the Wiki icon setting. Exported source captures the setting, so a release can be rebuilt consistently.

The default `offline` profile embeds the local icon for independent previews and archival use. Before a Wiki deployment, configure the uploaded icon URL.

No generated page connects to the local CMS. Close the backend and the static reader continues to work. The public package has exactly four files: `index.html`, `atlas.html`, `atlas.json`, and `iframe-demo.html`. Editor forms, draft imports, text proofreading and local API files are excluded.

## Reproducibility and retention

Run `python manage.py release i2026.P0.4` to create `releases/i2026.P0.4/`. It includes source/static ZIPs, complete content, layouts and checksums. Duplicate names are rejected. Commit source to the appropriate yearly Wiki repository or keep the release archive with it. Local `.state/` is intentionally excluded from source exports; preserve it separately for draft and editorial-history backups.

For a historical rebuild, extract its source ZIP into an empty directory and run the same build command. The archive is the engine/version boundary. Comparing/restoring content in today's studio does not replace today's application code.

## Repository documentation and GitHub

The root README uses the existing `assets/steward.svg` and screenshots in `docs/images/`. These files are included by `export-ci` but are not copied into the four-file public site. Relative links work when the source archive is extracted at the repository root.

This project supplies GitLab CI for the Wiki; it does not include a GitHub Actions workflow. Hosting source on GitHub does not itself deploy the Wiki. The public development repository is [SZU-SIAT-iGEM/space-material-atlas](https://github.com/SZU-SIAT-iGEM/space-material-atlas). For a competition submission, synchronize the reviewed complete source, including hidden `.gitlab-ci.yml`, to the appropriate iGEM GitLab repository. Exclude local runtime folders, generated outputs and release ZIPs. See [hosting requirements](hosting.md) and [license scope](licensing.md).
