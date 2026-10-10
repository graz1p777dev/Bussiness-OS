import {Globe,MessageCircle,Phone} from 'lucide-react';
import './ChannelIcon.css';
export default function ChannelIcon({channel}:{channel:string}){
 const key=channel.toLowerCase();
 return <span className={'channel-icon channel-icon-'+key} role="img" aria-label={channel} title={channel}>{key==='instagram'?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>:key==='telegram'?<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 3.2 18.1 20c-.3 1.2-1 1.5-2 1l-5.3-3.9-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.4L17.5 6c.4-.4-.1-.6-.6-.2L4.8 13.4l-5.2-1.6c-1.1-.3-1.1-1.1.2-1.6L20 2.5c.9-.3 1.7.2 1.6.7Z"/></svg>:key==='whatsapp'?<span className="channel-whatsapp-mark"><MessageCircle size={21}/><Phone size={10}/></span>:<Globe size={18}/>}</span>;
}
