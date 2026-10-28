/** Original 32 px character: the Tidebound Warden. Hand-pixelled source. */
import { stamp, line, pixel } from './compact-pixel-core.mjs';

// Fifteen material colours. The outline is blue-grey rather than black;
// highlights always describe a light at the upper left of the screen.
export const palette = {
 a:0x303949, b:0x546b7b, c:0x91a7ae, d:0xd4ded4, e:0xffedca,
 A:0x303949, E:0x303949,
 g:0x8b6648, G:0xd2aa61, Y:0xf5dc99,
 t:0x31535d, T:0x52898a, q:0x9bc6b3,
 v:0x42394d, V:0x725b71,
 S:0xe9b98d, s:0xb88068
};
const rows = s => s.trim().split('\n').map(r=>r.trim());

// A ten-pixel sallet/face plus a one-pixel short brass crest.
// The open cheek and brow stop the sallet reading as a robot's face.
const HEAD_S=rows(`
 ....Gg......
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 cdccAAAAcba.
 bccASSSSSba.
 .bcASESESba.
 .bcSSSSSsba.
 ..bcSSSSsb..
 ...bcSssb...
 ....bbbb....`);
const HEAD_SE=rows(`
 .....Gg.....
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 cdccAAAAbba.
 bccASSSSSba.
 .bcASESSSba.
 .bcSSSSSsba.
 ..bcSSSSsb..
 ...bcSssb...
 ....bbbb....`);
const HEAD_E=rows(`
 .....Gg.....
 ...cdddcc...
 ..cdeedccba.
 .cdeedcccbba
 .cdccAAAAbba
 .bccASSSSSba
 ..bcASESSSba
 ..bcSSSSSSsb
 ...bcSSSssb.
 ....bcSssb..
 .....bbbb...`);
const HEAD_NE=rows(`
 .....Gg.....
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 .cdccccbba..
 .bccccbbba..
 ..bccbbbba..
 ...bccbbb...
 ....bcbb....
 .....bb.....
 .....bb.....`);
const HEAD_N=rows(`
 ....Gg......
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 .cdccccbba..
 .bccccbbba..
 ..bccbbbba..
 ..bccbbba...
 ...bcbbb....
 ....bbb.....
 ....bbb.....`);
// West masks are painted separately: the rim lit on screen-left stays lit.
const HEAD_W=rows(`
 .....Gg.....
 ...cdddcc...
 ..cdeedccba.
 .cdeedcccbba
 .cAAAAAccbba
 cdSSSSSAcbb.
 cdSSSESAcbb.
 cSSSSSSAcbb.
 .cSSSSsbbb..
 ..cSSssbb...
 ...bbbbb....`);
const HEAD_SW=rows(`
 ....Gg......
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 cdAAAAAccba.
 cdSSSSSAcba.
 .cSSSESAcba.
 .cSSSSSsbba.
 ..cSSSssbb..
 ...cSssbb...
 ....bbbb....`);
const HEAD_NW=rows(`
 ....Gg......
 ..cdddccc...
 .cdeeedccba.
 cdeedcccbba.
 .cdccccbba..
 .bccccbbba..
 .bcccbbba...
 ..bccbba....
 ...bcbb.....
 ....bb......
 ....bb......`);
const HEADS=[HEAD_S,HEAD_SE,HEAD_E,HEAD_NE,HEAD_N,HEAD_NW,HEAD_W,HEAD_SW];

const BODY=rows(`
 ...cdddcc....
 .cddddddccb..
 cddddcccbbba.
 cdddccGGcbbba
 .cddcGYYGbba.
 ..cdccGGcbb..
 ..bcccccbbb..
 ..gGGGGGggg..
 ..gGYYGGggg..
 ..bccccbbbb..
 ..bcdbbcbbb..`);
const BODY_SIDE=rows(`
 ...cddcc...
 .ccddGGcb..
 cdddGGGcba.
 cddccGGcbba
 .bccGYGcbba
 ..ccGGGcbba
 ..bccccbba.
 ..gGGGGgg..
 ..gGYYGgg..
 ..bcccbbb..
 ..bcdbcbb..`);
