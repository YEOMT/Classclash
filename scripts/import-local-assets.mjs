// Restore only the user's approved local artwork from a separately held full project.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/import-local-assets.mjs <extracted-private-full-project-directory>');
const sourceRoot=fs.realpathSync(source),targetRoot=fs.realpathSync('.');
if(sourceRoot===targetRoot)throw new Error('Source and destination must be different directories');
const lock=JSON.parse(fs.readFileSync('assets/art-source/source-lock.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=Object.keys(lock.files);
for(const file of files){if(!/^(assets\/source\/|public\/assets\/)/.test(file)||file.split('/').includes('..'))throw new Error('Unsafe source-lock path');const input=path.join(sourceRoot,file);if(!fs.existsSync(input)||hash(fs.readFileSync(input))!==lock.files[file])throw new Error('Approved source missing or different: '+file);}
const backup=path.join(targetRoot,'.local-asset-backups',new Date().toISOString().replaceAll(':','-'));
let copied=0,preserved=0;
for(const file of files){const input=path.join(sourceRoot,file),output=path.join(targetRoot,file);if(fs.existsSync(output)){if(hash(fs.readFileSync(output))===lock.files[file])continue;const saved=path.join(backup,file);fs.mkdirSync(path.dirname(saved),{recursive:true});fs.copyFileSync(output,saved);preserved++;}fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(input,output);copied++;}
console.log(JSON.stringify({copied,preserved,backup:preserved?backup:null,scope:'Local educational use. No public redistribution grant is inferred.'}));
