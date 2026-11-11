"use strict";
const assert=require("node:assert/strict");
const {DryWarningController}=require("../pi/static/dry_warning.js");
let passed=0;
function test(name,fn){fn();passed++;console.log("PASS "+name);}
function fixture(){
  let now=0,played=0,cancelled=0;
  const c=new DryWarningController({clock:()=>now,play:()=>played++,cancel:()=>cancelled++});
  const status=(state="WATER_NEEDED",overrides={})=>({source:"hardware",connected:true,age_seconds:0,latest:{stream_id:"a"},state,...overrides});
  return {c,status,advance:n=>now+=n,plays:()=>played,cancels:()=>cancelled};
}
test("sound starts disabled",()=>{const f=fixture();f.c.update(f.status());assert.equal(f.plays(),0);});
test("enabling during a live warning sounds once",()=>{const f=fixture();f.c.update(f.status());f.c.enable();f.c.tick();assert.equal(f.plays(),1);});
test("repeats only after 30 seconds of refreshed live warning",()=>{const f=fixture();f.c.enable();f.c.update(f.status());for(let i=0;i<15;i++){f.advance(2000);f.c.update(f.status());}assert.equal(f.plays(),2);});
test("silence lasts for current warning and next episode sounds",()=>{const f=fixture();f.c.enable();f.c.update(f.status());f.c.silence();f.advance(31000);f.c.update(f.status());assert.equal(f.plays(),1);f.c.update(f.status("OBSERVE"));f.c.update(f.status());assert.equal(f.plays(),2);});
test("soak and sensor-check states stay quiet",()=>{const f=fixture();f.c.enable();f.c.update(f.status("WAIT_SOAK"));f.c.update(f.status("CHECK_SENSOR"));assert.equal(f.plays(),0);});
test("stale disconnected missing and simulated data stay quiet",()=>{const f=fixture();f.c.enable();for(const s of [f.status("STALE_DATA"),f.status("WATER_NEEDED",{connected:false}),f.status("WATER_NEEDED",{latest:null}),f.status("WATER_NEEDED",{age_seconds:999}),f.status("WATER_NEEDED",{source:"simulated"})])f.c.update(s);assert.equal(f.plays(),0);});
test("watchdog cancels warning when polling stops",()=>{const f=fixture();f.c.enable();f.c.update(f.status());f.advance(7000);f.c.tick();assert.equal(f.c.status().live,false);assert.equal(f.c.status().dry,false);assert.ok(f.cancels()>0);assert.equal(f.plays(),1);});
test("disable cancels and stops future alarms",()=>{const f=fixture();f.c.enable();f.c.update(f.status());f.c.disable();f.advance(31000);f.c.update(f.status());assert.equal(f.plays(),1);assert.ok(f.cancels()>0);});
test("a new stream renews a silenced warning",()=>{const f=fixture();f.c.enable();f.c.update(f.status());f.c.silence();f.c.update(f.status("WATER_NEEDED",{latest:{stream_id:"b"}}));assert.equal(f.plays(),2);});
test("audio failure disables alarms and gives recovery status",()=>{let now=0;const c=new DryWarningController({clock:()=>now,play:()=>{throw new Error("suspended");}});c.enable();c.update({source:"hardware",connected:true,age_seconds:0,latest:{stream_id:"a"},state:"WATER_NEEDED"});assert.equal(c.enabled,false);assert.match(c.status().error,/Enable sound again/);});
console.log(passed+" dry-warning checks passed.");
