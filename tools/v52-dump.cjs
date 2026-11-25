// Dumps the live v52's numbers for tests/v52-parity.test.ts: runs the v52 source in a vm with a stub DOM.
// Usage: node tools/v52-dump.cjs <plan-app/src/js> <plan-state.json> <YYYY-MM-DD today> <out.json>
// Runs the live v52 source in a vm with a stub DOM, fed by plan/state.json. Prints derived numbers as JSON.
const fs=require("fs"),vm=require("vm"),path=require("path");
const [,, jsDir, stateFile, today] = process.argv;
const state = JSON.parse(fs.readFileSync(stateFile,"utf8")); const S = state.data||state;
const el = ()=> new Proxy(function(){}, {get:(t,k)=> k===Symbol.toPrimitive? ()=>"" : k==="style"||k==="dataset"||k==="classList"? el() : k==="clientWidth"?600 : k==="value"?"" : k==="checked"?false : k==="length"?0 : k==="then"? undefined : el(), set:()=>true, apply:()=>el()});
const ls = {}; const store = {getItem:k=>ls[k]??null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>{delete ls[k]}};
// v52 reads its state from localStorage keys; fill them from state.json the same way the sync does
const ctx = {console, document: el(), localStorage: store, setTimeout:()=>0, clearTimeout:()=>0, setInterval:()=>0, requestAnimationFrame:()=>0,
  addEventListener:()=>{}, matchMedia:()=>({matches:false, addEventListener(){}}), location:{hash:""}, history:{replaceState(){}},
  navigator:{}, innerWidth:1200, IntersectionObserver: function(){ return {observe(){}}; }, ResizeObserver: function(){ return {observe(){}}; }};
ctx.window = ctx; ctx.globalThis = ctx;
const RealDate = Date; const T = new RealDate(today+"T12:00:00").getTime();
ctx.Date = class extends RealDate { constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } };
vm.createContext(ctx);
const files = fs.readdirSync(jsDir).filter(f=>f.endsWith(".js")).sort();
let src = files.map(f=>fs.readFileSync(path.join(jsDir,f),"utf8")).join("\n;\n");
// expose let/const globals we need
src += `\n;globalThis.__out = {DATA, FB, PROFILE, spec, dur, accOf, formSeries, easyEff, effRoll, zonesNow, corosK, dayLoads, LOAD_W, THR, actType, workoutEq, stravaForecast, thrHrPace, projection, formNow};`;
store.setItem("tp_profile_v1", JSON.stringify(S.profile)); store.setItem("tp_thr_hist_v1", JSON.stringify(S.thr));
store.setItem("tp_feedback_v1", JSON.stringify(S.fb)); store.setItem("tp_ovr_v1", JSON.stringify(S.ovr));
try{ vm.runInContext(src, ctx, {filename:"v52.js"}); }catch(e){ console.error("RUN ERR", e.stack.split("\n").slice(0,4).join("\n")); }
const O = ctx.__out; if(!O){ console.error("no out"); process.exit(1); }
const acc = {}; O.DATA.forEach(e=>{ const a = O.accOf(e); if(a) acc[e.d] = {score:a.score, as:a.as, parts:a.parts.map(p=>[p.key, Math.round(p.s*1000)/1000, Math.round(p.share*1000)/1000])}; });
const F = O.formSeries();
const eff = O.easyEff();
const out = {acc, form: F && {now:F.now, end:F.end, n:F.days.length, K:F.K, days:F.days.filter(x=>!x.plan).map(x=>[x.d, +x.L.toFixed(3), +x.ctl.toFixed(3), +x.atl.toFixed(3)])},
  eff: eff.map(p=>({d:p.d, norm:+p.norm.toFixed(3), raw:+p.raw.toFixed(3), heat:+p.heat.toFixed(4), long:p.long, hard:p.hard})),
  roll: O.effRoll(eff.filter(p=>!p.long)).map(p=>[p.d, +p.v.toFixed(3)]),
  dur: O.DATA.map(e=>[e.d, e.t, e.l, O.dur(e.t,e.l), O.actType(e)]),
  lab: (()=>{ const sf = O.stravaForecast(), th = O.thrHrPace(), pj = O.projection(O.formNow()), end = a=>+a[a.length-1].s.toFixed(2);
    return {wo: O.workoutEq().map(p=>[p.d, p.t, +p.eq.toFixed(3)]), sf: sf.eq ? +sf.eq.toFixed(2) : null, sfN: sf.n, thr: th.pace ? +th.pace.toFixed(2) : null, thrN: th.n,
      proj: pj && {mid:end(pj.mid), lo:end(pj.lo), hi:end(pj.hi), scale:+pj.scale.toFixed(4)}}; })()};
require("fs").writeFileSync(process.argv[5], JSON.stringify(out,null,1));
console.log("acc", Object.keys(acc).length, "eff", eff.length, "form now", F && F.now && Math.round(F.now.r));
