'use client';
import {useLowPower} from '../../lib/os/performance';
export type ArtKind='access'|'inventory'|'server'|'help'|'lost'|'error'|'knowledge'|'workflow'|'team'|'payment';
export default function NeutralArt({kind='access',className=''}:{kind?:ArtKind;className?:string}){const lowPower=useLowPower();if(lowPower)return null;const path=kind==='lost'?'/errors/lost.png':kind==='error'?'/errors/server.png':'/illustrations/'+kind+'.png';return <img loading="lazy" decoding="async" className={'neutral-art '+className} src={path} alt=""/>}
