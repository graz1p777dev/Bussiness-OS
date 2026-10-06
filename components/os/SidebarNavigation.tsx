'use client';
import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,BriefcaseBusiness,CheckSquare,Bot,Wallet,Settings,ChevronRight,LockKeyhole,type LucideIcon} from 'lucide-react';
import {navigation} from '../../lib/os/data';
import {initialEmployees,initialRoles,hasAccess} from '../../lib/os/team';
import {useStored} from '../../lib/os/storage';
const groups:{id:string;label:string;icon:LucideIcon;routes:string[]}[]=[
 {id:'business',label:'Бизнес',icon:BriefcaseBusiness,routes:['crm','conversations','customers','orders','inventory','pos']},
 {id:'work',label:'Работа',icon:CheckSquare,routes:['tasks','calendar','employees','planning']},
 {id:'intelligence',label:'AI и аналитика',icon:Bot,routes:['agents','builder','automations','knowledge','analytics','laboratory']},
 {id:'management',label:'Управление',icon:Wallet,routes:['finance','marketing','integrations']},
 {id:'system',label:'Система',icon:Settings,routes:['developer','audit','settings','security','server','help']}
];
export default function SidebarNavigation({route,collapsed,go,employeeId}:{route:string;collapsed:boolean;go:(route:string)=>void;employeeId?:string}){
 const [storedPreview]=useStored('team-preview-v3','');const preview=employeeId||storedPreview;const [employees]=useStored('team-employees-v3',initialEmployees);const [roles]=useStored('team-roles-v3',initialRoles);const blocked=(id:string)=>Boolean(preview&&!hasAccess(employees.find(e=>e.id===preview),roles,id));
 const [open,setOpen]=useState(groups.find(g=>g.routes.includes(route))?.id||'');const [narrow,setNarrow]=useState(false);const [flyout,setFlyout]=useState<{id:string;top:number}|null>(null);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const mq=matchMedia('(max-width:760px)');const update=()=>setNarrow(mq.matches);update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);
 const [lastNav,setLastNav]=useState({route,collapsed,narrow});if(lastNav.route!==route||lastNav.collapsed!==collapsed||lastNav.narrow!==narrow){if(lastNav.route!==route)setOpen(groups.find(g=>g.routes.includes(route))?.id||'');setFlyout(null);setLastNav({route,collapsed,narrow})}
 useEffect(()=>{if(!flyout)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setFlyout(null)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setFlyout(null)};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}},[flyout]);
 const compact=collapsed||narrow;
 const items=(group:typeof groups[number])=>group.routes.map(id=>{const entry=navigation.find(n=>n[1]===id)!;return <button key={id} disabled={blocked(id)} title={blocked(id)?'Доступ закрыт ролью':undefined} aria-current={route===id?'page':undefined} className={'branch-item '+(route===id?'active':'')} onClick={()=>{setFlyout(null);go(id)}}><span className="branch-dot"/><span>{entry[2]}</span>{blocked(id)&&<LockKeyhole size={12}/>} {id==='conversations'&&<em>12</em>}</button>});
 return <div className="branch-navigation" ref={root}><button disabled={blocked('dashboard')} title="Command Center" className={'nav-item branch-home '+(route==='dashboard'?'active':'')} aria-current={route==='dashboard'?'page':undefined} onClick={()=>go('dashboard')}><LayoutDashboard size={17}/>{!collapsed&&<span>Command Center</span>}</button><div className="branch-divider"/>{groups.map(group=>{const active=group.routes.includes(route);const expanded=compact?flyout?.id===group.id:open===group.id;const GroupIcon=group.icon;return <section className="navigation-branch" key={group.id}><button title={group.label} aria-label={group.label} aria-expanded={expanded} aria-controls={'nav-'+group.id} className={'branch-toggle '+(active?'has-active':'')} onClick={e=>{if(compact)setFlyout(expanded?null:{id:group.id,top:Math.min(e.currentTarget.getBoundingClientRect().top,window.innerHeight-300)});else setOpen(expanded?'':group.id)}}><GroupIcon size={17}/><span>{group.label}</span><ChevronRight size={14} className={expanded?'turned':''}/></button>{!compact&&<div id={'nav-'+group.id} className={'branch-expander '+(expanded?'is-open':'')} inert={!expanded}><div className="branch-children">{items(group)}</div></div>}{compact&&expanded&&<div id={'nav-'+group.id} className="branch-flyout" style={{top:flyout?.top}}><strong>{group.label}</strong>{items(group)}</div>}</section>})}</div>
}
