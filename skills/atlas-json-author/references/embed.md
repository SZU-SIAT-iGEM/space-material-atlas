# 给使用者的嵌入步骤

1. 在本机 Content Studio 中导入 JSON，检查差异并应用，再构建预览；维护者审查后通过 CI 发布。未应用草稿不会出现在公开网页中。
2. 获得该图谱在 iGEM 上的实际 URL。先直接打开并检查队伍、主题与来源。
3. 把 iframe 加入队伍 Wiki 页面。以下 `YOUR-TEAM` 是待替换路径：

```html
<iframe
  src="https://2026.igem.wiki/YOUR-TEAM/space-atlas/atlas.html?embed=1&mode=display&team=2026-6100&focusTeam=1"
  title="太空物质循环图谱" width="100%" height="720"
  style="border:0" loading="lazy"></iframe>
```

`mode=display` 保留旧展示链接兼容；managed 的公开页面在所有模式下都没有编辑功能。搜索、队伍切换、聚焦、来源、语言和导出保留，不读取管理草稿。移除 embed=1 可保留完整页头；默认英文，可显式传入 lang=en 或 lang=zh。

其他参数：view=water 指定主题，lang=en 英文，focus=water 聚焦节点，ground=1 显示地面系统。多队比较用 team=ID1,ID2；此时不加 focusTeam=1。ID 必须存在于已发布图谱。

iframe-demo.html 可直接选择队伍、主题、语言和模式，生成相应引用代码，并展示宿主控制与状态回传。宿主使用 postMessage 时指定精确 origin，收到 ready 后再发送；参考演示页的实际代码。离线 file:// 可阅读，但跨页消息需 HTTP。

在 iGEM Wiki 中应使用 iGEM 托管的组件地址，不能把任意外部托管演示当作已合规方案。图标托管、版权页脚及实际部署检查见构建目录的技术核对报告；未确认时不要承诺全部合规。
