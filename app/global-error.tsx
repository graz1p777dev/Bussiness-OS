'use client';
import ErrorScreen from '../components/os/ErrorScreen';
import './globals.css';
export default function GlobalError({reset}:{reset:()=>void}){return <html lang="ru"><body><ErrorScreen code={500} retry={reset}/></body></html>}
