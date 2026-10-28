/** Native pixel authoring helpers. No antialiasing, subpixels or runtime painting. */
export function pixel(g,x,y,color,alpha=255){
 x=Math.round(x);y=Math.round(y);if(color==null)return;if(x<0||y<0||x>=g.w||y>=g.h){(g.clippedWrites??=[]).push([x,y]);return;}
 const i=(y*g.w+x)*4;g.data[i]=color>>>16&255;g.data[i+1]=color>>>8&255;g.data[i+2]=color&255;g.data[i+3]=alpha;
}
export function rect(g,x,y,w,h,color,alpha=255){
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)pixel(g,x+xx,y+yy,color,alpha);
}
export function stamp(g,source,x,y,palette,options={}){
 const rows=typeof source==='string'?source.trim().split('\n').map(row=>row.trim()):source;
 const h=rows.length,w=Math.max(...rows.map(row=>row.length));
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<rows[yy].length;xx++){
  const key=rows[yy][xx];if(key==='.'||key===' ')continue;
  const color=(options.remap??{})[key]??palette[key];
  if(color==null)throw new Error(`Unknown authored pixel '${key}'`);
  pixel(g,x+(options.flipX?w-1-xx:xx),y+(options.flipY?h-1-yy:yy),color,options.alpha??255);
 }
}
export function line(g,x0,y0,x1,y1,color,width=1){
 x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
 const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;
 for(let n=0;n<128;n++){rect(g,x0-Math.floor(width/2),y0-Math.floor(width/2),width,width,color);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}
}
export function buffer(w=32,h=32){return {w,h,data:new Uint8Array(w*h*4)};}
