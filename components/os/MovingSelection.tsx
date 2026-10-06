'use client';
import {useEffect} from 'react';
/** One travelling surface per navigation group; follows scrolling and resizing. */
export default function MovingSelection(){
 useEffect(()=>{let frame=0;const observed=new Set<HTMLElement>();const resize=new ResizeObserver(schedule);
 function update(){frame=0;for(const group of observed){if(!group.isConnected){resize.unobserve(group);observed.delete(group)}}document.querySelectorAll<HTMLElement>('.tabs,.workspace-tabs,.settings-nav,.branch-navigation,.analytics-tabs').forEach(group=>{if(!observed.has(group)){observed.add(group);resize.observe(group)}const selector=group.classList.contains('branch-navigation')?'button[aria-current="page"]':'.selected,.active,[aria-selected="true"]';const item=group.querySelector<HTMLElement>(selector)||(group.classList.contains('branch-navigation')?group.querySelector<HTMLElement>('.branch-toggle.has-active'):null);if(!item||!item.getClientRects().length){group.removeAttribute('data-moving-selection');return}const box=group.getBoundingClientRect(),target=item.getBoundingClientRect();group.style.setProperty('--selection-x',`${target.left-box.left+group.scrollLeft}px`);group.style.setProperty('--selection-y',`${target.top-box.top+group.scrollTop}px`);group.style.setProperty('--selection-w',`${target.width}px`);group.style.setProperty('--selection-h',`${target.height}px`);group.setAttribute('data-moving-selection','true')})}
 function schedule(){if(!frame)frame=requestAnimationFrame(update)}
 const mutation=new MutationObserver(schedule);mutation.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current','aria-selected']});document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);schedule();return()=>{cancelAnimationFrame(frame);mutation.disconnect();resize.disconnect();document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)}
 },[]);return null;
}
