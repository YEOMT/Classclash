import { stamp, line } from './compact-pixel-core.mjs';

// Original 1 px source. The flame cap, face, robe folds, hands and boots are
// authored clusters; these are not resized parts from the previous atlas.
export const palette = {
 '#':0x35283e, a:0x53334c, b:0x7d3852, c:0xb34a57, d:0xe4796b,
 g:0xc48b54, G:0xffcd80, s:0xc58169, S:0xf2b68e, e:0xffdfb0,
 h:0x4b2e35, w:0x71513e, W:0xae8154, f:0xf39445, F:0xffeea9, t:0x3d3b50,
};
export const notes = {
 name:'잿불길잡이',
 design:'비대칭 불꽃 모자, 살구색 얼굴과 적갈색 옆머리, 구리 장식의 자주색 갈라진 로브, 작은 잿불 지팡이. 지팡이를 쥔 손과 빈 시전 손이 분리된 작은 SD 화염술사.',
 nativeCanvas:[32,32],footPivot:[16,30],paletteColors:16,
 proportions:'약 28px 신장, 모자를 포함한 머리 11px, 짧은 몸통과 갈라진 옷자락. 무기를 포함한 모든 포즈를 32px 안에 직접 작화.',
 lighting:'화면 좌상단 고정. 좌·우 얼굴을 따로 작화하며 팔과 천의 밝은 면은 화면 왼쪽에 유지.',
 motions:'기본 공격은 지팡이를 당겼다 내밀기; 화염 폭발은 허리 회전과 빈 손의 전방 방출; 화염 장벽은 두 팔을 크게 들고 펼치기. 피격은 뒤로 꺾이고 사망은 몸을 접어 옆으로 눕는다.',
 states:{idle:2,walk:4,basicAttack:6,skill1:6,skill2:8,hurt:2,death:5,spawn:3},
 contacts:{basicAttack:2,skill1:2,skill2:3},
};

const rows = text => text.trim().split('\n').map(row=>row.trim());
const CAP=rows(`
 ..bbb.......
 .bdddb......
 ...bdcb.....
 ...bddccb...
 ..bddccccb..
 .gGGggbbbbb.`);
const HEAD = {
 S:rows(`
 .bhhSeSShb..
 .hSe#S#SShb.
 .hsSSSSSshb.
 ..hhSSssbb..
 ...bbaab....`),
 SE:rows(`
 ..bhhSeSShb.
 ..hSeSS#SSb.
 ..hhSSSSSsb.
 ...hhSSssb..
 ....bbaab...`),
 SW:rows(`
 .bSeSShhb...
 .hSe#SSSh...
 .hsSSSSSh...
 ..hSSsshh...
 ...bbaab....`),
 E:rows(`
 ..bhhSeSSb..
 ..hhhSS#SS..
 ...hhSSSSs..
 ....hhSSb...
 .....bab....`),
 W:rows(`
 .bSeSShhb...
 .eS#SShhh...
 .sSSSShh....
 ..bSShh.....
 ...bab......`),
 N:rows(`
 .bddcccbbab.
 .bddccbbbab.
 ..bccbbbab..
 ...baaaab...
 ....aa......`),
 NE:rows(`
 ..bdcccbbab.
 ..bdccbbbab.
 ...bccbbaab.
 ....baaab...
 .....aa.....`),
 NW:rows(`
 .bdcccbbab..
 .bdccbbbab..
 .bbccbbab...
 ..baaabb....
 ....aa......`),
};
for(const direction of Object.keys(HEAD))HEAD[direction]=[...CAP,...HEAD[direction]];
const ROBE_FRONT=rows(`
 ....gGg......
 ...bdggcb....
 ..bddccbbab..
 .bddcccbbaba.
 .bddcccbbaba.
 ..bccbbaba...
 ..ggGGgggb...
 ..bdcccbbab..
 .bddcccbbbaba
 .bddcgcbbbaba
 bddcGcccbbbaa
 bddgGccbbbbaa
 bdgGcca.bbaa.
 .bbba...aabb.`);
const ROBE_BACK=rows(`
 ....gGg......
 ...bddccbb...
 ..bddcccbbab.
 .bddccbbbbaba
 .bddccbbbbaba
 ..bccbbbbba..
 ..ggGGgggba..
 ..bddccbbbaa.
 .bddcccbbbaba
 .bdccccbbbaba
 bddccccbbbbaa
 bddgcccbbgbaa
 bdcgcca.bbaa.
 .bbba...aabb.`);
const ROBE_SIDE_R=rows(`
 ...bgGgb..
 ..bddggcb.
 .bddGcbba.
 .bdcGbbba.
 ..bcGbaa..
 ..ggGGgb..
 .bdcGcbaa.
 .bdcGcbaa.
 bddcGcbbaa
 bdcgGcbbba
 bdcgcccbaa
 bdcgcbbbaa
 bdcg.babba
 .bb...aaa.`);
