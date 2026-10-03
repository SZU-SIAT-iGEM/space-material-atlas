# 静态运行与部署状态 · i2026.P0.2

更新日期：2026-10-03。本页记录实现与实际验证的状态，不代替当年整站 Wiki 要求。

| 项目 | 当前实现与验证 | 仍需完成 |
| --- | --- | --- |
| 静态读者 | public 仅 4 个 HTML/JSON 文件，浏览器运行图谱，不依赖 FastAPI | 线上托管后复核 |
| 本机维护 | FastAPI + 本地 JSON，绑定 127.0.0.1；编辑与校对在管理端 | 维护者备份本地草稿与历史 |
| 图标 | offline 内嵌原图标；igem profile 接受 static.igem.wiki 地址 | 上传图标并配置实际 URL |
| 源码与 CI | 完整源码可独立重建；提供 GitLab Pages 配置及 Wiki 接入片段 | 接入真实 iGEM 仓库、runner 与变量 |
| GitHub | [SZU-SIAT-iGEM/space-material-atlas](https://github.com/SZU-SIAT-iGEM/space-material-atlas) 公开维护源码 | 内容仍待人工审查；未提供 Actions 部署流程 |
| 许可 | 本项目代码 MIT、原创图谱文字 CC BY 4.0；第三方保留各自权利，见 [licensing.md](licensing.md) | 宿主 Wiki 的许可、署名、仓库链接按整站配置核对 |
| iframe | 本地宿主消息与队伍聚焦有验证记录 | 正式站点路径、origin 和整站集成复核 |
| 设备 | 浏览器尺寸和手势逻辑已有检查 | 实体手机、平板与系统软键盘 |

具体构建与部署步骤以 [ci.md](ci.md) 为准，实际验收范围见 [acceptance.md](acceptance.md)。原 v7 的无管理后台、公开表单、五文件输出等说明只保留在历史记录中。
