/* Interface copy only. UI template substitutions and editable content are never translated. */
'use strict';
let language=localStorage.getItem('atlas-studio-language')==='zh'?'zh':'en';
const copy=`
太空物质循环图谱 · 内容工作台|Space Material Atlas · Content Studio
太空物质循环图谱|Space Material Atlas
图谱内容工作台|Atlas Content Studio
内容工作台 / CONTENT STUDIO|CONTENT STUDIO
重新载入|Reload
构建预览 ↗|Build preview ↗
内容与版本管理|Content & versions
维护队伍与基础图，校对资料，为每次发布留下完整版本。|Maintain the atlas, refine its sources, and preserve each release.
内容概况|Collection overview
工作区|Workspaces
队伍管理|Teams
基础与共享内容|Shared content
导入与校对|Import & review
版本与发布|Versions & releases
队伍目录|Team directory
内容集合|Collections
新增队伍|Add a team
＋ 新增|＋ Add
搜索内容|Search
队名、年份或主题|Team, year, or topic
按年份筛选|Filter by year
按建模状态筛选|Filter by route status
全部主题|All topics
全部年份|All years
全部状态|All statuses
已有路线|Routes available
待补路线|Awaiting additions
等待增补|Awaiting additions
未来展望 · 草稿|Future outlook · draft
选择一份内容开始维护|Choose content to edit
每支队伍独立保存，共享节点通过引用连接。|Each team has its own module, connected through shared references.
检查本次修改|Review changes
关闭修改检查|Close review
修改原因|Reason for this change
例如：根据新版结果页修订产物说明|For example: revised the product description using the updated results page
继续编辑|Keep editing
应用到内容库|Apply to collection
关闭新增队伍|Close new team
队伍编号|Team identifier
例如 6100 或唯一英文标识|For example, 6100 or a unique identifier
先建立名录，可保存草稿并逐步补充项目路线。|Create a directory entry first, then develop the route in a saved draft.
创建编辑草稿|Create draft
支队伍|Teams
个节点|Nodes
条关系|Relations
份来源|Sources
条记录|records
没有匹配的内容。|No matching content.
此模块有保存的草稿。|This module has a saved draft.
恢复草稿|Resume draft
已恢复草稿；应用前会检查是否与较新的内容冲突。|Draft restored. The current collection version will be checked before applying it.
当前内容尚未应用，请先保存草稿、应用修改，或点击“放弃修改”。|There are unapplied changes. Save a draft, apply the changes, or discard them before continuing.
尚未应用|Unapplied changes
名录资料|Directory entry
项目资料|Project
路线连接引用|Route relation references
路线连接|Route connections
工艺依赖|Process dependencies
工艺改良|Process improvements
稳定标识|Stable ID
官方编号|Official ID
Wiki 地址|Wiki URL
所在地|Location
队伍类型|Team type
中文说明|Description · Chinese
英文说明|Description · English
完整叙述|Narrative
项目简短名称|Short project name
相关主题|Related topics
主要主题|Primary topic
所属队伍|Owner
所属路线|Route
示范路线|Demonstration route
来源引用|Source references
项目路线|Project routes
步骤节点|Route steps
起点节点|Source node
终点节点|Target node
关系类型|Relation category
中文作用范围|Scope · Chinese
英文作用范围|Scope · English
量化增益|Measured gain
访问日期|Access date
资料日期|Publication date
显示类型|Display type
展示链接|Display URL
获取日期|Retrieval date
边界角色|Boundary role
所属分图|Views
联系方式|Contact
正式地址|Canonical URL
显示版本|Display version
总图关系|Overview relations
资料截至日期|Content as of
收录范围|Coverage
主题目录|Topics
基础节点|Baseline nodes
基础关系|Baseline relations
共享物质与工艺|Shared materials & processes
共享关系|Shared relations
基础图来源|Baseline sources
队伍项目来源|Project sources
站点说明与联系资料|Site & contact
元数据与排序|Metadata & ordering
无所属路线|No route
留空表示 null|Leave blank for null
每行一个稳定标识|One stable ID per line
移除此记录|Remove record
＋ 添加|＋ Add 
这支队伍还没有项目路线|No routes yet
名录资料已保留，可在这里补充介绍、节点和关系。|The directory entry is preserved. Add the project, nodes, and relations here.
建立项目路线|Set up project routes
已载入 · |Loaded · 
放弃修改|Discard
保存草稿|Save draft
检查并应用|Review & apply
高级 JSON 编辑 · 完整保留所有字段|Advanced JSON · all fields preserved
将 JSON 载入表单|Load JSON into form
项目来源在“基础与共享内容 → 队伍项目来源”中维护。删除整支队伍可在高级 JSON 中检查相关模块后，通过导入与校对执行。|Maintain references under Shared content → Project sources. To remove a team, review its references and use Import & review with the complete updated atlas.
草稿已放弃。|Draft discarded.
草稿已保存|Draft saved
草稿已保存在本机，尚未写入正式内容库。|Draft saved locally. The published collection has not changed.
处变化 · 影响队伍：|changes · Affected teams: 
 · 分图：| · Views: 
无几何引用|No geometry references
＋ 新增|＋ Add
− 删除|− Removed
~ 修改|~ Changed
原：|Before: 
现：|After: 
内容没有变化。|No changes.
另有 |There are 
处变化，完整差异可从版本记录查看。|more changes. The complete diff is stored in version history.
修改已应用。构建预览后可检查完整图谱。|Changes applied. Build a preview to inspect the complete atlas.
把新资料接入现有图谱|Bring new material into the atlas
打开完整文本校对台 ↗|Open the text proofreader ↗
导入后先检查结构与引用，再查看增删改清单。完整队伍 bundle 会替换该队的路线集合。|Check structure and references, then review the diff. A complete team bundle replaces that team's route collection.
JSON 导入|Import JSON
文件类型|File type
完整图谱 / 队伍 bundle / 四份 JSON 集合|Full atlas / team bundle / four-file JSON collection
选择文件|Choose a file
也可以直接粘贴 JSON|Or paste JSON here
检查导入|Review import
共享节点合并|Merge shared nodes
选择保留的节点后，系统会检查受影响的关系与路线，生成统一修改清单。|Choose the node to keep. Review all affected relations and routes before applying the merge.
待合并节点|Node to merge
保留节点|Node to keep
检查合并影响|Review merge impact
拆分节点时，先添加新节点，再调整各条关系的起点、终点及路线引用；校验会列出尚未处理的引用。|To split a node, add the new nodes and update relation endpoints and route references. Validation reports unresolved references.
每次发布，都可以重建|A complete record of each release
完整源码由 iGEM CI/CD 构建为静态站点。每个版本固定当时的内容、布局与引擎，后续修订使用新的版本名称。|iGEM CI/CD builds the static site from source. Each release preserves its content, layouts, and engine. Publish later revisions under a new version name.
创建发布快照|Create a release
版本名称|Version name
例如 i2026.P0.2 或 i2026.R0.2|For example, i2026.P0.2 or i2026.R0.2
版本说明|Release notes
校验并生成版本|Validate & release
导出网页 CI 源码|Export website CI source
包含正式内容、前端、后台、布局核心、构建脚本与 CI 配置。已保存的草稿和本机运行记录独立保管。|Includes committed content, the reader, studio, layout engine, build scripts, and CI configuration. Local drafts and operational logs are kept separately.
导出网页 CI 源码包 ↗|Export website CI source ↗
当前内容：|Content revision: 
发布版本|Releases
支建模队伍|teams with routes
网页 CI 源码 ZIP|Website CI source ZIP
预览成品 ZIP|Preview build ZIP
版本清单|Manifest
比较并恢复此内容|Compare & restore content
尚无发布快照。|No releases yet.
内容修改记录|Content history
比较并恢复修改前的内容|Compare & restore the previous content
查看修改记录|View changes
尚无修改记录。|No changes recorded yet.
正在校验内容并处理构建任务…|Validating content and preparing the build…
任务未完成：|Task failed: 
任务已完成|Task complete
打开图谱预览 ↗|Open atlas preview ↗
排版检查通过|Layout checks passed
下载网页 CI 源码 ZIP|Download source ZIP
内容已重新载入。|Content reloaded.
该队伍已经存在，请从目录打开。|This team already exists. Open it from the directory.
内容已有更新，请重新载入后比较修改。|The collection has changed. Reload it and compare your changes before applying them.
请填写修改原因。|Enter a reason for this change.
队伍 bundle 必须包含全部集合。|A team bundle must contain every collection.
共享来源需在来源管理中修改：|Edit this shared source in the source collection: 
无法识别导入文件，请选择业务 JSON 文件类型，或导入完整图谱/队伍 bundle。|Unrecognized file. Choose its JSON type, or import a full atlas or team bundle.
请选择两个不同的现有节点。|Choose two different existing nodes.
合并会产生自连接，请先调整关系：|This merge creates a self-link. Update the relation first: 
版本格式应为 i年份.P或R基础图轮次.提交轮次，例如 i2026.P0.2。|Use iYEAR.P-or-R baseline-round.submission-round, for example i2026.P0.2.
此发布版本已存在，请使用新的修订号。|This release already exists. Use a new revision number.
只接受本机工作台的同源操作。|Only same-origin requests from the local studio are accepted.
文件或版本不存在。|File or version not found.
缺少必要字段：|Required field missing: 
已有构建正在执行，请等待完成。|A build is already running. Wait for it to finish.
请载入最新内容后构建。|Reload the latest content before building.
请载入最新内容后发布。|Reload the latest content before releasing.
请载入最新内容后导出。|Reload the latest content before exporting.
保存的草稿|Saved drafts
JSON 文本校对台|JSON text proofreader
在本机扫描中英文文本，修改、标记与核查来源。内容不会上传。修改后的 JSON 保留原结构；校对标记、标签和备注存入独立校对工程。|Review bilingual text and sources locally. Edited JSON preserves its structure; review notes are stored separately.
载入当前图谱文本|Load current atlas
导入 JSON / 校对工程|Import JSON / proofreading project
导出修改后的 JSON|Export edited JSON
保存校对工程|Save proofreading project
导出改动清单|Export changes
恢复本机暂存|Restore local draft
搜索文本、队名、节点 ID、JSON 路径或备注|Search text, team, node ID, JSON path, or notes
全部文件|All files
全部修改状态|All change states
仅已修改|Changed only
仅未修改|Unchanged only
全部校对状态|All review states
未校对|Unreviewed
已校对|Reviewed
待事实核查|Needs fact checking
按标签筛选|Filter by tag
显示 ID、链接等技术字段|Show IDs, URLs, and technical fields
显示原文|Show original text
建议校对 data/baseline.json、projects.json、roster.json 与 site-config.json。atlas.json 的布局和场景是派生成品，修改它不会自动回写源数据。相同文字可能存在于 description 与 narrative；可逐项修改，或使用“同记录同步同文”。来源链接仅供人工核查，本工具不判断事实真伪。|Review the four source JSON documents. Atlas layouts are generated output. Repeated descriptions may be synchronized within a record. Check source accuracy manually, then import corrected JSON in Content Studio to review and apply the changes.
根文档|Root document
已在本机暂存；建议保存校对工程作为备份。|Saved locally. Export the proofreading project for a backup.
本机暂存空间不足，请保存校对工程。|Local storage is full. Export the proofreading project.
原始链接|Original link
个文件 · |files · 
组文本 · |text groups · 
组已修改 · 筛选出 |changed · Showing 
组|groups
已修改|Changed
未修改|Unchanged
原文：|Original: 
标签，如：缺来源、术语|Tags, e.g. missing source, terminology
核查备注（不写入业务 JSON）|Review note (kept outside content JSON)
恢复本项原文|Restore original
同记录同步同文|Sync identical text in this record
没有匹配文本。导入 JSON 或调整筛选条件。|No matching text. Import JSON or change the filters.
上一页|Previous
下一页|Next
同名文件已载入，保留现有修改。|A file with this name is already loaded. Existing changes were preserved.
单文件超过 20 MB|The file exceeds 20 MB
校对工程结构不正确|Invalid proofreading project
已同步同记录内 |Synchronized 
处同文。|matching values in this record.
请先载入 JSON|Load JSON first
已导出完整 JSON；文本筛选不会删除未显示的数据。|Exported complete JSON, including content hidden by the filters.
没有本机暂存|No local draft
请在新开的校对页恢复暂存，避免覆盖当前会话。|Restore the draft in a new proofreader tab to preserve this session.
已恢复本机暂存|Local draft restored
文本|Text
新队伍草稿|Future outlook · draft
主题|Topic
节点|Nodes
来源|Sources
队名|Team name
年份|Year
网址|URL
国家|Country
城市|City
地区|Region
名称|Name
中文|中文
类型|Type
层级|Layer
情景|Scenario
依据|Basis
标题|Title
发布者|Publisher
邮箱|Email
记录|record
处变化|changes
无|None
`.trim().split('\n').map(line=>line.split('|'));
const translated=copy.slice().sort((a,b)=>b[0].length-a[0].length);
const literalPattern=new RegExp(translated.map(([zh])=>zh.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
const english=Object.fromEntries(copy);
function T(text){return language==='en'?String(text).replace(literalPattern,zh=>english[zh]):String(text);}
function UI(strings,...values){return strings.reduce((text,part,i)=>text+T(part)+(i<values.length?values[i]:''),'');}
function translatedLabels(labels){return new Proxy(labels,{get:(obj,key)=>typeof obj[key]==='string'?T(obj[key]):obj[key]});}
function localLabel(label){return label?.[language]||label?.en||label?.zh||'';}
// Capture only static shell text, before content is loaded. Never visit editable data.
const shellText=[],shellAttributes=[];
const originalTitle=document.title;
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()){const node=walker.currentNode;if(/[\u4e00-\u9fff]/.test(node.data)&&!node.parentElement.closest('script'))shellText.push([node,node.data]);}
document.querySelectorAll('[aria-label],[placeholder]').forEach(node=>{for(const attr of ['aria-label','placeholder'])if(node.hasAttribute(attr))shellAttributes.push([node,attr,node.getAttribute(attr)]);});
function translateShell(){document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=T(originalTitle);for(const [node,value] of shellText)node.data=T(value);for(const [node,attr,value] of shellAttributes)node.setAttribute(attr,T(value));document.querySelector('#studio-language').value=language;}
translateShell();
