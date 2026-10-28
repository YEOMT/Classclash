import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';

export interface ServerConfig {
  production: boolean; host: string; port: number; publicOrigin: string | null;
  hostAccessCode: string; databasePath: string; maxActiveRooms: number;
  roomExpiryHours: number; testSpeed: number; drainFile: string;
}
const integer = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n=value===undefined?fallback:Number(value);
  if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Configuration integer must be between ${min} and ${max}`);
  return n;
};
/** Forwarded headers are deliberately unused. Only configured APP_ORIGIN is trusted. */
export function serverConfig(env: NodeJS.ProcessEnv=process.env):ServerConfig {
  const production=env.NODE_ENV==='production';
  let publicOrigin:string|null=null;
  if(env.APP_ORIGIN){const u=new URL(env.APP_ORIGIN);if(u.origin!==env.APP_ORIGIN||u.username||u.password||!['http:','https:'].includes(u.protocol))throw new Error('APP_ORIGIN must be an origin without credentials, path or trailing slash');if(production&&u.protocol!=='https:')throw new Error('Production APP_ORIGIN must use HTTPS');publicOrigin=u.origin;}
  const hostAccessCode=env.HOST_ACCESS_CODE_FILE?readFileSync(env.HOST_ACCESS_CODE_FILE,'utf8').trim():(env.HOST_ACCESS_CODE||'');
  if(production&&(!publicOrigin||hostAccessCode.length<16||!env.DATABASE_PATH))throw new Error('Production requires HTTPS APP_ORIGIN, HOST_ACCESS_CODE (at least 16 characters) and explicit persistent DATABASE_PATH');
  if(production&&process.argv.includes('--dev'))throw new Error('Development middleware is disabled in production');
  return {production,host:env.HOST||(production?'0.0.0.0':'127.0.0.1'),port:integer(env.PORT,3000,1,65535),publicOrigin,hostAccessCode,databasePath:env.DATABASE_PATH||'data/class-clash-0.2.sqlite',maxActiveRooms:integer(env.MAX_ACTIVE_ROOMS,production?1:8,1,100),roomExpiryHours:integer(env.ROOM_EXPIRY_HOURS,24,1,720),testSpeed:env.NODE_ENV==='test'?integer(env.CLASH_TEST_SPEED,1,1,20):1,drainFile:env.DRAIN_FILE||'data/drain'};
}
export function allowedOrigin(req:IncomingMessage,config:ServerConfig):boolean {
  const origin=req.headers.origin;
  if(!origin)return !config.production;
  if(config.publicOrigin)return origin===config.publicOrigin;
  return origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;
}
export function validHostCode(input:unknown,expected:string):boolean {
  if(!expected)return true;
  if(typeof input!=='string'||input.length>512)return false;
  return timingSafeEqual(createHash('sha256').update(input).digest(),createHash('sha256').update(expected).digest());
}
/** Bounded token windows. Join budgets permit a classroom sharing a NAT address. */
export class RequestLimiter {
  private buckets=new Map<string,{at:number;count:number}>();
  allow(key:string,limit:number,periodMs:number,now=Date.now()):boolean {
    let b=this.buckets.get(key);
    if(!b||now-b.at>=periodMs){b={at:now,count:0};this.buckets.delete(key);this.buckets.set(key,b);}
    if(this.buckets.size>4096)this.buckets.delete(this.buckets.keys().next().value!);
    return ++b.count<=limit;
  }
}