const BODY_W=rows(`
 ...cddcc...
 ..cddGGccb.
 .cddGGGccba
 cddcGGccbb.
 cddcGYGcbb.
 cddcGGGcb..
 .bccccbbb..
 ..gGGGGgg..
 ..gGYYGgg..
 ..bcccbbb..
 ..bcdbcbb..`);
const BODY_BACK=rows(`
 ...cdddcc....
 .ccddGGdccb..
 cdddGVVGccba.
 cddcVVVVcbbba
 .bccVVVVcbbb.
 ..ccVVVvcbb..
 ..bcVVVvcbb..
 ..gGGGGGggg..
 ..gGVVVVggg..
 ..bVVVVvbbb..
 ..bVVVvvbbb..`);
const BODY_BACK_SIDE=rows(`
 ...cddcc...
 .ccddGGcb..
 cdddGVGcba.
 cddcVVVcbba
 .bccVVVcbba
 ..ccVVVcbba
 ..bcVVvbba.
 ..gGGGGgg..
 ..gGVVVgg..
 ..bVVVvbb..
 ..bVVvbbb..`);
const BODY_BACK_W=rows(`
 ...cddcc...
 ..cddGGccb.
 .cddGVGccba
 cddcVVVccb.
 cddcVVVcbb.
 cddcVVVcb..
 .bcVVvbbb..
 ..gGGGGgg..
 ..gGVVVgg..
 ..bVVVvbb..
 ..bVVvbbb..`);
const CAPE=rows(`
 ..VVVVVv..
 .VVVVVVvv.
 .VVVVVvvv.
 .VVVVVvvv.
 VVVVVVVvvv
 VVVVvVVvvv
 VVVVvVVvvv
 VVVvvVVvvv
 VVvvvVvvvv
 .Vvv..vvv.
 ..v....v..`);
const BOOT=rows(`
 ..ccc..
 .cddcb.
 .cddcb.
 .bccbb.
 .bccbb.
 cdddccb
 ccccbba`);
const BOOT_W=rows(`
 ..ccc..
 .cddcb.
 .cddcb.
 .bccbb.
 .bccbb.
 cdddccb
 ccccbba`);
const KNEE=rows(`
 .cdcb
 cddcb
 .bcbb
 .bcb.`);
const SHIELD=rows(`
 ..gGGGGg.
 .gYYGGGGg
 gYGTTTtgg
 GYTqqTtgg
 GYTqYTtgg
 GYTYYTtgg
 GYTqYTtgg
 GYTqqTtgg
 GGTTTTtgg
 .GTTTttg.
 ..GTTtg..
 ...Gtg...
 ....g....`);
const SHIELD_W=rows(`
 .gGGGGg..
 gYYGGGGg.
 gYGTTTtGg
 gYTqqTtGg
 gYTqYTtGg
 gYTYYTtGg
 gYTqYTtGg
 gYTqqTtGg
 gGTTTTtGG
 .gTTTttG.
 ..gTTtG..
 ...gtG...
 ....g....`);
const SHIELD_PROFILE=rows(`
 .gGGg.
 gYYGGg
 GYTTgg
 GYTtgg
 GYqtgg
 GYYtgg
 GYqtgg
 GYTtgg
 GGTTgg
 .GTtg.
 .GTtg.
 ..Gg..
 ..g...`);
const SHIELD_PROFILE_W=rows(`
 .gGGg.
 gYYGGg
 gYTTGg
 gYTtGg
 gYqtGg
 gYYtGg
 gYqtGg
 gYTtGg
 gGTTGg
 .gTtG.
 .gTtG.
 ..gG..
 ...g..`);
const FIST=rows(`
 .cdc.
 cdccb
 .bcbb
 ..bb.`);
const SHOULDER=rows(`
 .cddc.
 cddccb
 .ccbbb
 ..bb..`);
