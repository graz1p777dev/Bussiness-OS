import type {ReactNode} from 'react';
import AIMark from './AIMark';
export default function AIEntrance({children}:{children:ReactNode}){return <div className="ai-entrance"><div className="ai-launch" aria-hidden="true"><div className="ai-launch-emblem"><span className="ai-launch-orbit"/><AIMark size={76}/></div><strong>Business OS <span>AI</span></strong><small>Ваш бизнес. В фокусе.</small><div className="ai-launch-line"><i/></div></div><div className="ai-ready">{children}</div></div>}
