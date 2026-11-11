"use strict";
(() => {
  const el = id => document.getElementById(id);
  const csrfToken = document.body.dataset.csrf;
  const fmt = n => n === null || n === undefined ? "--" : Number(n).toFixed(1);
  const ml = n => n === null || n === undefined ? "--" : `${fmt(n)} mL`;
  let busy = false, status = null;
  function notice(message, error=false) {
    el("dose-alert").textContent = message;
    el("dose-alert").className = "notice" + (error ? " error" : "");
    el("dose-alert").hidden = false;
  }
  async function request(path, body) {
    const response = await fetch("/api/dose/"+path, body === undefined ? {} : {
      method:"POST", headers:{"Content-Type":"application/json", "X-Garden-CSRF":csrfToken},
      body:JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save. Check the connection.");
    return data;
  }
  function render(s) {
    status = s;
    const p=s.profile, r=s.run, c=s.cycle, rec=s.recommendation;
    if (p) {
      const input=el("dose-add-form").elements.namedItem("volume_ml");
      input.min=String(p.resolution_ml); input.step=String(p.resolution_ml); input.max=String(p.max_portion_ml);
    }
    el("dose-message").textContent=rec.message;
    el("dose-total").textContent=ml(rec.estimated_ml);
    el("dose-next").textContent=ml(rec.next_ml);
    el("dose-target").textContent=fmt(rec.target_index);
    el("dose-range").textContent=rec.range_ml ? `Training range: ${ml(rec.range_ml[0])}–${ml(rec.range_ml[1])}.` : "";
    el("dose-current-water").textContent=c ? `Recorded water for this sample: ${ml(c.actual_added_ml)}.` : "";
    el("dose-profile-description").textContent=p ?
      `${p.name} · ${s.training_runs} training trials · Maximum portion ${ml(p.max_portion_ml)} · Check error limit ${ml(p.allowed_error_ml)}` : "No water profile selected.";
    el("dose-calibration-state").textContent=p ? `Quantity calibration: ${s.calibration_state === "checked" ? "checked" : "experimental"}.` : "";
    el("dose-confirm-form").hidden=!p || s.setup_confirmed || !!r;
    el("dose-new-sample-form").hidden=!p || !!r;
    const select=el("dose-profile-select"), key=s.profiles.map(x=>`${x.id}:${x.name}`).join("|");
    if (select.dataset.key!==key) {
      select.replaceChildren();
      for (const profile of s.profiles) {
        const option=document.createElement("option"); option.value=profile.id; option.textContent=profile.name;
        select.appendChild(option);
      }
      select.dataset.key=key;
    }
    if (!select.matches(":focus") && p) select.value=String(p.id);
    el("dose-select-form").hidden=!s.profiles.length;
    const body=el("dose-training-rows"); body.replaceChildren();
    let prediction=r?.context || s.check_preview;
    if (!r && c) {
      try {prediction=JSON.parse(c.detail_json);} catch {prediction=null;}
    }
    el("dose-check-preview").textContent=prediction?.predicted_ml !== undefined ?
      `Prediction ${ml(prediction.predicted_ml)} · Range ${ml(prediction.range_ml[0])}–${ml(prediction.range_ml[1])} · ${prediction.training_runs_used} trials` :
      (s.check_preview?.message || "Wait for a settled reading.");
    for (const candidate of prediction?.candidates || []) {
      const tr=document.createElement("tr");
      for (const value of [candidate.run_id,fmt((candidate.low_ml+candidate.high_ml)/2)]) {
        const td=document.createElement("td"); td.textContent=String(value); tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    el("dose-run-controls").hidden=!r;
    el("dose-begin-form").hidden=!!r;
    el("dose-run-status").textContent=r ?
      `${r.kind === "training" ? "Training" : "Check"} run ${r.id} · Total water ${ml(r.cumulative_ml)}`+
      (r.predicted_ml !== null ? ` · Prediction ${ml(r.predicted_ml)}` : "")+
      (r.problem ? `. ${r.problem}` : r.pending ? ". Wait, then capture the reading." : "") : "";
    el("dose-stable-status").textContent=s.soak_remaining ? `Soak pause: ${s.soak_remaining} seconds.` :
      s.stable ? "Reading settled." : s.stable_message;
    const points=el("dose-point-rows"); points.replaceChildren();
    for (const point of r?.points || []) {
      const tr=document.createElement("tr");
      for (const value of [point.cumulative_ml,point.raw_median,point.index_value]) {
        const td=document.createElement("td"); td.textContent=fmt(value); tr.appendChild(td);
      }
      points.appendChild(tr);
    }
    for (const id of ["dose-add-form","dose-capture-form","dose-finish-form"]) {
      el(id).querySelector("button").disabled=!!r?.problem || (id==="dose-add-form" ? !!r?.pending :
        id==="dose-capture-form" ? !r?.pending || s.soak_remaining>0 || !s.stable : !!r?.pending);
    }
  }
  async function refresh() {
    if (busy) return;
    busy=true;
    try {render(await request("status"));}
    catch {
      for (const id of ["dose-total","dose-next"]) el(id).textContent="--";
      el("dose-message").textContent="Check the connection and reload.";
    } finally {busy=false;}
  }
  function bind(id,path) {
    const form=el(id);
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      const button=form.querySelector("button"); button.disabled=true;
      const body=Object.fromEntries(new FormData(form));
      for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) body[checkbox.name]=checkbox.checked;
      try {
        const response=await request(path,body), result=response.result;
        let msg=result?.excluded_reason || result?.notice || "Saved.";
        if (path==="finish" && result?.check_passed !== null && result?.check_passed !== undefined)
          msg=`Check complete. Error: ${ml(result.absolute_error_ml)} · ${result.check_passed ? "within limit" : "outside limit"}.`;
        notice(msg,!!result?.excluded_reason || result?.check_passed===false);
        if (["water","capture","end"].includes(path)) form.reset();
        await refresh();
      } catch(error) {notice(error.message,true);}
      finally {button.disabled=false; if(status) render(status);}
    });
  }
  for (const [form,path] of [["profile","profile"],["select","select"],["confirm","confirm"],
      ["new-sample","new_sample"],["begin","begin"],["add","water"],["capture","capture"],
      ["finish","finish"],["end","end"]]) bind(`dose-${form}-form`,path);
  refresh(); setInterval(refresh,2000);
})();
