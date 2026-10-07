import Shop from '../../features/Shop';
import LifeOS from '../../features/LifeOS';
import AuthScreen,{AuthGate} from '../../features/AuthScreen';
import {inventoryRoutes} from '../../lib/os/inventory-routes';
import {navigation} from '../../lib/os/data';
import {notFound,redirect} from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 if(slug.join('/')==='cashier'||slug.join('/')==='inventory/cashier')redirect('/pos');
 if(slug.length===1&&slug[0]==='shop')return <Shop/>;
 const publicRoutes=['login','register','recovery','access-help'];
 if(slug.length===1&&publicRoutes.includes(slug[0]))return <AuthScreen key={slug[0]} route={slug[0]}/>;
 const errorRoute=slug.length===2&&slug[0]==='errors'&&/^([45][0-9]{2})$/.test(slug[1]);
 if(slug.length>0&&!errorRoute&&!inventoryRoutes['/'+slug.join('/')]&&(slug.length!==1||!navigation.some(n=>n[1]===slug[0])))notFound();
 const employeeDemo=process.env.OS_EMPLOYEE_DEMO==='1';
 const workspace=<LifeOS employeeDemo={employeeDemo} initialPath={'/'+slug.join('/')}/>;
 return errorRoute?workspace:<AuthGate employeeId={employeeDemo?'aiym':undefined}>{workspace}</AuthGate>;
}
