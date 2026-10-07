import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceMonth,attendanceMetrics,attendanceSummary,attendanceScope,attendanceExplanationDebt,saveAttendanceDay,removeAttendanceDay,saveAttendanceLeave,reviewAttendanceLeave,saveAttendanceExplanation,reviewAttendanceExplanation,removeAttendanceExplanation,initialAttendance} from '../lib/os/attendance.ts';

const empty=()=>({days:[],leaves:[],explanations:[]});
const manager={mode:'attendance',employeeId:'owner-user'};
const self={mode:'my-time',employeeId:'aiym'};
const day=(extra={})=>({id:'d1',employeeId:'aiym',date:'2026-10-05',status:'worked',plannedStart:'09:00',plannedEnd:'18:00',checkIn:'2026-10-05T09:20',checkOut:'2026-10-05T18:10',breakMinutes:60,countsAsWorked:true,note:'',corrections:[],...extra});
const leave=(extra={})=>({id:'v1',employeeId:'aiym',from:'2026-10-19',to:'2026-10-23',comment:'Отпуск',status:'pending',decisionComment:'',...extra});
const attachment={name:'note.png',type:'image/png',size:3,data:'data:image/png;base64,YWJj'};
const explanation=(extra={})=>({id:'e1',employeeId:'aiym',dayId:'d1',reason:'Задержка транспорта',attachment,status:'pending',reviewComment:'',...extra});

test('month grid contains real dates and handles leap years',()=>{
 assert.equal(attendanceMonth('2024-02').length,29);
 assert.equal(attendanceMonth('2026-02').length,28);
 assert.equal(attendanceMonth('2026-12').at(-1),'2026-12-31');
 assert.deepEqual(attendanceMonth('2026-13'),[]);
});

test('hours subtract breaks and retain planned snapshots for lateness and overnight work',()=>{
 assert.deepEqual(attendanceMetrics(day()),{minutes:470,plannedMinutes:480,lateMinutes:20,overtimeMinutes:0,shortfallMinutes:10,open:false,counted:1});
 const night=day({plannedStart:'22:00',plannedEnd:'06:00',checkIn:'2026-10-05T22:10',checkOut:'2026-10-06T06:40',breakMinutes:30});
 assert.deepEqual(attendanceMetrics(night),{minutes:480,plannedMinutes:450,lateMinutes:10,overtimeMinutes:30,shortfallMinutes:0,open:false,counted:1});
 assert.equal(attendanceMetrics(day({checkOut:''})).open,true);
 assert.equal(attendanceMetrics(day({checkOut:''})).minutes,0);
 assert.equal(attendanceMetrics(day({status:'sick',checkIn:'',checkOut:'',countsAsWorked:false})).counted,0);
 assert.equal(attendanceSummary([day(),night]).minutes,950);
});

test('day validation rejects impossible dates, inverted times, excessive breaks and overnight overlap',()=>{
 assert.throws(()=>saveAttendanceDay(empty(),day({date:'2026-02-30'}),'',manager),/дату/);
 assert.throws(()=>saveAttendanceDay(empty(),day({checkIn:'2026-10-05T25:00'}),'',manager),/время/);
 assert.throws(()=>saveAttendanceDay(empty(),day({checkOut:'2026-10-05T08:00'}),'',manager),/Уход/);
 assert.throws(()=>saveAttendanceDay(empty(),day({checkIn:'',checkOut:''}),'',manager),/время прихода/);
 assert.throws(()=>saveAttendanceDay(empty(),day({breakMinutes:900}),'',manager),/Перерыв/);
 assert.throws(()=>saveAttendanceDay(empty(),day({status:'vacation'}),'',manager),/уберите/);
 const night=day({plannedStart:'22:00',plannedEnd:'06:00',checkIn:'2026-10-05T22:00',checkOut:'2026-10-06T06:00',breakMinutes:30});
 const state=saveAttendanceDay(empty(),night,'',manager);
 assert.throws(()=>saveAttendanceDay(state,day({id:'d2',date:'2026-10-06',plannedStart:'05:00',plannedEnd:'10:00',checkIn:'2026-10-06T05:00',checkOut:'2026-10-06T10:00'}),'',manager),/пересекается/);
 const adjacent=saveAttendanceDay(state,day({id:'d2',date:'2026-10-06',plannedStart:'06:00',plannedEnd:'10:00',checkIn:'2026-10-06T06:00',checkOut:'2026-10-06T10:00'}),'',manager);
 assert.equal(adjacent.days.length,2);
});

test('corrections require a reason, preserve the old fact and do not mutate source state',()=>{
 const state={...empty(),days:[day()]},before=structuredClone(state);
 assert.throws(()=>saveAttendanceDay(state,day({checkIn:'2026-10-05T09:00'}),'  ',manager),/причину/);
 const changed=saveAttendanceDay(state,day({checkIn:'2026-10-05T09:00'}),'Исправлена ошибка ввода',manager,'2026-10-07T06:00:00Z');
 assert.equal(changed.days[0].corrections[0].before.checkIn,'2026-10-05T09:20');
 assert.equal(changed.days[0].corrections[0].reason,'Исправлена ошибка ввода');
 assert.equal(attendanceMetrics(changed.days[0]).lateMinutes,0);
 assert.deepEqual(state,before);
 assert.throws(()=>saveAttendanceDay(state,day({employeeId:'medina'}),'Причина',manager),/не меняются/);
 assert.throws(()=>saveAttendanceDay(state,day({id:'duplicate'}),'',manager),/уже есть/);
});

