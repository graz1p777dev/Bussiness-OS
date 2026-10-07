import {calendarDays,validCalendarDate,validCalendarTime} from './calendar.ts';
import type {ActionPermissions} from './team.ts';

export const attendanceStatuses={planned:'По графику',worked:'Работал',remote:'Удалённо',late_not_counted:'День не зачтён',absent:'Нет отметки',day_off:'Выходной',sick:'Больничный',vacation:'Отпуск'};
export type AttendanceStatus=keyof typeof attendanceStatuses;
export type AttendanceFact={employeeId:string;date:string;status:AttendanceStatus;plannedStart:string;plannedEnd:string;checkIn:string;checkOut:string;breakMinutes:number;countsAsWorked:boolean;note:string};
export type AttendanceDay=AttendanceFact&{id:string;corrections:{at:string;reason:string;before:AttendanceFact}[]};
export type AttendanceLeave={id:string;employeeId:string;from:string;to:string;comment:string;status:'pending'|'approved'|'rejected'|'cancelled';decisionComment:string};
export type AttendanceAttachment={name:string;type:string;data?:string;blobId?:string;size:number};
export type AttendanceExplanation={id:string;dayId:string;employeeId:string;reason:string;attachment?:AttendanceAttachment;status:'pending'|'accepted'|'rejected';reviewComment:string};
export type AttendanceState={days:AttendanceDay[];leaves:AttendanceLeave[];explanations:AttendanceExplanation[]};
export type AttendanceActor={mode:'attendance'|'my-time';employeeId:string;permissions?:ActionPermissions};
const minute=60_000;
const workStatus=(status:AttendanceStatus)=>['planned','worked','remote','late_not_counted'].includes(status);
const timestamp=(value:string)=>Date.parse(value+':00Z');
export function validAttendanceMoment(value:string){return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&validCalendarDate(value.slice(0,10))&&validCalendarTime(value.slice(11))}
export function attendanceMonth(month:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];const start=month+'-01',end=new Date(start+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);return calendarDays(start,end.getUTCDate())}
export function attendanceShift(day:Pick<AttendanceFact,'date'|'plannedStart'|'plannedEnd'>){const start=timestamp(day.date+'T'+day.plannedStart);let end=timestamp(day.date+'T'+day.plannedEnd);if(end<start)end+=1440*minute;return {start,end}}
export function attendanceMetrics(day:AttendanceDay){
 const planned=attendanceShift(day),start=day.checkIn?timestamp(day.checkIn):0,end=day.checkOut?timestamp(day.checkOut):0;
 const worked=workStatus(day.status)&&Boolean(start&&end),plannedMinutes=Math.max(0,(planned.end-planned.start)/minute-day.breakMinutes),minutes=worked?Math.max(0,(end-start)/minute-day.breakMinutes):0;
 return {minutes,plannedMinutes,lateMinutes:workStatus(day.status)&&start?Math.max(0,(start-planned.start)/minute):0,overtimeMinutes:worked?Math.max(0,minutes-plannedMinutes):0,shortfallMinutes:worked?Math.max(0,plannedMinutes-minutes):0,open:workStatus(day.status)&&Boolean(start&&!end),counted:day.status!=='planned'&&workStatus(day.status)&&day.countsAsWorked?1:0};
}
export function attendanceSummary(days:AttendanceDay[]){return days.reduce((sum,day)=>{const row=attendanceMetrics(day);return {minutes:sum.minutes+row.minutes,lateDays:sum.lateDays+(row.lateMinutes>0?1:0),overtimeMinutes:sum.overtimeMinutes+row.overtimeMinutes,shortfallMinutes:sum.shortfallMinutes+row.shortfallMinutes,openDays:sum.openDays+(row.open?1:0),counted:sum.counted+row.counted,absent:sum.absent+(day.status==='absent'?1:0)}},{minutes:0,lateDays:0,overtimeMinutes:0,shortfallMinutes:0,openDays:0,counted:0,absent:0})}
export function attendanceScope(state:AttendanceState,actor:AttendanceActor):AttendanceState{return actor.mode==='attendance'?state:{days:state.days.filter(row=>row.employeeId===actor.employeeId),leaves:state.leaves.filter(row=>row.employeeId===actor.employeeId),explanations:state.explanations.filter(row=>row.employeeId===actor.employeeId)}}
function allow(actor:AttendanceActor,action:keyof ActionPermissions){if(actor.permissions&& !actor.permissions[action])throw new Error('Действие недоступно вашей роли')}
function manage(actor:AttendanceActor,action:keyof ActionPermissions){if(actor.mode!=='attendance')throw new Error('Отметки команды меняет руководитель');allow(actor,action)}
function own(actor:AttendanceActor,employeeId:string,action:keyof ActionPermissions){allow(actor,action);if(actor.mode==='my-time'&&(!actor.employeeId||actor.employeeId!==employeeId))throw new Error('Можно менять только собственные записи')}
export function saveAttendanceDay(state:AttendanceState,day:AttendanceDay,reason:string,actor:AttendanceActor,at=new Date().toISOString()):AttendanceState{
 const previous=state.days.find(row=>row.id===day.id);manage(actor,previous?'edit':'create');
 if(!day.employeeId||!validCalendarDate(day.date)||!Object.hasOwn(attendanceStatuses,day.status))throw new Error('Укажите сотрудника, дату и статус дня');
 if(!validCalendarTime(day.plannedStart)||!validCalendarTime(day.plannedEnd)||day.plannedStart===day.plannedEnd)throw new Error('Укажите разное время начала и окончания смены');
 const planned=attendanceShift(day);
 if(!Number.isInteger(day.breakMinutes)||day.breakMinutes<0||day.breakMinutes>=(planned.end-planned.start)/minute)throw new Error('Перерыв должен быть короче смены');
 if((day.checkIn&&!validAttendanceMoment(day.checkIn))||(day.checkOut&&!validAttendanceMoment(day.checkOut)))throw new Error('Укажите корректную дату и время прихода и ухода');
 if(day.checkOut&&!day.checkIn)throw new Error('Сначала укажите время прихода');
 if(workingFact(day.status)&&!day.checkIn)throw new Error('Укажите время прихода для рабочего дня');
 if(day.checkIn&&(timestamp(day.checkIn)<planned.start-12*60*minute||timestamp(day.checkIn)>planned.end))throw new Error('Приход должен относиться к выбранной смене');
 if(day.checkOut&&(timestamp(day.checkOut)<=timestamp(day.checkIn)||timestamp(day.checkOut)-timestamp(day.checkIn)>24*60*minute))throw new Error('Уход должен быть позже прихода, смена — не дольше 24 часов');
 if(day.checkOut&&(timestamp(day.checkOut)-timestamp(day.checkIn))/minute<=day.breakMinutes)throw new Error('Перерыв должен быть короче фактической смены');
 if((!workStatus(day.status)||day.status==='planned')&&(day.checkIn||day.checkOut||day.countsAsWorked))throw new Error('Для этого статуса уберите время прихода, ухода и зачёт дня');
 if(state.days.some(row=>row.id!==day.id&&row.employeeId===day.employeeId&&row.date===day.date))throw new Error('На эту дату уже есть отметка. Откройте её для исправления');
 if(workStatus(day.status)){
  const start=day.checkIn?timestamp(day.checkIn):planned.start,end=day.checkOut?timestamp(day.checkOut):planned.end;
  if(state.days.some(row=>{if(row.id===day.id||row.employeeId!==day.employeeId||!workStatus(row.status))return false;const shift=attendanceShift(row);return start<(row.checkOut?timestamp(row.checkOut):shift.end)&&end>(row.checkIn?timestamp(row.checkIn):shift.start)}))throw new Error('Смена пересекается с другой сменой сотрудника');
  if(state.leaves.some(row=>row.employeeId===day.employeeId&&row.status==='approved'&&day.date>=row.from&&day.date<=row.to))throw new Error('На этот день уже согласован отпуск');
 }
 if(previous&&!reason.trim())throw new Error('Укажите причину исправления');
 if(previous&&(previous.employeeId!==day.employeeId||previous.date!==day.date))throw new Error('Сотрудник и дата существующей отметки не меняются');
 const saved={...day,corrections:previous?[...previous.corrections,{at,reason:reason.trim(),before:fact(previous)}]:[]};
 return {...state,days:previous?state.days.map(row=>row.id===day.id?saved:row):[...state.days,saved]};
}
function workingFact(status:AttendanceStatus){return ['worked','remote','late_not_counted'].includes(status)}
function fact(day:AttendanceDay):AttendanceFact{return {employeeId:day.employeeId,date:day.date,status:day.status,plannedStart:day.plannedStart,plannedEnd:day.plannedEnd,checkIn:day.checkIn,checkOut:day.checkOut,breakMinutes:day.breakMinutes,countsAsWorked:day.countsAsWorked,note:day.note}}
export function removeAttendanceDay(state:AttendanceState,id:string,actor:AttendanceActor):AttendanceState{manage(actor,'remove');return {...state,days:state.days.filter(row=>row.id!==id),explanations:state.explanations.filter(row=>row.dayId!==id)}}
export function saveAttendanceLeave(state:AttendanceState,leave:AttendanceLeave,actor:AttendanceActor,today:string):AttendanceState{
 const previous=state.leaves.find(row=>row.id===leave.id);own(actor,leave.employeeId,previous?'edit':'create');
 if(previous&&(previous.employeeId!==leave.employeeId||previous.status!=='pending'))throw new Error('Можно редактировать только свою ожидающую заявку');
 if(!leave.employeeId||!validCalendarDate(leave.from)||!validCalendarDate(leave.to)||leave.to<leave.from)throw new Error('Укажите корректный период отпуска');
 if((Date.parse(leave.to)-Date.parse(leave.from))/86400000>365)throw new Error('Период отпуска не может превышать год');
 if(actor.mode==='my-time'&&leave.from<today)throw new Error('Начало отпуска не может быть в прошлом');
 if(leave.from<today&&!leave.comment.trim())throw new Error('Для отпуска задним числом укажите причину');
 if(state.leaves.some(row=>row.id!==leave.id&&row.employeeId===leave.employeeId&&['pending','approved'].includes(row.status)&&leave.from<=row.to&&leave.to>=row.from))throw new Error('Этот период пересекается с другой заявкой сотрудника');
 const saved={...leave,comment:leave.comment.trim(),status:'pending' as const,decisionComment:''};
 return {...state,leaves:previous?state.leaves.map(row=>row.id===leave.id?saved:row):[saved,...state.leaves]};
}
export function reviewAttendanceLeave(state:AttendanceState,id:string,status:AttendanceLeave['status'],comment:string,actor:AttendanceActor):AttendanceState{
 const leave=state.leaves.find(row=>row.id===id);if(!leave)throw new Error('Заявка не найдена');
 if(status==='cancelled'){own(actor,leave.employeeId,'edit');if(leave.status!=='pending'&&!(actor.mode==='attendance'&&leave.status==='approved'))throw new Error('Эту заявку нельзя отменить');if(leave.status==='approved')manage(actor,'manageTeam')}
 else{manage(actor,'manageTeam');allow(actor,'edit');if(leave.status!=='pending'||!['approved','rejected'].includes(status))throw new Error('Рассмотреть можно только ожидающую заявку');if(status==='rejected'&&!comment.trim())throw new Error('Укажите причину отказа')}
 if(status==='approved'&&state.days.some(day=>day.employeeId===leave.employeeId&&day.date>=leave.from&&day.date<=leave.to&&workStatus(day.status)))throw new Error('В периоде есть рабочие смены. Исправьте их перед согласованием');
 return {...state,leaves:state.leaves.map(row=>row.id===id?{...row,status,decisionComment:comment.trim()}:row)};
}
export function attendanceExplanationDebt(state:AttendanceState){return state.days.filter(day=>attendanceMetrics(day).lateMinutes>15&&!state.explanations.some(row=>row.dayId===day.id&&row.status!=='rejected'))}
export function saveAttendanceExplanation(state:AttendanceState,explanation:AttendanceExplanation,actor:AttendanceActor):AttendanceState{
 const previous=state.explanations.find(row=>row.id===explanation.id);own(actor,explanation.employeeId,previous?'edit':'create');
 const day=state.days.find(row=>row.id===explanation.dayId&&row.employeeId===explanation.employeeId);
 if(!day)throw new Error('Отметка сотрудника не найдена');
 if(!explanation.reason.trim())throw new Error('Укажите объяснение');
 if(previous&&(previous.employeeId!==explanation.employeeId||previous.dayId!==explanation.dayId||previous.status==='accepted'))throw new Error('Принятую объяснительную нельзя редактировать');
 if(state.explanations.some(row=>row.id!==explanation.id&&row.dayId===explanation.dayId&&row.status!=='rejected'))throw new Error('К этой отметке уже есть объяснительная');
 const file=explanation.attachment;
 if(!file)throw new Error('Приложите фотографию объяснительной');
 if(!['image/jpeg','image/png','image/webp','image/heic'].includes(file.type)||file.size>5*1024*1024||file.size<=0||!(file.blobId?.startsWith('attendance-file-')||file.data?.startsWith('data:'+file.type+';base64,')))throw new Error('Добавьте JPG, PNG, WebP или HEIC размером до 5 МБ');
 const saved={...explanation,reason:explanation.reason.trim(),status:'pending' as const,reviewComment:''};
 return {...state,explanations:previous?state.explanations.map(row=>row.id===saved.id?saved:row):[saved,...state.explanations]};
}
export function reviewAttendanceExplanation(state:AttendanceState,id:string,status:'accepted'|'rejected',comment:string,actor:AttendanceActor):AttendanceState{manage(actor,'manageTeam');allow(actor,'edit');const row=state.explanations.find(item=>item.id===id);if(!row||row.status!=='pending')throw new Error('Рассмотреть можно только ожидающую объяснительную');if(status==='rejected'&&!comment.trim())throw new Error('Укажите, что нужно дополнить');return {...state,explanations:state.explanations.map(item=>item.id===id?{...item,status,reviewComment:comment.trim()}:item)}}
export function removeAttendanceExplanation(state:AttendanceState,id:string,actor:AttendanceActor):AttendanceState{const row=state.explanations.find(item=>item.id===id);if(!row)throw new Error('Объяснительная не найдена');own(actor,row.employeeId,'remove');if(row.status==='accepted')throw new Error('Принятую объяснительную нельзя удалить');return {...state,explanations:state.explanations.filter(item=>item.id!==id)}}
export const initialAttendance:AttendanceState={days:[
 {id:'attendance-demo-aiym-1',employeeId:'aiym',date:'2026-10-01',status:'worked',plannedStart:'09:00',plannedEnd:'18:00',checkIn:'2026-10-01T09:00',checkOut:'2026-10-01T18:00',breakMinutes:60,countsAsWorked:true,note:'Демонстрационная смена',corrections:[]},
 {id:'attendance-demo-aiym-2',employeeId:'aiym',date:'2026-10-02',status:'worked',plannedStart:'09:00',plannedEnd:'18:00',checkIn:'2026-10-02T09:20',checkOut:'2026-10-02T18:00',breakMinutes:60,countsAsWorked:true,note:'Пример дня для объяснительной',corrections:[]},
 {id:'attendance-demo-nuriza-1',employeeId:'nuriza',date:'2026-10-01',status:'remote',plannedStart:'09:00',plannedEnd:'18:00',checkIn:'2026-10-01T09:00',checkOut:'2026-10-01T18:15',breakMinutes:60,countsAsWorked:true,note:'Демонстрационная смена',corrections:[]},
 {id:'attendance-demo-medina-1',employeeId:'medina',date:'2026-10-01',status:'worked',plannedStart:'10:00',plannedEnd:'19:00',checkIn:'2026-10-01T10:00',checkOut:'2026-10-01T19:00',breakMinutes:60,countsAsWorked:true,note:'Демонстрационная смена',corrections:[]}
],leaves:[{id:'attendance-demo-leave',employeeId:'medina',from:'2026-10-19',to:'2026-10-23',comment:'Демонстрационная заявка на пять дней',status:'pending',decisionComment:''}],explanations:[]};