const SHOULDER_W=rows(`
 .cddc.
 cddccb
 .ccbbb
 ..bb..`);
const MACE_UP=rows(`
 .cddc.
 cdeedb
 cddcbb
 .bcb..
 ..G...
 ..g...
 ..G...
 ..g...
 ..G...
 ..g...`);
const MACE_RIGHT=rows(`
 .....cd.
 ....cdeb
 GgGGcddb
 ....bcb.
 .....b..`);
const MACE_LEFT=rows(`
 .cd.....
 cded....
 cddcGGgG
 .bcb....
 ..b.....`);
const MACE_DOWN_RIGHT=rows(`
 Gg......
 .GG.....
 ..gG....
 ...Gcdd.
 ....cded
 ....cddb
 .....bb.`);
const MACE_DOWN_LEFT=rows(`
 ......gG
 .....GG.
 ....Gg..
 .cddG...
 cded....
 cddb....
 .bb.....`);
const MACE_DOWN=rows(`
 ..G...
 ..g...
 ..G...
 ..g...
 .cdd..
 cdeedb
 cddcbb
 .bbb..`);
const FALL_HEAD=rows(`
 ....ccc....
 ..ccdddc...
 .cdedcccb..
 GdddccSSSb.
 gddccASSsb.
 .bccSSSsb..
 ..bbbbb....`);
const FALL_BODY=rows(`
 ..cddc........
 .cddGGcc......
 cdccGYYGccbb..
 cdccGGGGcbcbba
 .bcGGGGccbcbb.
 ..bccccccbbb..
 ...bbbbbbb....`);
const FALL_DIAGONAL_BODY=rows(`
 ...cddc......
 ..cddGGcc....
 .cddGYYGccb..
 cddccGGGccbb.
 .bccGGGccbbba
 ..bccccccbbb.
 ...bcccccbb..
 ....bccbbb...
 .....bbbb....`);
const FALL_SHIELD=rows(`
 ..gGGGGg...
 .gYYTTTGGg.
 gYTTqqTTtgg
 GYTTYYTTtgg
 .GGTTTTtgg.
 ..gGGGgg...
 ....gg.....`);

const COUNTS={idle:2,walk:4,basicAttack:6,skill1:6,skill2:8,hurt:2,death:5,spawn:3};

// Explicit keys: rootX,rootY, headX,headY, main handX/handY,
// shieldX/shieldY, weapon pose, knee offset. Pixel positions, no interpolation.
const KEYS={
 idle:[ [0,0,0,0,25,21,3,13,'up',0], [0,1,0,1,25,22,3,14,'up',0] ],
 walk:[ [0,0,1,0,24,20,3,13,'up',-1], [0,-1,0,-1,25,20,4,12,'up',0], [0,0,-1,0,26,21,3,13,'up',1], [0,1,0,1,25,22,2,14,'up',0] ],
 basicAttack:[ [-1,1,-1,1,25,15,2,14,'up',-1], [-2,2,-2,2,24,10,1,15,'up',-2], [1,0,1,0,24,18,4,13,'right',2], [2,2,2,2,24,22,5,15,'downRight',2], [1,1,1,1,24,21,4,14,'up',1], [0,0,0,0,25,21,3,13,'up',0] ],
 skill1:[ [-1,1,-1,1,24,22,2,14,'up',-1], [-2,2,-2,2,23,23,1,15,'up',-2], [2,0,2,0,20,21,19,12,'up',2], [2,1,2,1,20,22,17,13,'up',2], [1,1,1,1,23,22,10,14,'up',1], [0,0,0,0,25,21,3,13,'up',0] ],
 skill2:[ [0,1,0,1,24,20,3,14,'up',0], [0,2,0,2,24,17,3,13,'up',0], [0,2,0,2,24,12,4,11,'up',0], [0,0,0,-1,24,10,5,8,'up',0], [0,1,0,0,24,11,6,9,'up',0], [0,1,0,0,24,13,4,10,'up',0], [0,1,0,1,25,18,3,13,'up',0], [0,0,0,0,25,21,3,13,'up',0] ],
 hurt:[ [-2,1,-2,0,23,23,2,15,'downRight',-1], [-1,2,-1,2,24,23,3,15,'up',-1] ],
 death:[ [-1,1,-2,1,24,22,2,15,'downRight',-1], [-2,4,-3,3,24,24,3,17,'downRight',-2], [-3,5,-4,5,24,25,3,18,'downRight',-2], [0,0,0,0,0,0,0,0,'up',0], [0,0,0,0,0,0,0,0,'up',0] ],
 spawn:[ [0,2,0,2,24,23,3,15,'up',0], [0,1,0,1,25,22,3,14,'up',0], [0,0,0,0,25,21,3,13,'up',0] ]
};

