export const assistantProfiles=[
 {id:'general',name:'Общий помощник',color:'#a78bfa',icon:'sparkles'},
 {id:'analytics',name:'Аналитика',color:'#5ba6ef',icon:'chart'},
 {id:'sales',name:'Продажи',color:'#4fb79b',icon:'bag'},
 {id:'team',name:'Управление командой',color:'#e4a35a',icon:'team'},
 {id:'planning',name:'Планирование',color:'#df83b4',icon:'target'},
] as const;
export function assistantProfile(chat:{agentId?:string;context:string;id:string}){
 return assistantProfiles.find(profile=>profile.id===chat.agentId)||assistantProfiles.find(profile=>profile.name===chat.context)||assistantProfiles[Number(chat.id.replace('default-',''))]||assistantProfiles[0];
}
export function assistantTopic(text:string){
 const line=text.replace(/\s+/g,' ').trim();
 return line.length>54?line.slice(0,51).trimEnd()+'…':line||'Новый разговор';
}
