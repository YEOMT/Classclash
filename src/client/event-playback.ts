/** Only an authenticated recovery snapshot may contain historical effects.
 * Live delivery is never dropped because rendering or the network was slow. */
export function shouldPlayDeliveredEvent(eventTick:number,snapshotTick:number,recovery:boolean){
 return !recovery||eventTick>=snapshotTick-12;
}
