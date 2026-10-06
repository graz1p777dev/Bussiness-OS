'use client';
import {useEffect,useRef,useState} from 'react';
import {useMotionPreference} from '../../lib/os/motion';
type Props={value:number;format:(n:number)=>string};
function MovingNumber({value,format}:Props){const [display,setDisplay]=useState(value);const previous=useRef(value);useEffect(()=>{const start=previous.current;if(start===value)return;let frame=0;const begin=performance.now();const tick=(now:number)=>{const progress=Math.min(1,(now-begin)/450);const current=start+(value-start)*(1-Math.pow(1-progress,3));previous.current=current;setDisplay(current);if(progress<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[value]);return <span aria-label={format(value)}>{format(display)}</span>}
export default function AnimatedNumber(props:Props){const motion=useMotionPreference();return motion?<MovingNumber {...props}/>:<span aria-label={props.format(props.value)}>{props.format(props.value)}</span>}
