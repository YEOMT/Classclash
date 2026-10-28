import type {Lane, Position, Team} from './types.js';

export const LANES:Lane[]=['TOP','MID','BOTTOM'];
export const POSITIONS:Position[]=['TOP','MID','BOTTOM','JUNGLE'];
export const POSITION_NAME:Record<Position,string>={TOP:'탑',MID:'미드',BOTTOM:'바텀',JUNGLE:'정글'};
export const POSITION_DESCRIPTION:Record<Position,string>={TOP:'상단 외곽 전선',MID:'중앙 대각선 전선',BOTTOM:'하단 외곽 전선',JUNGLE:'아군 캠프 → 부족한 라인 지원 / 적 정글 침투'};
export type MapPoint=[number,number];
const spawn:Record<Team,MapPoint>={A:[160,1080],B:[1120,160]};
const pathsAtoB:Record<Lane,MapPoint[]>={
 TOP:[[160,1080],[220,950],[200,800],[210,685],[185,545],[210,430],[200,275],[290,220],[435,210],[688,210],[820,225],[940,275],[1050,230],[1120,160]],
 MID:[[160,1080],[275,945],[400,885],[530,755],[640,640],[752,528],[880,400],[1005,335],[1120,160]],
 BOTTOM:[[160,1080],[340,1010],[470,1080],[590,1075],[850,1075],[1040,1040],[1072,855],[1080,590],[1120,480],[1005,335],[1120,160]],
};
const laneStructures:{team:Team;lane:Lane;outer:MapPoint;inner:MapPoint}[]=[
 {team:'A',lane:'TOP',outer:[210,430],inner:[210,685]},
 {team:'B',lane:'TOP',outer:[435,210],inner:[688,210]},
 {team:'A',lane:'MID',outer:[530,755],inner:[400,885]},
 {team:'B',lane:'MID',outer:[752,528],inner:[880,400]},
 {team:'A',lane:'BOTTOM',outer:[850,1075],inner:[590,1075]},
 {team:'B',lane:'BOTTOM',outer:[1072,855],inner:[1080,590]},
];
export interface CampDefinition {id:string;homeTeam:Team;name:string;kind:'WOLF'|'GOLEM'|'WISP';x:number;y:number}
export const JUNGLE_CAMPS:CampDefinition[]=[
 {id:'A-wolves',homeTeam:'A',name:'늑대',kind:'WOLF',x:345,y:750},
 {id:'A-wisp',homeTeam:'A',name:'숲의 정령',kind:'WISP',x:425,y:445},
 {id:'A-golem',homeTeam:'A',name:'바위 수호자',kind:'GOLEM',x:500,y:950},
 {id:'B-wolves',homeTeam:'B',name:'늑대',kind:'WOLF',x:935,y:530},
 {id:'B-wisp',homeTeam:'B',name:'숲의 정령',kind:'WISP',x:855,y:835},
 {id:'B-golem',homeTeam:'B',name:'바위 수호자',kind:'GOLEM',x:780,y:330},
];
/** Shared corridors follow the supplied artwork. Both renderer and authoritative
 * navigation use this world; decorative pixels never decide combat. */
export const JUNGLE_PATHS:MapPoint[][]=[
 [[275,945],[320,835],[345,750],[400,675],[410,600],[425,445]],
 [[400,885],[480,875],[500,950],[500,1020],[590,1075]],
 [[345,750],[430,780],[530,755]],
 [[425,445],[300,380],[290,270],[435,210]],
 [[425,445],[480,385],[505,365],[505,270],[688,210]],
 [[780,330],[820,225]],
 [[780,330],[700,340],[625,420],[640,490],[752,528]],
 [[780,330],[825,365],[880,400]],
 [[1005,335],[1080,420],[1010,480],[935,530],[905,650],[855,835]],
 [[935,530],[850,500],[752,528]],
 [[855,835],[960,870],[1072,855]],
 [[855,835],[800,800],[775,680],[700,640],[640,640]],
 [[500,950],[500,1035],[700,1030],[820,1010],[970,950],[855,835]],
];
export const BATTLE_MAP={
 id:'lol-three-lane-jungle-v1',width:1280,height:1280,laneWidth:132,mergeWidth:230,
 artwork:'/assets/maps/lol/background.png',spawn,pathsAtoB,camps:JUNGLE_CAMPS,junglePaths:JUNGLE_PATHS,
 laneY:{TOP:210,MID:640,BOTTOM:1075},
 structures:[
  ...laneStructures.flatMap(s=>[
   {id:s.team+'_'+s.lane+'_OUTER',team:s.team,lane:s.lane,kind:'OUTER',x:s.outer[0],y:s.outer[1]},
   {id:s.team+'_'+s.lane+'_INNER',team:s.team,lane:s.lane,kind:'INNER',x:s.inner[0],y:s.inner[1]},
  ]),
  ...(['A','B'] as Team[]).flatMap(team=>{
   const guards:MapPoint[]=team==='A'?[[275,945],[340,1010]]:[[940,275],[1005,335]];
   return [...guards.map(([x,y],i)=>({id:team+'_GUARD_'+(i+1),team,lane:null,kind:'GUARD',x,y})),
    {id:team+'_NEXUS',team,lane:null,kind:'NEXUS',x:team==='A'?145:1135,y:team==='A'?1095:145}];
  }),
 ],
};
export const MAP_BOUNDS={left:48,right:1232,top:48,bottom:1232,leftMerge:320,rightMerge:960,centerX:640,centerY:640};
export function inBase(x:number,y:number,team:Team){const p=spawn[team];return Math.hypot(x-p[0],y-p[1])<=240;}
