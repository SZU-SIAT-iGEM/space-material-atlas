"""Build a public reader from the maintained viewer, excluding contribution code."""
import re

def reader_app(source):
    # Delimited source regions: retained editor source is available only to the local manager.
    start = source.index('/* Contribution form:')
    end = source.index('/* Navigation, graph interaction and contribution actions. */')
    source = source[:start] + source[end:]
    source = re.sub(r'readOnly=embedded\|\|[^;]+;', 'readOnly=true;', source, count=1)
    source = re.sub(r'^function (loadDrafts|persistDrafts)\(.*\n', '', source, flags=re.M)
    start = source.index(' if(button.dataset.removeDraft)')
    end = source.index(" if(button.id==='copy-embed')", start)
    source = source[:start] + source[end:]
    source = re.sub(r"^\$\('#bundle-import'\).*\n", '', source, flags=re.M)
    source = source.replace("if(t.dataset.bind){setBinding(t.dataset.bind,t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value);return}if(t.dataset.endpoint){const [i,key]=t.dataset.endpoint.split(':');editorRelations[+i][key]=resolveChoice(t.value)}", '')
    source = source.replace("if(pageName==='contribute'&&editorBundle)renderEditor();else showPage(pageName)", 'showPage(pageName)')
    source = source.replace("if(name==='contribute'){openEditor();return}", "if(name==='contribute'){showGraph();return}")
    source = source.replace("if(!owners()[id]){openEditor(id);return}", 'if(!owners()[id]){teamPage(id);return}')
    source = source.replace("if(button.dataset.editTeam){openEditor(button.dataset.editTeam);return}", '')
    source = re.sub(r'^ if\(button\.dataset\.exportDescription\).*\n', '', source, flags=re.M)
    source = source.replace('loadDrafts();', '')
    source = source.replace("if(hash==='contribute'&&!readOnly)openEditor();else if(", 'if(')
    source = re.sub(r'<button class="control[^"\n]*editor-action"[^>]*>.*?</button>', '', source)
    source = source.replace("contribute:['填写路线','Contribute'],", '')
    source = source.replace("rosterYear=2026", "rosterYear=Math.max(...DATA.roster.teams.map(t=>t.year))")
    source = source.replace('[2024,2025,2026].map(y=>', '[...new Set(DATA.roster.teams.map(t=>t.year))].sort((a,b)=>a-b).map(y=>')
    source = source.replace("'2024—2025 年的 21 支队伍与 2026 年的 17 支队伍，共同构成 Space Village 的项目目录。已加入的路线可以直接聚焦查看；新路线从填写团队资料开始。','The directory brings together 21 teams from 2024–2025 and 17 teams from 2026. Explore existing routes, or contribute a new team route.'", "`目录收录 ${DATA.roster.teams.length} 支队伍，其中 ${p.teams.length} 支已有项目路线。选择年份可浏览各年的队伍。`,`The directory includes ${DATA.roster.teams.length} teams, with routes for ${p.teams.length}. Select a year to explore its teams.`")
    source = source.replace('从自己的项目出发，补充与现有物质和工艺的联系。', '队伍已列入名录，等待增补项目路线。').replace('Add your project and its links to existing materials and processes.', 'Listed in the directory; awaiting additions to its project routes.')
    source = source.replace('这支队伍已列入 Space Village 名录。项目路线可通过团队表单加入图谱。', '这支队伍已列入 Space Village 名录，项目路线待补充。').replace('This team is listed in Space Village. Its project route can be added through the contribution form.', 'This team is listed in Space Village; its project route is not yet available.')
    source = source.replace('团队可以通过表单填写路线，导出资料文件，并发送给维护者。', '新增资料与修订建议可发送给维护者，经整理后加入后续版本。').replace('Teams can fill in a route, export the contribution file and send it to the maintainers.', 'Send additional materials and corrections to the maintainers for inclusion in a future version.')
    source = source.replace('保留完整导航（展示模式，仅隐藏编辑入口）', '保留完整阅读导航').replace('Keep full navigation (display mode, editing hidden)', 'Keep full reader navigation')
    source = re.sub(r'<div class="stat-line">21 <span>.*?</div><div class="stat-line">17 <span>.*?</div>', '<div class="stat-line">${DATA.roster.teams.length} <span>${L("名录队伍","Listed teams")}</span></div><div class="stat-line">${p.teams.length} <span>${L("已有项目路线","Teams with routes")}</span></div>', source)
    return source

def reader_template(source):
    source = source.replace('<title>', '<link rel="icon" href="__BRAND_ICON__"><title>', 1)
    source = re.sub(r'<button[^>]*data-page="contribute"[^>]*>.*?</button>', '', source)
    return re.sub(r'<input[^>]*id="bundle-import"[^>]*>', '', source)

def reader_demo(source):
    return source.replace('<option value="edit">普通模式 · 显示编辑入口</option>', '')
