import type {AnalyticsRecord} from './analytics';
export function chartRows(id:string,key:string|undefined,datum:Record<string,unknown>,rows:AnalyticsRecord[]){
 const name=String(datum.name||'');
 if(datum.fullDate)return rows.filter(r=>r.date===datum.fullDate);
 if(datum.id)return rows.filter(r=>r.id===datum.id);
 if(id==='weekdaySales')return rows.filter(r=>new Date(r.date+'T12:00:00Z').getUTCDay()===Number(datum.weekday));
 if(id==='ratingMix')return rows.filter(r=>Math.round(r.rating)===Number(datum.rating));
 if(id==='outcomes')return rows.filter(r=>r.status===name);
 if(id==='repeatMix'){const counts=new Map<string,number>();for(const r of rows)if(r.status==='Успешно')counts.set(r.client,(counts.get(r.client)||0)+1);return rows.filter(r=>name.startsWith('Повторные')?(counts.get(r.client)||0)>=2:counts.get(r.client)===1)}
 if(id==='costMix')return rows.filter(r=>name==='Реклама'?r.spend>0:name==='AI'?r.aiCost>0:r.cost>0);
 const dimension=id==='channelMix'||id==='salesChannelStack'?'channel':id==='teamRadar'||id==='teamOutcomes'?'employee':key||'product';
 return rows.filter(r=>String(r[dimension as keyof AnalyticsRecord])===name);
}
export function reorderWidget(ids:string[],source:string,target:string){const from=ids.indexOf(source),to=ids.indexOf(target);if(from<0||to<0||from===to)return ids;const next=[...ids];next.splice(from,1);next.splice(to,0,source);return next}