function part(g,art,x,y){stamp(g,art,Math.round(x),Math.round(y),palette);}
function mainArm(g,hand,shoulder,west){
 const [hx,hy]=hand,[sx,sy]=shoulder;
 const ex=Math.round((sx+hx)/2)+(west?1:-1),ey=Math.max(sy+2,Math.round((sy+hy)/2)+1);
 // Four pixels of actual upper-arm/forearm overlap prevent detached gloves.
 line(g,sx,sy,ex,ey,palette.a,4);line(g,ex,ey,hx,hy,palette.a,3);
 line(g,sx-1,sy,ex-1,ey,palette.c,2);line(g,ex-1,ey,hx-1,hy,palette.c,1);
 part(g,west?SHOULDER_W:SHOULDER,sx-3,sy-2);
 part(g,FIST,hx-2,hy-1);
}
function weapon(g,hand,kind,west){
 const [x,y]=hand;
 if(kind==='right')part(g,west?MACE_LEFT:MACE_RIGHT,west?x-7:x,y-2);
 else if(kind==='downRight')part(g,west?MACE_DOWN_LEFT:MACE_DOWN_RIGHT,west?x-7:x,y-1);
 else if(kind==='down')part(g,MACE_DOWN,x-2,y);
 else part(g,MACE_UP,x-2,y-8);
}
function collapsed(g,f,d){
 // The last two poses are individually drawn low, long silhouettes. Nothing
 // stands upright and fades in place. Metal light remains on the upper edge.
 const west=d>=5,shift=f===4?1:0;
 if(f===2){
  part(g,BOOT,23,24);part(g,BOOT_W,18,25);
  part(g,FALL_DIAGONAL_BODY,12,18);
  part(g,FALL_HEAD,6,13);
  part(g,west?SHIELD_W:SHIELD,5,18);
  part(g,MACE_DOWN_RIGHT,23,23);
  return {hand:[23,24],offhand:[10,24],foot:[16,30]};
 }
 part(g,FALL_BODY,12,22+shift);
 part(g,FALL_HEAD,4,20+shift);
 part(g,BOOT,24,24+shift);
 part(g,FALL_SHIELD,8,24+shift);
 part(g,MACE_RIGHT,23,26+shift);
 if(west){
  // A separately placed face/hand makes west corpses distinct without flipping
  // the screen-space light on every armour cluster.
  pixel(g,8,25+shift,palette.S);pixel(g,9,25+shift,palette.s);
 }
 return {hand:[23,29],offhand:[13,28],foot:[16,30]};
}

