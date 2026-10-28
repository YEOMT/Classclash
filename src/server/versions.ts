import {createHash} from 'node:crypto';
import {HEROES,SKILLS} from '../shared/heroes.js';
import {BALANCE} from '../shared/balance.js';
import {JUNGLE_BALANCE} from '../shared/jungle-balance.js';
import {BOT_TACTICS} from '../shared/bot-balance.js';
import {ENGINE_TACTICS} from '../shared/engine-tactics.js';

/** Bump whenever engine/room semantics change incompatibly with a saved match. */
export const RULES_VERSION='classclash-rules-0.2-jungle-stable-targets';
export interface RuntimeVersions { rulesVersion:string; contentHash:string; balanceHash:string }
/** Object key order must not affect compatibility; array order remains meaningful. */
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function fingerprint(value:unknown):string {return createHash('sha256').update(canonical(value)).digest('hex');}
export const CURRENT_VERSIONS:Readonly<RuntimeVersions>=Object.freeze({rulesVersion:RULES_VERSION,contentHash:fingerprint({heroes:HEROES,skills:SKILLS}),balanceHash:fingerprint({balance:BALANCE,botTactics:BOT_TACTICS,jungle:JUNGLE_BALANCE,engine:ENGINE_TACTICS})});
export function incompatibleVersions(stored:Partial<RuntimeVersions>|undefined):string[]{
  return (Object.keys(CURRENT_VERSIONS) as (keyof RuntimeVersions)[]).filter(key=>stored?.[key]!==CURRENT_VERSIONS[key]);
}
