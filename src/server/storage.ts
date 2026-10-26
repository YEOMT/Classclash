import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { RoomData } from './room.js';
import {CURRENT_VERSIONS,incompatibleVersions} from './versions.js';

/** A command and the entire consistent room checkpoint commit in the same WAL transaction. */
export class Storage {
  readonly db: DatabaseSync;
  readonly secret: string;
  constructor(path: string) {
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms (room_code TEXT PRIMARY KEY, room_id TEXT UNIQUE NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, room_code TEXT NOT NULL, actor_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS command_results (scope_id TEXT NOT NULL,actor_id TEXT NOT NULL,command_id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(scope_id,actor_id,command_id));
      CREATE TABLE IF NOT EXISTS match_results (match_id TEXT PRIMARY KEY, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS economy_ledger (scope_id TEXT NOT NULL,actor_id TEXT NOT NULL,revision INTEGER NOT NULL,gold INTEGER NOT NULL CHECK(gold>=0),earned INTEGER NOT NULL,spent INTEGER NOT NULL,PRIMARY KEY(scope_id,actor_id,revision));`);
    const key=this.db.prepare('SELECT value FROM metadata WHERE key=?').get('secret') as {value:string}|undefined;
    this.secret=key?.value||randomBytes(32).toString('hex');
    if(!key)this.db.prepare('INSERT INTO metadata VALUES(?,?)').run('secret',this.secret);
  }
  load():RoomData[]{
    return (this.db.prepare('SELECT state FROM rooms').all() as {state:string}[]).map(row=>{
      const room=JSON.parse(row.state) as RoomData;if(room.version!==1)throw new Error('Unsupported checkpoint version; preserve the database and use the matching server version.');
      const changed=incompatibleVersions(room.versions);
      if(changed.length&&['OPENING_QUIZ','INITIAL_MAINTENANCE','COUNTDOWN','BATTLE'].includes(room.phase))throw new Error(`Incompatible active checkpoint for room ${room.roomCode} (${room.phase}): ${changed.join(', ')} differs from this server. Database preserved. Resume with the matching rules/content/balance version; do not overwrite the saved match.`);
      // Lobby and immutable finished results do not resume old simulation state.
      if(changed.length)room.versions={...CURRENT_VERSIONS};
      if(['LOBBY','RESULT','CANCELLED'].includes(room.phase)){
        room.botDiagnostics??=[];
        for(const p of room.players)if(p.bot){p.bot.maintenanceStartedTick??=room.tick;p.bot.lastProgressTick??=room.tick;p.bot.lastAction??=p.state;}
      }
      room.recovered=true;for(const p of room.players)if(!p.isBot)p.online=false;return room;
    });
  }
  /** Caller excludes connected rooms. Recheck age, identity and phase before deleting. */
  expireInactive(codes:string[]):string[]{
    const removed:string[]=[],cutoff=Date.now()-24*60*60*1000;
    this.db.exec('BEGIN IMMEDIATE');
    try{
      for(const code of new Set(codes)){
        const row=this.db.prepare('SELECT room_id,state FROM rooms WHERE room_code=?').get(code) as {room_id:string;state:string}|undefined;
        if(!row)continue;
        const room=JSON.parse(row.state) as RoomData,updated=Date.parse(room.updatedAt);
        if(room.roomId!==row.room_id||room.roomCode!==code||!['LOBBY','RESULT','CANCELLED'].includes(room.phase)||!Number.isFinite(updated)||updated>cutoff)continue;
        this.db.prepare('DELETE FROM requests WHERE room_code=?').run(code);
        this.db.prepare('DELETE FROM rooms WHERE room_code=? AND room_id=?').run(code,row.room_id);removed.push(code);
      }
      this.db.exec('COMMIT');return removed;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  save(room:RoomData,command?:{scope:string;actor:string;id:string;result:unknown},request?:{id:string;fingerprint:string;actor:string}){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('INSERT INTO rooms VALUES(?,?,?,?) ON CONFLICT(room_code) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at').run(room.roomCode,room.roomId,JSON.stringify(room),new Date().toISOString());
      if(command)this.db.prepare('INSERT OR IGNORE INTO command_results VALUES(?,?,?,?)').run(command.scope,command.actor,command.id,JSON.stringify(command.result));
      if(request)this.db.prepare('INSERT INTO requests VALUES(?,?,?,?)').run(request.id,request.fingerprint,room.roomCode,request.actor);
      if(room.matchId){for(const p of room.players)this.db.prepare('INSERT OR IGNORE INTO economy_ledger VALUES(?,?,?,?,?,?)').run(room.matchId,p.playerId,p.ledgerRevision,p.gold,p.stats.earned,p.stats.spent);}
      if(room.result)this.db.prepare('INSERT OR IGNORE INTO match_results VALUES(?,?)').run(room.result.matchId,JSON.stringify(room.result));
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  request(id:string){return this.db.prepare('SELECT * FROM requests WHERE request_id=?').get(id) as {request_id:string;fingerprint:string;room_code:string;actor_id:string}|undefined;}
  close(){this.db.close();}
}
