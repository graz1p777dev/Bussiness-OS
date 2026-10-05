import LifeOS from '../../features/LifeOS';
import {navigation} from '../../lib/os/data';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;const errorRoute=slug.length===2&&slug[0]==='errors'&&/^([45][0-9]{2})$/.test(slug[1]);if(slug.length>0&&!errorRoute&&(slug.length!==1||!navigation.some(n=>n[1]===slug[0])))notFound();return <LifeOS initialPath={'/'+slug.join('/')}/>}
