import {stamp, line, rect, pixel} from './compact-pixel-core.mjs';

// Willow ranger: every material cluster below is drawn at the final 32px grid.
// Letter values are stable across all animation frames; '.' is transparent.
export const palette = {
  o:0x202632, d:0x25484b, g:0x397c70, l:0x75b39b,
  w:0xeee3bd, v:0xa7b89d, h:0x654844, r:0xaa7851,
  s:0xba8868, t:0xf0cba0, k:0x3c4652, b:0x684b42,
  c:0xa58156, m:0xd8bf7c,
};
export const notes = [
  'Original Willow ranger; 32×32 native art, foot pivot (16,30), approximately 2.7 heads tall.',
  'Teal hood, copper side ponytail, pale scarf, slate tunic, diagonal leather quiver and a curved ash bow.',
  'Fourteen opaque colors; colored hood/leather/scarf edges, continuous material clusters and upper-left illumination.',
  'West silhouettes reflect the anatomy while their light/shadow ramps exchange so the lamp remains at upper left.',
  'Basic and piercing-arrow contact pose 2; arrow-rain upward release pose 3. Drawing arms, bow string and weight transfer are authored independently.',
];

// Eleven rows from crown to scarf. Faces are seven pixels high, with one-pixel
// eyebrows/eyes kept inside large uninterrupted skin and hair clusters.
const HEAD_S = [
  '...dddddd...', '..dgglllggd.', '.dggllllgggd', '.dglrhhhhrgd',
  '.dgrrttttsgd', '.dgrttttttsd', '.dgrtootosd.', '..drtttttsd.',
  '...dsswssd..', '...dvwwwvd..', '....dvvvd...',
];
const HEAD_SE = [
  '...dddddd...', '..dgglllggd.', '.dggllllgggd', '.dglrhhhhrgd',
  '.dgrrttttsgd', '.dgrrtttttsd', '.dgrstoottsd', '..drsttttsd.',
  '...dsswssd..', '...dvwwwvd..', '....dvvvd...',
];
const HEAD_E = [
  '...ddddd....', '..dggllggd..', '.dggllllggd.', '.dglrhhhggd.',
  '.dgrrtttsgd.', '.dgrrttttts.', '.dgrstotttso', '..drstttts..',
  '...dsswss...', '...dvwwwv...', '....dvvvd...',
];
const HEAD_NE = [
  '...dddddd...', '..dgglllggd.', '.dggllllgggd', '.dgglllggggd',
  '.dggllgggggd', '.dgggggggtsd', '.dgggggggtsd', '..dggggrrsd.',
  '...dgggrrd..', '...dvvvvvd..', '....dvvvd...',
];
const HEAD_N = [
  '...dddddd...', '..dgglllggd.', '.dggllllgggd', '.dgglllggggd',
  '.dggllgggggd', '.dgggggggggd', '.dgggggggggd', '..dgggggggd.',
  '...dgggggd..', '...dvvvvvd..', '....dvvvd...',
];
const PONY = ['.hhhr', 'hrrrh', 'hrrh.', '.hrh.', '.hrh.', '..hh.', '..h..'];
const TUNIC_S = [
  '..vvwwvv..', '.dgvwwvgd.', 'dgllvvgggd', 'dgglgggggd',
  '.dgllgggd.', '.dbcgggd..', '.dbccggd..', '.dbbmcbd..',
  '.dbbbccd..', '..dkkkd...',
];
const TUNIC_E = [
  '..vvwwwv..', '.dgvwwvgd.', 'dgllvgggd.', 'dgllggggd.',
  '.dglgggd..', '.dbclggd..', '.dbccggd..', '.dbbmcbd..',
  '.dbbbccd..', '..dkkkd...',
];
const TUNIC_N = [
  '..dvvvvdd.', '.dglvvgdd.', 'dgllggggdd', 'dgllggcgdd',
  '.dglgccdd.', '.dglccgd..', '.dgccggd..', '.dbccbbd..',
  '.dbbbccd..', '..dkkkd...',
];
const TUNIC_DRAW = [
  '...vvwwwv...', '.ddgvwwvgd..', 'dggllvvggd..', 'dglllgggd...',
  '.dgglggd....', '..dgcggd....', '..dbccgd....', '..dbbmccd...',
  '...dbbkkd...', '....dkkkd...',
];
const TUNIC_SHOT = [
  '..vvwwwv....', '..dgvwwvgdd.', '.dgglvgggggd', '.dgllgggggd.',
  '..dgllggdd..', '..dbclggd...', '..dbccggd...', '.dbbmcbbd...',
  '.dbbbccdd...', '..dkkkkd....',
];
const TUNIC_LOW = [
  '...vvwwvv...', '..dgvwwvgdd.', '.dgllvvggggd', 'dglllgggggd.',
  'dgglggggdd..', '.dbcgggdd...', '.dbccgdd....', '..dbbmcd....',
  '...dbbkd....', '...dkkkd....',
];
const LEG_BACK = ['.kkk.', '.kgg.', '.kgg.', '.kbb.', '.bcb.', '.bcb.', '.bbbb'];
const LEG_FRONT = ['.kkkk', '.kkgg', '.kkgg', '..bcb', '..bcb', '..bcm', '.bbbb'];
const LEG_STRIDE = ['.kkk..', '.kgg..', '..kgg.', '...bcb', '...bcb', '...bcm', '..bbbb'];
const LEG_BRACE = ['.kkk..', '.kgg..', '..kgg.', '...bcb', '...bcb', '..bcm.', '.bbbb.'];
const QUIVER = ['..bcm', '.bcmb', '.bmb.', '.bcb.', '.bcb.', '.bcb.', '.bb..'];
const FOREARM_REST = ['.bss.', 'btts.', '.bss.', '..bb.', '..bb.'];
const BOW_ARM_REST = ['bss......', 'bttsb....', '.btttsb..', '...btttsb', '.....bssb'];
const BOW_ARM = ['.bssssss.', 'bttttttsb', '.bsssssb.'];
const DRAW_ARM_NOCk = ['..bsss..', '.btttsb.', 'bssbbb..', '.bb.....'];
const DRAW_ARM_PULL = ['.bss....', 'bttsb...', 'bssbtsb.', '.bbssssb'];
const DRAW_ARM_RELEASE = ['..bss...', '.bttsb..', 'bssbssb.', '.bb..bb.'];
const ARM_UP = ['..bss', '.btss', '.btss', 'btss.', 'bss..', '.bb..'];
const BOW = [
  '.bb..', '..bc.', '...cm', '...cm', '...cm', '....b', '....b',
  '....b', '...bc', '...bc', '....b', '....b', '...cm', '...cm',
  '...cm', '..bc.', '.bb..',
];
const BOW_UP = [
  '......bbbbbb......', '...bbbccccccbbb...', '.bbccmm....mmccbb.',
  'bcm............mcb', 'bb..............bb',
];
const BOW_DIAG = [
  '.........bb.', '..........bc', '..........cm', '...........b',
  '...........b', '..........cm', '..........cm', '.........cm.',
  '........cm..', '.......cm...', '......cm....', '.....cm.....',
  '....cm......', '...bc.......', '..bb........',
];
const DEAD_CLOAK = ['....dddddddddd...', '..ddggllllggggdd.', '.dgggllllgggggggd', 'dggggggggggggggdd', '.ddggggggggggdd..', '...dddddddddd....'];
const DEAD_HEAD = ['..dddddd...', '.dggllggd..', 'dgrrrtttsd.', 'dgrtttottso', '.drrttttsd.', '..dssvssd..', '...dvvvd...'];