test('personal scope excludes every other employee and personal users cannot alter attendance or reviews',()=>{
 const state={days:[day(),day({id:'d2',employeeId:'medina'})],leaves:[leave(),leave({id:'v2',employeeId:'medina'})],explanations:[explanation(),explanation({id:'e2',employeeId:'medina'})]};
 const scoped=attendanceScope(state,self);
 assert.equal(scoped.days.length,1);assert.equal(scoped.leaves.length,1);assert.equal(scoped.explanations.length,1);
 assert.deepEqual(attendanceScope(state,{...self,employeeId:'unknown'}),empty());
 assert.throws(()=>saveAttendanceDay(empty(),day(),'',self),/руководитель/);
 assert.throws(()=>removeAttendanceDay(state,'d1',self),/руководитель/);
 assert.throws(()=>saveAttendanceLeave(empty(),leave({employeeId:'medina'}),self,'2026-10-07'),/собственные/);
 assert.throws(()=>reviewAttendanceLeave(state,'v1','approved','',self),/руководитель/);
 assert.throws(()=>reviewAttendanceExplanation(state,'e1','accepted','',self),/руководитель/);
 assert.throws(()=>saveAttendanceDay(empty(),day(),'',{...manager,permissions:{create:false}}),/роли/);
 assert.throws(()=>reviewAttendanceLeave(state,'v1','approved','',{...manager,permissions:{edit:true,manageTeam:false}}),/роли/);
});

test('leave requests validate periods and collisions, and review requires a reason for refusal',()=>{
 assert.throws(()=>saveAttendanceLeave(empty(),leave({to:'2026-10-18'}),self,'2026-10-07'),/период/);
 assert.throws(()=>saveAttendanceLeave(empty(),leave({from:'2026-10-01'}),self,'2026-10-07'),/прошлом/);
 assert.throws(()=>saveAttendanceLeave(empty(),leave({from:'2026-10-01',comment:''}),manager,'2026-10-07'),/причину/);
 const state=saveAttendanceLeave(empty(),leave(),self,'2026-10-07');
 assert.throws(()=>saveAttendanceLeave(state,leave({id:'v2',from:'2026-10-23',to:'2026-10-25'}),self,'2026-10-07'),/пересекается/);
 assert.throws(()=>reviewAttendanceLeave(state,'v1','rejected','',manager),/причину/);
 const rejected=reviewAttendanceLeave(state,'v1','rejected','Нужны другие даты',manager);
 assert.equal(rejected.leaves[0].decisionComment,'Нужны другие даты');
 assert.throws(()=>saveAttendanceLeave(rejected,leave(),self,'2026-10-07'),/ожидающую/);
 const approved=reviewAttendanceLeave(state,'v1','approved','Согласовано в демо',manager);
 assert.throws(()=>saveAttendanceDay(approved,day({date:'2026-10-19',checkIn:'2026-10-19T09:00',checkOut:'2026-10-19T18:00'}),'',manager),/согласован отпуск/);
 assert.throws(()=>reviewAttendanceLeave(approved,'v1','cancelled','',self),/нельзя отменить/);
 assert.throws(()=>reviewAttendanceLeave(approved,'v1','cancelled','',{...manager,permissions:{edit:true,manageTeam:false}}),/роли/);
 assert.equal(reviewAttendanceLeave(state,'v1','cancelled','',self).leaves[0].status,'cancelled');
 const withShift={...state,days:[day({date:'2026-10-19',checkIn:'2026-10-19T09:00',checkOut:'2026-10-19T18:00'})]};
 assert.throws(()=>reviewAttendanceLeave(withShift,'v1','approved','',manager),/смены/);
});

test('explanation debt follows corrected facts and attachment/review lifecycle',()=>{
 const state={...empty(),days:[day()]};assert.equal(attendanceExplanationDebt(state).length,1);
 assert.throws(()=>saveAttendanceExplanation(empty(),explanation(),self),/не найдена/);
 assert.throws(()=>saveAttendanceExplanation(state,explanation({reason:' '}),self),/объяснение/);
 assert.throws(()=>saveAttendanceExplanation(state,explanation({attachment:undefined}),self),/фотографию/);
 assert.throws(()=>saveAttendanceExplanation(state,explanation({attachment:{...attachment,type:'text/html'}}),self),/JPG/);
 assert.throws(()=>saveAttendanceExplanation(state,explanation({attachment:{...attachment,size:6_000_000}}),self),/5 МБ/);
 assert.equal(saveAttendanceExplanation(state,explanation({attachment:{name:'photo.heic',type:'image/heic',size:4_000_000,blobId:'attendance-file-e1'}}),self).explanations[0].attachment.size,4_000_000);
 const submitted=saveAttendanceExplanation(state,explanation(),self);
 assert.equal(attendanceExplanationDebt(submitted).length,0);
 const rejected=reviewAttendanceExplanation(submitted,'e1','rejected','Нужна подпись',manager);
 assert.equal(attendanceExplanationDebt(rejected).length,1);
 const resubmitted=saveAttendanceExplanation(rejected,explanation({reason:'Подпись добавлена'}),self);
 assert.equal(resubmitted.explanations[0].status,'pending');
 const accepted=reviewAttendanceExplanation(resubmitted,'e1','accepted','',manager);
 assert.throws(()=>removeAttendanceExplanation(accepted,'e1',self),/Принятую/);
 assert.throws(()=>saveAttendanceExplanation(accepted,explanation(),self),/Принятую/);
 assert.equal(removeAttendanceDay(accepted,'d1',manager).explanations.length,0);
 const corrected=saveAttendanceDay(state,day({checkIn:'2026-10-05T09:00'}),'Правильное время',manager);
 assert.equal(attendanceExplanationDebt(corrected).length,0);
 assert.equal(attendanceSummary(initialAttendance.days).counted,4);
});
