'use client';
import {useState} from 'react';
import Analytics from './Analytics';
import LiveBusinessAnalytics from './LiveBusinessAnalytics';
import type {LiveAnalyticsAccess} from '../lib/os/live-analytics';

export default function BusinessAnalyticsWorkspace(props:{access:LiveAnalyticsAccess;actorId:string;notify:(message:string)=>void;audit:(message:string)=>void}){
 const [demo,setDemo]=useState(false);
 return <><div className="toolbar"><div className="tabs"><button className={!demo?'active':''} onClick={()=>setDemo(false)}>Данные моей OS</button><button className={demo?'active':''} onClick={()=>setDemo(true)}>Демонстрация возможностей</button></div><span className="muted">{demo?'Пример отчётов на отдельном демонстрационном наборе':'CRM, касса и склад — единые источники'}</span></div>{demo?<Analytics notify={props.notify} audit={props.audit}/>:<LiveBusinessAnalytics {...props}/>}</>;
}
