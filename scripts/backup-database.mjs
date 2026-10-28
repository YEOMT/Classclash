import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Usage: node scripts/backup-database.mjs SOURCE.sqlite NEW-BACKUP.sqlite');
if(!fs.existsSync(source))throw new Error('Source database does not exist');
if(fs.existsSync(destination))throw new Error('Refusing to replace an existing backup');
fs.mkdirSync(path.dirname(path.resolve(destination)),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,destination);}finally{db.close();}
const copy=new DatabaseSync(destination,{readOnly:true});
try{const integrity=copy.prepare('PRAGMA integrity_check').get();if(integrity.integrity_check!=='ok')throw new Error('Backup integrity failed');console.log(JSON.stringify({status:'PASS',backup:path.resolve(destination),integrity:'ok',rooms:copy.prepare('SELECT count(*) AS count FROM rooms').get().count}));}finally{copy.close();}
