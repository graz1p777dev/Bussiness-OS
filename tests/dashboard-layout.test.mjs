import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDashboardLayout,moveDashboardBlock} from '../lib/os/dashboard-layout.ts';
import {defaultSettingsDocument,validateSettingsDocument,setSettingsAlias,readSettingsAlias} from '../lib/os/settings-document.ts';
test('dashboard order and hidden blocks persist in canonical settings without changing other sections',()=>{
 const rows=moveDashboardBlock(defaultDashboardLayout,'attention',-1).map(row=>row.id==='agents'?{...row,visible:false}:row);
 const next=setSettingsAlias(defaultSettingsDocument,'dashboard-layout-v1',rows);
 assert.deepEqual(readSettingsAlias(validateSettingsDocument(next),'dashboard-layout-v1',defaultDashboardLayout),rows);
 assert.deepEqual(next.crm,defaultSettingsDocument.crm);
 assert.deepEqual(moveDashboardBlock(rows,rows[0].id,-1),rows);
 assert.equal(defaultDashboardLayout.find(row=>row.id==='agents').visible,true);
});
test('old settings receive dashboard defaults; duplicate or unknown blocks are rejected',()=>{
 const old=structuredClone(defaultSettingsDocument);delete old.appearance.dashboardLayout;
 assert.deepEqual(validateSettingsDocument(old).appearance.dashboardLayout,defaultDashboardLayout);
 old.appearance.dashboardLayout=defaultDashboardLayout.map(row=>({...row,id:'unknown'}));
 assert.throws(()=>validateSettingsDocument(old));
 old.appearance.dashboardLayout=defaultDashboardLayout.map(row=>({...row,id:'agents'}));
 assert.throws(()=>validateSettingsDocument(old));
});
