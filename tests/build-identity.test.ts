import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {runtimeBuildInfo} from '../src/server/build-info.js';
test('build identity validates runtime asset bytes rather than trusting a fresh manifest alone',()=>{
  const root=mkdtempSync(join(tmpdir(),'clash-identity-'));mkdirSync(join(root,'assets/v2'),{recursive:true});
  const bytes=Buffer.from('a test raster payload'),hash=createHash('sha256').update(bytes).digest('hex');writeFileSync(join(root,'assets/unit.png'),bytes);
  writeFileSync(join(root,'assets/v2/manifest.json'),JSON.stringify({assetVersion:'test-only',distribution:{status:'LOCAL_SCHOOL_USE_ONLY'},files:{'/assets/unit.png':hash}}));
  const good=runtimeBuildInfo(root);assert.equal(good.assetFilesMatch,true);assert.equal(good.assetFileCount,1);assert.equal(good.assetMismatchCount,0);assert.equal(good.assetDistribution,'LOCAL_SCHOOL_USE_ONLY');
  writeFileSync(join(root,'assets/unit.png'),'stale asset');const bad=runtimeBuildInfo(root);assert.equal(bad.assetManifestHash,good.assetManifestHash);assert.equal(bad.assetFilesMatch,false);assert.equal(bad.buildAssetMatch,false);assert.equal(bad.assetMismatchCount,1);
});
