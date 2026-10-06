import type {Entity} from './data';
export type ReplyTemplate={id:string;name:string;body:string};
export const replyVariables=[['имя','Имя'],['клиент','Полное имя'],['сумма','Сумма сделки'],['этап','Этап'],['канал','Канал'],['ответственный','Ответственный'],['заметка','Заметка'],['id','ID сделки'],['телефон','Телефон'],['город','Город']] as const;
export const initialReplyTemplates:ReplyTemplate[]=[
 {id:'greeting',name:'Первое приветствие',body:'Здравствуйте, {{имя}}! Спасибо за обращение. Подскажите, чем можем помочь?'},
 {id:'payment',name:'Подтверждение заказа',body:'{{имя}}, сумма вашей сделки — {{сумма}}. Ваш менеджер — {{ответственный}}. Подскажите, удобно ли сейчас обсудить детали?'},
 {id:'followup',name:'Повторный контакт',body:'Здравствуйте, {{имя}}! Возвращаюсь к нашему разговору. Остались ли вопросы? Буду рад помочь.'},
];
export function renderReply(body:string,customer:Entity){
 const values:Record<string,string>={имя:customer.name.trim().split(/\s+/)[0]||'',клиент:customer.name,сумма:new Intl.NumberFormat('ru-RU').format(customer.value)+' сом',этап:customer.status,канал:customer.channel,ответственный:customer.owner,заметка:customer.note,id:customer.id,телефон:customer.phone||'',город:customer.city||''};
 const missing=new Set<string>();const text=body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(token,key:string)=>{const value=values[key];if(value===undefined||!value.trim()){missing.add(key);return token}return value});
 return {text,missing:[...missing]};
}