export function draw(g,state='idle',frame=0,direction=1){
 if(!(state in COUNTS))state='idle';
 const f=Math.max(0,Math.min(COUNTS[state]-1,frame|0)),d=((direction|0)%8+8)%8;
 if(state==='death'&&f>=2)return collapsed(g,f,d);
 const west=d>=5,side=d===2||d===6,back=d>=3&&d<=5,k=KEYS[state][f];
 const [rx,ry,hx,hy,mx,my,sx,sy,weaponPose,knee]=k,bodyX=16+rx,bodyY=12+ry;
 const forward=west?-1:1;
 let hand=[west?31-mx:mx,my],shield=[west?31-sx-8:sx,sy];
 let kind=weaponPose;
 if(state==='basicAttack'&&f===2){if(d===0){hand=[21,21];kind='down';}else if(d===4){hand=[22,11];kind='up';}}
 if(state==='skill1'&&f===2){if(d===0)shield=[12,18];else if(d===4)shield=[12,4];}
 // Cloth only occupies a few quiet shadow clusters behind the armour.
 part(g,CAPE,bodyX-5,15+ry);
 const stride=state==='walk'?[-2,0,2,0][f]:knee,legY=23+(state==='death'?Math.min(2,f):0);
 const leftX=side?bodyX-3:bodyX-6,rightX=side?bodyX+1:bodyX+2;
 // Boot planes and knees stay lit from screen-left for both east and west.
 part(g,KNEE,leftX+1,21+ry+Math.min(0,stride));
 part(g,KNEE,rightX+1,21+ry+Math.min(0,-stride));
 part(g,BOOT_W,leftX-(state==='walk'&&stride<0?1:0),legY+Math.min(0,stride));
 part(g,BOOT,rightX+(state==='walk'&&stride>0?1:0),legY+Math.min(0,-stride));
 const body=side?(west?BODY_W:BODY_SIDE):back?(west?BODY_BACK_W:d===3?BODY_BACK_SIDE:BODY_BACK):BODY;
 const bx=side?bodyX-5:bodyX-6;
 // Raised mace is behind the head, while a contact arm crosses the breastplate.
 const isRaise=hand[1]<15;
 if(back||isRaise){mainArm(g,hand,[bodyX+forward*(side?4:5),bodyY+4],west);weapon(g,hand,kind,west);}
 // The shield's carrying arm is a discrete metal strip behind its large face.
 line(g,bodyX-forward*4,bodyY+5,shield[0]+4,shield[1]+6,palette.b,3);
 if(back)part(g,side?(west?SHIELD_PROFILE_W:SHIELD_PROFILE):(west?SHIELD_W:SHIELD),shield[0],shield[1]);
 part(g,body,bx,bodyY);
 part(g,HEADS[d],bodyX-6+(west?-hx:hx)-rx,2+hy);
 if(!back&&!isRaise){mainArm(g,hand,[bodyX+forward*(side?4:5),bodyY+4],west);weapon(g,hand,kind,west);}
 if(!back)part(g,side?(west?SHIELD_PROFILE_W:SHIELD_PROFILE):(west?SHIELD_W:SHIELD),shield[0],shield[1]);
 // Small crest accents are body art. Sanctuary rings/hit effects remain owned
 // by the renderer and its actual server impact tick.
 if(state==='skill2'&&(f===3||f===4)){pixel(g,bodyX-1,12,palette.Y);pixel(g,bodyX,11,palette.e);}
 let alpha=255;if(state==='spawn')alpha=[110,190,255][f];
 if(alpha!==255)for(let i=3;i<g.data.length;i+=4)if(g.data[i])g.data[i]=alpha;
 return {hand,offhand:[shield[0]+4,shield[1]+6],foot:[16,30],projectile:hand};
}

export const notes={
 heroId:'paladin',title:'Tidebound Warden',nativeSize:[32,32],footAnchor:[16,30],
 proportions:'10 px sallet/face plus 1 px crest, 11 px broad plate torso, planted 7 px greaves; approx. 2.6 heads',
 design:'A squat ivory-plated guardian with an open-cheek sallet, short flanged mace, oversized asymmetrical sea-glass kite shield and quiet mauve cloak.',
 light:'Screen upper-left; west head/body/shield/weapon planes have separately authored colour clusters.',
 references:'SD proportions, clustered shading and clear equipment silhouettes studied from user-supplied references. Every mask is original.',
 contacts:{basicAttack:2,skill1:2,skill2:3},
 states:COUNTS,
 authoring:'Native one-pixel masks; integer part poses; no smooth resampling, external images or copied pixels.'
};
