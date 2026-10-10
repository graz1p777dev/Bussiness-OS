import {navigation} from './data.ts';
export const teamActions={create:'Создание записей',edit:'Редактирование',remove:'Удаление',export:'Экспорт данных',ai:'Запуск ИИ',finance:'Финансовые операции',inventory:'Проведение складских документов',manageTeam:'Управление сотрудниками',password:'Пароль и защита своего аккаунта',production:'Действия в production'};
export type TeamAction=keyof typeof teamActions;
export type TeamRole={id:string;name:string;pages:string[];actions:TeamAction[];pageActions?:Record<string,TeamAction[]>};
export type EmployeeProfileHistory={id:string;at:string;actorId:string;action:string};
export type Employee={id:string;name:string;email:string;position:string;role:string;status:'Активен'|'Заблокирован'|'Уволен';passwordChangedAt?:string;forcePasswordChange?:boolean;department?:string;kpi?:string;salary?:number;payScheme?:string;contract?:string;duties?:string;hiringPurpose?:string;mainObjective?:string;profileHistory?:EmployeeProfileHistory[]};
export const initialRoles:TeamRole[]=[
 {id:'owner',name:'Владелец',pages:navigation.map(n=>n[1]),actions:Object.keys(teamActions) as TeamAction[]},
 {id:'admin',name:'Администратор',pages:navigation.map(n=>n[1]),actions:(Object.keys(teamActions) as TeamAction[]).filter(action=>action!=='production')},
 {id:'manager',name:'Менеджер',pages:['dashboard','assistant','crm','conversations','customers','appointments','pos','reports','orders','tasks','calendar','my-time','messenger','knowledge','help'],actions:['create','edit','finance','ai','password']},
 {id:'cashier',name:'Кассир',pages:['dashboard','pos','crm','customers','reports','tasks','my-time','messenger','help'],actions:['create','edit','finance','password'],pageActions:{crm:[],customers:[],tasks:[],dashboard:[]}},
 {id:'operator',name:'Оператор',pages:['dashboard','crm','customers','conversations','appointments','reports','tasks','calendar','my-time','messenger','knowledge','help'],actions:['create','edit','ai','password']},
 {id:'warehouse',name:'Склад',pages:['dashboard','inventory','pos','tasks','my-time','messenger','help'],actions:['create','edit','inventory','password']},
 {id:'analyst',name:'Аналитик',pages:['dashboard','assistant','analytics','planning','agents','help'],actions:['export','ai','password']},
 {id:'custom',name:'Своя роль',pages:['help'],actions:[]},
];
export const initialEmployees:Employee[]=[{id:'owner-user',name:'Алихан Торебеков',email:'alihan@demiresults.kg',position:'Основатель',role:'owner',status:'Активен'},{id:'aiym',name:'Айым Абдиева',email:'aiym@demiresults.kg',position:'Менеджер продаж',role:'manager',status:'Активен'},{id:'nuriza',name:'Нуриза Асанова',email:'nuriza@demiresults.kg',position:'Менеджер продаж',role:'manager',status:'Активен'},{id:'medina',name:'Медина Осмонова',email:'medina@demiresults.kg',position:'Консультант',role:'manager',status:'Активен'}];
export function resolvedRolePages(role:TeamRole|undefined){return role?.id==='owner'?navigation.map(item=>item[1]):role?.pages||[]}
export function resolvedRoleActions(role:TeamRole|undefined,page?:string){return page&&role?.pageActions&&Object.hasOwn(role.pageActions,page)?role.pageActions[page]:role?.actions||[]}
export function hasAccess(employee:Employee|undefined,roles:TeamRole[],page?:string,action?:TeamAction){if(!employee||employee.status!=='Активен')return false;const role=roles.find(r=>r.id===employee.role);return Boolean(role&&(!page||resolvedRolePages(role).includes(page))&&(!action||resolvedRoleActions(role,page).includes(action)))}
export type ActionPermissions=Record<TeamAction,boolean>;
export function actionPermissions(employee:Employee|undefined,roles:TeamRole[],page:string):ActionPermissions{return Object.fromEntries((Object.keys(teamActions) as TeamAction[]).map(action=>[action,hasAccess(employee,roles,page,action)])) as ActionPermissions}
export function requiresPasswordChange(employee:Employee|undefined){return employee?.status==='Активен'&&employee.forcePasswordChange===true}

