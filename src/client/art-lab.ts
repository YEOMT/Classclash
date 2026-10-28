import './art-lab.css';
import {CHAMPION_ART} from './champion-animation.js';
import {nativeLoopFrame} from './art-contract.js';
import {BattleRenderer} from './renderer.js';
import {ART_HEROES,createArtFixture,advanceArtFixture} from './art-lab-fixture.js';
import {HERO_BY_ID,SKILLS} from '../shared/heroes.js';
import {BALANCE} from '../shared/balance.js';
import type {CombatState} from '../shared/combat-types.js';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const descriptions=['선택된 레오나 원본 · 검과 방패','선택된 애쉬 원본 · 활과 두 팔','선택된 애니 원본 · 불꽃과 손'];
const palettes=[['#202334','#4a6575','#9fb5ba','#f4e4b9','#d69d4d','#428b84'],['#261e2e','#764936','#bc7953','#f1c091','#912f4a','#ed7b61'],['#211c32','#4c2e58','#9b465d','#e78955','#ffc36f','#fff0b4']];
$('art-lab').innerHTML=`<header><div><a href="/">CLASS CLASH / 게임으로 돌아가기</a><div class="eyebrow">RASTER MOTION · 18 HEROES</div><h1>작은 영웅, 선명한 전투.</h1><p>성전사 · 궁수 · 화염술사 — 현재 선택 원본과 실제 전투 엔진 검증</p></div><span class="tag">ART LAB / 02</span></header><main><div class="sprite-tools"><label>동작 검수 <select id="pose"><option value="idle">대기</option><option value="walk">이동</option><option value="basicAttack" selected>기본 공격</option><option value="skill1">스킬 1</option><option value="skill2">스킬 2</option><option value="hurt">피격</option><option value="death">사망</option></select></label><label>방향 <select id="direction">${['S','SE','E','NE','N','NW','W','SW'].map(d=>`<option ${d==='SE'?'selected':''}>${d}</option>`).join('')}</select></label><span id="frame-readout"></span></div><section class="roster">${ART_HEROES.map((id,i)=>`<article class="hero-card"><canvas width="64" height="64" id="sprite-${id}" aria-label="${HERO_BY_ID[id]!.name} 애니메이션"></canvas><div><small>0${i+1} / ${['VANGUARD','RANGER','EMBERWEAVER'][i]}</small><h2>${HERO_BY_ID[id]!.name}</h2><p>${descriptions[i]}</p><div class="palette">${palettes[i]!.map(c=>`<i style="background:${c}"></i>`).join('')}</div></div></article>`).join('')}</section><div class="toolbar"><button id="student" aria-pressed="true">학생 확대</button><button id="host" aria-pressed="false">호스트 전체맵</button><label>추적 <select id="follow">${ART_HEROES.map((id,i)=>`<option value="A-${i}">${HERO_BY_ID[id]!.name}</option>`).join('')}</select></label><span class="separator"></span><label>검증 장면 <select id="scene"><option value="skirmish">3 vs 3 · 스킬 교전</option><option value="stress">30 영웅 + 168 미니언</option></select></label><button id="pause">일시 정지</button><button id="step">1틱 진행</button><button id="restart">장면 재시작</button></div><div class="stage" id="stage"><span class="loading">스프라이트를 불러오는 중…</span></div><div class="below"><div class="panel"><div class="panel-title"><span>실제 판정 이벤트</span><span>20 Hz / 판정과 스프라이트 동기화</span></div><div class="log" id="event-log"></div></div><div class="panel"><div class="panel-title"><span>전장 상태</span><span id="world-size">${BALANCE.map.width} × ${BALANCE.map.height}</span></div><div class="stats"><div><b id="clock">0.0</b><span>전투 시간 / 초</span></div><div><b id="units">0</b><span>생존 영웅 / 미니언</span></div><div><b id="hits">0</b><span>명중 이벤트</span></div></div></div></div><p class="footnote">독립 검증 전장입니다. 게임과 같은 AI·공격 판정·스킬 수치·스프라이트·렌더러를 사용합니다. 초기 배치와 출정 인원만 구성하며, 교실 방의 퀴즈·재화·경기에는 영향을 주지 않습니다.</p></main>`;

