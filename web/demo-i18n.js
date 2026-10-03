/* Bilingual embedding-example copy. User/content substitutions remain untouched. */
let language=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';
const phrases=`
图谱嵌入与功能示范|Atlas embedding explorer
把图谱放进你的网页|Bring the atlas to your page
选择初始内容，查看实际 iframe，再复制引用代码。展示模式仅隐藏编辑元素；阅读、比较、搜索、来源、语言和导出功能保留。|Choose the initial view, try the live iframe, and copy the embed code. The published reader supports exploration, comparison, search, sources, languages, and export.
呈现方式|Presentation
嵌入展示 · 精简页头|Embedded · compact header
完整展示 · 保留导航|Full reader · with navigation
高度（像素）|Height (pixels)
选择队伍：单队聚焦或多队比较|Choose teams: focus on one or compare several
选中全部|Select all
基础系统|Baseline
单队时只看本队联系|Show only this team's links when one team is selected
地面系统|Ground systems
初始聚焦节点|Initial node focus
中文、英文、队名或节点 ID|Chinese, English, team name, or node ID
按设置重新载入|Reload with these settings
打开独立展示页 ↗|Open standalone reader ↗
太空物质循环图谱|Space Material Atlas
等待载入…|Waiting to load…
宿主页面控制|Control from the host page
以下操作无需重新载入 iframe。以 HTTP 打开时可用；file:// 仍能阅读，但没有跨页控制。iframe 内部的按钮同样可操作。|These controls work over HTTP without reloading the iframe. Local files support reading but not host messaging. Controls inside the iframe also remain available.
应用所选队伍|Apply selected teams
切换到所选主题|Apply selected topic
切换语言|Apply language
应用地面系统设置|Apply ground-system setting
聚焦所填节点|Focus on selected node
适应画面|Fit to view
取消单队聚焦|Clear team focus
读取当前状态|Read current state
可复制的 iframe|Embed code
复制引用代码|Copy embed code
代码跟随上方设置。共享给其他队伍时必须替换为已发布的 iGEM 图谱地址；本机草稿不会随 URL 分享。新队伍先合并并发布，再用其 ID 引用。|The code follows the settings above. When sharing it, use the published iGEM atlas URL. Local drafts are not shared by URL. Publish a new team before referring to its ID.
回传状态与节点事件|State and node events
等待 ready|Waiting for ready
最近消息|Recent messages
可以在组件中体验的功能|Reader features
切换基础图与全部队伍，单队聚焦、多队对比；切换主题，展开工艺步骤。|Explore the baseline, focus on one team, compare several teams, and open a topic's process steps.
搜索节点，Ctrl / ⌘ + 滚轮缩放、拖动平移、适应画面；普通滚轮继续滚动外层网页。触屏支持单指拖动和双指缩放，点击节点、连线或角标查看来源。|Search nodes, use Ctrl / Command + wheel to zoom, drag to pan, or fit the view. A plain wheel scrolls the host page. Touch supports one-finger panning and pinch zoom. Select a node, link, or badge to inspect its sources.
开关地面系统；切换中英文；导出当前 SVG 和 JSON。|Toggle ground systems, switch between English and Chinese, or export SVG and JSON.
完整展示保留队伍目录、来源、About 和嵌入页，隐藏填写、修改、导入与删除入口。|The full reader includes the team directory, references, About, and embedding pages. Editing is available in the local Content Studio.
消息协议与安全来源|Messaging and allowed origins
所有消息带 version: 1。宿主校验 event.source 与 event.origin，组件只接受指定父页面。set-teams、set-view、focus-node、set-language、set-ground、fit、reset-focus、get-state 的完整示例可查看本页脚本。|Messages use version: 1. The host checks event.source and event.origin; the component accepts its designated parent only. This page demonstrates set-teams, set-view, focus-node, set-language, set-ground, fit, reset-focus, and get-state.
工艺联系与改良|Process links & improvements
所选队伍相关节点：|Related nodes: 
，当前列出 | · Showing 
个；继续输入关键词可缩小范围。| · Type to narrow the results.
file:// 阅读预览；跨页控制需 HTTP。|Local-file preview; host controls require HTTP.
正在载入…|Loading…
请先从关键词匹配结果中选择节点。|Choose a node from the search results first.
引用代码已复制|Embed code copied
请选中代码复制|Select the code and copy it
总图|Overview
主题|Topic
语言|Language
`.trim().split('\n').map(s=>s.split('|'));
const dict=Object.fromEntries(phrases),pattern=new RegExp(phrases.sort((a,b)=>b[0].length-a[0].length).map(([s])=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
function T(s){return language==='en'?String(s).replace(pattern,key=>dict[key]):String(s);}
function UI(parts,...values){return parts.reduce((s,p,i)=>s+T(p)+(i<values.length?values[i]:''),'');}
function localLabel(x){return x[language]||x.en||x.zh;}
const shell=[],attrs=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),originalTitle=document.title;
while(walker.nextNode()){const n=walker.currentNode;if(/[\u4e00-\u9fff]/.test(n.data)&&!n.parentElement.closest('script,style'))shell.push([n,n.data]);}
document.querySelectorAll('[placeholder],[title]').forEach(n=>{for(const k of ['placeholder','title'])if(n.hasAttribute(k))attrs.push([n,k,n.getAttribute(k)]);});
function translateShell(){document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=T(originalTitle);for(const[n,v]of shell)n.data=T(v);for(const[n,k,v]of attrs)n.setAttribute(k,T(v));document.querySelector('#language').value=language;}
translateShell();