// A reflected sprite must not reflect the light. Exchange the paired material
// ramps as well as reflecting their silhouettes; outline colors remain stable.
const westPalette = {...palette, d:palette.g, g:palette.d, l:palette.l,
  r:palette.h, h:palette.r, s:palette.t, t:palette.s, b:palette.c, c:palette.b};
const DIRECTIONS = ['S','SE','E','NE','N','NW','W','SW'];
const rowWidth = rows => Math.max(...rows.map(row => row.length));

export function draw(g, state, frame, direction) {
  const d = typeof direction === 'string' ? Math.max(0, DIRECTIONS.indexOf(direction)) : direction;
  const west = d >= 5;
  const back = d >= 3 && d <= 5;
  const side = d === 2 || d === 6;
  const colors = west ? westPalette : palette;
  const place = (rows,x,y) => stamp(g,rows,west ? 32-x-rowWidth(rows) : x,y,colors,{flipX:west});
  const point = (x,y,c) => pixel(g,west ? 31-x : x,y,colors[c]);
  const stroke = (x0,y0,x1,y1,c,width=1) => line(g,west?31-x0:x0,y0,west?31-x1:x1,y1,colors[c],width);
  const block = (x,y,w,h,c) => rect(g,west?32-x-w:x,y,w,h,colors[c]);
  const attacking = state === 'basicAttack' || state === 'skill1' || state === 'skill2';
  const impact = state === 'skill2' ? 3 : 2;
  const firing = attacking && frame === impact;
  const drawBack = attacking && frame === impact-1;
  const upshot = state === 'skill2' && frame >= 1 && frame <= 5;
  const northShot = attacking && state!=='skill2' && d===4;
  const southShot = attacking && state!=='skill2' && d===0;
  const diagonalShot = attacking && state!=='skill2' && (d===1||d===3||d===5||d===7);
  let bob = state === 'idle' ? frame : state === 'walk' ? [0,1,0,1][frame%4] : 0;
  let lean = drawBack ? -2 : firing ? 1 : 0;
  let crouch = state === 'hurt' ? (frame===0?1:0) : upshot && frame < 3 ? 1 : 0;
  if (state === 'hurt') lean = frame===0?-2:-1;
  if (attacking && state!=='skill2' && frame<2) crouch=2;
  if (state === 'skill1') {crouch=frame<2?3:frame<4?2:0;lean=frame<2?-3:frame<4?2:0;}
  if (state === 'spawn') bob = [2,1,0][frame] ?? 0;

  if (state === 'death') {
    // The first two cels lose their balance; the final three are newly drawn
    // prone anatomy, with bow, hair and legs separately resting on the floor.
    if (frame >= 2) {
      const lower = frame === 2 ? -1 : frame === 4 ? 1 : 0;
      place(DEAD_CLOAK,7,23+lower);place(DEAD_HEAD,17,20+lower);
      place(['.bbbbb', 'bcbccm', '.bbbbb'],3,26+lower);
      place(['..hhhr', '.hrrrh', 'hrrhh.'],25,24+lower);
      stroke(4,29,20,29,'b');stroke(4,28,12,27,'c');stroke(12,27,20,28,'m');
      if(frame===2){place(['.bss','btts','.bss'],18,25);}
      return;
    }
    crouch = frame === 0 ? 2 : 5;lean = frame === 0 ? -1 : -3;
  }

  const bodyX = 11 + lean, bodyY = 12 + bob + crouch;
  const headX = 10 + lean, headY = 1 + bob + crouch;
  const footY = Math.min(25,22+crouch);
  if (state === 'walk') {
    const stride=frame%4;
    place(stride===0 ? LEG_STRIDE : LEG_BACK,stride===0?7:stride===2?12:10,footY-(stride===2?1:0));
    place(stride===2 ? LEG_STRIDE : LEG_FRONT,stride===2?18:stride===0?20:16,footY-(stride===0?1:0));
  } else if(attacking && state!=='skill2' && frame<4) {
    place(LEG_BRACE,state==='skill1'?7:8,22);
    place(LEG_FRONT,state==='skill1'?19:18,22);
  } else {
    place(LEG_BACK,11+(drawBack?-1:0),footY);
    place(LEG_FRONT,17+(firing?1:0),footY);
  }

  // Quiver and side ponytail create a second silhouette behind the head/bow.
  place(QUIVER,8+lean,11+bob+crouch);
  stroke(9+lean,8+bob+crouch,10+lean,13+bob+crouch,'m');
  point(9+lean,8+bob+crouch,'w');point(8+lean,9+bob+crouch,'w');
  place(PONY,6+lean+(state==='walk'&&frame%2?1:0),6+bob+crouch);
  if(back)place(FOREARM_REST,8+lean,15+bob+crouch);
  const torso=back?TUNIC_N:state==='skill1'&&frame<4?TUNIC_LOW:attacking&&frame<2?TUNIC_DRAW:firing?TUNIC_SHOT:side?TUNIC_E:TUNIC_S;
  place(torso,bodyX,bodyY);
  const head = d===0 ? HEAD_S : d===4 ? HEAD_N : back ? HEAD_NE : side ? HEAD_E : HEAD_SE;
  place(head,headX,headY);

  // Restore small upper-left highlight clusters after anatomy reflection. These
  // deliberately use actual canvas coordinates, keeping the light stationary.
  if(west){pixel(g,32-headX-rowWidth(head)+3,headY+2,palette.l);pixel(g,32-bodyX-rowWidth(TUNIC_E)+1,bodyY+3,palette.l);}

  if (upshot || northShot) {
    const lift=frame===1?3:frame===5?3:0;
    // Both arms travel above the shoulders; a horizontal curved bow announces
    // arrow rain instead of repeating the ordinary forward shot.
    place(ARM_UP,10+lean,10+lift+bob);
    place(ARM_UP,18+lean,9+lift+bob);
    place(BOW_UP,7+lean,lift+bob);
    const stringY=(frame===impact-1?12:frame===impact?6:9)+lift+bob;
    stroke(7+lean,4+lift+bob,16+lean,stringY,'v');
    stroke(24+lean,4+lift+bob,16+lean,stringY,'v');
    if(frame<impact){stroke(16+lean,2+lift+bob,16+lean,stringY,'m');point(16+lean,1+lift+bob,'w');}
    if(frame===impact){stroke(16+lean,0,16+lean,4,'w');point(15+lean,1,'m');point(17+lean,1,'m');}
    place(['bsss','btts','.bb.'],14+lean,stringY-1);
  } else if(southShot) {
    place(BOW_ARM_REST,10+lean,16+bob+crouch);
    place(ARM_UP,18+lean,17+bob+crouch);
    place([...BOW_UP].reverse(),7+lean,23);
    const stringY=drawBack?17:firing?22:20;
    stroke(7+lean,23,16+lean,stringY,'v');stroke(24+lean,23,16+lean,stringY,'v');
    place(['bsss','btts','.bb.'],14+lean,stringY-1);
    if(frame<impact){stroke(16+lean,stringY,16+lean,30,'m');point(16+lean,31,'w');}
    if(firing){stroke(16+lean,28,16+lean,31,'w');point(15+lean,30,'m');point(17+lean,30,'m');}
  } else if(diagonalShot) {
    const rising=d===3||d===5,aimY=rising?-1:1,weaponY=rising?7:10;
    place(rising?[...BOW_DIAG].reverse():BOW_DIAG,17,weaponY);
    const gripY=rising?15:18,drawX=drawBack?(state==='skill1'?15:17):firing?22:20;
    const drawY=gripY+(drawX-25)*aimY;
    place(BOW_ARM,18+lean,gripY-1);
    place(drawBack?DRAW_ARM_PULL:DRAW_ARM_RELEASE,10+lean,drawY-2);
    const topX=rising?19:26,bottomX=rising?26:19;
    stroke(topX,weaponY,drawX,drawY,'v');stroke(bottomX,weaponY+14,drawX,drawY,'v');
    place(['bss','tts','bss'],drawX-1,drawY-1);
    if(frame<impact){stroke(drawX,drawY,31,gripY+6*aimY,'m');point(31,gripY+6*aimY,'w');}
    if(firing){stroke(27,gripY+2*aimY,31,gripY+6*aimY,'w');point(30,gripY+5*aimY-1,'m');}
  } else {
    let bowX=24+lean, bowY=9+bob+crouch;
    if(attacking&&frame===3)bowX--;
    if(attacking&&frame>=4)bowY++;
    if(attacking){
      place(BOW_ARM,19+lean,15+bob+crouch);
      place(drawBack?DRAW_ARM_PULL:firing?DRAW_ARM_RELEASE:DRAW_ARM_NOCk,10+lean,16+bob+crouch);
    } else {
      place(BOW_ARM_REST,19+lean,14+bob+crouch);
      place(['.bss','btts','.bss'],12+lean,16+bob+crouch);
    }
    place(BOW,bowX,bowY);
    const stringX=attacking ? bowX-(drawBack?(state==='skill1'?8:7):frame===0?3:0) : bowX;
    const stringY=bowY+8;
    stroke(bowX+1,bowY,stringX,stringY,'v');
    stroke(stringX,stringY,bowX+1,bowY+16,'v');
    if(attacking&&frame<2){
      // The nocked shaft follows the drawing hand; its fletching remains behind
      // the string until release. No whole-sprite stretching or fake rotation.
      stroke(stringX-2,stringY,30,stringY,'m');point(31,stringY,'w');
      point(stringX-2,stringY-1,'w');point(stringX-2,stringY+1,'v');
      place(['bss','tts','bss'],stringX-2,stringY-1);
    } else if(firing){
      stroke(27,stringY,31,stringY,state==='skill1'?'w':'m');
      point(30,stringY-1,'w');point(30,stringY+1,'v');
    }
  }
  // Ground contact remains y=29 even when the upper body recoils. The authored
  // scarf tail changes its fold on the walk cycle and strengthens the direction.
  if(!back){place(state==='walk'&&frame%2?['vw..','vww.','.vww','..vv']:['vw..','vww.','.vv.'],8+lean,12+bob+crouch);}
  if(state==='hurt'){block(10+lean,16+bob,2,1,'s');}
}
