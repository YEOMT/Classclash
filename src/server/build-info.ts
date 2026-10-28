import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
export const PROTOCOL_VERSION='classclash-ws-2';
export function runtimeBuildInfo(webroot:string){
  let metadata:{appVersion?:string;commitSha?:string|null;buildTime?:string|null;assetManifestHash?:string|null}={};
  if(existsSync('dist/build-info.json'))metadata=JSON.parse(readFileSync('dist/build-info.json','utf8'));
  const manifest=join(webroot,'assets/v2/manifest.json');
  const bytes=existsSync(manifest)?readFileSync(manifest):null;
  const hash=bytes?createHash('sha256').update(bytes).digest('hex'):null;
  const parsed=bytes?JSON.parse(bytes.toString()):null;
  const distribution=parsed?.distribution;
  const root=resolve(webroot),files=Object.entries(parsed?.files||{}) as [string,string][];
  const mismatches=files.filter(([url,expected])=>{const path=resolve(root,'.'+url);return !path.startsWith(root+sep)||!existsSync(path)||createHash('sha256').update(readFileSync(path)).digest('hex')!==expected;});
  const assetFilesMatch=files.length>0&&mismatches.length===0;
  return {appVersion:metadata.appVersion||'0.2.0',commitSha:metadata.commitSha||null,buildTime:metadata.buildTime||null,assetManifestHash:hash,protocolVersion:PROTOCOL_VERSION,assetVersion:bytes?JSON.parse(bytes.toString()).assetVersion||'0.2':null,assetDistribution:distribution?.status||'UNVERIFIED',assetFileCount:files.length,assetMismatchCount:mismatches.length,assetFilesMatch,buildAssetMatch:!!hash&&metadata.assetManifestHash===hash&&assetFilesMatch};
}
