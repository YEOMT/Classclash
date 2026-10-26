export interface HeartbeatState { pingSentAt:number|null }
export interface HeartbeatDecision {
 action:'PING'|'WAIT'|'TERMINATE';
 pingSentAt:number|null;
}
export const HEARTBEAT_INTERVAL_MS=5000;
export const HEARTBEAT_TIMEOUT_MS=15000;
export const HEARTBEAT_LOOP_TOLERANCE_MS=1000;

/**
 * A late server timer is not evidence that a peer stopped answering.
 * After a long loop gap, probe again and allow a full responsive-loop grace period.
 * The caller clears pingSentAt only when an actual pong arrives.
 */
export function heartbeatDecision(state:HeartbeatState,now:number,elapsedSinceCheck:number):HeartbeatDecision {
 if(elapsedSinceCheck>HEARTBEAT_INTERVAL_MS+HEARTBEAT_LOOP_TOLERANCE_MS||state.pingSentAt===null)
  return{action:'PING',pingSentAt:now};
 if(now-state.pingSentAt>=HEARTBEAT_TIMEOUT_MS)return{action:'TERMINATE',pingSentAt:state.pingSentAt};
 return{action:'WAIT',pingSentAt:state.pingSentAt};
}