const ROBE_SIDE_L=rows(`
 ..bgGgb...
 .bddggcb..
 .bdGcbbba.
 .bdGcbbba.
 ..bGcbba..
 ..gGGggb..
 .bdGccbaa.
 .bdGccbaa.
 bddGcccbaa
 bdcGgcbbaa
 bdcGcccbaa
 bdcgcbbbaa
 bdcg.babba
 .bb...aaa.`);
const BOOT=rows(`
 .www.
 wWWwa
 wWWwa
 wwwaa`);
const CALF=rows(`
 .ab.
 .bt.
 .tw.
 .wW.`);
const SLEEVE_DOWN=rows(`
 .bdb.
 bdcba
 bccba
 .cbba
 .ggba
 .sSb.`);
const SLEEVE_REACH=rows(`
 .bbbb...
 bddccba.
 bdcbbgSS
 .baaggSs
 ..aa....`);
const SLEEVE_UP=rows(`
 .sS.
 .gG.
 .dc.
 bdcba
 bdcb.
 .bba.`);
const SLEEVE_COIL=rows(`
 ..bdb..
 .bddcba
 bdccbba
 .gGaba.
 .sSaa..`);
const FLAME=rows(`
 ...f..
 ..fF..
 .fFFf.
 .fFGFf
 fFGGff
 .ffgf.
 ..ww..`);
const FLAME_TINY=rows(`
 ..f.
 .fFf
 fFGf
 .fg.
 .ww.`);
const PRONE=rows(`
 ...bb............
 .bbddcb.......... 
 bdddcccb.gg......
 bccgbccbbdcb.....
 .bgbcbddccbbba...
 ..bbbdcGGccbbbaa.
 ...bbccgbbcbtttta
 .....bbbaaattWwta
 .......aaa..tttaa`);

function part(g,art,x,y){stamp(g,art,Math.round(x),Math.round(y),palette);}
function hand(g,x,y){part(g,['sSS','sSe','.ss'],x,y);}
function staff(g,tip,base,bright=0){
 line(g,base.x,base.y,tip.x,tip.y,palette['#'],3);
 line(g,base.x,base.y,tip.x,tip.y,palette.w,1);
 line(g,base.x-1,base.y,tip.x-1,tip.y,palette.W,1);
 part(g,bright?FLAME:FLAME_TINY,tip.x-(bright?2:1),tip.y-(bright?6:4));
}
function arm(g,pose,x,y,sign=1){
 const shape=pose==='up'?SLEEVE_UP:pose==='coil'?SLEEVE_COIL:pose==='reach'?SLEEVE_REACH:SLEEVE_DOWN;
 if(sign>0||pose!=='reach'){part(g,shape,x,y);return;}
 // Separate leftward sleeve: silhouette points left, upper-left highlight stays left.
 part(g,['...bbbb.','.bddccbb','SSgdcbbb','sSggaab.','....aa..'],x,y);
}

/** Native 32 × 32 frame. Directions affect authored views and pose layout;
 * no complete sprite is mirrored, so the upper-left material light is stable.
 */
