# GitHub and iGEM GitLab

Checked against official guidance on **2026-10-03**.

## Public development repository

[SZU-SIAT-iGEM/space-material-atlas](https://github.com/SZU-SIAT-iGEM/space-material-atlas) is the public development repository. Source publication and Wiki deployment are separate workflows.

The repository includes the local studio, modular content, reader, layout engine, tests, source build pipeline, licenses and documentation. README screenshots use Friskoli / SZU-SIAT-China. Generated pages, local drafts, runtime history, caches and delivery archives are excluded from Git.

## Required competition copies

| Use | Required destination |
| --- | --- |
| A component of the team Wiki | Include all code required to build it in the team's yearly iGEM GitLab Wiki repository; integrate through its existing CI |
| Submission for Best Software | The official eligibility page requires an OSI-approved software license and source hosted in a dedicated iGEM GitLab software repository |
| Ongoing public maintenance | GitHub can hold the development repository; it does not replace those competition destinations |

The [2026 official Wiki template](https://gitlab.igem.org/2026/kit) requires all coding assets in the Wiki repository, image/icon/font hosting on static.igem.wiki, and runtime resources served from iGEM infrastructure. The template retains CC BY 4.0 for the Wiki. The [Best Software requirements](https://competition.igem.org/judging/special-prizes) state the separate software-repository requirement. The team's deliverables dashboard provides the actual assigned repository and submission workflow.

## Recommended workflow

1. Maintain and review the project on GitHub. Select the source commit corresponding to the year's submission.
2. For the Wiki, copy the complete source into `space-atlas/` of the assigned Wiki repository, preserve its license and main Pages job, and append the commands in [ci/wiki-integration.yml](../ci/wiki-integration.yml).
3. Upload the icon through iGEM's uploads tool, configure the exact `ATLAS_BRAND_URL`, and run the real Wiki pipeline. Check the hosted atlas and iframe from the final Wiki origin.
4. If submitting this as competition software, also push the reviewed source to the team's assigned dedicated software repository, following the deliverables dashboard's instructions.
5. Record the GitHub commit, iGEM repository/commit and published content version together. Keep future yearly revisions separate from frozen submissions.

The repository provides GitLab CI. Configure the assigned iGEM destination and verify its pipeline before submitting. GitHub Actions and GitHub Pages deployment are not included.
