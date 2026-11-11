"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const fmt = (value, places = 1) => value === null || value === undefined ? "—" : Number(value).toFixed(places);
  const ml = value => fmt(value) + " mL";
  const time = value => new Intl.DateTimeFormat("en-ZA", {timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
  const day = value => new Intl.DateTimeFormat("en-ZA", {timeZone:"Africa/Johannesburg",day:"numeric",month:"short"}).format(new Date(value + "T12:00:00+02:00"));
  const weekday = value => new Intl.DateTimeFormat("en-ZA", {timeZone:"Africa/Johannesburg",weekday:"short",day:"numeric"}).format(new Date(value + "T12:00:00+02:00"));
  const duration = seconds => {
    if (seconds === null || seconds === undefined) return "—";
    if (seconds < 60) return Math.round(seconds) + " s";
    const minutes = Math.floor(seconds / 60), remainder = Math.floor(seconds % 60);
    if (minutes < 60) return minutes + " m " + remainder + " s";
    return Math.floor(minutes / 60) + " h " + (minutes % 60) + " m";
  };
  function el(name, attrs = {}, content) {
    const result = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, String(value));
    if (content !== undefined) result.textContent = content;
    return result;
  }
  function append(svg, name, attrs, content) {
    const result = el(name, attrs, content); svg.appendChild(result); return result;
  }
  function title(node, text) { node.appendChild(el("title", {}, text)); }
  function text(svg, x, y, content, attrs = {}) { return append(svg, "text", {x,y,...attrs}, content); }
  function line(svg, x1, y1, x2, y2, attrs = {}) {
    return append(svg, "line", {x1,y1,x2,y2,stroke:"#e0e8da","stroke-width":1,...attrs});
  }
  function niceMaximum(value) {
    if (!(value > 0)) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const n = value / power;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10) * power;
  }
  function row(body, values) {
    const tr = document.createElement("tr");
    for (const value of values) { const td = document.createElement("td"); td.textContent = value; tr.appendChild(td); }
    body.appendChild(tr);
  }
  function weeklyChart(days) {
    const svg = $("weekly-chart"); svg.replaceChildren();
    const left = 55, right = 980, top = 27, bottom = 181;
    const max = niceMaximum(Math.max(...days.map(d => d.volume_ml), 1) * 1.08);
    text(svg, left, 13, "Water (mL)", {"class":"chart-axis-title"});
    for (let i = 0; i <= 4; i++) {
      const y = bottom - i * (bottom-top) / 4;
      line(svg, left, y, right, y);
      const value=max*i/4;
      text(svg, left-12, y+4, fmt(value, Number.isInteger(value) ? 0 : 1), {"text-anchor":"end"});
    }
    const colors = {training:"#2d8062",checks:"#ce9740",references:"#7296b9",other:"#b8c4b3"};
    days.forEach((d, i) => {
      const center = left + (i+0.5)*(right-left)/7, width = 58;
      let height = 0;
      for (const [category, color] of Object.entries(colors)) {
        const h = d.categories[category] / max * (bottom-top);
        if (h > 0) {
          const rect = append(svg, "rect", {x:center-width/2,y:bottom-height-h,width,height:h,fill:color,rx:2,"data-category":category,"data-volume":d.categories[category]});
          title(rect, d.date + " · " + category + ": " + ml(d.categories[category]));
        }
        height += h;
      }
      if (d.watering_count) text(svg, center, bottom-height-9, fmt(d.volume_ml), {"text-anchor":"middle","class":"chart-value"});
      else text(svg, center, bottom-10, d.reading_count ? "0" : "No data", {"text-anchor":"middle"});
      text(svg, center, bottom+27, weekday(d.date), {"text-anchor":"middle"});
    });
  }
  function wateringChart(data) {
    const svg = $("watering-chart"); svg.replaceChildren();
    const left=53,right=975,top=54,bottom=269;
    const start=Date.parse(data.start), end=Date.parse(data.end), span=Math.max(1000,end-start);
    const x = value => left+(Date.parse(value)-start)/span*(right-left);
    const y = value => bottom-Number(value)/100*(bottom-top);
    text(svg, left, 14, "Relative moisture index", {"class":"chart-axis-title"});
    for (let i=0;i<=4;i++) {
      const value=i*25, at=y(value);line(svg,left,at,right,at);
      text(svg,left-12,at+4,String(value),{"text-anchor":"end"});
    }
    if (data.target_index !== null) {
      line(svg,left,y(data.target_index),right,y(data.target_index),{stroke:"#8a987d","stroke-dasharray":"5 5"});
      text(svg,right,y(data.target_index)-7,"Target " + fmt(data.target_index,0),{"text-anchor":"end","class":"target-label"});
    }
    for (let i=0;i<=4;i++) {
      const at=new Date(start+i*span/4).toISOString();
      text(svg,x(at),bottom+25,time(at),{"text-anchor":i===0?"start":i===4?"end":"middle"});
    }
    text(svg,right,bottom+43,"Time (SAST)",{"text-anchor":"end","class":"chart-axis-title"});
    if (!data.segments.length) text(svg,500,160,"No calibrated readings in this view.",{"text-anchor":"middle","class":"chart-empty"});
    data.segments.forEach(segment => {
      const points=segment.map(p => x(p.at)+","+y(p.index)).join(" ");
      if(segment.length===1) append(svg,"circle",{cx:x(segment[0].at),cy:y(segment[0].index),r:2,fill:"#277b58"});
      else append(svg,"polyline",{points,fill:"none",stroke:"#277b58","stroke-width":2.2,"stroke-linejoin":"round","data-points":segment.length});
    });
    data.captures.forEach(p => {
      const circle=append(svg,"circle",{cx:x(p.at),cy:y(p.index),r:4.5,fill:"#fff",stroke:"#277b58","stroke-width":2});
      title(circle,time(p.at)+" · "+ml(p.cumulative_ml)+" total · settled index "+fmt(p.index));
    });
    let previousLabel = -999, tier=0;
    data.additions.forEach(p => {
      const at=x(p.at), known=p.index !== null && p.index !== undefined;
      const value=known ? y(p.index) : top;
      tier = at-previousLabel < 65 ? (tier+1)%2 : 0;
      const labelY=30+tier*16; previousLabel=at;
      line(svg,at,labelY+5,at,Math.max(value,top),{stroke:"#d2ad6f","stroke-dasharray":"3 4"});
      const circle=append(svg,"circle",{cx:at,cy:value,r:4,fill:"#ce9740",stroke:"#fff","stroke-width":1.2});
      title(circle,time(p.at)+" · "+ml(p.volume_ml)+" recorded"+(known?" · index "+fmt(p.index):""));
      text(svg,Math.max(left+3,Math.min(right-3,at)),labelY,"+"+ml(p.volume_ml),{"text-anchor":at<left+30?"start":at>right-30?"end":"middle","class":"water-label"});
    });
  }
  function predictionChart(items) {
    const svg=$("prediction-chart");svg.replaceChildren();
    const left=115,right=915,top=30,step=100,height=Math.max(220,items.length*step+75),bottom=height-40;
    svg.setAttribute("viewBox","0 0 1000 "+height);
    const maximum=niceMaximum(Math.max(...items.flatMap(r=>[r.predicted_ml,r.actual_total_ml]),1)*1.2);
    const x=value=>left+value/maximum*(right-left);
    for(let i=0;i<=4;i++){
      const value=maximum*i/4,at=x(value);
      line(svg,at,top,at,bottom);text(svg,at,bottom+24,fmt(value,maximum<10?1:0),{"text-anchor":"middle"});
    }
    text(svg,right,bottom+40,"Water (mL)",{"text-anchor":"end","class":"chart-axis-title"});
    if(!items.length) text(svg,500,100,"No saved results in this view.",{"text-anchor":"middle","class":"chart-empty"});
    items.forEach((r,i)=>{
      const center=top+45+i*step;
      text(svg,left-15,center+4,"Run "+r.run_id,{"text-anchor":"end","class":"chart-value"});
      [[r.predicted_ml,"#2d8062",-26,"Prediction"],[r.actual_total_ml,"#7296b9",5,"Measured total"]].forEach(([value,color,offset,label])=>{
        const rect=append(svg,"rect",{x:left,y:center+offset,width:Math.max(0,x(value)-left),height:23,rx:3,fill:color,"data-run":r.run_id,"data-kind":label,"data-value":value});
        title(rect,"Run "+r.run_id+" · "+label+": "+ml(value));
        text(svg,x(value)+10,center+offset+16,ml(value),{"class":"chart-value"});
      });
    });
  }
  function setOptions(select, items) {
    const key=JSON.stringify(items);
    if(select.dataset.options===key)return;
    select.replaceChildren();
    for(const [value,label] of items){const o=document.createElement("option");o.value=value;o.textContent=label;select.appendChild(o);}
    select.dataset.options=key;
  }
  function render(data) {
    $("history-source").textContent=data.source==="hardware"?"Recorded sensor data":"Simulated records";
    $("summary-date").value=data.selected_date;
    $("day-label").textContent=day(data.selected_date);
    $("week-label").textContent=day(data.week_start)+" – "+day(data.week_end);
    for(const period of ["day","week"]){
      const p=data[period];
      $(period+"-volume").textContent=ml(p.volume_ml);
      $(period+"-entries").textContent=String(p.watering_count);
      $(period+"-coverage").textContent=duration(p.recorded_seconds);
      $(period+"-dry").textContent=p.recorded_seconds?duration(p.dry_warning_seconds):"—";
    }
    $("daily-rows").replaceChildren();
    data.days.forEach(d=>row($("daily-rows"),[d.date,fmt(d.volume_ml),d.watering_count,d.reading_count,duration(d.recorded_seconds),d.recorded_seconds?duration(d.dry_warning_seconds):"—"]));
    weeklyChart(data.days);
    const options=[["day","Selected day · all watering"],...data.run_options.map(r=>[String(r.id),(r.kind==="validation"?"Check":"Training")+" run "+r.id+(r.status==="excluded"?" · excluded":r.status==="ended"?" · ended":r.status==="open"?" · in progress":"")])];
    setOptions($("watering-run"),options);
    $("watering-run").value=data.watering.selected;
    const w=data.watering;
    $("watering-window").textContent=new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",day:"numeric",month:"short",year:"numeric"}).format(new Date(w.start))+" · "+time(w.start)+"–"+time(w.end)+" SAST";
    $("watering-count").textContent=w.additions.length+" water entries";
    $("response-volume").textContent=ml(w.water_total_ml);
    $("response-start").textContent=w.captures.length?fmt(w.captures[0].index):"—";
    $("response-end").textContent=w.captures.length?fmt(w.captures.at(-1).index):"—";
    $("response-readings").textContent=w.reading_count.toLocaleString("en-ZA");
    $("water-addition-rows").replaceChildren();$("settled-rows").replaceChildren();
    w.additions.forEach(r=>row($("water-addition-rows"),[time(r.at),fmt(r.volume_ml),fmt(r.index)]));
    w.captures.forEach(r=>row($("settled-rows"),[time(r.at),fmt(r.cumulative_ml),fmt(r.index)]));
    wateringChart(w);
    $("prediction-scope").value=data.prediction_scope;
    $("prediction-description").textContent=data.prediction_scope==="recalculated"?
      "Saved recalculations · existing check measurements":"Predictions saved when each check began · recorded model versions";
    $("prediction-count-label").textContent=data.prediction_scope==="recalculated"?"Recalculations shown":"Check runs shown";
    $("prediction-count").textContent=String(data.prediction_summary.count);
    $("prediction-mean").textContent=data.prediction_summary.mean_difference_ml===null?"—":ml(data.prediction_summary.mean_difference_ml);
    $("prediction-maximum").textContent=data.prediction_summary.maximum_difference_ml===null?"—":ml(data.prediction_summary.maximum_difference_ml);
    $("prediction-rows").replaceChildren();$("target-error-rows").replaceChildren();
    data.predictions.forEach(r=>{
      row($("prediction-rows"),["Run "+r.run_id,fmt(r.starting_index),fmt(r.final_index)+" / "+fmt(r.target_index),fmt(r.predicted_ml),fmt(r.actual_total_ml),fmt(r.difference_ml)]);
      row($("target-error-rows"),["Run "+r.run_id,fmt(r.target_observed_ml,2),fmt(r.stored_target_error_ml,2),r.original_passed===null?"Not recorded":r.original_passed?"Within original limit":"Outside original limit"]);
    });
    predictionChart(data.predictions);
    $("history-footnote").textContent=data.latest_recorded_at?"Latest saved reading or water entry: "+new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",dateStyle:"medium",timeStyle:"short",hour12:false}).format(new Date(data.latest_recorded_at))+" SAST.":"No records have been collected yet.";
    document.documentElement.dataset.analyticsReady="true";
  }
  const initial=new URLSearchParams(location.search);
  const selected={date:initial.get("date"),run:initial.get("run"),scope:initial.get("scope")};
  let generation=0;
  async function refresh() {
    const current=++generation, params=new URLSearchParams();
    for(const [key,value] of Object.entries(selected))if(value)params.set(key,value);
    try{
      const response=await fetch("/api/analytics?"+params,{cache:"no-store",credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to load saved records.");
      if(current!==generation)return;
      render(data);$("analytics-message").hidden=true;
      history.replaceState(null,"","/history"+(params.toString()?"?"+params:""));
    }catch(error){
      if(current!==generation)return;
      $("analytics-message").textContent=error.message;$("analytics-message").hidden=false;
    }
  }
  $("summary-form").addEventListener("submit",event=>{event.preventDefault();selected.date=$("summary-date").value;refresh();});
  $("latest-date").addEventListener("click",()=>{selected.date=null;refresh();});
  $("watering-run").addEventListener("change",()=>{selected.run=$("watering-run").value;refresh();});
  $("prediction-scope").addEventListener("change",()=>{selected.scope=$("prediction-scope").value;refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},15000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
  refresh();
})();