let renderer:BattleRenderer, fixture=createArtFixture(),state:CombatState=fixture.state;
let sequence=0,paused=false,host=false,ready=false,lastEvent=0,hitCount=0;
const observed=new Set<string>(),actions=new Set<string>(),log:string[]=[];
const metrics={simulationMs:[] as number[],peakHeroes:0,peakMinions:0};
function reset(){fixture=createArtFixture(($<HTMLSelectElement>('scene').value==='stress'),++sequence);state=fixture.state;lastEvent=0;hitCount=0;log.length=0;renderer.setPlayers(fixture.players);renderer.follow($<HTMLSelectElement>('follow').value);renderer.update(structuredClone(state),paused);refresh();}
function refresh(){
 for(const e of state.events){if(e.eventSeq<=lastEvent)continue;lastEvent=e.eventSeq;observed.add(e.type);if(e.type==='HIT')hitCount++;if(e.type==='SKILL_CAST')actions.add(String(e.params.skillId??e.effectId));if(['SKILL_CAST','HIT','DEATH','SHIELD'].includes(e.type)){
  const u=state.units.find(u=>u.entityId===e.sourceEntityId),who=HERO_BY_ID[u?.heroDefinitionId??'']?.name??'미니언';
  const skill=SKILLS[String(e.params.skillId)]?.name??SKILLS[e.effectId]?.name??({'flurry':'연환권','uppercut':'승룡권','fire_burst':'화염 폭발','flame_wall':'화염 장벽','shield_bash':'방패 강타','sanctuary':'성역 방패'}[e.effectId]??(e.type==='HIT'?'명중':e.type==='DEATH'?'사망':e.type==='SHIELD'?'보호막':'시전'));
  log.unshift(`${(e.tick/20).toFixed(2)}s  ${who} · ${skill}`);log.length=Math.min(log.length,3);
 }}
 const heroes=state.units.filter(u=>u.kind==='HERO'&&u.hp>0).length,minions=state.units.filter(u=>u.kind.endsWith('MINION')&&u.hp>0).length;
 metrics.peakHeroes=Math.max(metrics.peakHeroes,heroes);metrics.peakMinions=Math.max(metrics.peakMinions,minions);
 $('clock').textContent=(state.tick/20).toFixed(1);$('units').textContent=`${heroes} / ${minions}`;$('hits').textContent=String(hitCount);$('event-log').textContent='';for(const line of log){const p=document.createElement('div');p.textContent=line;$('event-log').append(p);}
}
function step(){const before=performance.now();advanceArtFixture(state);if(metrics.simulationMs.length<18000)metrics.simulationMs.push(performance.now()-before);renderer.update(structuredClone(state),paused);refresh();}
async function view(value:boolean){ready=false;host=value;renderer?.destroy();$('stage').replaceChildren();const next=new BattleRenderer();renderer=next;await next.init($('stage'),value);if(renderer!==next)return;next.setPlayers(fixture.players);next.follow($<HTMLSelectElement>('follow').value);next.update(structuredClone(state),paused);$('host').setAttribute('aria-pressed',String(value));$('student').setAttribute('aria-pressed',String(!value));ready=true;}
$('student').onclick=()=>{void view(false);};$('host').onclick=()=>{void view(true);};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'재생':'일시 정지';renderer.update(structuredClone(state),paused);};
$('step').onclick=()=>{paused=true;$('pause').textContent='재생';step();};
$('restart').onclick=()=>reset();$<HTMLSelectElement>('scene').onchange=()=>reset();
$<HTMLSelectElement>('follow').onchange=()=>renderer.follow($<HTMLSelectElement>('follow').value);
try{await view(false);refresh();}catch(error){if(!$('stage').querySelector('[role="alert"]'))$('stage').textContent=`전장 초기화 실패: ${error}`;throw error;}
setInterval(()=>{if(ready&&!paused)step();},50);
const images=await Promise.all(ART_HEROES.map(async id=>{const img=new Image();img.src=CHAMPION_ART[id]!.sheet;await img.decode();return img;}));
$('direction').innerHTML='<option value="E">오른쪽 원본</option><option value="W">왼쪽 미러</option>';
let lastPose=0;
function sprites(now:number){
 if(now-lastPose>30){lastPose=now;const pose=$<HTMLSelectElement>('pose').value,mirror=$<HTMLSelectElement>('direction').value==='W',readout:string[]=[];
  for(let i=0;i<ART_HEROES.length;i++){
   const id=ART_HEROES[i]!,spec=CHAMPION_ART[id]!,clip=pose==='basicAttack'?spec.actions.attack!.clip:pose==='skill1'||pose==='skill2'?spec.actions[pose]!.clip:spec.clips[pose==='death'?'dead':pose==='hurt'?'hit':pose==='walk'?'run':pose]??spec.clips.idle!,frames=spec.anims[clip]!.frames,index=nativeLoopFrame(frames,now,true),frame=frames[index]!,r=frame.data,ctx=$<HTMLCanvasElement>(`sprite-${id}`).getContext('2d')!;
   ctx.clearRect(0,0,64,64);ctx.imageSmoothingEnabled=false;const scale=Math.min(60/r.w,60/r.h),w=r.w*scale,h=r.h*scale;ctx.save();if(mirror){ctx.translate(64,0);ctx.scale(-1,1);}ctx.drawImage(images[i]!,r.x,r.y,r.w,r.h,(64-w)/2,62-h,w,h);ctx.restore();readout.push(`${HERO_BY_ID[id]!.name} ${index+1}/${frames.length}`);
  }
  $('frame-readout').textContent=readout.join(' · ')+' · 원본 시간/프레임 유지';
 }
 requestAnimationFrame(sprites);
}requestAnimationFrame(sprites);
// QA surface reads actual fixture state and renderer metrics; no classroom commands.
Object.defineProperty(window,'__artLab',{get:()=>({ready,state,host,paused,observed:[...observed],actions:[...actions],metrics,rendererMetrics:renderer.metrics,players:fixture.players})});
