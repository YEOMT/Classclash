import fs from 'node:fs';import zlib from 'node:zlib';
import {buffer} from '../assets/source/compact-pixel-core.mjs';
const ids=process.argv.slice(2).length?process.argv.slice(2):['paladin','archer','pyromancer'];
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);let c=0xffffffff;for(const n of Buffer.concat([t,data]))c=table[(c^n)&255]^(c>>>8);b.writeUInt32BE((c^0xffffffff)>>>0,data.length+8);return b;}
function png(g){const hd=Buffer.alloc(13);hd.writeUInt32BE(g.w);hd.writeUInt32BE(g.h,4);hd[8]=8;hd[9]=6;const rows=Buffer.alloc(g.h*(g.w*4+1));for(let y=0;y<g.h;y++)Buffer.from(g.data.buffer,g.data.byteOffset+y*g.w*4,g.w*4).copy(rows,y*(g.w*4+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hd),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
fs.mkdirSync('artifacts/art-rework-v3',{recursive:true});
for(const id of ids){
 if(!fs.existsSync(`assets/source/compact-${id}.mjs`))continue;
 const art=await import(`../assets/source/compact-${id}.mjs`),board=buffer(32*8*4,32*9*4),clipped=[];
 const poses=[['idle',0],['walk',0],['basicAttack',0],['basicAttack',2],['basicAttack',4],['skill1',2],['skill2',3],['hurt',0],['death',3]];
 for(let row=0;row<poses.length;row++)for(let d=0;d<8;d++){
  const g=buffer();art.draw(g,...poses[row],d);if(g.clippedWrites?.length)clipped.push({pose:poses[row],d,pixels:g.clippedWrites});
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;if(!g.data[i+3])continue;for(let yy=0;yy<4;yy++)for(let xx=0;xx<4;xx++){const j=(((row*32+y)*4+yy)*board.w+(d*32+x)*4+xx)*4;board.data.set(g.data.subarray(i,i+4),j);}}
 }
 fs.writeFileSync(`artifacts/art-rework-v3/${id}-candidate.png`,png(board));console.log(id,JSON.stringify({clipped}));
}
