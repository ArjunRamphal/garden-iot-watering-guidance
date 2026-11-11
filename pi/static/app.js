"use strict";
const $ = id => document.getElementById(id);
const csrf = document.body.dataset.csrf;
let statusData = null, historyData = [], settingsFilled = false, polling = false;
const formatter = new Intl.DateTimeFormat("en-ZA", {timeZone:"Africa/Johannesburg",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
const dateText = x => x ? formatter.format(new Date(x)) : "--";
const fixed = (x, n=1) => x === null || x === undefined ? "--" : Number(x).toFixed(n);
const labels = {
  NO_DATA:["Waiting for fresh readings","Connect the Uno. Raw readings should arrive every second."],
  STALE_DATA:["Reading unavailable / old","Check the USB connection and sensor. No current watering recommendation is available."],
  CHECK_SENSOR:["Check the sensor and soil contact","An extreme or noisy reading needs inspection. Very dry soil and a disconnected probe can look similar."],
  UNCALIBRATED:["Raw monitoring is ready","Capture dry and drained wet references in your own soil, then activate the calibration."],
  SET_THRESHOLDS:["Validate your thresholds","The relative index is available. Check and confirm the thresholds using your own soil trials."],
  CHECKING_DRY:["Checking a low reading","Waiting for three new low samples before raising the dry-soil warning."],
  WATER_NEEDED:["Dry-soil warning: inspect before watering","If this soil needs water, apply one measured trial portion by hand, record it below, then allow it to soak in."],
  WAIT_SOAK:["Allow the water to soak in","Do not add another portion automatically. Wait for stable readings; use a longer pause if needed."],
  OBSERVE:["Monitor the soil","No confirmed dry-soil warning is active. Check the plant and soil; continue observing."],
};

function message(text, error=false){
  $("message").textContent=text; $("message").className="notice"+(error?" error":""); $("message").hidden=false;
}
async function api(url, body){
  const options=body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-Garden-CSRF":csrf},body:JSON.stringify(body)};
  const response=await fetch(url, options);
  if(response.status===401) throw new Error("Sign in again, then reload the dashboard.");
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Request failed");
  return data;
}
function formData(form){
  const data=Object.fromEntries(new FormData(form));
  for(const input of form.querySelectorAll('input[type="checkbox"]')) data[input.name]=input.checked;
  return data;
}
function fillSettings(){
  const form=$("settings-form"), values=statusData.settings;
  for(const [key,value] of Object.entries(values)){
    const input=form.elements.namedItem(key); if(!input) continue;
    if(input.type==="checkbox") input.checked=value; else input.value=value??"";
  }
  settingsFilled=true;
}
function logRows(target, rows, makeText){
  const box=$(target); box.replaceChildren();
  for(const row of rows){const p=document.createElement("p");p.textContent=makeText(row);box.appendChild(p);}
  if(!rows.length) box.textContent="No records yet.";
}
// BEGIN restored system event feed
function renderSystemEventFeed(rows){
  let box=$("events-list");
  if(!box){
    const anchor=$("record-count");
    if(!anchor) return;
    const heading=document.createElement("h3");
    heading.textContent="Recent system events";
    box=document.createElement("div");
    box.id="events-list";
    box.className="log";
    anchor.insertAdjacentElement("afterend",heading);
    heading.insertAdjacentElement("afterend",box);
  }
  logRows("events-list",rows,r=>`${dateText(r.at)} / ${r.type}: ${r.message}`);
}
// END restored system event feed

function updateStatus(s){
  statusData=s;
  $("mode").textContent=s.source==="simulated"?"SIMULATED":"HARDWARE";
  $("simulation").hidden=s.source!=="simulated";
  const [title,advice]=labels[s.state]||[s.state,""];
  $("state").textContent=title;
  $("advice").textContent=advice+(s.state==="WAIT_SOAK"?` ${s.soak_remaining_seconds}s remain in the configured pause.`:"")+
    (s.state==="WATER_NEEDED"?" See the Water amount panel below for calibrated quantity guidance.":"");
  $("decision").className="decision"+(["STALE_DATA","CHECK_SENSOR"].includes(s.state)?" danger":["WATER_NEEDED","SET_THRESHOLDS","UNCALIBRATED","CHECKING_DRY","NO_DATA"].includes(s.state)?" caution":"");
  $("quality").textContent=[s.error,s.latest?.flags,s.bad_frames?`${s.bad_frames} invalid frames ignored`:""].filter(Boolean).join(" / ");
  $("raw").textContent=s.latest?.raw??"--";
  $("index").textContent=fixed(s.latest?.moisture_index);
  $("age").textContent=s.age_seconds===null?"--":`${fixed(s.age_seconds)} s`;
  $("connection").textContent=`${s.connected?"Connected":"Disconnected"}${s.serial_port?" / "+s.serial_port:""}`;
  $("water-total").textContent=`${fixed(s.summary.water_total_ml)} mL`;
  $("water-count").textContent=`${s.summary.water_event_count} operator-entered watering records (all time)`;
  $("record-count").textContent=`${s.summary.reading_count} readings saved.`;
  $("crop-description").textContent=`${s.settings.crop}. ${s.settings.soil_notes}`;
  $("capture-progress").textContent=`${Math.min(s.fresh_capture_samples,s.capture_samples_needed)} / ${s.capture_samples_needed} recent samples buffered; leave the probe still before capture.`;
  for(const kind of ["dry","wet"]){
    const r=s.captures[kind]; $(kind+"-result").textContent=r?`Reference #${r.id}: ${fixed(r.raw)} ADC; spread ${r.spread}; SD ${fixed(r.sd,2)}. ${dateText(r.at)}. ${r.note}`:"No reference captured yet.";
  }
  const c=s.calibration;
  $("active-calibration").textContent=c?`Active profile #${c.id}: dry ${c.dry_raw}, drained wet ${c.wet_raw} ADC. ${c.note}`:"No calibration is active.";
  logRows("watering-list",s.recent_watering,r=>`${dateText(r.at)} / ${r.volume_ml} mL / ${r.operator}. ${r.note}`);
  logRows("observations-list",s.recent_observations,r=>`${dateText(r.at)} / ${r.operator}: ${r.note}`);
  renderSystemEventFeed(s.recent_events || []);
  if(!settingsFilled) fillSettings();
}
function chart(id, field, max, activeOnly=false){
  const canvas=$(id), ratio=window.devicePixelRatio||1;
  const width=canvas.clientWidth,height=220;
  canvas.width=width*ratio;canvas.height=height*ratio;
  const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);
  const pad={l:36,r:10,t:15,b:30}, w=width-pad.l-pad.r, h=height-pad.t-pad.b;
  ctx.font="11px system-ui";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.t+h-i*h/4;ctx.strokeStyle="#e4ebe1";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(width-pad.r,y);ctx.stroke();ctx.fillStyle="#547062";ctx.fillText(String(max*i/4),2,y+4);}
  const data=historyData.filter(r=>!activeOnly||r.calibration_id===statusData?.calibration?.id);
  if(!data.length){ctx.fillText("Waiting for readings",pad.l+10,pad.t+30);return;}
  const first=Date.parse(data[0].at),last=Date.parse(data.at(-1).at),span=Math.max(last-first,1000);
  const xFor=r=>pad.l+(Date.parse(r.at)-first)/span*w,yFor=v=>pad.t+h-v/max*h;
  if(activeOnly&&statusData?.settings.thresholds_confirmed){
    for(const [value,color] of [[statusData.settings.low_index,"#bf5e20"],[statusData.settings.clear_index,"#56835b"]]){
      ctx.strokeStyle=color;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(pad.l,yFor(value));ctx.lineTo(width-pad.r,yFor(value));ctx.stroke();ctx.setLineDash([]);
    }
  }
  ctx.strokeStyle=activeOnly?"#26784e":"#277293";ctx.lineWidth=2;ctx.beginPath();
  let prev=null;
  for(const row of data){
    if(row[field]===null){prev=null;continue;}
    const x=xFor(row),y=yFor(row[field]);
    const broken=!prev||row.stream_id!==prev.stream_id||row.calibration_id!==prev.calibration_id||Date.parse(row.at)-Date.parse(prev.at)>20000;
    if(broken)ctx.moveTo(x,y);else ctx.lineTo(x,y);prev=row;
  }
  ctx.stroke();ctx.fillStyle=activeOnly?"#26784e":"#277293";
  const tail=data.at(-1);if(tail[field]!==null){ctx.beginPath();ctx.arc(xFor(tail),yFor(tail[field]),3,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle="#547062";ctx.fillText(new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit",hour12:false}).format(first),pad.l,height-6);
  ctx.textAlign="right";ctx.fillText(new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit",hour12:false}).format(last),width-pad.r,height-6);
}
function draw(){
  chart("raw-chart","raw",1023);chart("index-chart","moisture_index",100,true);
  const body=$("reading-rows");body.replaceChildren();
  for(const row of historyData.slice(-12).reverse()){
    const tr=document.createElement("tr");
    for(const value of [dateText(row.at),row.raw,fixed(row.moisture_index),row.state]){const td=document.createElement("td");td.textContent=value;tr.appendChild(td);}
    body.appendChild(tr);
  }
}
async function refresh(){
  if(polling)return;polling=true;
  try{const [s,h]=await Promise.all([api("/api/status"),api("/api/history")]);updateStatus(s);historyData=h;draw();}
  catch(error){$("state").textContent="Dashboard connection lost";$("advice").textContent="Current readings are unavailable. Check that the application is running.";$("decision").className="decision danger";message(error.message,true);}
  finally{polling=false;}
}
function bind(id,path,transform=body=>body){
  const form=$(id);
  form.addEventListener("submit",async event=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{await api(path,transform(formData(form)));message("Saved.");if(id==="settings-form"||id==="calibration-form")settingsFilled=false;
      if(id==="water-form"){form.elements.volume_ml.value="";form.elements.already_applied.checked=false;form.elements.note.value="";}
      if(id==="observation-form")form.elements.note.value="";
      await refresh();
    }catch(error){message(error.message,true);}finally{button.disabled=false;}
  });
}
bind("water-form","/api/watering");bind("observation-form","/api/observation");bind("settings-form","/api/settings");
bind("dry-form","/api/capture",body=>({...body,kind:"dry"}));
bind("wet-form","/api/capture",body=>({...body,kind:"wet"}));
bind("calibration-form","/api/calibration",body=>({...body,dry_id:statusData?.captures.dry?.id,wet_id:statusData?.captures.wet?.id}));
$("refresh").addEventListener("click",refresh);window.addEventListener("resize",draw);
refresh();setInterval(refresh,1000);
