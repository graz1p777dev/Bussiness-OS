'use client';
import ErrorScreen from '../components/os/ErrorScreen';
export default function Error({error,reset}:{error:Error&{status?:number};reset:()=>void}){return <ErrorScreen code={error.status&&error.status>=400&&error.status<=599?error.status:500} retry={reset}/>}
