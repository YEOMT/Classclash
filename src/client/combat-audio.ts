export interface SoundProfile {family:string;wave:OscillatorType;from:number;to:number;seconds:number}
/** Short, distinct synthesized cues; no copied sound files or gameplay effects. */
export function soundProfile(effect:string,type:string):SoundProfile{
 if(/HEAL|CLEANSE/.test(type)||/heal|prayer/.test(effect))return {family:'heal',wave:'sine',from:640,to:960,seconds:.18};
 if(/tower|nexus|guard/.test(effect)||/DESTROY/.test(type))return {family:'tower',wave:'sawtooth',from:150,to:48,seconds:.2};
 if(/fire|flame|pyro/.test(effect))return {family:'fire',wave:'sawtooth',from:280,to:65,seconds:.15};
 if(/ice|frost|cryo/.test(effect))return {family:'frost',wave:'sine',from:1200,to:540,seconds:.11};
 if(/arrow|bolt|archer|crossbow|ranged_minion/.test(effect))return {family:'arrow',wave:'triangle',from:930,to:190,seconds:.065};
 if(/brawler|flurry|uppercut|monk/.test(effect))return {family:'fist',wave:'triangle',from:170,to:65,seconds:.07};
 if(/sword|steel|slash|paladin|shield|iron/.test(effect))return {family:'metal',wave:'square',from:520,to:130,seconds:.085};
 return {family:'magic',wave:'sine',from:380,to:170,seconds:.1};
}
