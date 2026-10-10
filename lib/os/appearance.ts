'use client';
import {useCallback,useEffect,useMemo,type SetStateAction} from 'react';
import {useStored} from './storage';
export const defaultPalettes={dark:{bg:'#111216',panel:'#181a20',sidebar:'#15161b',hover:'#22242d',border:'#2a2c35',text:'#ebecef',muted:'#8b8f9e',accent:'#a78bfa'},light:{bg:'#f7f8fb',panel:'#ffffff',sidebar:'#f0f2f6',hover:'#e9ebf2',border:'#e0e3eb',text:'#242633',muted:'#737888',accent:'#7763c6'}};
export type Palette=typeof defaultPalettes.dark;
export const defaultAppearance={custom:false,palettes:defaultPalettes,density:'comfortable',fontFamily:'system',fontSize:14,radius:6,motion:true,lowPower:false};
type Appearance=typeof defaultAppearance;
function normalizedAppearance(value:Appearance):Appearance {
 const source=value&&typeof value==='object'?value:defaultAppearance;
 const number=(value:unknown,fallback:number,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;
 const palettes={dark:{...defaultPalettes.dark},light:{...defaultPalettes.light}};
 for(const mode of ['dark','light'] as const)for(const key of Object.keys(palettes[mode]) as (keyof Palette)[]){
  const color=source.palettes?.[mode]?.[key];
  if(typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color))palettes[mode][key]=color;
 }
 return {custom:source.custom===true,palettes,density:source.density==='compact'?'compact':'comfortable',fontFamily:['system','humanist','classic'].includes(source.fontFamily)?source.fontFamily:'system',fontSize:number(source.fontSize,14,12,18),radius:number(source.radius,6,0,18),motion:source.motion!==false,lowPower:source.lowPower===true};
}
export function useAppearance(theme:string){
 const [stored,setStored]=useStored('appearance-v2',defaultAppearance,normalizedAppearance);
 const appearance=useMemo(()=>normalizedAppearance(stored),[stored]);
 const setAppearance=useCallback((next:SetStateAction<Appearance>)=>setStored(current=>normalizedAppearance(typeof next==='function'?next(normalizedAppearance(current)):next)),[setStored]);
 useEffect(()=>{
  const colorScheme=matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const apply=()=>{
   const mode=theme==='System'?(colorScheme.matches?'dark':'light'):theme==='Light'?'light':'dark';
   const root=document.documentElement;
   root.dataset.theme=mode;
   root.dataset.density=appearance.density;
   root.dataset.lowPower=String(appearance.lowPower);
   root.dataset.motion=String(appearance.motion&&!appearance.lowPower&&!reducedMotion.matches);
   root.style.setProperty('--os-font',({system:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",humanist:"'Trebuchet MS',Verdana,sans-serif",classic:"Georgia,'Times New Roman',serif"} as Record<string,string>)[appearance.fontFamily]);
   root.style.setProperty('--base-font',appearance.fontSize+'px');
   root.style.setProperty('--font-scale',String(appearance.fontSize/14));
   root.style.setProperty('--control-radius',appearance.radius+'px');
   for(const key of Object.keys(defaultPalettes.dark)){
    if(appearance.custom)root.style.setProperty('--'+key,appearance.palettes[mode][key as keyof Palette]);
    else root.style.removeProperty('--'+key);
   }
  };
  apply();
  colorScheme.addEventListener('change',apply);
  reducedMotion.addEventListener('change',apply);
  return()=>{colorScheme.removeEventListener('change',apply);reducedMotion.removeEventListener('change',apply)};
 },[appearance,theme]);
 return [appearance,setAppearance] as const;
}
