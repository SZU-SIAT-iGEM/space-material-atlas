# 数据格式

使用项目现有 `space-atlas-team-bundle-1` 协议：顶层 `format, team, nodes, edges, dependencies, enhancements, sources` 全部存在。四类记录仅包含本队拥有的内容，共享节点通过 ID 引用，不放进 nodes。

紧凑编写输入：

```json
{
  "team": {"id":"2027-example","name":"Example","theme":"bioreactor","summary":{"zh":"项目名称","en":"Project title"},"description":{"zh":"资料支持的说明","en":"Source-supported description"},"url":""},
  "sources":[{"id":"team:2027-example:document","title":"Team-supplied description","url":"","kind":"team_supplied"}],
  "routes":[{"id":"route:main","theme":"bioreactor","label":{"zh":"主要路线","en":"Main route"}}],
  "connections":[{"id":"edge:input","route":"route:main","source":"EXISTING_ID","target":"conversion","type":"material","label":{"zh":"输入物质","en":"Feedstock"}}]
}
```

nodes.json 是数组，每项有 `id, route, kind, label:{zh,en}, description:{zh,en}`。本队短 ID 和路线 ID 自动加年份队伍前缀。连接端点可引用本队短 ID 或旧图完整 ID。上述 example 只说明格式，EXISTING_ID 必须替换，不能直接应用。

关系类型：material、energy、support、information 放 edges；dependency 放 dependencies，并要求 target 是 process；enhancement 放 enhancements，额外填 `scope:{zh,en}` 与 kind（默认 process_improvement）。作用目标必须为 process。不要把调控信号、计算模型或工艺依赖当作物质流。生化通路可以合并在过程节点，但独立分支应保留。

已纳入统计、等待增补由实时项目与名录交叉判断，不采用旧 integrated 值。未进入名录的候选资料存于交付文件或 `.state/drafts/`；没有事实支持时不增加占位节点或正式名录条目。

重复应用相同 bundle 应无内容变化。修订已建模队伍应先 `export --id ... --out ...`；工具导出所有本队记录及这些记录引用的项目来源，共享基础来源继续按 ID 引用。完整名录资料由后台保留；新增队伍必须有可靠年份和身份，缺失时生成待确认草稿，不能猜官方编号。
