import type { CombatState, CombatUnit, Point } from '../shared/combat-types.js';
import type { Lane, Team, CombatTeam } from '../shared/types.js';
import { BATTLE_MAP, MAP_BOUNDS, JUNGLE_PATHS, JUNGLE_CAMPS, LANES } from '../shared/battle-map.js';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const gap = (a: Point & { radius: number }, b: Point & { radius: number }) => Math.max(0, distance(a, b) - a.radius - b.radius);
export const direction = (a: Point, b: Point): Point => {
  const length = distance(a, b); return length > .001 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 };
};
export const teamDirection = (team: CombatTeam) => team === 'A' ? 1 : -1;
export const isStructure = (u: CombatUnit) => ['OUTER','INNER','GUARD','NEXUS'].includes(u.kind);
export const living = (u: CombatUnit) => u.hp > 0 && u.state !== 'DEAD';
export const laneY = (lane: Lane) => BATTLE_MAP.laneY[lane];
const lanePaths=Object.fromEntries(LANES.map(lane=>[lane,BATTLE_MAP.pathsAtoB[lane].map(([x,y])=>({x,y}))])) as Record<Lane,Point[]>;
export function lanePath(lane:Lane):Point[]{return lanePaths[lane];}
export function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
  return {x:a.x+dx*t,y:a.y+dy*t};
}
export const segmentDistance = (p: Point, a: Point, b: Point) => distance(p, closestOnSegment(p,a,b));
const progressCache=new WeakMap<Point,Map<string,{x:number;y:number;value:number}>>();
export function laneProgress(p: Point, lane: Lane, team: CombatTeam): number {
  const key=lane+'/'+team,cached=progressCache.get(p)?.get(key);if(cached&&cached.x===p.x&&cached.y===p.y)return cached.value;
  const path=lanePath(lane); let best=Infinity, at=0, sum=0, total=0;
  for(let i=0;i<path.length-1;i++) {
    const a=path[i]!,b=path[i+1]!,q=closestOnSegment(p,a,b),d=distance(p,q),len=distance(a,b);
    if(d<best){best=d;at=sum+distance(a,q);} sum+=len; total+=len;
  }
  const value=team==='A'?at:total-at;let cache=progressCache.get(p);if(!cache){cache=new Map();progressCache.set(p,cache);}cache.set(key,{x:p.x,y:p.y,value});return value;
}
export function pointOnPath(progress: number, lane: Lane, team: CombatTeam, lateral=0): Point {
  const path=team==='B'?[...lanePath(lane)].reverse():lanePath(lane);
  let remaining=Math.max(0,progress);
  for(let i=0;i<path.length-1;i++){
    const a=path[i]!,b=path[i+1]!,d=direction(a,b),len=distance(a,b);
    if(remaining<=len||i===path.length-2)return {x:a.x+d.x*Math.min(len,remaining)-d.y*lateral,y:a.y+d.y*Math.min(len,remaining)+d.x*lateral};
    remaining-=len;
  }
  return path[path.length-1]!;
}
const terrainPaths=[...LANES.map(lane=>({points:lanePath(lane),halfWidth:BATTLE_MAP.laneWidth/2})),...JUNGLE_PATHS.map(points=>({points:points.map(([x,y])=>({x,y})),halfWidth:42}))];
const terrainSegments=terrainPaths.flatMap(route=>route.points.slice(1).map((b,i)=>{const a=route.points[i]!,dx=b.x-a.x,dy=b.y-a.y;return {ax:a.x,ay:a.y,dx,dy,len2:dx*dx+dy*dy,halfWidth:route.halfWidth,minX:Math.min(a.x,b.x)-route.halfWidth,maxX:Math.max(a.x,b.x)+route.halfWidth,minY:Math.min(a.y,b.y)-route.halfWidth,maxY:Math.max(a.y,b.y)+route.halfWidth};}));
export function inLane(p:Point,radius:number,_lane:Lane):boolean{
 if(p.x<MAP_BOUNDS.left+radius||p.x>MAP_BOUNDS.right-radius||p.y<MAP_BOUNDS.top+radius||p.y>MAP_BOUNDS.bottom-radius)return false;
 for(const spawn of Object.values(BATTLE_MAP.spawn))if(distance(p,{x:spawn[0],y:spawn[1]})<=120-radius)return true;
 for(const camp of JUNGLE_CAMPS)if(distance(p,camp)<=65-radius)return true;
 for(const seg of terrainSegments){if(p.x<seg.minX||p.x>seg.maxX||p.y<seg.minY||p.y>seg.maxY)continue;const px=p.x-seg.ax,py=p.y-seg.ay,t=clamp((px*seg.dx+py*seg.dy)/seg.len2,0,1),dx=px-seg.dx*t,dy=py-seg.dy*t;if(dx*dx+dy*dy<=(seg.halfWidth-radius)**2)return true;}
 return false;
}
export function forwardDirection(u:CombatUnit):Point{const lane=u.lane??'MID',at=laneProgress(u,lane,u.team);return direction(pointOnPath(at,lane,u.team),pointOnPath(at+24,lane,u.team));}
export function walkable(state: CombatState,p: Point,radius:number,lane:Lane,ignoreId?:string):boolean{
  return inLane(p,radius,lane)&&state.structures.every(s=>!living(s)||s.entityId===ignoreId||distance(p,s)>=radius+s.radius+.3);
}
export function clearSegment(state:CombatState,a:Point,b:Point,radius:number,lane:Lane,ignoreId?:string):boolean{
  // Interval coverage uses a tolerance for adjoining segments. Endpoints still
  // obey the exact shared terrain predicate, so repeated tiny crowd corrections
  // cannot accumulate outside the corridor and strand the unit there.
  if(!inLane(a,radius,lane)||!inLane(b,radius,lane))return false;
  // Sampling alone misses a shallow tangent near a tower and can smooth a valid
  // detour into a path which the movement collision check can never follow.
  if(state.structures.some(s=>living(s)&&s.entityId!==ignoreId&&segmentDistance(s,a,b)<radius+s.radius+.3))return false;
  return terrainSegmentCovered(a,b,radius,lane);
}
/** Continuous coverage by the same corridor capsules as inLane. Sampling at six
 * pixels can miss a sub-pixel gap between adjoining roads: A* calls it clear,
 * safeMove then rejects each real step forever. Interval union has no step-size
 * aliasing and is cheaper than sampling a long segment at every pixel. */
