/** Use this adapter when replacing mock data with real requests. */
export class HttpError extends Error{constructor(public status:number){super('HTTP '+status);this.name='HttpError'}}
export async function requestJSON<T>(input:RequestInfo|URL,init?:RequestInit):Promise<T>{const response=await fetch(input,init);if(!response.ok)throw new HttpError(response.status);return await response.json() as T}
