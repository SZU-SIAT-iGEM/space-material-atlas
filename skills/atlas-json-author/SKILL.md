---
name: atlas-json-author
description: Create or edit Space Material Atlas team and node JSON from project descriptions, reuse existing nodes, validate browser-importable bundles, and explain iframe embedding without filling the form manually.
---

# 图谱 JSON 编写

在 `space-atlas-managed` 中，从文档整理整队资料请优先读取相邻的 `../atlas-team-import/SKILL.md`。本脚本会优先读取实时 `content/`，旧版项目才读取 `data/`。managed 项目的正式导入使用本机管理后台或 `Store.import_updates`，不要直接改 `data/projects.json` 或公开阅读页面。

用于太空物质图谱的队伍资料、新增节点和路线修改。在 managed 项目中定位 `manage.py`、`content/manifest.json` 和 `web/core.js`；仅处理原 v7 项目时才使用其 data/ 构建目录。不要使用历史数据副本覆盖当前内容。随附工具默认定位 skill 所在构建目录，也可用 `--atlas PATH` 指定。

## 从现有节点开始

先运行 `python skills/atlas-json-author/scripts/atlas_json.py catalog --query 水`，或不加 query 导出全部。根据具体物质和工艺含义选择已有 ID，向用户说明复用哪些节点。不要因为名称相似而把乙酸、肥料、营养盐视作同一种物质。搜索不到等价概念时才新增节点。队伍身份使用年份与官方 ID；没有 ID 时使用明确的临时标识，不能伪造官方编号。

项目叙述采用客观第三方视角，定性描述项目提出的路线，假定目标成功并保留 Future。具体连接必须来自项目资料；不要补造无依据的上下游。来源链接用实际提供或读到的资料，不能把名录主页当成技术路线依据。

## 新增与修改

新建时写两份简短文件：team-plan.json 描述队伍、路线和连接；nodes.json 只列本队新增节点。按 [格式与例子](references/format.md) 编写，可从 assets/ 的示例复制结构，但必须替换示例内容。示例仅教学，不代表已收录真实项目。

```text
python skills/atlas-json-author/scripts/atlas_json.py compile --plan team-plan.json --nodes nodes.json --out team-bundle.json
```

修改已有队伍时先完整导出，编辑这份 bundle，保留未修改的其他路线、示范和改良，不从零重建：

```text
python skills/atlas-json-author/scripts/atlas_json.py export-team --id 2026-6100 --out team-bundle.json
python skills/atlas-json-author/scripts/atlas_json.py validate --bundle team-bundle.json
```

材料流放 edges；对共享工艺的依赖放 dependencies；作用于工艺的改良放 enhancements，注明机制和 scope。改良目标必须为 process，角标随队伍显示。某些团队拥有示范路线和额外分支工作，不能用单一结果限定。共享节点只能引用；修改共享节点需作为单独的全局维护任务处理，不用本队 bundle 覆盖。

工具同时调用浏览器导入规则和发布字段白名单；失败就修正，不绕过检查。不要放入 verification_note、finding、review_summary、内部评语或未审核草稿。新字段先讨论其公开用途，不通过改名藏入其他字段。

## 交付与导入

交付 team-bundle.json，说明复用的节点、新增节点、分支和来源。managed 使用本机 Content Studio 的 Import & review 检查差异、影响和 revision，填写原因后应用。公开页面不能编辑或导入；保存草稿不代表已应用或已发布。仅维护原 v7 时才使用其浏览器“填写路线”表单。

managed 正式应用通过管理端或相邻 atlas-team-import 工具的 check/apply 事务流程完成；随后运行 `python manage.py build` 检查预览，`python manage.py export-ci` 导出完整 CI 源码。原 v7 的 upsert-team、直接更新 data/projects.json 和 scripts/build_release.py 仅适用于旧项目。不要自动推送或联系其他团队。

## 嵌入一并交付

根据 [嵌入说明](references/embed.md) 给出填写好队伍 ID 的 iframe。使用者需提供实际 iGEM 托管地址；不知道时明确标示待替换地址。新路线必须先合并发布，别的网页才能读取。managed 的所有公开模式均不含编辑入口，保留阅读、切换、聚焦、语言与导出功能。iframe-demo.html 展示参数和宿主控制。

Python 仅用于本地/CI 生成 JSON 和 HTML；静态网页不需要 Python 服务。技术合规问题按用户要求先报告，不能在本 skill 中默认修复、改授权或部署。