function terrainSegmentCovered(a:Point,b:Point,radius:number,lane:Lane):boolean{
  for(const p of [a,b])if(p.x<MAP_BOUNDS.left+radius||p.x>MAP_BOUNDS.right-radius||p.y<MAP_BOUNDS.top+radius||p.y>MAP_BOUNDS.bottom-radius)return false;
  const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;if(length2<1e-12)return inLane(a,radius,lane);
  const intervals:[number,number][]=[];
  let full=false;
  const circle=(cx:number,cy:number,r:number)=>{
    if(r<0)return;const px=a.x-cx,py=a.y-cy,q=px*dx+py*dy,disc=q*q-length2*(px*px+py*py-r*r);
    if(disc<0)return;const root=Math.sqrt(Math.max(0,disc)),lo=Math.max(0,(-q-root)/length2),hi=Math.min(1,(-q+root)/length2);if(lo===0&&hi===1)full=true;else if(hi>=lo)intervals.push([lo,hi]);
  };
  for(const spawn of Object.values(BATTLE_MAP.spawn))circle(spawn[0],spawn[1],120-radius);
  for(const camp of JUNGLE_CAMPS)circle(camp.x,camp.y,65-radius);
  if(full)return true;
  for(const seg of terrainSegments){
    if(Math.max(a.x,b.x)<seg.minX||Math.min(a.x,b.x)>seg.maxX||Math.max(a.y,b.y)<seg.minY||Math.min(a.y,b.y)>seg.maxY)continue;
    const r=seg.halfWidth-radius;if(r<0)continue;const length=Math.sqrt(seg.len2),ux=seg.dx/length,uy=seg.dy/length,px=a.x-seg.ax,py=a.y-seg.ay;
    let lo=0,hi=1;
    const clip=(start:number,delta:number,min:number,max:number)=>{
      if(Math.abs(delta)<1e-12){if(start<min||start>max)hi=-1;return;}
      const t0=(min-start)/delta,t1=(max-start)/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
    };
    clip(px*ux+py*uy,dx*ux+dy*uy,0,length);clip(-px*uy+py*ux,-dx*uy+dy*ux,-r,r);
    if(lo===0&&hi===1)return true;
    if(hi>=lo)intervals.push([lo,hi]);circle(seg.ax,seg.ay,r);circle(seg.ax+seg.dx,seg.ay+seg.dy,r);if(full)return true;
  }
  intervals.sort((x,y)=>x[0]-y[0]);let covered=0;
  for(const [lo,hi]of intervals){if(lo>covered+1e-8)return false;covered=Math.max(covered,hi);if(covered>=1-1e-8)return true;}
  return false;
}
export function safeMove(state: CombatState,u:CombatUnit,to:Point):Point{
  const lane=u.lane??'TOP', steps=Math.max(1,Math.ceil(distance(u,to)/3));let p:Point={x:u.x,y:u.y};
  for(let i=1;i<=steps;i++){
    const q={x:u.x+(to.x-u.x)*i/steps,y:u.y+(to.y-u.y)*i/steps};
    if(clearSegment(state,p,q,u.radius,lane)){p=q;continue;}
    const horizontal={x:q.x,y:p.y}, vertical={x:p.x,y:q.y};
    if(clearSegment(state,p,horizontal,u.radius,lane))p=horizontal;
    else if(clearSegment(state,p,vertical,u.radius,lane))p=vertical;
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

/** Local 12-unit navigation grid, replanned only for a changed/blocked goal or a stuck unit. */
const navigationGrids=new Map<string,Uint8Array>();
const navigationEdges=new Map<string,Map<number,boolean>>();
export function findLocalPath(state:CombatState,u:CombatUnit,goal:Point):Point[]{
  const lane=u.lane??'TOP';if(clearSegment(state,u,goal,u.radius,lane))return [goal];
  const size=12,w=Math.ceil(BATTLE_MAP.width/size),h=Math.ceil(BATTLE_MAP.height/size),key=(x:number,y:number)=>y*w+x;
  const start={x:clamp(Math.floor(u.x/size),0,w-1),y:clamp(Math.floor(u.y/size),0,h-1)};
  const finish={x:clamp(Math.floor(goal.x/size),0,w-1),y:clamp(Math.floor(goal.y/size),0,h-1)};
  const toPoint=(x:number,y:number)=>({x:x*size+size/2,y:y*size+size/2});
  const geometryKey=`${BATTLE_MAP.id}/${u.radius}/${state.structures.filter(living).map(s=>`${s.x},${s.y},${s.radius}`).join(';')}`;
  let cells=navigationGrids.get(geometryKey);
  if(!cells){
    cells=new Uint8Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells[key(x,y)]=walkable(state,toPoint(x,y),u.radius,lane)?1:0;
    if(navigationGrids.size>=80)navigationGrids.delete(navigationGrids.keys().next().value!);
    navigationGrids.set(geometryKey,cells);
  }
  let edges=navigationEdges.get(geometryKey);if(!edges){if(navigationEdges.size>=80)navigationEdges.delete(navigationEdges.keys().next().value!);edges=new Map();navigationEdges.set(geometryKey,edges);}
  const closed=new Set<number>();
  const open:{x:number;y:number;g:number;f:number}[]=[{...start,g:0,f:0}],scores=new Map<number,number>([[key(start.x,start.y),0]]),parents=new Map<number,number>();
  let found=-1,closest=key(start.x,start.y),best=distance(u,goal),loops=0;
  while(open.length&&loops++<6500){
    let idx=0;for(let i=1;i<open.length;i++)if(open[i]!.f<open[idx]!.f)idx=i;
    const cur=open.splice(idx,1)[0]!,curKey=key(cur.x,cur.y),startNode=curKey===key(start.x,start.y);
    if(closed.has(curKey))continue;closed.add(curKey);
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
      const edgeKey=curKey*9+(dy+1)*3+dx+1;let clear=startNode?undefined:edges.get(edgeKey);
      if(clear===undefined){clear=clearSegment(state,edgeStart,q,u.radius,lane);if(!startNode)edges.set(edgeKey,clear);}
      if(!clear)continue;
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
