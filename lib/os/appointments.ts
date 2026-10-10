import type {CalendarConsultation} from './calendar.ts';
import {validCalendarDate,validCalendarTime} from './calendar.ts';
export const appointmentKinds=['Консультация','Процедура','Встреча','Обслуживание','Звонок','Другое'];
export type Appointment=CalendarConsultation&{kind?:string;duration?:number;dealId?:string};
export function saveAppointment(rows:Appointment[],item:Appointment){
 if(!item.clientId||!item.client.trim())throw new Error('Выберите клиента.');
 if(!validCalendarDate(item.date)||!validCalendarTime(item.time))throw new Error('Укажите корректные дату и время.');
 if(!appointmentKinds.includes(item.kind||'Консультация'))throw new Error('Выберите тип записи.');
 const duration=item.duration??30;
 if(!Number.isInteger(duration)||duration<5||duration>480)throw new Error('Длительность должна быть от 5 до 480 минут.');
 const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 const start=minute(item.time);
 if(start+duration>1440)throw new Error('Запись должна закончиться в этот день.');
 const inactive=(status:string)=>['Отменена','Неявка'].includes(status);
 if(!inactive(item.status)&&item.employeeId&&rows.some(row=>row.id!==item.id&&row.employeeId===item.employeeId&&row.date===item.date&&!inactive(row.status)&&minute(row.time)<start+duration&&minute(row.time)+(row.duration??30)>start))throw new Error('У сотрудника уже есть запись на это время.');
 const next={...item,duration,kind:item.kind||'Консультация'};
 return rows.some(row=>row.id===item.id)?rows.map(row=>row.id===item.id?next:row):[next,...rows];
}
