export type DocumentEntry={id:string;parent:string|null;name:string;kind:'folder'|'file';text?:string;mime?:string;size?:number;blob?:boolean;favorite?:boolean;deleted?:boolean;modified:string};
export const initialDocuments:DocumentEntry[]=[{id:'sales',parent:null,name:'Продажи',kind:'folder',modified:'2026-10-05'},{id:'team',parent:null,name:'Команда',kind:'folder',modified:'2026-10-05'},...['Каталог косметики','Правила консультации','Доставка и оплата','Ответы на частые вопросы'].map((name,i)=>({id:'doc-'+i,parent:i===1?'team':'sales',name:name+'.md',kind:'file' as const,mime:'text/markdown',modified:'2026-10-05',text:['Beauty of Joseon SPF 50 — 1 800 сом. Мягкое очищение и подбор ухода.','Уточните тип кожи, текущий уход и чувствительность.','Бишкек: доставка курьером. Оплата наличными или переводом.','Как выбрать SPF? Уточните тип кожи и предпочтения клиента.'][i]}))];
export function descendants(entries:DocumentEntry[],id:string){const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const entry of entries)if(entry.parent&&ids.has(entry.parent)&&!ids.has(entry.id)){ids.add(entry.id);changed=true}}return ids}
export function moveDocuments(entries:DocumentEntry[],ids:string[],parent:string|null){if(parent&&!entries.some(e=>e.id===parent&&e.kind==='folder'&&!e.deleted))throw new Error('Папка назначения недоступна');const selected=new Set(ids);const blocked=new Set<string>();for(const id of ids)for(const child of descendants(entries,id))blocked.add(child);if(parent&&blocked.has(parent))throw new Error('Нельзя переместить папку внутрь себя');const roots=entries.filter(e=>selected.has(e.id)&&!entries.some(ancestor=>ancestor.id!==e.id&&selected.has(ancestor.id)&&descendants(entries,ancestor.id).has(e.id)));const names=new Set<string>();for(const e of roots){const key=e.name.toLowerCase();if(names.has(key)||entries.some(x=>!selected.has(x.id)&&!x.deleted&&x.parent===parent&&x.name.toLowerCase()===key))throw new Error('В папке уже есть «'+e.name+'»');names.add(key)}const rootIds=new Set(roots.map(e=>e.id));return entries.map(e=>rootIds.has(e.id)?{...e,parent,modified:new Date().toISOString()}:e)}
export function trashDocuments(entries:DocumentEntry[],ids:string[],deleted=true){const affected=new Set<string>();ids.forEach(id=>descendants(entries,id).forEach(child=>affected.add(child)));return entries.map(e=>affected.has(e.id)?{...e,deleted}:e)}
export function restoreDocuments(entries:DocumentEntry[],ids:string[]){
 const restored=trashDocuments(entries,ids,false);
 const placed=restored.map(entry=>{const parent=restored.find(e=>e.id===entry.parent);return ids.includes(entry.id)&&entry.parent&&(!parent||parent.deleted)?{...entry,parent:null}:entry});
 const occupied=new Map<string,Set<string>>();
 const namesIn=(parent:string|null)=>{const key=parent||'';if(!occupied.has(key))occupied.set(key,new Set());return occupied.get(key)!};
 const wasDeleted=new Set(entries.filter(e=>e.deleted).map(e=>e.id));
 for(const entry of placed)if(!entry.deleted&&!wasDeleted.has(entry.id))namesIn(entry.parent).add(entry.name.toLowerCase());
 return placed.map(entry=>{
  if(entry.deleted||!wasDeleted.has(entry.id))return entry;
  const names=namesIn(entry.parent);let name=entry.name;let suffix=1;
  const dot=entry.kind==='file'?entry.name.lastIndexOf('.'):-1;const base=dot>0?entry.name.slice(0,dot):entry.name;const extension=dot>0?entry.name.slice(dot):'';
  while(names.has(name.toLowerCase()))name=base+' (восстановлено '+(suffix++)+')'+extension;
  names.add(name.toLowerCase());return {...entry,name};
 });
}
function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('business-os-document-files',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
export async function documentBlob(id:string,blob?:Blob){const db=await database();try{return await new Promise<Blob|undefined>((resolve,reject)=>{const transaction=db.transaction('files',blob?'readwrite':'readonly');const store=transaction.objectStore('files');const request=blob?store.put(blob,id):store.get(id);let result:Blob|undefined;request.onsuccess=()=>{result=blob||request.result};transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})}finally{db.close()}}

export function migrateKnowledge(entries:DocumentEntry[],legacy:unknown):DocumentEntry[]{
 if(entries.some(e=>e.id==='legacy-knowledge')||!Array.isArray(legacy))return entries;
 const rows=legacy.filter((row):row is {id:string;name:string;note?:string}=>Boolean(row&&typeof row==='object'&&typeof row.id==='string'&&typeof row.name==='string'));
 if(!rows.length)return entries;
 const modified=new Date().toISOString();
 return [...entries,{id:'legacy-knowledge',parent:null,name:'Из прежней базы знаний',kind:'folder',modified},...rows.map(row=>({id:'legacy-knowledge-'+row.id,parent:'legacy-knowledge',name:row.name,kind:'file' as const,text:typeof row.note==='string'?row.note:'',mime:'text/plain',modified}))];
}
export function isTextDocument(entry:Pick<DocumentEntry,'mime'|'name'>){return Boolean(entry.mime?.startsWith('text/')||['application/json','application/xml'].includes(entry.mime||'')||/\.(txt|csv|md|json|xml|log|yaml|yml)$/i.test(entry.name))}
export async function saveDocumentBlobs(files:{id:string;blob:Blob}[]){
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('files','readwrite');const store=transaction.objectStore('files');for(const file of files)store.put(file.blob,file.id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})}finally{db.close()}
}
