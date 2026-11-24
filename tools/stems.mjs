// loudness of each instrument alone (no mastering interplay beyond the shared limiter)
import fs from 'node:fs';
const D=new URL('../src/',import.meta.url).pathname; const strip=f=>fs.readFileSync(D+f,'utf8').replace("'use strict';",'');
const code='const THREE={};const location=undefined;'+strip('00_util.js')+strip('06_score.js')+strip('85_audio.js').split('const Sound =')[0]+';return {Score,synth};';
const {Score,synth}=new Function(code)(); const SEC=[['INTRO',0,4.8],['A',4.8,24],['TEA',24,28.8],['LEMON',28.8,43.2],['BRIDGE',43.2,52.8],['C',52.8,72],['OUT',72,81.6]];
const db=v=>(20*Math.log10(Math.max(v,1e-9))).toFixed(1).padStart(6);
console.log('          '+SEC.map(s=>s[0].padStart(7)).join(''));
for(const k of ['koto','flute','flute2','bass','strings','chord','lemon','lemon2','taiko','wood','shake','bell','clack']){const tr={};for(const n in Score.tracks)tr[n]=n===k?Score.tracks[n]:[];const o=synth({SR:22050,DUR:Score.DUR,TAIL:1,tr,CUE:Score.CUE,ev:[],gainM:1});const [L,R]=o.music;console.log(k.padEnd(9),SEC.map(([n,a,b])=>{let s=0,c=0;for(let i=(a*22050)|0;i<b*22050;i++){s+=L[i]*L[i]+R[i]*R[i];c+=2;}return ' '+db(Math.sqrt(s/c));}).join(''));}
