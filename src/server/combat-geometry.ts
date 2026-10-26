import type { CombatState, CombatUnit, Point } from '../shared/combat-types.js';
import type { Lane, Team } from '../shared/types.js';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const gap = (a: Point & { radius: number }, b: Point & { radius: number }) => Math.max(0, distance(a, b) - a.radius - b.radius);
export const direction = (a: Point, b: Point): Point => {
  const length = distance(a, b); return length > .001 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 };
};
export const teamDirection = (team: Team) => team === 'A' ? 1 : -1;
export const isStructure = (u: CombatUnit) => u.kind !== 'HERO' && !u.kind.endsWith('MINION');
export const living = (u: CombatUnit) => u.hp > 0 && u.state !== 'DEAD';
export const laneY = (lane: Lane) => lane === 'TOP' ? 224 : 544;
export function lanePath(lane: Lane): Point[] {
  const y = laneY(lane); return [{x:152,y:384},{x:300,y:384},{x:380,y},{x:1156,y},{x:1236,y:384},{x:1384,y:384}];
}
export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
  return {x:a.x+dx*t,y:a.y+dy*t};
}
export const segmentDistance = (p: Point, a: Point, b: Point) => distance(p, closestOnSegment(p,a,b));
export function laneProgress(p: Point, lane: Lane, team: Team): number {
  const path=lanePath(lane); let best=Infinity, at=0, sum=0, total=0;
  for(let i=0;i<path.length-1;i++) {
    const a=path[i]!,b=path[i+1]!,q=closestOnSegment(p,a,b),d=distance(p,q),len=distance(a,b);
    if(d<best){best=d;at=sum+distance(a,q);} sum+=len; total+=len;
  }
  return team==='A'?at:total-at;
}
export function pointOnPath(progress: number, lane: Lane, team: Team, lateral=0): Point {
  const path=lanePath(lane); if(team==='B')path.reverse();
  let remaining=Math.max(0,progress);
  for(let i=0;i<path.length-1;i++){
    const a=path[i]!,b=path[i+1]!,d=direction(a,b),len=distance(a,b);
    if(remaining<=len||i===path.length-2)return {x:a.x+d.x*Math.min(len,remaining)-d.y*lateral,y:a.y+d.y*Math.min(len,remaining)+d.x*lateral};
    remaining-=len;
  }
  return path[path.length-1]!;
}
export function inLane(p: Point, radius: number, lane: Lane): boolean {
  if(p.x<45+radius||p.x>1491-radius||p.y<140+radius||p.y>628-radius)return false;
  // The base merge is an area, not a bottleneck waypoint. Only the assigned corridor is used outside it.
  if((p.x<=320||p.x>=1216)&&p.y>=264+radius&&p.y<=504-radius)return true;
  const path=lanePath(lane);
  for(let i=0;i<path.length-1;i++)if(segmentDistance(p,path[i]!,path[i+1]!)<=72-radius)return true;
  return false;
}
export function walkable(state: CombatState,p: Point,radius:number,lane:Lane,ignoreId?:string):boolean{
  return inLane(p,radius,lane)&&state.structures.every(s=>!living(s)||s.entityId===ignoreId||distance(p,s)>=radius+s.radius+.3);
}
export function clearSegment(state:CombatState,a:Point,b:Point,radius:number,lane:Lane,ignoreId?:string):boolean{
  // Sampling alone misses a shallow tangent near a tower and can smooth a valid
  // detour into a path which the movement collision check can never follow.
  if(state.structures.some(s=>living(s)&&s.entityId!==ignoreId&&segmentDistance(s,a,b)<radius+s.radius+.3-1e-6))return false;
  const count=Math.max(1,Math.ceil(distance(a,b)/6));
  for(let i=0;i<=count;i++){const p={x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count};if(!inLane(p,radius,lane))return false;}
  return true;
}
export function safeMove(state: CombatState,u:CombatUnit,to:Point):Point{
  const lane=u.lane??'TOP', steps=Math.max(1,Math.ceil(distance(u,to)/3));let p:Point={x:u.x,y:u.y};
  for(let i=1;i<=steps;i++){
    const q={x:u.x+(to.x-u.x)*i/steps,y:u.y+(to.y-u.y)*i/steps};
    if(walkable(state,q,u.radius,lane)){p=q;continue;}
    const horizontal={x:q.x,y:p.y}, vertical={x:p.x,y:q.y};
    if(walkable(state,horizontal,u.radius,lane))p=horizontal;
    else if(walkable(state,vertical,u.radius,lane))p=vertical;
    else break;
  }
  return p;
}
export function nearestWalkable(state:CombatState,p:Point,radius:number,lane:Lane):Point|null{
  if(walkable(state,p,radius,lane))return p;
  for(let r=4;r<=100;r+=4){
    for(let i=0;i<24;i++){const angle=i*Math.PI/12,q={x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r};if(walkable(state,q,radius,lane))return q;}
  }
  return null;
}
export function circleHits(p:Point,radius:number,u:CombatUnit):boolean{return distance(p,u)<=radius+u.radius;}
export function rectangleHits(origin:Point,dir:Point,length:number,width:number,u:CombatUnit,centered=false):boolean{
  const x=(u.x-origin.x)*dir.x+(u.y-origin.y)*dir.y;
  const y=-(u.x-origin.x)*dir.y+(u.y-origin.y)*dir.x;
  const lo=centered?-length/2:0,hi=centered?length/2:length;
  return Math.hypot(Math.max(lo-x,0,x-hi),Math.max(Math.abs(y)-width/2,0))<=u.radius;
}
export function coneHits(origin:Point,dir:Point,length:number,degrees:number,u:CombatUnit):boolean{
  const d=distance(origin,u);if(d-u.radius>length)return false;if(d<=u.radius)return true;
  const c=clamp(((u.x-origin.x)*dir.x+(u.y-origin.y)*dir.y)/d,-1,1);
  return Math.acos(c)<=degrees*Math.PI/360+Math.asin(Math.min(1,u.radius/d));
}

