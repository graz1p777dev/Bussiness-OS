export type SecuritySession={id:string;device:string;place:string;date:string;current:boolean};
export type AccountSecurityState={twoFactor:boolean;alerts:boolean;sessions:SecuritySession[];codes:string[];updated:string};
export const defaultAccountSecurity:AccountSecurityState={twoFactor:false,alerts:true,sessions:[{id:'current',device:'Текущий браузер',place:'Это устройство',date:'Сейчас',current:true}],codes:[],updated:''};
export function accountSecurityKey(accountId:string){return 'security-account-v1-'+accountId}
function normalize(value:unknown):AccountSecurityState{
 const source=value&&typeof value==='object'?value as Partial<AccountSecurityState>:{};
 const seen=new Set<string>();const sessions=(Array.isArray(source.sessions)?source.sessions:[]).filter((session):session is SecuritySession=>Boolean(session&&typeof session.id==='string'&&typeof session.device==='string'&&typeof session.place==='string'&&typeof session.date==='string')).filter(session=>{if(seen.has(session.id))return false;seen.add(session.id);return true}).map(session=>({...session,current:session.id==='current'}));
 if(!sessions.some(session=>session.current))sessions.unshift({...defaultAccountSecurity.sessions[0]});
 return {twoFactor:typeof source.twoFactor==='boolean'?source.twoFactor:false,alerts:typeof source.alerts==='boolean'?source.alerts:true,sessions,codes:Array.isArray(source.codes)?source.codes.filter(code=>typeof code==='string'):[],updated:typeof source.updated==='string'?source.updated:''};
}
export function loadAccountSecurity(accountId:string,read:(key:string)=>string|null):AccountSecurityState{
 const parse=(key:string):unknown=>{try{const raw=read(key);return raw===null?undefined:JSON.parse(raw)}catch{return undefined}};
 const ownKey='life-'+accountSecurityKey(accountId);
 if(read(ownKey)!==null)return normalize(parse(ownKey));
 if(accountId!=='owner-user')return normalize(defaultAccountSecurity);
 return normalize({twoFactor:parse('life-security-demo-2fa'),alerts:parse('life-security-demo-alerts'),sessions:parse('life-security-demo-sessions'),codes:parse('life-security-demo-backup-codes'),updated:parse('life-security-demo-password-updated')});
}
