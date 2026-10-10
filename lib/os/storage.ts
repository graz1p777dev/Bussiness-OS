'use client';
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {defaultSettingsDocument,getSettingsDocument,isSettingsAlias,persistSettingsDocument,readSettingsAlias,setSettingsAlias,settingsDocumentKey,type SettingsStorage} from './settings-document.ts';

export function readStoredValue<T>(key:string,initial:T,storage:SettingsStorage=localStorage):T{
 if(isSettingsAlias(key))return readSettingsAlias(getSettingsDocument(storage),key) as T;
 if(key==='settings-document-v1')return getSettingsDocument(storage) as T;
 const raw=storage.getItem('life-'+key);return raw===null?initial:JSON.parse(raw) as T;
}
export function writeStoredValue<T>(key:string,value:T,storage:SettingsStorage=localStorage){
 if(isSettingsAlias(key)){const current=getSettingsDocument(storage),next=setSettingsAlias(current,key,value);if(JSON.stringify(current)!==JSON.stringify(next))persistSettingsDocument(next,storage);return}
 if(key==='settings-document-v1')throw new Error('Используйте подтверждённый импорт настроек');
 const serialized=JSON.stringify(value);if(storage.getItem('life-'+key)===serialized)return;
 storage.setItem('life-'+key,serialized);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('storage-custom',{detail:{key:'life-'+key}}));
}
/** Compatibility for blueprint / Store snapshots; legacy configuration keys are never written again. */
export function settingsStorage(storage:SettingsStorage=localStorage):SettingsStorage{return {
 getItem:key=>key.startsWith('life-')&&isSettingsAlias(key.slice(5))?JSON.stringify(readSettingsAlias(getSettingsDocument(storage),key.slice(5))):storage.getItem(key),
 setItem:(key,value)=>{if(key.startsWith('life-')&&isSettingsAlias(key.slice(5)))writeStoredValue(key.slice(5),JSON.parse(value),storage);else storage.setItem(key,value)},
 removeItem:key=>{if(key.startsWith('life-')&&isSettingsAlias(key.slice(5)))writeStoredValue(key.slice(5),readSettingsAlias(defaultSettingsDocument,key.slice(5)),storage);else storage.removeItem(key)},
}}
export function useStored<T>(key:string,initial:T,load?:(value:T)=>T){
 const [value,setValue]=useState(initial),options=useRef({initial,load});
 useEffect(()=>{options.current={initial,load}});
 useEffect(()=>{
  const refresh=(event?:Event)=>{
   const changed=event instanceof CustomEvent?event.detail?.key:event instanceof StorageEvent?event.key:null;
   if(changed&&changed!=='life-'+key&&!(changed===settingsDocumentKey&&isSettingsAlias(key)))return;
   try{const raw=readStoredValue(key,options.current.initial),next=options.current.load?options.current.load(raw):raw;setValue(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);if(!event&&!isSettingsAlias(key)&&key!=='settings-document-v1'&&localStorage.getItem('life-'+key)===null)writeStoredValue(key,next)}catch{if(key==='team-roles-v3')setValue([] as T)}
  };
  window.addEventListener('storage-custom',refresh);window.addEventListener('storage',refresh);refresh();
  return()=>{window.removeEventListener('storage-custom',refresh);window.removeEventListener('storage',refresh)};
 },[key]);
 const update=useCallback((change:SetStateAction<T>)=>{
  const raw=readStoredValue(key,options.current.initial),current=options.current.load?options.current.load(raw):raw;
  const next=typeof change==='function'?(change as (value:T)=>T)(current):change;
  writeStoredValue(key,next);setValue(next);
 },[key]);
 return [value,update] as const;
}
