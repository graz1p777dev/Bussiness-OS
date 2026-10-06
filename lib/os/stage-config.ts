'use client';
import {stages} from './data';
import {stageColors} from './deal-colors';
import {useStored} from './storage';
export const initialStageConfig={sales:stages.map((name,i)=>({id:'stage-'+i,name,color:stageColors[i]})),repeat:stages.map((name,i)=>({id:'repeat-'+i,name,color:stageColors[i]}))};
export function useDealStages(pipeline='Продажи'){const [config,setConfig]=useStored('stage-config-v3',initialStageConfig);const rows=pipeline==='Повторные продажи'?config.repeat:config.sales;return {stages:rows.map(r=>r.name),colors:rows.map(r=>r.color),rows,config,setConfig}}
