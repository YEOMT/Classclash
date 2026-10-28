import packed from '../generated/art-manifest.json';
export interface NativeFrame {duration:number;data:{x:number;y:number;w:number;h:number};pivot:[number,number];sourceSize:[number,number];sockets:Record<'feet'|'mainHand'|'offHand'|'projectileOrigin',[number,number]>}
export interface ChampionArt {name:string;heroId:string;assetVersion:string;sourceHash:string;sheet:string;width:number;height:number;scale:number;clips:Record<string,string>;anims:Record<string,{frames:NativeFrame[]}>;actions:Record<string,{clip:string;releaseFrame:number;multiHitFrames:number[]}>}
export const CHAMPION_CONTRACT=packed.heroes as unknown as Record<string,ChampionArt>;
export const ART_VERSION=packed.assetVersion;
export function requireChampionArt(id:string):ChampionArt{const spec=CHAMPION_CONTRACT[id];if(!spec)throw new Error(`Missing required champion artwork: ${id}`);return spec;}
export function nativeLoopFrame(frames:NativeFrame[],ageMs:number,loop:boolean):number{
 const total=frames.reduce((n,f)=>n+f.duration*1000,0);let at=Math.max(0,ageMs);if(loop)at%=total;else if(at>=total)return frames.length-1;
 for(let i=0;i<frames.length;i++){if(at<frames[i]!.duration*1000)return i;at-=frames[i]!.duration*1000;}return frames.length-1;
}
export function socketOffset(frame:NativeFrame,name:keyof NativeFrame['sockets'],mirror:boolean,scale=1){const socket=frame.sockets[name];return {x:(socket[0]-frame.pivot[0])*scale*(mirror?-1:1),y:(socket[1]-frame.pivot[1])*scale};}
export function stableFacing(facingX:number,previous:boolean){return Math.abs(facingX)<.18?previous:facingX<0;}
