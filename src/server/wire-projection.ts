import type {RoomSnapshot} from '../shared/types.js';

/** Display precision only. Authority coordinates, damage and event timing remain unchanged. */
const hundredths=['x','y','previousX','previousY','vx','vy','hp','maxHp','shield'] as const;
const directions=['facingX','facingY'] as const;
export function displayUnitNumbers(unit:Record<string,unknown>):Record<string,unknown>{
  const result={...unit};
  for(const key of hundredths){const value=unit[key];if(typeof value==='number'&&Number.isFinite(value)){
    const rounded=Math.round(value*100)/100;
    // A living unit must not appear to have zero health before the authority kills it.
    result[key]=(key==='hp'||key==='shield')&&value>0?Math.max(.01,rounded):rounded;
  }}
  for(const key of directions){const value=unit[key];if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.round(value*10000)/10000;}
  return result;
}

/** Create per broadcast, never across rooms or ticks. Private fields are never cached. */
export function snapshotEncoder(battle:RoomSnapshot['battle'],tick:number){
  const sharedBattle=battle?JSON.stringify({...battle,events:undefined}).slice(0,-1):null;
  const battleByCursor=new Map<number,string>();
  return (snapshot:RoomSnapshot,lastEventSeq:number):string=>{
    let encodedBattle=battleByCursor.get(lastEventSeq);
    if(encodedBattle===undefined){encodedBattle=battle?sharedBattle+',"events":'+JSON.stringify(battle.events.filter(e=>e.eventSeq>lastEventSeq&&e.tick>=tick-200))+'}':'null';battleByCursor.set(lastEventSeq,encodedBattle);}
    const privateJson=JSON.stringify({...snapshot,battle:undefined});
    return '{"type":"SNAPSHOT","snapshot":'+privateJson.slice(0,-1)+',"battle":'+encodedBattle+'}}';
  };
}
