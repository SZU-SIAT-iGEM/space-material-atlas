async function exportTeamReport(id,button){
 if(readOnly)return;
 const previous=button?.textContent;if(button)button.disabled=true;
 try{
  let projects=C.clone(p);if(id==='editor'){const bundle=checkedForm();if(!bundle)return;projects=C.upsert(b,projects,bundle);id=bundle.team.id}
  const team=projects.teams.find(t=>t.id===id);if(!team)throw Error('Unknown team');
  const all=Object.fromEntries([...b.nodes,...projects.nodes].map(n=>[n.id,n])),relations=[...projects.edges,...projects.dependencies,...projects.enhancements].filter(e=>e.owner===id),used=new Set(relations.flatMap(e=>[e.source,e.target]));
  const sources=Object.fromEntries([...b.sources,...projects.sources].map(s=>[s.id,s]));
  const sourceIDs=new Set([...team.source_ids,...relations.flatMap(e=>e.source_ids||[]),...[...used].flatMap(k=>all[k].source_ids||[])]);
  const bundle=C.teamBundle(projects,id),files=[{name:'team-bundle.json',text:JSON.stringify(bundle,null,2)}],diagrams=[];
  for(const v of DATA.views){const m=C.project(b,projects,v),edges=m.edges.filter(e=>e.owner===id),nodesUsed=new Set(edges.flatMap(e=>[e.source,e.target]));if(!edges.length)continue;const model={...m,edges,nodes:Object.fromEntries(Object.entries(m.nodes).filter(([k])=>nodesUsed.has(k)))};
   for(const language of ['zh','en']){if(button)button.textContent=`${v} · ${language}`;await new Promise(resolve=>setTimeout(resolve,0));const g=await R.layout(model,language),svg=R.render(model,g,b,projects,language),name=`diagrams/${v}-${language}.svg`;files.push({name,text:svg});diagrams.push({view:v,language,file:name,nodes:Object.keys(model.nodes),relations:edges.map(e=>e.id)})}
  }
  const text=x=>typeof x==='object'?`中文：${x?.zh||''}\n\nEnglish: ${x?.en||''}`:String(x||''),mdEscape=s=>String(s||'').replace(/[\r\n]+/g,' ');
  const md=[`# ${team.year} ${team.name}`,`队伍 ID：${id}`,team.url?`[项目主页](${team.url})`:'项目主页：未提供',text(team.narrative||{zh:team.description,en:team.description_en}),'## 图谱文件','这些图仅显示本队关系及其端点；共享节点保留，其他队伍的连接和改良不包含。'];
  for(const d of diagrams)md.push(`- [${d.view} · ${d.language}](${d.file})`);
  md.push('## 路线');for(const c of team.chains)md.push(`### ${mdEscape(c.label.zh)}${c.demonstration?'（示范）':''}`,text(c.label),`ID: ${c.id}`,c.step_ids.map(k=>all[k]?.label.zh||k).join(' → '));
  md.push('## 本队节点与共享端点');for(const k of new Set([...bundle.nodes.map(n=>n.id),...used])){const n=all[k];md.push(`### ${mdEscape(n.label.zh)} · ${k}`,`${n.owner===id?'本队节点':'共享或其他队伍端点'} / ${n.kind}`,text(n.label),text(n.narrative||{zh:n.description,en:n.description_en}),`来源 ID：${(n.source_ids||[]).join(', ')}`)}
  md.push('## 连接与改良');for(const e of relations)md.push(`### ${e.source} → ${e.target}`,`ID: ${e.id} / ${e.category}`,text(e.label),e.scope?text({zh:e.scope,en:e.scope_en}):'',`来源 ID：${(e.source_ids||[]).join(', ')}`);
  md.push('## 来源');for(const sid of sourceIDs){const s=sources[sid];if(s)md.push(`### ${mdEscape(s.title)} · ${sid}`,s.display_url||s.url||'团队提供的资料，无公开链接',text(s.description))}
  files.push({name:'team-description.md',text:md.join('\n\n')},{name:'manifest.json',text:JSON.stringify({team:id,diagrams},null,2)});
  AtlasDownload.save(`${id}-description.zip`,AtlasDownload.zip(files));toast(L('队伍总览、分图和中英文文字已导出','Team diagrams and bilingual text exported'));
 }catch(e){toast(e.message);console.error(e)}finally{if(button){button.disabled=false;button.textContent=previous}}
}
