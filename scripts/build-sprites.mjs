// Original, deterministic pixel art source. Native Node only; no external art or canvas.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const root=process.cwd(), out=path.join(root,'public/assets/heroes');
fs.mkdirSync(out,{recursive:true});
const heroes=JSON.parse(fs.readFileSync(path.join(root,'assets/source/heroes.json'),'utf8'));
const directions=['S','SE','E','NE','N','NW','W','SW'];
const stateCounts={idle:2,walk:4,basicAttack:6,skill1:6,skill2:8,hurt:2,death:5,spawn:3};
const states={};let start=0;for(const [s,count] of Object.entries(stateCounts)){states[s]={start,count};start+=count;}
const CELL=64,COLS=16,W=CELL*COLS,H=Math.ceil(start*8/COLS)*CELL;
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,b){const t=Buffer.from(type),o=Buffer.alloc(b.length+12);o.writeUInt32BE(b.length,0);t.copy(o,4);b.copy(o,8);o.writeUInt32BE(crc32(Buffer.concat([t,b])),b.length+8);return o;}
function png(w,h,rgba){const hd=Buffer.alloc(13);hd.writeUInt32BE(w,0);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4).copy(rows,y*(w*4+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',hd),pngChunk('IDAT',zlib.deflateSync(rows,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);}
class Pixels{
 constructor(w,h){this.w=w;this.h=h;this.data=new Uint8Array(w*h*4);}
 pixel(x,y,c,a=255){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=this.w||y>=this.h)return;let i=(y*this.w+x)*4;this.data[i]=c>>16&255;this.data[i+1]=c>>8&255;this.data[i+2]=c&255;this.data[i+3]=a;}
 rect(x,y,w,h,c,a=255){for(let yy=Math.round(y);yy<Math.round(y+h);yy++)for(let xx=Math.round(x);xx<Math.round(x+w);xx++)this.pixel(xx,yy,c,a);}
 line(x0,y0,x1,y1,c,width=1){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;for(let n=0;n<150;n++){this.rect(x0-Math.floor(width/2),y0-Math.floor(width/2),width,width,c);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}}
 poly(points,c){const ys=points.map(p=>p[1]);for(let y=Math.floor(Math.min(...ys));y<=Math.ceil(Math.max(...ys));y++){const xs=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y))xs.push(xi+(y-yi)*(xj-xi)/(yj-yi));}xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)this.rect(Math.ceil(xs[k]),y,Math.floor(xs[k+1])-Math.ceil(xs[k])+1,1,c);}}
 disc(x,y,rx,ry,c){for(let yy=-ry;yy<=ry;yy++)for(let xx=-rx;xx<=rx;xx++)if(xx*xx/(rx*rx)+yy*yy/(ry*ry)<=1)this.pixel(x+xx,y+yy,c);}
 blit(src,x,y){for(let yy=0;yy<src.h;yy++)for(let xx=0;xx<src.w;xx++){const si=(yy*src.w+xx)*4,di=((yy+y)*this.w+xx+x)*4;if(src.data[si+3])this.data.set(src.data.subarray(si,si+4),di);}}
}
// All parts live in local sprite coordinates. x points toward the facing direction.
function pose(h,state,f,d){
 const phase=f/(stateCounts[state]-1),v=[[0,1],[.71,.71],[1,0],[.71,-.71],[0,-1],[-.71,-.71],[-1,0],[-.71,.71]][d];
 const side=Math.abs(v[0]),back=v[1]<-.4,large=['golem','ancient'].includes(h.rig),bodyW=h.rig==='armored'?15:large?19:h.rig==='large'?17:h.rig==='spirit'?20:12;
 const p={fx:v[0],fy:v[1],d,side,back,bodyW,large,cx:32,cy:36-(large?2:0),headY:24-(large?4:0),headX:32,lean:0,bob:0,crouch:0,spread:4,foot:0,arm:0,handReach:0,offReach:0,weaponAngle:-1.1,raise:0,opacity:255,phase,release:false,motion:'idle',frame:f,state};
 if(state==='idle'){p.bob=f;p.arm=f*.2;}
 if(state==='walk'){p.foot=[-2,0,2,0][f];p.bob=f%2;p.arm=[-.25,0,.25,0][f];p.lean=1;}
 if(state==='hurt'){p.lean=-2-f;p.crouch=1;p.arm=-.2;p.headX-=Math.round(p.fx*2);}
 if(state==='death'){p.crouch=[1,4,8,12,15][f];p.lean=-f*2;p.headY+=f;p.weaponAngle=.7+f*.25;p.opacity=[255,255,225,170,90][f];p.spread=5+f;}
 if(state==='spawn'){p.bob=2-f;p.opacity=[100,190,255][f];p.arm=-.2;}
 if(['basicAttack','skill1','skill2'].includes(state)){
  const index=state==='basicAttack'?0:state==='skill1'?1:2,m=h.motions[index],impact=index===2?3:2;
  const t=f<impact?0:f===impact?1:f===impact+1?.6:.15;p.motion=m;p.release=f===impact||(['flurry','cross_combo','triple'].includes(m)&&f%2===0);p.lean=f<impact?-1:2*t;p.handReach=f<impact?-3:5*t;p.offReach=0;p.arm=f<impact?-.45:.65*t;p.weaponAngle=f<impact?-1.8:.25;
  if(['slash','flash','spin'].includes(m)){p.weaponAngle=[-2.1,-1.7,.45,1.15,.9,-.7][Math.min(f,5)];p.handReach=[-2,-3,6,4,2,0][Math.min(f,5)];if(m==='spin'){p.weaponAngle=f*1.2;p.lean=Math.round(Math.cos(f)*3);p.offReach=3;}if(m==='flash'){p.lean=4*t;p.crouch=2;p.handReach=8*t;}}
  if(['smash','stone_smash','ancient_smash','earth','fissure','ice_stamp'].includes(m)){p.raise=f<impact?7:0;p.weaponAngle=f<impact?-1.9:.7;p.crouch=f===impact?3:0;p.lean=f===impact?3:0;if(['earth','fissure'].includes(m))p.offReach=p.handReach;}
  if(['punch','flurry','stab','cross_combo','sigil','palm','soul'].includes(m)){p.handReach=f%2?0:7;p.offReach=['flurry','cross_combo'].includes(m)?(f%2?8:0):1;p.weaponAngle=0;p.crouch=m==='flurry'?2:0;if(m==='sigil')p.raise=f<impact?4:0;if(m==='soul'){p.raise=4;p.handReach=f<impact?2:8;p.offReach=-2;}}
  if(m==='uppercut'){p.crouch=f<impact?4:-3;p.handReach=f<impact?1:5;p.raise=f<impact?0:11;p.weaponAngle=-1.4;}
  if(['bow','heavy_bow','sky_bow'].includes(m)){p.handReach=f<impact?2:4;p.offReach=f<impact?-3:3;p.weaponAngle=m==='sky_bow'?-1.3:0;p.raise=m==='sky_bow'?8:1;p.lean=f===impact?-1:0;}
  if(['crossbow','heavy_crossbow','binding'].includes(m)){p.handReach=f===impact?-1:5;p.offReach=4;p.weaponAngle=0;p.raise=1;p.lean=f===impact?-2:0;}
  if(['staff_cast','fire_orb','heal_reach','chain','book_cast','triple'].includes(m)){p.handReach=f<impact?0:6;p.raise=f<impact?3:1;p.weaponAngle=f<impact?-1.3:-.45;if(m==='triple'){p.raise=4+(f%2)*2;p.offReach=3;}if(m==='book_cast'){p.offReach=3;p.raise=2;}}
  if(['prayer','sanctuary','bell','roar','barrier','resonance','thunder'].includes(m)){p.raise=5+Math.round(3*t);p.handReach=m==='barrier'?7:1;p.offReach=m==='barrier'?7:2;p.weaponAngle=-1.5;p.lean=0;p.crouch=m==='roar'?1:0;}
  if(['wall_draw','fan','dissonance','melody'].includes(m)){p.weaponAngle=-1.6+phase*2.4;p.handReach=2+Math.round(5*t);p.offReach=4;p.raise=3;p.lean=1;}
  if(['parry','wall','shield_bash','charge'].includes(m)){p.weaponAngle=m==='parry'?-1.55:0;p.handReach=m==='parry'?3:1;p.offReach=f<impact?1:7;p.crouch=m==='charge'?3:1;p.spread=m==='wall'?7:5;p.lean=m==='charge'?5:1;}
  if(['thrust','repel'].includes(m)){p.weaponAngle=0;p.handReach=f<impact?-2:7;p.offReach=3;p.lean=f<impact?-1:2;}
  if(['shadow','leap'].includes(m)){p.crouch=f<impact?3:-3;p.raise=f<impact?0:4;p.handReach=4;p.lean=4;}
  if(m==='iron_swing'){p.weaponAngle=-1+phase*2;p.offReach=3;}
  if(m==='pluck'){p.handReach=f<impact?1:4;p.offReach=2;p.weaponAngle=-.5;}
  if(m==='heavy_bow'){p.offReach=f<impact?-6:4;p.raise=3;p.crouch=1;p.lean=f<impact?-2:1;}
  if(m==='heavy_crossbow'){p.crouch=2;p.handReach=f===impact?-3:6;p.offReach=5;p.lean=f===impact?-3:1;}
  if(m==='fire_orb'){p.raise=f<impact?7:3;p.offReach=5;p.crouch=f===impact?1:0;}
  if(m==='chain'){p.raise=6;p.offReach=4;p.handReach=f<impact?2:7;p.weaponAngle=-.8;}
  if(m==='heal_reach'){p.handReach=f<impact?2:8;p.raise=5;p.offReach=3;p.weaponAngle=-.3;}
  if(m==='repel'){p.offReach=7;p.handReach=f<impact?-1:9;p.crouch=2;p.spread=6;}
 }
 p.cx+=Math.round(p.fx*p.lean);p.cy+=p.bob+p.crouch;p.headX=p.cx+Math.round(p.fx*1.5);p.headY+=p.bob+p.crouch;
 const fxx=Math.abs(p.fx)<.1?.55:p.fx,frontSide=p.fy>.4?1:-1;
 p.hand=[p.cx+Math.round(fxx*(7+p.handReach)),p.cy-1+Math.round(p.fy*3)-p.raise];
 p.offhand=[p.cx-Math.round(fxx*(7+p.offReach)),p.cy+frontSide-p.raise*(p.motion==='barrier'||p.motion==='earth'||p.motion==='fissure'?1:.5)];
 return p;
}
function drawHead(g,h,p,c){const x=p.headX,y=p.headY,back=p.back,side=p.side>.9,faceX=x+Math.round(p.fx*2),faceY=y+(back?0:2),head=h.head;
 g.poly([[x-5,y-5],[x+4,y-5],[x+6,y-2],[x+5,y+5],[x+2,y+7],[x-4,y+6],[x-6,y+1]],c[0]);
 g.rect(x-4,y-4,8,9,c[5]);g.rect(x-3,y-3,7,7,c[4]);
 if(!back){g.rect(faceX+(side?1:-2),faceY,side?2:1,1,c[0]);if(!side)g.rect(faceX+2,faceY,1,1,c[0]);g.pixel(faceX+1,faceY+3,c[5]);}
 else g.rect(x-4,y-4,9,8,c[3]);
 const hood=['white_hood','dark_hood','rune_hood'].includes(head);
 if(hood){g.poly([[x-7,y+4],[x-6,y-5],[x-2,y-8],[x+4,y-7],[x+7,y-3],[x+6,y+6],[x+4,y+4],[x+4,y-3],[x-3,y-4],[x-4,y+4]],c[0]);g.poly([[x-6,y+3],[x-5,y-5],[x-1,y-7],[x+4,y-5],[x+5,y+4],[x+3,y+3],[x+3,y-3],[x-3,y-3],[x-4,y+4]],c[1]);if(back)g.rect(x-4,y-4,9,8,c[1]);if(head==='dark_hood')g.rect(x-5,y+4,11,3,c[2]);if(head==='rune_hood'){g.rect(x-4,y-5,2,3,c[2]);g.pixel(x+3,y-4,c[9]);}}
 if(['hair','wild_hair','headband','feather','cap'].includes(head)){g.poly([[x-6,y],[x-7,y-4],[x-4,y-7],[x-1,y-6],[x+2,y-8],[x+5,y-5],[x+6,y-1],[x+3,y-3],[x-1,y-3],[x-4,y+1]],c[0]);g.line(x-4,y-5,x+2,y-6,c[3],2);if(head==='wild_hair'){g.rect(x-7,y,2,7,c[3]);g.rect(x+5,y,2,7,c[3]);}if(head==='headband'){g.rect(x-5,y-2,11,2,c[2]);g.rect(x-9,y,4,2,c[1]);}if(head==='feather'){g.poly([[x-4,y-5],[x+7,y-5],[x+6,y-7],[x-2,y-9]],c[1]);g.line(x-5,y-7,x-8,y-12,c[9],2);g.pixel(x-6,y-11,c[2]);}if(head==='cap')g.rect(x-5,y-6,12,4,c[1]);}
 if(['triangle_hat','flame_hat','bard_hat'].includes(head)){const tip=head==='flame_hat'?[x+1,y-13]:head==='bard_hat'?[x-7,y-10]:[x,y-14];g.poly([[x-9,y-4],tip,[x+6,y-7],[x+9,y-4],[x+7,y-1],[x-9,y-1]],c[0]);g.poly([[x-7,y-4],tip,[x+5,y-6],[x+7,y-3],[x-7,y-2]],c[1]);g.line(x-5,y-3,x+6,y-3,c[2],2);if(head==='flame_hat'){g.pixel(x+2,y-12,c[6]);g.pixel(x,y-9,c[2]);}if(head==='bard_hat'){g.line(x+3,y-7,x+8,y-11,c[6],2);g.pixel(x+8,y-12,c[9]);}}
 if(head==='bald'){g.rect(x-2,y-4,4,1,c[6]);if(back)g.rect(x-3,y-3,7,7,c[4]);}
 if(['crown_helm','iron_helm'].includes(head)){g.poly([[x-7,y+3],[x-6,y-6],[x-3,y-8],[x+4,y-7],[x+7,y-3],[x+6,y+5],[x+2,y+7],[x-4,y+5]],c[0]);g.poly([[x-5,y+2],[x-5,y-5],[x-2,y-7],[x+4,y-5],[x+5,y+4],[x+1,y+5]],c[7]);g.line(x-3,y-5,x+3,y-4,c[6],2);if(!back){g.rect(x-4,y,9,2,c[0]);g.pixel(x+Math.sign(p.fx)*3,y,c[9]);}if(head==='crown_helm'){g.rect(x-5,y-7,2,4,c[2]);g.rect(x-1,y-9,2,5,c[2]);g.rect(x+3,y-7,2,4,c[2]);}else{g.line(x,y-6,x,y+5,c[8],2);g.rect(x+5,y-2,2,5,c[8]);}}
 if(head==='lightning_crown'){g.poly([[x-6,y-3],[x-7,y-9],[x-3,y-6],[x,y-10],[x+2,y-5],[x+7,y-7],[x+5,y-2]],c[0]);g.line(x-5,y-7,x-3,y-3,c[2],2);g.line(x,y-8,x+1,y-3,c[9],2);g.rect(x+3,y-5,2,3,c[2]);}
 if(head==='stone'){g.poly([[x-8,y-5],[x-3,y-9],[x+6,y-6],[x+8,y+5],[x+4,y+9],[x-6,y+6]],c[0]);g.poly([[x-6,y-4],[x-2,y-7],[x+5,y-4],[x+5,y+5],[x,y+7],[x-5,y+4]],c[1]);g.rect(x-5,y-5,5,2,c[6]);if(!back){g.rect(x-4,y,2,2,c[2]);g.rect(x+2,y,2,2,c[2]);g.rect(x-2,y+4,4,1,c[0]);}g.line(x+4,y-4,x+2,y-1,c[3]);}
 if(['mask','beast_mask'].includes(head)){g.poly([[x-8,y-5],[x-5,y-9],[x+5,y-9],[x+8,y-4],[x+6,y+8],[x,y+11],[x-6,y+7]],c[0]);g.poly([[x-6,y-4],[x-4,y-7],[x+4,y-7],[x+6,y-3],[x+4,y+7],[x,y+9],[x-4,y+6]],c[4]);g.line(x-4,y-5,x+3,y-5,c[9],2);if(!back){g.line(x-4,y-1,x-1,y+1,c[0],2);g.line(x+2,y+1,x+5,y-1,c[0],2);g.rect(x-1,y+3,2,4,c[5]);g.pixel(x-2,y,c[6]);g.pixel(x+3,y,c[6]);}if(head==='beast_mask'){g.poly([[x-8,y-2],[x-10,y-10],[x-5,y-7]],c[4]);g.poly([[x+8,y-2],[x+10,y-10],[x+5,y-7]],c[4]);g.line(x-5,y+5,x-8,y+3,c[7],2);g.line(x+5,y+5,x+8,y+3,c[7],2);}}
}
function drawBody(g,h,p,c){const x=p.cx,y=p.cy,w=Math.round(p.bodyW/2),side=p.side>.9,robe=h.rig==='robe',large=p.large,spirit=h.rig==='spirit';
 if(h.cloak){g.poly([[x-w+1,y-7],[x+w-1,y-7],[x+w+4,y+13+p.bob],[x,y+15],[x-w-5,y+12]],c[0]);g.poly([[x-w+2,y-6],[x+w-2,y-6],[x+w+2,y+11],[x,y+13],[x-w-3,y+10]],h.id==='paladin'?c[6]:c[3]);g.line(x-w,y+1,x-w-2,y+10,c[1],2);}
 if(!spirit){for(const s of[-1,1]){const lx=x+s*p.spread,ly=47+p.crouch+((s>0?1:-1)*p.foot);g.line(x+s*3,y+7,lx,ly,c[0],5);g.line(x+s*3,y+7,lx,ly-1,h.rig==='large'?c[4]:c[3],3);g.rect(lx-2,ly,6,4,c[0]);g.rect(lx-1,ly,4,2,c[8]);}}
 if(robe){g.poly([[x-w,y-7],[x+w,y-7],[x+w+3,y+13],[x+2,y+15],[x-2,y+13],[x-w-3,y+14]],c[0]);g.poly([[x-w+1,y-6],[x+w-1,y-6],[x+w+1,y+12],[x+1,y+13],[x-w-1,y+12]],c[1]);g.poly([[x-w+1,y-5],[x-2,y-5],[x+2,y+12],[x-3,y+12]],c[3]);g.line(x+3,y-5,x+5,y+11,c[2]);g.rect(x-w,y+1,w*2+1,2,c[7]);if(h.id==='monk')for(let k=0;k<5;k++)g.rect(x-4+k*2,y-5+Math.abs(k-2),1,2,c[0]);}
 else if(spirit){g.poly([[x-12,y-9],[x+12,y-9],[x+10,y+3],[x+6,y+8],[x+4,y+14],[x,y+10],[x-4,y+15],[x-8,y+7],[x-10,y+2]],c[0]);g.poly([[x-10,y-8],[x+10,y-8],[x+8,y+2],[x+4,y+8],[x+3,y+12],[x,y+8],[x-3,y+12],[x-6,y+5]],c[1]);g.line(x-8,y-6,x+8,y-6,c[2],3);g.line(x,y-3,x,y+9,c[6],2);g.rect(x-3,y-1,6,3,c[7]);}
 else {g.poly([[x-w,y-7],[x+w,y-7],[x+w+1,y+5],[x+w-2,y+10],[x-w+1,y+10]],c[0]);g.poly([[x-w+1,y-6],[x+w-1,y-6],[x+w-1,y+4],[x+w-3,y+8],[x-w+2,y+8]],h.rig==='large'||h.id==='brawler'?c[4]:c[1]);g.poly([[x-w+1,y-6],[x-1,y-5],[x+1,y+7],[x-w+2,y+8]],h.rig==='large'||h.id==='brawler'?c[5]:c[3]);g.rect(x-w+1,y+5,w*2-1,3,c[8]);g.rect(x-1,y+5,3,3,c[2]);
  if(h.rig==='armored'){g.poly([[x-w-3,y-7],[x-2,y-8],[x-2,y-2],[x-w-2,y]],c[7]);g.poly([[x+2,y-8],[x+w+3,y-6],[x+w+2,y],[x+2,y-2]],c[7]);g.line(x-w+1,y-5,x+w-1,y-5,c[6]);g.line(x+1,y-5,x+1,y+4,c[7]);}
  if(h.rig==='large'){g.poly([[x-w-2,y-7],[x-2,y-9],[x+2,y-7],[x+w+2,y-8],[x+w+2,y-1],[x+w-2,y-3],[x-4,y-2],[x-w-2,y-1]],c[3]);g.rect(x-w,y-7,5,3,c[2]);g.rect(x+w-4,y-6,5,3,c[2]);}
  if(h.rig==='golem'){g.poly([[x-14,y-9],[x-7,y-11],[x-3,y-5],[x-6,y+1],[x-14,y-1]],c[3]);g.poly([[x+5,y-9],[x+13,y-8],[x+15,y-2],[x+6,y]],c[7]);g.rect(x-2,y-4,5,6,c[0]);g.rect(x-1,y-3,3,4,c[6]);g.pixel(x,y-2,c[9]);g.line(x-7,y+1,x-4,y+3,c[3]);}
  if(h.rig==='ancient'){g.rect(x-11,y-8,6,5,c[7]);g.rect(x+6,y-7,7,5,c[3]);g.line(x-3,y-5,x+2,y+3,c[6],2);g.line(x+2,y+3,x+5,y,c[6],1);g.rect(x-4,y+6,7,3,c[3]);}
 }
}
function drawArm(g,h,p,c,hand,off){const x=p.cx,y=p.cy,sign=hand[0]>=x?1:-1,shoulder=[x+sign*(p.bodyW/2),y-5],elbow=[(shoulder[0]+hand[0])/2,hand[1]+2];const thick=['golem','ancient'].includes(h.rig)?6:h.rig==='large'||h.rig==='armored'?5:4;
 g.line(...shoulder,...elbow,c[0],thick+2);g.line(...elbow,...hand,c[0],thick+1);g.line(...shoulder,...elbow,h.rig==='robe'?c[1]:['golem','ancient','armored','spirit'].includes(h.rig)?c[7]:c[4],thick);g.line(...elbow,...hand,h.rig==='robe'?c[3]:['golem','ancient','armored','spirit'].includes(h.rig)?c[1]:c[5],thick-1);g.rect(hand[0]-1,hand[1]-1,3,3,['golem','ancient','spirit'].includes(h.rig)?c[2]:c[4]);
}
function drawWeapon(g,h,p,c,kind,hand,off=false){let[x,y]=hand;const sx=p.fx<-.1?-1:1,ang=p.weaponAngle,dir=[Math.cos(ang)*sx,Math.sin(ang)],end=n=>[x+dir[0]*n,y+dir[1]*n];
 const blade=(len,width)=>{const [ex,ey]=end(len);g.line(x,y,ex,ey,c[0],width+2);g.line(x,y,ex,ey,c[7],width);g.line(x+sx,y-1,ex+sx,ey-1,c[6],1);g.line(x-dir[1]*3,y+dir[0]*3,x+dir[1]*3,y-dir[0]*3,c[2],2);};
 if(kind==='none')return;
 if(kind==='sword'||kind==='dagger'){blade(kind==='sword'?19:10,kind==='sword'?2:3);return;}
 if(kind==='glove'){g.disc(x+sx,y,4,4,c[0]);g.disc(x+sx,y-1,3,3,c[1]);g.rect(x+sx-2,y-3,4,2,c[2]);g.rect(x-2,y+2,4,2,c[6]);return;}
 if(kind==='round_shield'||kind==='spirit_shield'){const r=kind==='round_shield'?7:6;g.disc(x,y,r,r+1,c[0]);g.disc(x,y,r-1,r,c[2]);g.disc(x,y,r-3,r-2,c[3]);g.line(x-3,y,x+3,y,c[6],2);g.line(x,y-4,x,y+4,c[6],2);g.pixel(x-3,y-5,c[9]);return;}
 if(kind==='square_shield'){g.poly([[x-7,y-8],[x+6,y-8],[x+7,y+6],[x,y+10],[x-7,y+6]],c[0]);g.poly([[x-5,y-6],[x+4,y-6],[x+5,y+5],[x,y+8],[x-5,y+5]],c[7]);g.rect(x-3,y-4,6,9,c[8]);g.line(x,y-6,x,y+6,c[6],2);return;}
 if(['mace','flail','axe'].includes(kind)){const[ex,ey]=end(kind==='axe'?15:11);g.line(x,y,ex,ey,c[0],4);g.line(x,y,ex,ey,c[7],2);if(kind==='axe'){g.poly([[ex-7,ey-4],[ex-1,ey-7],[ex+2,ey-4],[ex+7,ey-3],[ex+6,ey+4],[ex+2,ey+5],[ex-2,ey+3],[ex-6,ey+3]],c[0]);g.poly([[ex-6,ey-3],[ex-1,ey-5],[ex+1,ey-2],[ex+5,ey-2],[ex+5,ey+2],[ex+1,ey+3],[ex-2,ey+1],[ex-5,ey+2]],c[7]);g.line(ex-5,ey-2,ex-5,ey+1,c[6]);}else{g.rect(ex-4,ey-4,8,8,c[0]);g.rect(ex-3,ey-3,6,6,c[7]);g.rect(ex-2,ey-3,2,6,c[6]);if(kind==='flail'){g.pixel(ex-5,ey,c[6]);g.pixel(ex+4,ey,c[6]);}}return;}
 if(kind==='bow'){const raised=p.motion==='sky_bow',b=raised?-6:0;g.line(x+sx*3,y-10+b,x+sx*7,y-6+b,c[0],3);g.line(x+sx*7,y-6+b,x+sx*8,y+4+b,c[0],3);g.line(x+sx*8,y+4+b,x+sx*3,y+10+b,c[0],3);g.line(x+sx*3,y-10+b,x+sx*7,y-5+b,c[7],1);g.line(x+sx*7,y-5+b,x+sx*7,y+5+b,c[2]);g.line(x+sx*7,y+5+b,x+sx*3,y+10+b,c[7]);const draw=p.frame<2?4:0;g.line(x+sx*3,y-10+b,x-sx*draw,y+b,c[6]);g.line(x-sx*draw,y+b,x+sx*3,y+10+b,c[6]);if(!p.release){g.line(x-sx*(4+draw),y+b,x+sx*12,y+b,c[7]);g.line(x+sx*12,y+b,x+sx*9,y-2+b,c[6]);}return;}
 if(kind==='crossbow'){g.line(x-sx*7,y+2,x+sx*13,y-1,c[0],5);g.line(x-sx*7,y+1,x+sx*13,y-1,c[7],3);g.line(x+sx*7,y-8,x+sx*10,y-1,c[0],3);g.line(x+sx*10,y-1,x+sx*7,y+7,c[0],3);g.line(x+sx*7,y-7,x+sx*9,y,c[6]);g.line(x+sx*9,y,x+sx*7,y+6,c[6]);g.line(x+sx*7,y-7,x,y,c[2]);g.line(x,y,x+sx*7,y+6,c[2]);g.rect(x-3,y+2,4,4,c[3]);if(p.motion==='binding')g.line(x+sx*10,y,x+sx*7,y+4,c[2]);return;}
 if(kind.includes('staff')||kind==='long_staff'){const long=kind==='long_staff',len=long?23:18;const dx=long?dir[0]:sx*.24,dy=long?dir[1]:-.97;g.line(x-dx*7,y-dy*7,x+dx*len,y+dy*len,c[0],3);g.line(x-dx*7,y-dy*7,x+dx*len,y+dy*len,c[7],1);const ex=x+dx*len,ey=y+dy*len;
  if(kind==='flame_staff'){g.poly([[ex-4,ey+1],[ex-4,ey-4],[ex-1,ey-8],[ex,ey-4],[ex+3,ey-6],[ex+4,ey],[ex+1,ey+3]],c[2]);g.rect(ex-1,ey-3,3,5,c[6]);g.pixel(ex,ey-2,c[9]);}
  if(kind==='ice_staff'){g.poly([[ex,ey-7],[ex+5,ey-1],[ex,ey+5],[ex-4,ey-1]],c[0]);g.poly([[ex,ey-6],[ex+3,ey-1],[ex,ey+3],[ex-2,ey-1]],c[6]);g.line(ex,ey-5,ex,ey+2,c[9]);}
  if(kind==='holy_staff'){g.line(ex-4,ey-3,ex+4,ey-3,c[0],4);g.line(ex,ey-7,ex,ey+2,c[0],4);g.line(ex-4,ey-3,ex+4,ey-3,c[6],2);g.line(ex,ey-7,ex,ey+2,c[6],2);g.pixel(ex,ey-3,c[9]);}
  if(kind==='fork_staff'){g.line(ex,ey,ex-5,ey-6,c[0],3);g.line(ex,ey,ex+4,ey-7,c[0],3);g.line(ex,ey,ex-5,ey-6,c[2]);g.line(ex,ey,ex+4,ey-7,c[2]);g.pixel(ex,ey-4,c[9]);}return;}
 if(kind==='stone_fist'||kind==='ancient_fist'){const r=kind==='stone_fist'?(off?5:7):5;g.poly([[x-r,y-r],[x+r-2,y-r-1],[x+r+1,y-2],[x+r,y+r],[x-r+1,y+r+1],[x-r-1,y]],c[0]);g.rect(x-r+1,y-r+1,r*2-1,r*2-1,c[1]);g.rect(x-r+2,y-r+1,r*2-3,2,c[7]);g.line(x,y-r+3,x+2,y+r-2,c[3],2);if(kind==='ancient_fist'){g.line(x-2,y-2,x+2,y+2,c[6]);g.pixel(x+2,y-2,c[6]);}return;}
 if(kind==='lute'){g.disc(x,y+2,6,7,c[0]);g.disc(x,y+2,5,6,c[7]);g.disc(x,y+2,2,3,c[0]);g.line(x,y-3,x+sx*6,y-12,c[0],4);g.line(x,y-3,x+sx*6,y-12,c[6],2);g.line(x-1,y+6,x+sx*6,y-12,c[2]);g.pixel(x+2,y+2,c[9]);return;}
 if(kind==='book'){g.poly([[x-8,y-4],[x-1,y-5],[x+2,y-3],[x+8,y-4],[x+8,y+5],[x+1,y+6],[x-7,y+4]],c[0]);g.poly([[x-7,y-3],[x-1,y-4],[x,y-2],[x,y+4],[x-6,y+3]],c[6]);g.poly([[x+1,y-2],[x+7,y-3],[x+7,y+4],[x+1,y+5]],c[2]);g.line(x-5,y-1,x-2,y,c[3]);g.line(x+3,y+1,x+5,y,c[3]);return;}
 if(kind==='beads'){for(let n=0;n<5;n++)g.rect(x+Math.round(Math.cos(n)*3),y+Math.round(Math.sin(n)*3),2,2,c[3]);if(p.motion==='bell'){g.poly([[x-3,y-4],[x+3,y-4],[x+4,y+2],[x-4,y+2]],c[6]);g.pixel(x,y+4,c[2]);}return;}
 if(kind==='palm'){g.poly([[x-4,y-2],[x-3,y-6],[x-1,y-4],[x,y-7],[x+2,y-4],[x+4,y-3],[x+3,y+4],[x-2,y+5]],c[0]);g.rect(x-2,y-4,5,7,c[2]);g.rect(x-1,y,3,2,c[6]);}
}
function draw(g,h,state,f,d){const c=h.palette.map(n=>parseInt(n,16)),p=pose(h,state,f,d);const farther=p.fy<0;
 // Soft ground shadows are deliberately absent from atlas: the renderer owns ground and team rings.
 if(farther){drawArm(g,h,p,c,p.hand,false);drawWeapon(g,h,p,c,h.weapon,p.hand);drawArm(g,h,p,c,p.offhand,true);drawWeapon(g,h,p,c,h.offhand,p.offhand,true);}
 drawBody(g,h,p,c);
 if(!farther){drawArm(g,h,p,c,p.offhand,true);drawWeapon(g,h,p,c,h.offhand,p.offhand,true);}
 drawHead(g,h,p,c);
 if(!farther){drawArm(g,h,p,c,p.hand,false);drawWeapon(g,h,p,c,h.weapon,p.hand);}
 else if(p.side>.5){drawArm(g,h,p,c,p.offhand,true);drawWeapon(g,h,p,c,h.offhand,p.offhand,true);}
 // Distinct authored accessories remain visible in idle, independent of effect particles.
 if(h.id==='rune_mage'){for(let k=0;k<3;k++){let xx=p.cx+[-11,9,5][k],yy=p.cy+[-8,-12,9][k]+((f+k)%2);g.rect(xx,yy,3,3,c[2]);g.pixel(xx+1,yy+1,c[0]);}}
 if(h.id==='assassin'){g.poly([[p.cx-3,p.cy-8],[p.cx-11,p.cy-3],[p.cx-8,p.cy+3],[p.cx-5,p.cy-3]],c[2]);}
 if(h.id==='swordsman')g.rect(p.cx-5,p.cy-6,3,7,c[2]);
 if(h.id==='brawler')g.rect(p.cx-5,p.cy+5,11,2,c[2]);
 if(h.id==='guardian_spirit')g.line(p.cx-9,p.cy-7,p.cx-4,p.cy-4,c[9],2);
 if(state==='hurt'&&f===0){for(let i=0;i<g.data.length;i+=4)if(g.data[i+3]){g.data[i]=Math.min(255,g.data[i]+36);g.data[i+1]=Math.min(255,g.data[i+1]+36);g.data[i+2]=Math.min(255,g.data[i+2]+36);}}
 if(p.opacity<255)for(let i=3;i<g.data.length;i+=4)g.data[i]=Math.round(g.data[i]*p.opacity/255);
 return p;
}
const manifest={atlasVersion:1,license:'Original Class Clash artwork; no third-party art copied',directions,cellSize:CELL,columns:COLS,states,heroes:{}};
const contact=new Pixels(18*96,132), hashes={};
for(const h of heroes){const sheet=new Pixels(W,H),animations={},sockets={};let idle;
 for(const [state,info] of Object.entries(states))for(let d=0;d<8;d++){
  const frames=[],rowHashes=[];
  for(let f=0;f<info.count;f++){const g=new Pixels(CELL,CELL),p=draw(g,h,state,f,d),index=(info.start+f)*8+d,x=(index%COLS)*CELL,y=Math.floor(index/COLS)*CELL;sheet.blit(g,x,y);frames.push({x,y,w:CELL,h:CELL});rowHashes.push(crypto.createHash('sha256').update(g.data).digest('hex'));if(state==='idle'&&f===0){sockets[directions[d]]={hand:p.hand.map(Math.round),offHand:p.offhand.map(Math.round),foot:[32,52],projectile:[Math.round(p.hand[0]+p.fx*8),Math.round(p.hand[1]-2+p.fy*3)]};if(d===1)idle=g;}}
  const impact=state==='skill2'?3:2;animations[`${state}.${directions[d]}`]={frames,loop:state==='idle'||state==='walk',windupFrames:state.startsWith('skill')||state==='basicAttack'?Array.from({length:impact},(_,i)=>i):[],impactFrame:impact,recoveryFrames:state.startsWith('skill')||state==='basicAttack'?Array.from({length:info.count-impact},(_,i)=>i+impact):[],events:state.startsWith('skill')||state==='basicAttack'?[{name:'release',serverBoundary:'impactTick'}]:[]};
  if(['basicAttack','skill1','skill2'].includes(state))hashes[`${h.id}.${state}.${directions[d]}`]=rowHashes.join('|');
 }
 const meta={heroId:h.id,atlasVersion:1,image:`/assets/heroes/${h.id}.png`,logicalSize:[64,64],pivot:[32,52],worldBodySize:['golem','ancient','spirit'].includes(h.rig)?[40,48]:[32,40],directions,sockets,animations,rig:h.rig,motions:h.motions};
 fs.writeFileSync(path.join(out,`${h.id}.png`),png(W,H,sheet.data));fs.writeFileSync(path.join(out,`${h.id}.json`),JSON.stringify(meta));
 manifest.heroes[h.id]={image:meta.image,pivot:meta.pivot,worldBodySize:meta.worldBodySize,metadata:`/assets/heroes/${h.id}.json`};
 const portrait=new Pixels(64,64);portrait.blit(idle,0,0);fs.writeFileSync(path.join(out,`${h.id}-portrait.png`),png(64,64,portrait.data));
 contact.blit(idle,heroes.indexOf(h)*96+16,8);
 const sample=new Pixels(CELL,CELL);draw(sample,h,'basicAttack',2,2);contact.blit(sample,heroes.indexOf(h)*96+16,68);
}
// Validate actual raster coverage and action streams, not just names.
if(heroes.length!==18||new Set(heroes.map(h=>h.id)).size!==18)throw new Error('18 unique hero rigs required');
if(W>2048||H>2048)throw new Error('Atlas exceeds 2048x2048');
for(const h of heroes){for(const d of directions){const a=['basicAttack','skill1','skill2'].map(s=>hashes[`${h.id}.${s}.${d}`]);if(new Set(a).size!==3)throw new Error(`Duplicated action frame stream ${h.id}/${d}`);}}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(out,'contact-sheet.png'),png(contact.w,contact.h,contact.data));
fs.writeFileSync(path.join(out,'build-report.json'),JSON.stringify({heroes:18,directions:8,states:Object.keys(states).length,framesPerHero:start*8,totalFrames:heroes.length*start*8,atlas:[W,H],originalSource:'assets/source/heroes.json + scripts/build-sprites.mjs',uniqueActionStreams:true,sha256:crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex')},null,2));
console.log(`Built ${heroes.length} original hero atlases: ${heroes.length*start*8} frames, ${W}x${H} each. Eight directions and all action streams validated.`);
