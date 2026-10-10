import {parseWorkflowImport} from './workflow-schema.ts';
import {validateWorkflow} from './workflow-validation.ts';
type Graph=ReturnType<typeof parseWorkflowImport>;
export function proposeWorkflowChange(graph:Graph,request:string,stages:string[],id:()=>string){
 const nodes=structuredClone(graph.nodes),edges=structuredClone(graph.edges),changes:string[]=[];
 const text=request.toLowerCase();
 function append(kind:string,label:string,data:Record<string,unknown>={}){const tails=nodes.filter(n=>!edges.some(e=>e.source===n.id));if(tails.length!==1)throw new Error('В схеме несколько концов. Выберите место нового блока на холсте; помощник не будет угадывать ветку.');const tail=tails[0],nodeId=id();nodes.push({id:nodeId,type:'agent',position:{x:tail.position.x+300,y:tail.position.y},data:{kind,label,...data}});edges.push({id:id(),source:tail.id,target:nodeId});changes.push('Добавлен блок: '+label)}
 if(/новый сценарий|создай сценарий|с нуля/.test(text)){nodes.splice(0,nodes.length,{id:id(),type:'agent',position:{x:70,y:150},data:{kind:'Trigger',label:'Входящий клиент',source:'Все'}});edges.splice(0);changes.push('Создан новый сценарий с входящим событием')}
 const stage=stages.filter(s=>text.includes(s.toLowerCase())).sort((a,b)=>b.length-a.length)[0];
 if(stage&&/этап|перенес|перевед|перевод/.test(text)){const existing=nodes.find(n=>n.data.kind==='CRM'&&n.data.action!=='assign-agent');if(existing){existing.data={...existing.data,stage,action:'move'};changes.push('Этап в CRM → '+stage)}else append('CRM','Перенести этап',{action:'move',stage})}
 const channel=/whatsapp|ватсап/.test(text)?'WhatsApp':/telegram|телеграм/.test(text)?'Telegram':/instagram|инстаграм/.test(text)?'Instagram':null;
 if(channel&&/источник|канал|только|из /.test(text)){const trigger=nodes.find(n=>n.data.kind==='Trigger');if(trigger){trigger.data.source=channel;changes.push('Источник события → '+channel)}}
 if(/остатк|наличи.*товар|провер.*товар/.test(text))append('Inventory','Проверить остатки',{tool:'get_inventory'});
 const message=request.match(/(?:сообщение|ответ|текст)\s*[:—-]?\s*[«"“]([^»"”]+)[»"”]/i);
 if(message){const existing=nodes.find(n=>n.data.kind==='Message');if(existing){existing.data.template=message[1];changes.push('Обновлён текст сообщения')}else append('Message','Подготовить ответ',{template:message[1],channel:'Канал клиента'})}
 if(/подтвержден|подтверждени|одобрени/.test(text)&&!/без подтвержден|убери подтвержден/.test(text))append('Human Approval','Подтверждение сотрудника',{approver:'Владелец'});
 const minutes=text.match(/(?:ожидание|подожди|задержк[а-яё]*)\s*(\d+)\s*(?:мин|час)/);if(minutes){const value=Number(minutes[1])*(minutes[0].includes('час')?60:1);if(value<1||value>10080)throw new Error('Ожидание должно быть от 1 минуты до 7 дней');append('Delay','Ожидание',{minutes:value})}
 if(/выровн|упорядоч.*блок/.test(text)){nodes.forEach((n,i)=>{n.position={x:70+(i%3)*300,y:90+Math.floor(i/3)*150}});changes.push('Выровнено расположение блоков')}
 if(!changes.length)throw new Error('Локальный помощник не понял изменение. Попробуйте: «Перенеси на этап …», «Проверь остатки», «Добавь подтверждение», «Сообщение: «ваш текст»», «Задержка 10 минут» или «Выровняй блоки». Свободное редактирование по любому запросу потребует подключённой модели.');
 const result=parseWorkflowImport({version:1,nodes,edges});const errors=validateWorkflow(result.nodes,result.edges,stages);if(errors.length)throw new Error(errors.join('\n'));return {graph:result,changes};
}
export const workflowCode=(graph:Graph)=>JSON.stringify({version:1,nodes:graph.nodes,edges:graph.edges},null,2);
