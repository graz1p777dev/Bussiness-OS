'use client';
import {useEffect,useState,useMemo} from 'react';
import {useStored} from './storage';
import {initialDocuments,documentBlob} from './documents';
import {collectAgentKnowledge,selectedKnowledgeSpaces,emptyAgentKnowledge,type AgentKnowledge} from './agent-knowledge';
const emptySettings:Record<string,Record<string,unknown>>={},emptyInstructions:Record<string,string>={};
export function useAgentKnowledge(canRead:boolean){
 const [entries]=useStored('documents-explorer-v1',initialDocuments),[instructions]=useStored('knowledge-space-instructions-v1',emptyInstructions),[settings]=useStored('agent-settings',emptySettings);
 const signature=JSON.stringify({canRead,entries,instructions,bindings:Object.fromEntries(Object.entries(settings).map(([id,value])=>[id,selectedKnowledgeSpaces(value)]))});
 const [loaded,setLoaded]=useState<{signature:string;values:Record<string,AgentKnowledge>}>({signature:'',values:{}});
 useEffect(()=>{let active=true;if(canRead)Promise.all(Object.entries(settings).map(async([id,value])=>[id,await collectAgentKnowledge(selectedKnowledgeSpaces(value),entries,instructions,true,documentBlob)] as const)).then(values=>{if(active)setLoaded({signature,values:Object.fromEntries(values)})});return()=>{active=false}},[signature,canRead,settings,entries,instructions]);
 return useMemo(()=>({get:(id:string)=>canRead&&loaded.signature===signature?loaded.values[id]||emptyAgentKnowledge:emptyAgentKnowledge,ready:!canRead||loaded.signature===signature,signature}),[canRead,loaded,signature]);
}