/** Local 16-unit navigation grid, replanned only for a changed/blocked goal or a stuck unit. */
const navigationGrids=new Map<string,Uint8Array>();
export function findLocalPath(state:CombatState,u:CombatUnit,goal:Point):Point[]{
  const lane=u.lane??'TOP';if(clearSegment(state,u,goal,u.radius,lane))return [goal];
  const size=16,w=96,h=48,key=(x:number,y:number)=>y*w+x;
  const start={x:clamp(Math.floor(u.x/size),0,w-1),y:clamp(Math.floor(u.y/size),0,h-1)};
  const finish={x:clamp(Math.floor(goal.x/size),0,w-1),y:clamp(Math.floor(goal.y/size),0,h-1)};
  const toPoint=(x:number,y:number)=>({x:x*size+size/2,y:y*size+size/2});
  const geometryKey=`${lane}/${u.radius}/${state.structures.filter(living).map(s=>`${s.x},${s.y},${s.radius}`).join(';')}`;
  let cells=navigationGrids.get(geometryKey);
  if(!cells){
    cells=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells[key(x,y)]=walkable(state,toPoint(x,y),u.radius+1,lane)?1:0;
    if(navigationGrids.size>=80)navigationGrids.delete(navigationGrids.keys().next().value!);
    navigationGrids.set(geometryKey,cells);
  }
  const open:{x:number;y:number;g:number;f:number}[]=[{...start,g:0,f:0}],scores=new Map<number,number>([[key(start.x,start.y),0]]),parents=new Map<number,number>();
  let found=-1,closest=key(start.x,start.y),best=distance(u,goal),loops=0;
  while(open.length&&loops++<2000){
    let idx=0;for(let i=1;i<open.length;i++)if(open[i]!.f<open[idx]!.f)idx=i;
    const cur=open.splice(idx,1)[0]!,curKey=key(cur.x,cur.y),startNode=curKey===key(start.x,start.y);
    // The virtual start is the unit's actual position, including when testing a
    // nearby goal. Its grid center can see a goal through a different tangent.
    const p:Point=startNode?u:toPoint(cur.x,cur.y),dg=distance(p,goal);
    if(dg<best){closest=curKey;best=dg;}
    if(((cur.x===finish.x&&cur.y===finish.y)||dg<22)&&clearSegment(state,p,goal,u.radius,lane)){found=curKey;break;}
    // Near the rounded lane/tower intersection the current cell and its direct
    // neighbors can all be blocked, although a legal tangent reaches the next
    // row. A virtual start connects to visible nodes within three grid cells.
    const reach=startNode?3:1;
    for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
      if(!dx&&!dy)continue;const nx=cur.x+dx,ny=cur.y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const q=toPoint(nx,ny);if(!cells[key(nx,ny)])continue;
      if(curKey!==key(start.x,start.y)&&dx&&dy&&(!cells[key(cur.x,ny)]||!cells[key(nx,cur.y)]))continue;
      // A unit may occupy the edge of an obstructed grid cell. Connect from its
      // actual position rather than assuming that cell's center is traversable.
      const edgeStart=curKey===key(start.x,start.y)?u:p;
      if(!clearSegment(state,edgeStart,q,u.radius,lane))continue;
      const nk=key(nx,ny),g=cur.g+(startNode?distance(u,q)/size:dx&&dy?1.414:1);if(g>=(scores.get(nk)??Infinity))continue;
      scores.set(nk,g);parents.set(nk,curKey);open.push({x:nx,y:ny,g,f:g+distance(q,goal)/size});
    }
  }
  let at=found>=0?found:closest;const result:Point[]=[];
  while(parents.has(at)){result.unshift(toPoint(at%w,Math.floor(at/w)));at=parents.get(at)!;}
  if(found>=0)result.push(goal);
  // String pulling removes stair-stepping while retaining collision-safe segments.
  const smooth:Point[]=[];let from:Point=u;
  while(result.length){let i=result.length-1;while(i>0&&!clearSegment(state,from,result[i]!,u.radius,lane))i--;if(!clearSegment(state,from,result[i]!,u.radius,lane))break;from=result[i]!;smooth.push(from);result.splice(0,i+1);}
  return smooth;
}

export class SpatialHash {
  private cells=new Map<string,CombatUnit[]>();
  constructor(units:CombatUnit[]){for(const u of units){if(!living(u))continue;const k=`${Math.floor(u.x/64)},${Math.floor(u.y/64)}`;const list=this.cells.get(k)??[];list.push(u);this.cells.set(k,list);}}
  nearby(p:Point,radius:number):CombatUnit[]{
    const result:CombatUnit[]=[];
    for(let y=Math.floor((p.y-radius)/64);y<=Math.floor((p.y+radius)/64);y++)for(let x=Math.floor((p.x-radius)/64);x<=Math.floor((p.x+radius)/64);x++){
      const list=this.cells.get(`${x},${y}`);if(list)for(const u of list)if(distance(p,u)<=radius+u.radius)result.push(u);
    }return result;
  }
}
