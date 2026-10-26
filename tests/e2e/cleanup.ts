import type {Page} from '@playwright/test';

export {cancelFixture as cancelActiveTestMatch};

/** End only the fixture's own room, through the authenticated host protocol. */
export async function cancelFixture(page:Page){
 if(page.isClosed())return;
 await page.evaluate(()=>new Promise<void>(resolve=>{
  const raw=sessionStorage.getItem('classclash:active');if(!raw){resolve();return;}
  const session=JSON.parse(raw);if(session.role!=='host'){resolve();return;}
  const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);let epoch=0,sent=false;
  const finish=()=>{clearTimeout(timer);ws.close();resolve();};const timer=setTimeout(finish,5000);
  ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'HELLO',roomCode:session.roomCode,token:session.token})));
  ws.addEventListener('error',finish);ws.addEventListener('message',event=>{
   const m=JSON.parse(String(event.data));if(m.type==='WELCOME')epoch=m.connectionEpoch;
   if(m.type==='SNAPSHOT'&&!sent){const s=m.snapshot;if(['LOBBY','RESULT','CANCELLED'].includes(s.phase)){finish();return;}sent=true;ws.send(JSON.stringify({type:'COMMAND',command:{commandId:crypto.randomUUID(),matchId:s.matchId,expectedPhaseRevision:s.phaseRevision,connectionEpoch:epoch,type:'CANCEL_MATCH',payload:{}}}));}
   if(m.type==='ACK'||m.type==='ERROR')finish();
  });
 })).catch(()=>{});
}
