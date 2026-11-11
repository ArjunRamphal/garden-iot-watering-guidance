"use strict";

(function (root) {
  class DryWarningController {
    constructor(options={}) {
      this.clock=options.clock||Date.now;
      this.play=options.play||(()=>{});
      this.cancel=options.cancel||(()=>{});
      this.change=options.change||(()=>{});
      this.repeatMs=options.repeatMs||30000;
      this.freshMs=options.freshMs||6500;
      this.enabled=false;this.dry=false;this.live=false;this.silenced=false;
      this.seen=null;this.lastPlayed=-Infinity;this.stream=null;this.error="";
    }
    enable() { this.enabled=true;this.error="";this.lastPlayed=-Infinity;this.tick(); }
    disable() { this.enabled=false;this.cancel();this.change(this.status()); }
    silence() { if(this.dry){this.silenced=true;this.cancel();}this.change(this.status()); }
    update(snapshot) {
      const now=this.clock(), latest=snapshot&&snapshot.latest;
      const live=!!(snapshot&&snapshot.source==="hardware"&&snapshot.connected&&latest&&
        typeof snapshot.age_seconds==="number"&&snapshot.age_seconds>=0&&snapshot.age_seconds<=120&&
        !["NO_DATA","STALE_DATA"].includes(snapshot.state));
      const dry=live&&snapshot.state==="WATER_NEEDED";
      const stream=latest&&latest.stream_id;
      if(!dry||!this.dry||stream!==this.stream){this.silenced=false;this.lastPlayed=-Infinity;}
      if(!dry&&this.dry)this.cancel();
      this.live=live;this.dry=dry;this.stream=stream;this.seen=now;
      this.tick();
    }
    unavailable() {
      this.live=false;this.dry=false;this.silenced=false;this.seen=null;
      this.lastPlayed=-Infinity;this.cancel();this.change(this.status());
    }
    tick() {
      const now=this.clock();
      if(this.seen!==null&&now-this.seen>this.freshMs){
        this.unavailable();return;
      }
      if(this.enabled&&this.dry&&!this.silenced&&now-this.lastPlayed>=this.repeatMs){
        try{this.play();this.lastPlayed=now;}
        catch(error){this.enabled=false;this.error="Audio paused. Enable sound again.";this.cancel();}
      }
      this.change(this.status());
    }
    status() {
      return {enabled:this.enabled,dry:this.dry,live:this.live,silenced:this.silenced,error:this.error};
    }
  }
  root.GardenDryWarningController=DryWarningController;
  if(typeof module!=="undefined"&&module.exports)module.exports={DryWarningController};
  if(typeof document==="undefined"||!document.getElementById("sound-panel"))return;
  const $=id=>document.getElementById(id);
  let audio=null,nodes=[],loading=false;
  function stopTones(){
    for(const node of nodes){try{node.stop();}catch(error){ }}
    nodes=[];
  }
  async function unlock(){
    const Constructor=root.AudioContext||root.webkitAudioContext;
    if(!Constructor)throw new Error("This browser does not support audio alerts.");
    if(!audio||audio.state==="closed")audio=new Constructor();
    await audio.resume();
    if(audio.state!=="running")throw new Error("Allow sound for this page, then try again.");
  }
  function tones(){
    if(!audio||audio.state!=="running")throw new Error("Audio is paused.");
    stopTones();
    const start=audio.currentTime;
    [740,980,740].forEach((frequency,i)=>{
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      const at=start+i*0.3;
      oscillator.type="sine";oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,at);
      gain.gain.linearRampToValueAtTime(0.10,at+0.015);
      gain.gain.linearRampToValueAtTime(0,at+0.18);
      oscillator.connect(gain);gain.connect(audio.destination);
      oscillator.start(at);oscillator.stop(at+0.2);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();nodes=nodes.filter(n=>n!==oscillator);};
      nodes.push(oscillator);
    });
  }
  function render(status){
    $("sound-toggle").textContent=status.enabled?"Disable sound":"Enable sound";
    $("sound-toggle").setAttribute("aria-pressed",String(status.enabled));
    $("sound-silence").hidden=!(status.enabled&&status.dry&&!status.silenced);
    let state="off",message="Sound off";
    if(status.error)message=status.error;
    else if(status.enabled){
      state="enabled";
      if(!status.live)message="Enabled · waiting for live readings";
      else if(status.dry&&status.silenced){state="silenced";message="This dry warning is silenced";}
      else if(status.dry){state="warning";message="Dry warning · sound repeats every 30 seconds";}
      else message="Enabled · watching for a dry warning";
    }
    $("sound-panel").dataset.soundState=state;
    $("sound-status").textContent=message;
  }
  const controller=new DryWarningController({play:tones,cancel:stopTones,change:render});
  $("sound-toggle").addEventListener("click",async()=>{
    if(controller.enabled){controller.disable();return;}
    try{await unlock();controller.enable();}
    catch(error){$("sound-status").textContent=error.message;}
  });
  $("sound-test").addEventListener("click",async()=>{
    try{await unlock();tones();$("sound-status").textContent="Test sound played";setTimeout(()=>render(controller.status()),1800);}
    catch(error){$("sound-status").textContent=error.message;}
  });
  $("sound-silence").addEventListener("click",()=>controller.silence());
  async function poll(){
    if(loading)return;loading=true;
    try{
      const response=await fetch("/api/status",{cache:"no-store",credentials:"same-origin"});
      if(!response.ok)throw new Error("Live readings unavailable.");
      controller.update(await response.json());
    }catch(error){controller.unavailable();}
    finally{loading=false;}
  }
  setInterval(poll,2000);
  setInterval(()=>controller.tick(),1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)poll();});
  root.addEventListener("pagehide",()=>controller.disable());
  render(controller.status());poll();
})(typeof globalThis!=="undefined"?globalThis:this);
