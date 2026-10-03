# v7 历史参考

> 本文保留 v7 当时的操作与检查说明。当前 managed 使用 content/ 和本机管理端维护，public 只有四个文件、无编辑功能。请按 [当前 README](../README.md)、[维护指南](maintenance.md)和 [CI 指南](ci.md)操作；下文的旧命令与五文件输出仅作历史记录。

## 2026-09-25：阅读体验小更新

- 介绍正文：桌面 16px，小屏 15px；来源 14px。上下游关系分行排版，长文滚动时关闭按钮保持可见。
- 点选过小的节点时自动放大到便于阅读的尺度；周围图形保留更多对比度，定位动画缩短。
- “取消聚焦”与 Escape 保留画布位置、倍率和面板开闭状态。父页面的 `reset-focus` 使用相同行为。
- 中英文名称均可搜索，名称匹配优先；支持方向键、Enter、Escape 和中文输入法。
- iframe 中普通滚轮滚动外层网页，Ctrl / ⌘ + 滚轮缩放图谱；触屏手势与缩放按钮保留。默认英文，嵌入示例也默认英文。

验证记录见 [QA-reading-2026-09-25.md](history/QA-reading-2026-09-25.md)。

## v7：多端浏览、阅读指引、动画与 Wiki 配色

手机支持单指拖动、双指缩放以及双指结束后继续单指平移；右下角提供放大、缩小和全景按钮。拖动不会误开节点介绍。手机竖屏使用底部介绍，短横屏使用右侧介绍，面板可单独滚动；旋转屏幕和切换介绍面板保留画布中心与显示倍率。小屏导航与次要工具折叠，主要控件至少 44px，输入框至少 16px，并适配安全区和软键盘可见范围。

多端交互源码为 `web/viewport-core.js`、`web/viewport.js` 和 `web/responsive.css`，构建后内嵌到单文件。手势与镜头回归检查：`node scripts/test_viewport.cjs`。验证详情见 [QA-multidevice.md](history/QA-multidevice.md)。

本版基于 2026-09-09 的最新 `igem-ci-build`，于 2026-09-21 更新界面。原始版本保留。`data/` 四份 JSON 与来源版本一致，本次没有更新项目内容或开展事实复核。

- 首次打开独立图谱时显示六步阅读指引，只涉及分图、节点、搜索、队伍、来源、动画及导出。完成或跳过后不再自动出现，工具栏可重新打开。退出时恢复原来的视图、缩放、队伍选择和节点介绍。
- 编辑指引使用独立记录，仅在首次进入“填写路线”时显示，也可从编辑页面重新打开。浏览、展示和嵌入模式不会触发编辑指引；引导过程不改变表单内容。
- 所有指引均提供中英文客观功能说明。界面与图内文字改用无衬线字体，优先使用本机可用字体，不请求外部字体服务。
- 使用 Friskoli Wiki v3 的深蓝 `#061B2F`、浅绿 `#EDF8F3`、正文蓝 `#0C2F5F`、青绿色及橙色信号。节点边界的语义颜色保留。
- 节点定位有短暂的视角过渡；选择节点后，相邻物质连线播放一次方向动画，也可手动重播。动画速度不代表流量。暂停设置在当前浏览器中保存；系统减少动态设置优先。

直接打开 `atlas.html`，或部署 `public/`。默认显示英文，可在导航菜单切换中文；链接中的 `?lang=zh` 或 `?lang=en` 显式指定语言。`?guide=1` 强制显示阅读指引，`?guide=0` 跳过自动显示。嵌入组件默认不自动弹出指引，仍保留手动入口；宿主可显式传入 `guide=1`。首次记录和动画偏好按浏览器与网站来源分别保存。

新增源文件为 `web/experience.js` 与 `web/experience.css`；构建时一并内嵌，部署仍只有五个静态文件，无新增运行时依赖。阅读、编辑指引的文案在 `experience.js` 中分别维护。

键盘操作：指引支持 Tab、左右方向键及 Escape；图谱节点支持 Tab 和 Enter/空格，画布获得焦点后支持方向键平移和 +/- 缩放。

验证记录见 [QA-v7.md](history/QA-v7.md)。

这是清理历史字段后的独立源码目录。后续修改以本目录为准；不要再把旧 v6 的 data 或 atlas.html 直接覆盖回来。

新增的 JSON 编写 skill 在 `skills/atlas-json-author/`。使用方式见 [JSON 与展示模式说明](../JSON与展示模式使用说明.md)。展示模式为 `mode=display`，只隐藏编辑入口；`iframe-demo.html` 提供完整参数和宿主控制示范。

