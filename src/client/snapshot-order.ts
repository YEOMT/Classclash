export interface SnapshotOrder { connectionEpoch:number; matchId:string|null; snapshotSeq:number }

/** A new authenticated connection may restart its sequence after server recovery. */
export function acceptSnapshot(previous:SnapshotOrder|null,next:SnapshotOrder,welcomedEpoch:number):boolean {
  if(next.connectionEpoch!==welcomedEpoch)return false;
  if(previous?.connectionEpoch===next.connectionEpoch&&next.snapshotSeq<=previous.snapshotSeq)return false;
  return true;
}
