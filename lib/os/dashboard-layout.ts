export const dashboardBlocks={revenue:'Динамика выручки',summary:'Сводка бизнеса',pipeline:'Воронка продаж',channels:'Источники клиентов',agents:'Работа агентов',attention:'Требует внимания'};
export type DashboardBlock=keyof typeof dashboardBlocks;
export type DashboardLayout={id:DashboardBlock;visible:boolean}[];
export const defaultDashboardLayout:DashboardLayout=(Object.keys(dashboardBlocks) as DashboardBlock[]).map(id=>({id,visible:true}));
export function moveDashboardBlock(layout:DashboardLayout,id:DashboardBlock,direction:number){
 const index=layout.findIndex(row=>row.id===id),next=index+direction;
 if(index<0||next<0||next>=layout.length)return layout;
 const result=[...layout];[result[index],result[next]]=[result[next],result[index]];return result;
}
