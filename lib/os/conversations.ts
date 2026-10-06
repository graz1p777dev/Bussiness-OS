export type ChatMessage=string|{id:string;text:string;direction:'incoming'|'outgoing';employeeId?:string;sentAt?:string};
// Existing stored strings are replies sent by the operator. The demo thread ends with a client message.
export function messageDirection(message:ChatMessage){return typeof message==='string'?'outgoing':message.direction}
export function messageText(message:ChatMessage){return typeof message==='string'?message:message.text}
export function needsReply(messages:ChatMessage[],initialLastDirection:'incoming'|'outgoing'|null='incoming'){const last=messages.at(-1);return (last===undefined?initialLastDirection:messageDirection(last))==='incoming'}
