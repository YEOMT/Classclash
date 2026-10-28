import {BALANCE} from '../shared/balance.js';

/** Same world-to-screen transform for terrain and markers; preserves aspect ratio. */
export function minimapTransform(width:number,height:number){
 const scale=Math.min(width/BALANCE.map.width,height/BALANCE.map.height);
 return {scale,x:(width-BALANCE.map.width*scale)/2,y:(height-BALANCE.map.height*scale)/2};
}
