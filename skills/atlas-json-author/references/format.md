# 两份输入，一份导入文件

`team-plan.json`：team 包含 id、name、theme、summary、description、url；summary 与 description 可为字符串或 `{zh,en}`。sources 使用稳定 id、title、url。routes 包含 id、label、可选 theme 和 demonstration。connections 包含 source、target、label、type、可选 route/source_ids；改良还需 scope 与可选 kind。

`nodes.json`：数组，节点包含 id、label、kind、route、description。已有共享节点不要写入此数组，直接用其 ID 作连接端点。新增短 ID 自动加队伍前缀。节点所属路线的排列顺序决定步骤顺序，连接决定实际分支；每条路线至少含一个本队节点。平台独立节点可不填 route。

主题：water、air、agriculture、materials、bioreactor、human、logistics、energy、ground、heritage（以实时目录为准）。节点 kind：process、material、state、information、energy、resource。关系 type：material、energy、support、information、dependency、enhancement。

构建的 team-bundle.json 顶层为 format、team、nodes、edges、dependencies、enhancements、sources。它与当前表单导入格式相同。已有队伍用 export-team 得到完整文件后修改；因为导入是完整替换本队记录，删除未提及的旧分支会造成内容丢失。

教学示例位于 ../assets/ 的 team-plan.example.json 与 nodes.example.json。它展示复用 f_waste、f_salts 和 space_bioreactor，包含一条物质回收链及独立的工艺改良连接。空来源 URL 明确表示示例没有真实来源，不可直接并入正式数据。