export type EmployeeActor={employeeId:string;permissions?:ActionPermissions};
export function canManageEmployees(actor:EmployeeActor,employees:Employee[]){return employees.some(employee=>employee.id===actor.employeeId&&employee.status==='Активен')&&(actor.permissions?.manageTeam??actor.employeeId==='owner-user')}
export function recordEmployeeHistory(employee:Employee,actorId:string,action:string,now:string):Employee{return {...employee,profileHistory:[{id:now+'-'+(employee.profileHistory?.length||0),at:now,actorId,action},...(employee.profileHistory||[])]}}
export function employeeProfileForViewer(employee:Employee,canViewSalary:boolean):Employee{if(canViewSalary)return employee;const safe={...employee};delete safe.salary;delete safe.payScheme;return safe}
export function saveEmployeeProfile(employees:Employee[],roles:TeamRole[],input:Employee,actor:EmployeeActor,now:string):Employee[]{
 if(!canManageEmployees(actor,employees))throw new Error('Управление сотрудниками запрещено вашей ролью.');
 const previous=employees.find(employee=>employee.id===input.id),name=input.name.trim(),email=input.email.trim().toLowerCase();
 if(!name||!email||!email.includes('@'))throw new Error('Укажите имя и корректный email сотрудника.');
 if(employees.some(employee=>employee.id!==input.id&&employee.email.toLowerCase()===email))throw new Error('Этот email уже используется.');
 const role=input.id==='owner-user'?'owner':input.role;
 if(!roles.some(item=>item.id===role))throw new Error('Выберите существующую роль.');
 if(input.salary!==undefined&&(!Number.isFinite(input.salary)||input.salary<0))throw new Error('Укажите неотрицательный оклад.');
 const fields=['position','department','kpi','salary','payScheme','contract','duties','hiringPurpose','mainObjective'] as const;
 const next:Employee={...previous,id:input.id,name,email,role,position:input.position.trim(),status:previous?.status||'Активен'};
 for(const field of fields){const value=input[field];Object.assign(next,{[field]:typeof value==='string'?value.trim():value})}
 const labels:Record<string,string>={name:'имя',email:'email',role:'роль',position:'должность',department:'отдел',kpi:'KPI',salary:'оклад',payScheme:'схема оплаты',contract:'договор',duties:'обязанности',hiringPurpose:'цель найма',mainObjective:'главная задача'};
 const changed=['name','email','role',...fields].filter(field=>previous?.[field as keyof Employee]!==next[field as keyof Employee]);
 if(previous&&!changed.length)return employees;
 const saved=recordEmployeeHistory(next,actor.employeeId,previous?'Обновлено: '+changed.map(field=>labels[field]).join(', '):'Создан профиль сотрудника',now);
 return previous?employees.map(employee=>employee.id===saved.id?saved:employee):[...employees,saved];
}
export function changeEmployeeStatus(employees:Employee[],id:string,status:Employee['status'],actor:EmployeeActor,now:string){
 if(!canManageEmployees(actor,employees))throw new Error('Управление сотрудниками запрещено вашей ролью.');
 const employee=employees.find(item=>item.id===id);
 if(!employee||id==='owner-user'||!['Активен','Заблокирован','Уволен'].includes(status))throw new Error('Нельзя изменить доступ этого аккаунта.');
 if(employee.status==='Уволен')throw new Error('Уволенный аккаунт не восстанавливается этим действием.');
 return employees.map(item=>item.id===id?recordEmployeeHistory({...item,status},actor.employeeId,'Статус аккаунта: '+status,now):item);
}
