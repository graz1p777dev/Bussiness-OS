'use client';
import {useEffect} from 'react';
import {useStored} from './storage';
export const defaultPalettes={dark:{bg:'#111216',panel:'#181a20',sidebar:'#15161b',hover:'#22242d',border:'#2a2c35',text:'#ebecef',muted:'#8b8f9e',accent:'#a78bfa'},light:{bg:'#f7f8fb',panel:'#ffffff',sidebar:'#f0f2f6',hover:'#e9ebf2',border:'#e0e3eb',text:'#242633',muted:'#737888',accent:'#7763c6'}};
export type Palette=typeof defaultPalettes.dark;
export const defaultAppearance={custom:false,palettes:defaultPalettes,density:'comfortable',fontSize:14,radius:6,motion:true};
export function useAppearance(theme:string){
 const [appearance,setAppearance]=useStored('appearance-v2',defaultAppearance);
 useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const mode=theme==='System'?(media.matches?'dark':'light'):theme==='Light'?'light':'dark';const root=document.documentElement;root.dataset.theme=mode;root.dataset.density=appearance.density;root.dataset.motion=String(appearance.motion);root.style.setProperty('--base-font',appearance.fontSize+'px');root.style.setProperty('--control-radius',appearance.radius+'px');for(const key of Object.keys(defaultPalettes.dark)){if(appearance.custom)root.style.setProperty('--'+key,appearance.palettes[mode][key as keyof Palette]);else root.style.removeProperty('--'+key)}};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply)},[appearance,theme]);
 return [appearance,setAppearance] as const;
}
