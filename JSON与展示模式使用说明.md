# JSON 导入与 iframe · managed

适用版本：i2026.P0.2。修改在维护源文件与本机管理端完成，公开读者保留浏览、聚焦与导出功能。

## 从材料生成整队导入包

优先使用 [atlas-team-import](skills/atlas-team-import/SKILL.md)，从 Word 或项目说明整理完整双语队伍包；底层 JSON 工具见 [atlas-json-author](skills/atlas-json-author/SKILL.md)。两者都从当前 `content/` 读取目录，不以旧 `data/` 作为维护来源。

在项目根目录执行以下独立用途的命令：

```sh
python skills/atlas-json-author/scripts/atlas_json.py catalog --query 水
python skills/atlas-json-author/scripts/atlas_json.py compile --plan team-plan.json --nodes nodes.json --out team-bundle.json
python skills/atlas-json-author/scripts/atlas_json.py validate --bundle team-bundle.json
```

修订已有队伍时先 `export-team --id 2026-6100 --out existing-team-bundle.json`，再编辑完整包；不要用它覆盖刚生成的新队伍文件。共享节点通过稳定 ID 引用，不由队伍包覆盖。来源、关系端点及公开字段必须通过检查。

在本机工作台 Import & review 中载入 bundle，查看增删改、影响与 revision，填写原因再应用。只有应用后的内容进入构建；不完整资料先保存草稿。名录中无路线的队伍是等待增补，未入名录的队伍是未来展望。

## 公开页面与嵌入

| 打开方式 | 效果 |
| --- | --- |
| `atlas.html` | 完整阅读导航，默认英文，无编辑入口 |
| `atlas.html?lang=zh` | 中文阅读 |
| `atlas.html?mode=display` | 兼容旧展示链接，保留阅读工具 |
| `atlas.html?embed=1&lang=en` | iframe 精简页头，保留阅读操作 |
| `atlas.html?mode=edit` | 仍为公开阅读页，不启用编辑 |

主题、队伍切换、搜索、聚焦、地面系统、来源、语言、SVG/JSON 导出与阅读指引继续可用。管理端的草稿与编辑工具不进入公开页面。

```html
<iframe src="./space-atlas/atlas.html?embed=1&lang=en&team=2026-6055&focusTeam=1&view=bioreactor"
        title="Space Material Atlas" width="100%" height="720" style="border:0"
        loading="lazy"></iframe>
```

路径需按宿主页面位置调整。`team=ID1,ID2` 可选择多队；`focusTeam=1` 用于单队聚焦；`view` 指定主题，`focus` 指定节点，`ground=1` 显示地面系统。

`iframe-demo.html` 提供队伍、主题、语言、初始节点、高度与模式设置，并生成可复制的代码。宿主示例包括 set-teams、set-view、set-language、set-ground、focus-node、fit、reset-focus、get-state，以及 ready/state/node-selected 回传。发送消息需等待 ready，指定正确 origin，并检查消息来源。

用 HTTP 测试跨页消息：`python -m http.server 8793 --bind 127.0.0.1 --directory public`，然后打开 <http://127.0.0.1:8793/iframe-demo.html>。静态文件服务器不承担管理后台功能。

新路线必须先合并构建才会出现在引用页面。正式 Wiki 地址与图标配置见 [CI 指南](docs/ci.md)；导出 CI 源码用 `python manage.py export-ci`。