export function draw(g,state,frame,direction){
 const count=notes.states[state]??2,f=((frame%count)+count)%count;
 const view=typeof direction==='number'?['S','SE','E','NE','N','NW','W','SW'][direction]:direction;
 const dir=HEAD[view]?view:'SE',sign=['W','SW','NW'].includes(dir)?-1:1;
 const back=['N','NE','NW'].includes(dir),side=['E','W'].includes(dir);
 const moving=state==='walk',swing=moving?[-1,0,1,0][f]:0;
 let ox=0,oy=moving?[0,-1,0,0][f]:state==='idle'?f:0;
 let mode='rest',tip={x:sign>0?7:25,y:9},base={x:sign>0?6:26,y:28},staffFront=!back;
 if(state==='basicAttack'){
  ox=[-1,-2,2,1,0,0][f]*sign;oy=[1,1,0,0,1,0][f];
  mode=f<2?'coil':f<4?'thrust':'rest';
  tip=f<2?{x:sign>0?8:24,y:7}:{x:sign>0?28:4,y:12};
  base=f<2?{x:sign>0?6:26,y:27}:{x:sign>0?12:20,y:24};
 }else if(state==='skill1'){
  ox=[-2,-2,2,2,1,0][f]*sign;oy=[1,0,-1,0,1,0][f];
  mode=f<2?'charge':f<4?'burst':'rest';
  tip=f<2?{x:sign>0?6:26,y:8}:{x:sign>0?28:4,y:9};
  base=f<2?{x:sign>0?8:24,y:28}:{x:sign>0?13:19,y:25};
 }else if(state==='skill2'){
  oy=[1,0,-1,-1,0,0,1,0][f];
  mode=f<2?'charge':f===2?'rise':f<5?'wall':f===5?'wallRecover':'rest';
  tip={x:sign>0?6:26,y:f<2?9:7};base={x:sign>0?10:22,y:f<2?28:23};
 }else if(state==='hurt'){
  ox=-sign*(f?1:2);oy=f?0:1;mode='hurt';
  tip={x:sign>0?5:27,y:11};base={x:sign>0?9:23,y:28};
 }else if(state==='spawn'){
  oy=[3,1,0][f];mode=f<2?'charge':'rest';
 }else if(state==='death'){
  if(f>=2){
   // Final frames are hand-drawn collapsed folds, a side face and dropped staff.
   staff(g,{x:5,y:26},{x:27,y:29},0);
   part(g,PRONE,7,f===2?19:f===3?20:21);
   part(g,['.hhh..','hSeSh.','sS#SSh','.sSSsb','..bbb.'],6,f===2?21:f===3?22:23);
   if(f===2)part(g,['..bdb','bdccba','bggbaa','.ssaa.'],20,20);
   return;
  }
  ox=[-1,-2][f]*sign;oy=[2,4][f];mode='hurt';
  tip={x:sign>0?5:27,y:14};base={x:sign>0?14:18,y:29};
 }
 if(mode==='thrust'||mode==='burst'){
  // Direction-specific staff keys keep north/south releases distinct from
  // side views, rather than rotating an already shaded finished sprite.
  const release={
   S:[{x:23,y:25},{x:10,y:15}],SE:[{x:28,y:22},{x:12,y:15}],
   E:[{x:28,y:17},{x:12,y:22}],NE:[{x:28,y:8},{x:12,y:24}],
   N:[{x:22,y:7},{x:14,y:25}],NW:[{x:4,y:8},{x:20,y:24}],
   W:[{x:4,y:17},{x:20,y:22}],SW:[{x:4,y:22},{x:20,y:15}],
  }[dir];
  [tip,base]=release;
 }
 const cx=16+ox,headX=cx-6+(dir==='E'?1:dir==='W'?-1:0),headY=2+oy;
 const body=back?ROBE_BACK:side?(sign>0?ROBE_SIDE_R:ROBE_SIDE_L):ROBE_FRONT;
 const bodyX=cx-(side?5:6),bodyY=12+oy;
 const crouched=state==='death'||state==='spawn'&&f===0;
 const bootY=crouched?27:26;
 part(g,CALF,cx-4-swing,23+Math.min(oy,1));
 part(g,CALF,cx+2+swing,23+Math.min(oy,1));
 part(g,BOOT,cx-6-swing,bootY+(moving&&f===1?1:0));
 part(g,BOOT,cx+1+swing,bootY+(moving&&f===3?1:0));
 if(!staffFront)staff(g,tip,base,mode==='wall'||mode==='burst');
 // Far sleeve sits behind the body; near sleeve is posed independently below.
 arm(g,['rise','wall','wallRecover'].includes(mode)?'up':'down',cx+(sign>0?-7:4),bodyY+(mode==='wall'?-3:mode==='rise'?-1:1));
 if(moving&&swing){
  part(g,body.slice(0,10),bodyX,bodyY);
  part(g,body.slice(10),bodyX+swing,bodyY+10);
 }else part(g,body,bodyX,bodyY);
 part(g,HEAD[dir],headX,headY);
 if(mode==='coil'||mode==='charge'){
  arm(g,'coil',cx+(sign>0?0:-6),bodyY+1);
  arm(g,'up',cx+(sign>0?-8:5),bodyY-1);
 }else if(mode==='thrust'||mode==='burst'){
  arm(g,'reach',cx+(sign>0?2:-9),bodyY+1,sign);
  if(mode==='burst'){
   arm(g,'reach',cx+(sign>0?0:-7),bodyY+5,sign);
   hand(g,cx+(sign>0?8:-10),bodyY+5);
   if(f===2)part(g,FLAME,sign>0?26:0,12);
  }
 }else if(mode==='rise'){
  arm(g,'up',cx-7,bodyY-3);arm(g,'coil',cx+3,bodyY-1);
 }else if(mode==='wall'){
  arm(g,'up',cx-9,bodyY-5);arm(g,'up',cx+6,bodyY-5);
  hand(g,cx-9,bodyY-6);hand(g,cx+7,bodyY-6);
  // The cuff and hem fan upward; the head remains a readable single cluster.
  part(g,['bdcb','dcbb','gbaa'],cx-7,bodyY+7);
  part(g,['bdcb','bcba','bagb'],cx+5,bodyY+7);
 }else if(mode==='wallRecover'){
  arm(g,'up',cx-8,bodyY-3);arm(g,'up',cx+5,bodyY-3);
 }else if(mode==='hurt'){
  arm(g,'coil',cx+(sign>0?2:-7),bodyY+2);
 }else{
  arm(g,'down',cx+(sign>0?4:-8),bodyY+1+(moving?-swing:0));
 }
 if(staffFront)staff(g,tip,base,mode==='wall'||mode==='burst');
 // Small intentional staff grip is the shared attachment point, not an effect.
 const grip={x:Math.round((tip.x+base.x)/2),y:Math.round((tip.y+base.y)/2)};
 hand(g,grip.x-1,grip.y-1);
}
