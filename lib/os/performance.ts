'use client';
import {useSyncExternalStore} from 'react';

const listeners=new Set<()=>void>();
let stopListening:(()=>void)|undefined;
function subscribe(callback:()=>void){
 listeners.add(callback);
 if(!stopListening){
  const notify=()=>listeners.forEach(listener=>listener());
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new MutationObserver(notify);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-low-power','data-motion']});
  media.addEventListener('change',notify);
  stopListening=()=>{observer.disconnect();media.removeEventListener('change',notify)};
 }
 return()=>{listeners.delete(callback);if(!listeners.size){stopListening?.();stopListening=undefined}};
}
const lowPower=()=>document.documentElement.dataset.lowPower==='true';
const motion=()=>!lowPower()&&document.documentElement.dataset.motion!=='false'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
export function useLowPower(){return useSyncExternalStore(subscribe,lowPower,()=>false)}
export function useMotionPreference(){return useSyncExternalStore(subscribe,motion,()=>false)}
