'use client';
import {useCallback,useEffect,useState,useRef} from 'react';
import {navigation} from './data';
const routeIds=new Set(navigation.map(item=>item[1]));
export function resolveWorkspaceRoute(pathname:string){const segment=pathname.split('/').filter(Boolean)[0]||'dashboard';return routeIds.has(segment)?segment:'errors'}
/** Sections are local views: switching them must never depend on an RSC request. */
export function useWorkspaceRoute(initialPathname:string){
 const [loading,setLoading]=useState(true);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const [route,setRoute]=useState(()=>resolveWorkspaceRoute(initialPathname));
 useEffect(()=>{const sync=()=>{setRoute(resolveWorkspaceRoute(window.location.pathname));setLoading(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setLoading(false),180)};sync();window.addEventListener('popstate',sync);return()=>{window.removeEventListener('popstate',sync);if(timer.current)clearTimeout(timer.current)}},[]);
 const navigate=useCallback((next:string)=>{if(!routeIds.has(next))return;setLoading(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setLoading(false),180);const path='/'+next;if(window.location.pathname!==path)window.history.pushState(window.history.state,'',path);setRoute(next)},[]);
 return [route,navigate,loading] as const;
}
