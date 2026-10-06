export type PlanningPerson={id:string;name:string;active?:boolean};
export type PlanningPersonOption={value:string;name:string;id?:string};
export function planningPersonKey(people:PlanningPerson[],name:string,id?:string):string{
 if(id)return id;
 const exact=people.filter(person=>person.name===name);
 if(exact.length===1)return exact[0].id;
 const firstName=people.filter(person=>person.name.split(' ')[0]===name);
 return exact.length===0&&firstName.length===1?firstName[0].id:'legacy:'+name;
}
export function planningPersonOptions(people:PlanningPerson[],name='',id?:string):PlanningPersonOption[]{
 const selected=planningPersonKey(people,name,id);
 const options=people.filter(person=>person.active!==false||person.id===selected&&Boolean(name||id)).map(person=>({value:person.id,id:person.id,name:person.name}));
 if(name&&!options.some(option=>option.value===selected))return [...options,{value:selected,id,name}];
 return options;
}
