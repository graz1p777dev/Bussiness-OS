const standardFields=new Set(['имя','клиент','название','телефон','город','источник','канал','этап','статус','ответственный','сумма','примечание','заметка','заметки']);
export function clientFieldNames(value:unknown){
 return [...new Set(String(value||'').split('\n').map(name=>name.trim()).filter(name=>name&&!standardFields.has(name.toLocaleLowerCase())))];
}
export function clientFieldInputName(name:string){return 'client-field:'+encodeURIComponent(name)}
export function readClientCustomFields(form:FormData,previous:Record<string,string>={}){
 const fields:[string,string][]=Object.entries(previous);
 for(const [key,value] of form.entries())if(key.startsWith('client-field:')&&typeof value==='string'){
  try{const name=decodeURIComponent(key.slice('client-field:'.length));if(name.trim())fields.push([name,value.trim()])}catch{/* Ignore fields that are not valid encoded names. */}
 }
 return Object.fromEntries(fields);
}