**静态运行不等于全部 iGEM 条款已满足。** 没有动态 Python 后端，但图标托管、许可页脚与实际部署仍有待确认项，见 [技术核对](deployment-status.md)。按本轮要求尚未自动修改这些项目。

## 文件作用

| 文件 | 用途 |
| --- | --- |
| data/baseline.json、projects.json | 当前图谱节点、连接、定性说明与来源；仅保留发布字段 |
| data/roster.json、site-config.json | 38 队名录、About、邮箱、可选托管地址 |
| web/ | HTML 模板、样式、交互和浏览器编辑逻辑 |
| assets/steward.svg | 左上角图标，构建时内嵌 |
| vendor/viz.cjs、NOTICE.txt | 随附 Graphviz/Viz.js，无需 npm 下载 |
| scripts/atlas.py、directed.py、organic.py、graphviz.cjs | 数据校验、SVG 与有向布局 |
| scripts/build_viewer.py | 将数据、SVG 和交互封装为单文件 HTML |
| scripts/build_release.py | 字段白名单检查、重建布局、封装并指定发布文件 |
| scripts/test_core.cjs、test_release.py、check_geometry.py | 数据一致性、历史字段泄漏及几何检查 |
| .gitlab-ci.yml | iGEM GitLab Pages 流水线 |

没有复制 v3/v4/v5、旧 atlas.json、研究缓存、对话记录、迁移脚本和旧 viewer.html。layouts/ 每次从当前数据重建，不需要上传。

## 本地构建

需要 Python 3.11 或更新版本及 Node.js 22。Linux 命令如下；Windows 可将 python3 换成 python。

```sh
python3 scripts/build_release.py
node scripts/test_core.cjs
node scripts/test_viewport.cjs
python3 scripts/check_geometry.py
python3 scripts/test_release.py
python3 scripts/test_json_skill.py
```

只发布 public/ 内五个文件：index.html、atlas.html、atlas.json、iframe-demo.html、proofreader.html。atlas.json 是有意保留的公开导出，已经去除历史审核字段。所有交互和 JSON 下载使用同一份清理后的数据。其余目录不作为 Pages 成品。

字段白名单遇到未知字段会报错，不会静默发布；新增字段需先决定它是否应公开。该机制排除已知历史字段，不能替代对现有叙述事实的人工审核。表单仍支持队伍资料 JSON，公共合并前须通过发布检查。

## 接入 iGEM CI/CD

如果这就是整个 Wiki 项目：把本目录的源码内容放到目标仓库根目录，包含隐藏的 .gitlab-ci.yml。不要把外层工作区、历史 .git 或旧 ZIP 上传。模板使用 node:22，安装 python3 后执行构建与检查；只有默认分支运行 pages，artifact 仅包含 public/。

如果已有团队 Wiki：**不要覆盖已有 .gitlab-ci.yml，也不要用本目录替换整个 Wiki。** 将本目录源码放入 space-atlas/；在现有 Pages job 安装 Python，并在原 Wiki 生成完成后添加以下命令，再沿用原有 public artifact：

```sh
python3 space-atlas/scripts/build_release.py
node space-atlas/scripts/test_core.cjs
node space-atlas/scripts/test_viewport.cjs
python3 space-atlas/scripts/check_geometry.py
python3 space-atlas/scripts/test_release.py
python3 space-atlas/scripts/test_json_skill.py
mkdir -p public/space-atlas
cp -a space-atlas/public/. public/space-atlas/
```

此时 iframe 地址为该 Wiki 下 space-atlas/atlas.html?embed=1&team=2026-6100&focusTeam=1。原 Wiki 构建必须先执行，避免后来清空 public。实际目标仓库尚未接入，本地没有执行推送或远程流水线。

若需要通用 GitLab runner，官方模板未要求特定 tags；本配置也未额外添加。CI 安装 Python 需要 runner 可以访问 Debian 包镜像。

## 官方依据

核对日期：2026-09-09。

- [iGEM 官方 2026 React/Vite 模板 CI](https://gitlab.igem.org/templates/wiki-react-vite/-/blob/main/.gitlab-ci.yml)：node:22、pages、public artifact、默认分支规则。
- [GitLab Pages](https://docs.gitlab.com/user/project/pages/)：构建后发布指定目录。

目前已本地重建并通过数据、几何、公开字段检查及浏览器操作检查。没有在实际 iGEM runner 上运行，不能视为远程部署成功。
