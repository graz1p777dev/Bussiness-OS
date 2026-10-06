'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

/** Keep the complete dashboard, mounting charts near the viewport in low-power mode. */
export default function ViewportChart({lowPower,height,render}:{lowPower:boolean;height:number;render:()=>ReactNode}){
 const element=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const node=element.current;
  if(!lowPower||!node)return;
  const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)),{rootMargin:'320px'});
  observer.observe(node);
  return()=>observer.disconnect();
 },[lowPower]);
 return <div ref={element} className="viewport-chart" style={{height}} data-chart-mounted={!lowPower||visible}>{!lowPower||visible?render():null}</div>;
}
