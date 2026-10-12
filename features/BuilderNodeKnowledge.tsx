'use client';
import {useEffect,useState} from 'react';
import {BookOpen,FileText} from 'lucide-react';
import {useStored} from '../lib/os/storage';
import {initialDocuments,documentBlob} from '../lib/os/documents';
import {collectAgentKnowledge,emptyAgentKnowledge,type AgentKnowledge} from '../lib/os/agent-knowledge';
import './BuilderNodeKnowledge.css';
const emptyInstructions:Record<string,string>={};
export default function BuilderNodeKnowledge({selected,onChange,canEdit,canRead}:{selected:string[];onChange:(ids:string[])=>void;canEdit:boolean;canRead:boolean}){
 const [entries]=useStored('documents-explorer-v1',initialDocuments),[instructions]=useStored('knowledge-space-instructions-v1',emptyInstructions);
 const signature=JSON.stringify([selected,entries,instructions,canRead]);const [loaded,setLoaded]=useState<{signature:string;value:AgentKnowledge}>({signature:'',value:emptyAgentKnowledge});
 useEffect(()=>{let active=true;collectAgentKnowledge(selected,entries,instructions,canRead,documentBlob).then(value=>{if(active)setLoaded({signature,value})});return()=>{active=false}},[signature,selected,entries,instructions,canRead]);
 const spaces=canRead?entries.filter(entry=>entry.kind==='folder'&&!entry.parent&&!entry.deleted):[],knowledge=canRead&&loaded.signature===signature?loaded.value:emptyAgentKnowledge;
 return <section className="builder-node-knowledge"><h4><BookOpen size={16}/>Знания этого блока</h4><p>Выбери пространства. Документы и инструкции попадут в контекст именно этого узла.</p>{spaces.map(space=><label className="check-label" key={space.id}><input type="checkbox" disabled={!canEdit} checked={selected.includes(space.id)} onChange={event=>onChange(event.target.checked?[...selected,space.id]:selected.filter(id=>id!==space.id))}/>{space.name}</label>)}{selected.filter(id=>!spaces.some(space=>space.id===id)).map(id=><label className="check-label" key={id}><input type="checkbox" disabled={!canEdit} checked onChange={()=>onChange(selected.filter(value=>value!==id))}/>Недоступное пространство · отключить</label>)}{!canRead&&<p>База знаний недоступна вашей роли.</p>}{canRead&&!spaces.length&&<p>Создайте пространство в базе знаний.</p>}{canRead&&selected.length>0&&loaded.signature!==signature&&<p role="status">Читаем материалы…</p>}{knowledge.spaces.map(space=><details key={space.id} open><summary>{space.name} · {knowledge.documents.filter(doc=>doc.spaceId===space.id).length} документов в контексте</summary><h5>Инструкции пространства</h5><pre>{space.instructions||'Не заданы'}</pre><h5>Документы</h5>{knowledge.documents.filter(doc=>doc.spaceId===space.id).map(doc=><details key={doc.id}><summary><FileText size={13}/>{doc.name}</summary><pre>{doc.text}</pre></details>)}</details>)}{knowledge.warnings.map((warning,index)=><p className="builder-knowledge-warning" key={index}>{warning}</p>)}<small>Локальный тест показывает инструкции и подходящие цитаты. Языковая модель в Builder пока не вызывается.</small></section>
}
