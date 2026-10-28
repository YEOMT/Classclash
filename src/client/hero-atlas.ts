/** Asset-motion-01 stores each source pose once. The game still has eight
 * movement headings; the supplied art has two side views, mirrored on the GPU. */
export const HERO_ATLAS = {cell:64, columns:8, poses:36, width:512, height:320} as const;
export function heroAtlasPose(sample:{index:number;direction:number}) {
 return {pose:Math.floor(sample.index/8),mirror:sample.direction>=5};
}
export function heroAtlasRect(pose:number){
 return {x:pose%HERO_ATLAS.columns*HERO_ATLAS.cell,y:Math.floor(pose/HERO_ATLAS.columns)*HERO_ATLAS.cell,w:HERO_ATLAS.cell,h:HERO_ATLAS.cell};
}
