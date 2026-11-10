// SAARTHI console - UI only. The "brain" (LLM) connects in a later step; until then a small
// local responder handles time, date, notes, opening sites and system status.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("saarthi:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("saarthi:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const TZ = "Asia/Kolkata";
const fmtTime = (d, s = false) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", ...(s ? { second: "2-digit" } : {}), hour12: false, timeZone: TZ });
const sysReduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let motion = store.get("motion", sysReduce ? "reduced" : "full");

// ---------------- state machine ----------------
const STATES = {
  idle: { label: "Standing by", sub: "Press Space or the mic to talk" },
  listening: { label: "Listening", sub: "Release Space when you're done" },
  thinking: { label: "Thinking", sub: "Working on it" },
  speaking: { label: "Speaking", sub: "Press Esc to stop" },
  error: { label: "Something went wrong", sub: "" },
};
let state = "idle";
function setState(s, sub) {
  state = s;
  document.body.dataset.state = s;
  $("#state-label").textContent = STATES[s].label;
  $("#state-sub").textContent = sub ?? STATES[s].sub;
}

// ---------------- the core: a chariot wheel after the Konark sun wheel ----------------
// 8 thick spokes, 8 thin spokes, beads on the rim, and an outer dial that is a real 24-hour clock.
const cv = $("#core"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, t0 = performance.now(), level = 0, analyser = null, audioData = null, raf = 0, last = 0;
function size() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  draw(performance.now(), true);
}
const CY = "92,225,255", SA = "255,181,71";
function ring(r, w, color, a0 = 0, a1 = Math.PI * 2) { ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); }

function draw(now, force) {
  const t = (now - t0) / 1000;
  const still = motion === "off";
  const slow = motion === "reduced";
  // audio level: from the mic while listening, simulated envelope while speaking
  if (analyser && state === "listening") {
    analyser.getByteTimeDomainData(audioData);
    let sum = 0; for (let i = 0; i < audioData.length; i++) { const v = (audioData[i] - 128) / 128; sum += v * v; }
    level += (Math.min(1, Math.sqrt(sum / audioData.length) * 4) - level) * 0.3;
  } else if (state === "speaking") {
    level += ((0.35 + 0.35 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1))) - level) * 0.25;
  } else level += (0 - level) * 0.08;

  const R = Math.min(W * 0.42, H * 0.36);
  ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.45);
  const speak = state === "speaking", listen = state === "listening", think = state === "thinking", err = state === "error";
  const main = err ? "255,107,122" : speak ? SA : CY;
  const spin = still ? 0 : (slow ? 0.25 : 1);

  // the lamp-light behind the hub (only the core gets light; panels stay flat)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
  glow.addColorStop(0, `rgba(${main},${0.16 + level * 0.25})`); glow.addColorStop(1, `rgba(${main},0)`);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2); ctx.fill();

  // outer 24-hour dial: ticks every 15 min, hour numerals, a saffron hand at the current IST time
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const dayFrac = (ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds()) / 86400;
  ctx.save();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2 - Math.PI / 2, hour = i % 4 === 0;
    const r1 = R * 1.04, r2 = R * (hour ? 1.1 : 1.07);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.strokeStyle = `rgba(${CY},${hour ? 0.55 : 0.22})`; ctx.lineWidth = hour ? 1.4 : 1; ctx.stroke();
  }
  ctx.font = `500 ${Math.max(9, R * 0.045)}px "JetBrains Mono", monospace`; ctx.fillStyle = `rgba(${CY},.5)`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let h = 0; h < 24; h += 3) { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; ctx.fillText(String(h).padStart(2, "0"), Math.cos(a) * R * 1.19, Math.sin(a) * R * 1.19); }
  const ha = dayFrac * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(Math.cos(ha) * R * 0.98, Math.sin(ha) * R * 0.98); ctx.lineTo(Math.cos(ha) * R * 1.13, Math.sin(ha) * R * 1.13);
  ctx.strokeStyle = `rgba(${SA},.95)`; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(Math.cos(ha) * R * 1.13, Math.sin(ha) * R * 1.13, 3.5, 0, Math.PI * 2); ctx.fillStyle = `rgb(${SA})`; ctx.fill();
  ctx.restore();

  // segmented instrument ring, turning slowly
  ctx.save(); ctx.rotate(t * 0.08 * spin);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ring(R * 0.97, 2, `rgba(${CY},${i % 3 === 0 ? 0.6 : 0.25})`, a + 0.04, a + Math.PI / 6 - 0.04); }
  ctx.restore();

  // voice ring: the rim breathes with the mic or with SAARTHI's voice
  ctx.save();
  ctx.beginPath();
  const pts = 160;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wob = (listen || speak) ? level * R * 0.06 * (Math.sin(a * 6 + t * 5) * 0.6 + Math.sin(a * 11 - t * 3) * 0.4) : 0;
    const breathe = state === "idle" && !still ? Math.sin(t * 1.2) * R * 0.006 : 0;
    const r = R * 0.88 + wob + breathe;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.strokeStyle = `rgba(${main},${0.7 + level * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // the wheel: rim with beads, 8 thick + 8 thin spokes, turning like a chariot wheel
  const wheelSpin = think ? t * 0.9 * spin : t * 0.05 * spin;
  ctx.save(); ctx.rotate(wheelSpin);
  ring(R * 0.74, 3, `rgba(${main},.85)`);
  ring(R * 0.68, 1, `rgba(${main},.35)`);
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.71, Math.sin(a) * R * 0.71, R * 0.011, 0, Math.PI * 2); ctx.fillStyle = `rgba(${main},.7)`; ctx.fill(); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, thick = i % 2 === 0;
    ctx.save(); ctx.rotate(a);
    if (thick) {
      ctx.beginPath(); ctx.moveTo(R * 0.17, -R * 0.022); ctx.lineTo(R * 0.67, -R * 0.034); ctx.lineTo(R * 0.67, R * 0.034); ctx.lineTo(R * 0.17, R * 0.022); ctx.closePath();
      ctx.fillStyle = `rgba(${main},.16)`; ctx.fill(); ctx.strokeStyle = `rgba(${main},.75)`; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(R * 0.45, 0, R * 0.03, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${main},.6)`; ctx.stroke(); // carved medallion
    } else {
      ctx.beginPath(); ctx.moveTo(R * 0.2, 0); ctx.lineTo(R * 0.67, 0); ctx.strokeStyle = `rgba(${main},.45)`; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // thinking: a saffron bead orbiting the hub, like a charioteer's glance
  if (think) {
    const oa = t * 2.4 * Math.max(spin, 0.4);
    ctx.beginPath(); ctx.arc(Math.cos(oa) * R * 0.8, Math.sin(oa) * R * 0.8, 4, 0, Math.PI * 2); ctx.fillStyle = `rgb(${SA})`; ctx.fill();
    ring(R * 0.8, 1.5, `rgba(${SA},.5)`, oa - 0.9, oa);
  }

  // hub
  ring(R * 0.16, 2, `rgba(${main},.9)`);
  const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.15);
  hub.addColorStop(0, `rgba(${speak ? "255,236,200" : "220,250,255"},${0.9})`); hub.addColorStop(0.5, `rgba(${main},${0.55 + level * 0.4})`); hub.addColorStop(1, `rgba(${main},.08)`);
  ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, R * (0.13 + level * 0.025), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const idleSlow = state === "idle" && motion !== "full";
  const minGap = motion === "off" ? 1000 : idleSlow ? 66 : (state === "idle" ? 33 : 16); // ~30fps when idle, ~60 when active
  if (now - last < minGap) return;
  last = now; draw(now);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(loop); });
new ResizeObserver(() => size()).observe($(".core-wrap"));

// ---------------- top bar + side panels ----------------
function tick() {
  const d = new Date();
  $("#clock-time").textContent = fmtTime(d, true);
  $("#clock-date").textContent = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: TZ }) + " · IST";
}
function net() {
  const on = navigator.onLine, c = navigator.connection;
  $("#chip-net i").className = on ? "ok" : "err";
  $("#chip-net em").textContent = on ? (c?.effectiveType ? c.effectiveType.toUpperCase() : "Online") : "Offline";
}
const session = Date.now();
async function system() {
  const rows = [];
  rows.push(["Platform", navigator.userAgentData?.platform || (navigator.platform || "—")]);
  rows.push(["CPU threads", navigator.hardwareConcurrency || "—"]);
  if (navigator.deviceMemory) rows.push(["Memory", `${navigator.deviceMemory} GB+`]);
  rows.push(["Screen", `${screen.width}×${screen.height} @${(devicePixelRatio || 1).toFixed(1)}x`]);
  let bat = null;
  try { bat = await navigator.getBattery?.(); } catch { /* not available */ }
  if (bat) rows.push(["Battery", `${Math.round(bat.level * 100)}%${bat.charging ? " · charging" : ""}`, bat.level]);
  const up = Math.floor((Date.now() - session) / 1000);
  rows.push(["Session", `${String(Math.floor(up / 3600)).padStart(2, "0")}:${String(Math.floor(up / 60) % 60).padStart(2, "0")}:${String(up % 60).padStart(2, "0")}`]);
  rows.push(["Language", navigator.language]);
  $("#sys").innerHTML = rows.map(([k, v, m]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>${m != null ? `<div class="meter"><i style="width:${Math.round(m * 100)}%"></i></div>` : ""}`).join("");
}
function agenda() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const items = [["07:30", "Morning run"], ["10:00", "Gravrel standup"], ["13:00", "Lunch"], ["15:30", "Interview practice: RAG"], ["19:00", "Read: LoRA & QLoRA"], ["22:30", "Plan tomorrow"]];
  const mins = now.getHours() * 60 + now.getMinutes();
  let next = items.findIndex(([t]) => { const [h, m] = t.split(":").map(Number); return h * 60 + m >= mins; });
  $("#today-label").textContent = now.toLocaleDateString("en-IN", { weekday: "long" });
  $("#agenda").innerHTML = items.map(([t, txt], i) => `<li class="${i < next || next === -1 ? "past" : i === next ? "now" : ""}"><time>${t}</time><span>${esc(txt)}</span></li>`).join("");
}
function memory() {
  const notes = store.get("notes", []);
  $("#mem-count").textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
  $("#memory").innerHTML = notes.length ? notes.slice().reverse().map((n, i) => `<li><span>${esc(n.text)}</span><button data-del="${notes.length - 1 - i}" aria-label="Forget this note">Forget</button></li>`).join("") : `<li class="empty">Nothing yet</li>`;
}
$("#memory").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; const n = store.get("notes", []); const [gone] = n.splice(+b.dataset.del, 1); store.set("notes", n); memory(); log("Forgot a note", "local", gone?.text); });

// activity log: every action, with whether it only read, wrote, or stayed on this device
function log(what, kind = "read", detail = "") {
  const li = document.createElement("li");
  li.innerHTML = `<time>${fmtTime(new Date())}</time><div><b>${esc(what)}</b><span class="tag ${kind}">${{ read: "read", write: "needs approval", local: "on device" }[kind]}</span></div>${detail ? `<p>${esc(detail)}</p>` : ""}`;
  $("#activity").prepend(li);
  while ($("#activity").children.length > 30) $("#activity").lastChild.remove();
}

// ---------------- conversation ----------------
function say(role, html, extra = "") {
  const d = document.createElement("div");
  d.className = `msg ${role === "you" ? "you" : "sa"}`;
  d.innerHTML = role === "you" ? esc(html) : `<span class="who">SAARTHI</span>${html}${extra}`;
  $("#convo").appendChild(d);
  $("#convo").scrollTop = $("#convo").scrollHeight;
  return d;
}
let voiceOut = store.get("voiceOut", true);
$("#voice-out").checked = voiceOut;
$("#voice-out").onchange = (e) => { voiceOut = e.target.checked; store.set("voiceOut", voiceOut); };
function pickVoice() {
  const vs = speechSynthesis?.getVoices?.() || [];
  return vs.find((v) => v.lang === "en-IN") || vs.find((v) => /India/i.test(v.name)) || vs.find((v) => v.lang.startsWith("en")) || null;
}
function speak(text) {
  if (!voiceOut || !("speechSynthesis" in window)) { setState("idle"); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ""));
  const v = pickVoice(); if (v) u.voice = v;
  u.rate = 1.02; u.pitch = 0.95;
  u.onstart = () => setState("speaking");
  u.onend = u.onerror = () => setState("idle");
  speechSynthesis.speak(u);
  setTimeout(() => { if (state === "thinking") setState("speaking"); }, 300);
}

// local skills until the brain is connected
const SITES = { youtube: "https://youtube.com", github: "https://github.com", gmail: "https://mail.google.com", google: "https://google.com", linkedin: "https://linkedin.com", render: "https://dashboard.render.com", claude: "https://claude.ai", "interview coach": "https://claude.ai" };
const SKILLS = [
  { re: /\b(time|samay)\b/i, run: () => ({ text: `It's ${fmtTime(new Date())} in India.`, steps: ["Read device clock (IST)"], kind: "local", what: "Read the clock" }) },
  { re: /\b(date|day|today)\b/i, run: () => ({ text: `Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ })}.`, steps: ["Read device calendar date"], kind: "local", what: "Read the date" }) },
  { re: /^(remember|note|yaad rakh(o|na)?)\s+(that\s+)?(.+)/i, run: (m) => { const n = store.get("notes", []); n.push({ text: m[4], at: Date.now() }); store.set("notes", n); memory(); return { text: `Noted. I'll remember that ${esc(m[4])}.`, steps: ["Saved a note in this browser"], kind: "local", what: "Saved a note", detail: m[4] }; } },
  { re: /\b(what do you remember|my notes|notes)\b/i, run: () => { const n = store.get("notes", []); return { text: n.length ? `You asked me to remember: ${n.map((x) => esc(x.text)).join("; ")}.` : "You haven't asked me to remember anything yet.", steps: ["Read notes stored in this browser"], kind: "local", what: "Read notes" }; } },
  { re: /\b(status|system|battery|how are you)\b/i, run: () => ({ text: `All systems steady. ${navigator.onLine ? "Network is online" : "Network is offline"}, ${navigator.hardwareConcurrency || "several"} CPU threads available. My brain isn't connected yet, so I can only run local skills.`, steps: ["Read network state", "Read CPU thread count"], kind: "local", what: "Checked system status" }) },
  { re: /^(open|launch|khol(o)?)\s+(.+)/i, run: (m) => {
      const name = m[3].trim().toLowerCase(), url = SITES[name] || (/\.\w{2,}$/.test(name) ? "https://" + name.replace(/^https?:\/\//, "") : null);
      if (!url) return { text: `I don't know where "${esc(m[3])}" is yet. Try a site name like github.com.`, steps: [], kind: "local", what: "Couldn't resolve a site" };
      return { text: `Ready to open <b>${esc(url)}</b>.`, steps: ["Matched site name", "Waiting for your approval"], kind: "write", what: `Open ${url}`, confirm: { label: `Open <code>${esc(url)}</code> in a new tab?`, go: () => { open(url, "_blank", "noopener"); log(`Opened ${url}`, "write"); } } };
    } },
  { re: /^(search|google|dhoondo)\s+(for\s+)?(.+)/i, run: (m) => { const url = "https://www.google.com/search?q=" + encodeURIComponent(m[3]); return { text: `Ready to search the web for <b>${esc(m[3])}</b>.`, steps: ["Built a search URL", "Waiting for your approval"], kind: "write", what: "Web search", confirm: { label: `Search Google for <code>${esc(m[3])}</code>?`, go: () => { open(url, "_blank", "noopener"); log(`Searched: ${m[3]}`, "write"); } } }; } },
  { re: /\b(hello|hi|namaste|hey)\b/i, run: () => ({ text: "Namaste. I'm SAARTHI. I can tell the time, keep notes, open sites and check this device. Connect my brain later and I'll do much more.", steps: [], kind: "local", what: "Greeted you" }) },
  { re: /\b(help|what can you do|commands)\b/i, run: () => ({ text: "Try: <b>what time is it</b>, <b>remember to call Ravi at 5</b>, <b>open github</b>, <b>search LoRA rank</b>, <b>system status</b>. Press <b>Ctrl+K</b> for every command.", steps: [], kind: "local", what: "Listed commands" }) },
];
async function ask(text) {
  text = text.trim(); if (!text) return;
  say("you", text);
  setState("thinking", "Working on it");
  await new Promise((r) => setTimeout(r, motion === "full" ? 650 : 200));
  let res = null;
  for (const s of SKILLS) { const m = text.match(s.re); if (m) { res = s.run(m); break; } }
  if (!res) res = { text: "My brain isn't connected yet, so I can't answer open questions. For now I can tell the time, keep notes, open sites and check this device. Say <b>help</b> to see how.", steps: ["No local skill matched"], kind: "local", what: "Couldn't answer (brain offline)" };
  const steps = res.steps.length ? `<details><summary>${res.steps.length} step${res.steps.length > 1 ? "s" : ""}</summary><ol>${res.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>` : "";
  const box = say("sa", res.text, steps);
  log(res.what, res.kind, res.detail);
  if (res.confirm) {
    box.insertAdjacentHTML("beforeend", `<div class="confirm"><p>${res.confirm.label}</p><div class="row"><button class="btn go">Approve</button><button class="btn">Cancel</button></div></div>`);
    const [go, no] = $$(".confirm .btn", box);
    go.onclick = () => { res.confirm.go(); box.querySelector(".confirm").innerHTML = `<p>Done.</p>`; };
    no.onclick = () => { box.querySelector(".confirm").innerHTML = `<p>Cancelled.</p>`; log("Cancelled an action", "local"); };
  }
  speak(res.text);
}
$("#ask").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#q").value; $("#q").value = ""; if (v.startsWith("/")) { openPalette(v.slice(1)); return; } ask(v); });

// ---------------- voice in: hold Space or the mic ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, stream = null, heard = "";
async function startListening() {
  if (state === "listening") return;
  speechSynthesis?.cancel();
  setState("listening");
  $("#mic").setAttribute("aria-pressed", "true");
  $("#chip-mic i").className = "live"; $("#chip-mic em").textContent = "Live";
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser(); analyser.fftSize = 512; audioData = new Uint8Array(analyser.fftSize);
    ac.createMediaStreamSource(stream).connect(analyser);
  } catch { setState("error", "Microphone blocked. Allow it in the address bar, or type instead."); stopMic(); return; }
  if (SR) {
    heard = "";
    rec = new SR(); rec.lang = "en-IN"; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (e) => { heard = [...e.results].map((r) => r[0].transcript).join(" "); $("#state-sub").textContent = heard.slice(-60) || "…"; };
    rec.onerror = () => {};
    try { rec.start(); } catch { /* already started */ }
  } else {
    $("#state-sub").textContent = "This browser can't transcribe speech. Use Chrome or Edge, or type.";
  }
}
function stopMic() {
  $("#mic").setAttribute("aria-pressed", "false");
  $("#chip-mic i").className = ""; $("#chip-mic em").textContent = "Off";
  stream?.getTracks().forEach((t) => t.stop()); stream = null; analyser = null;
}
function stopListening() {
  if (state !== "listening") return;
  stopMic();
  if (rec) { rec.onend = () => { const h = heard.trim(); rec = null; h ? ask(h) : setState("idle", "I didn't catch that"); }; try { rec.stop(); } catch { rec.onend(); } }
  else setState("idle");
}
$("#mic").addEventListener("pointerdown", (e) => { e.preventDefault(); startListening(); });
$("#mic").addEventListener("pointerup", stopListening);
$("#mic").addEventListener("pointerleave", () => { if (state === "listening") stopListening(); });
addEventListener("keydown", (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) && document.activeElement.id !== "pal-q" ? true : document.activeElement?.id === "pal-q";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.key === "Escape") { if (!$("#palette").hidden) closePalette(); else { speechSynthesis?.cancel(); if (state === "listening") { rec?.abort?.(); rec = null; stopMic(); } setState("idle"); } return; }
  if (e.code === "Space" && !typing && !e.repeat) { e.preventDefault(); startListening(); }
  if (e.key === "/" && !typing) { e.preventDefault(); $("#q").focus(); }
});
addEventListener("keyup", (e) => { if (e.code === "Space" && state === "listening") stopListening(); });

// ---------------- command palette ----------------
const COMMANDS = [
  { name: "Ask: what time is it", key: "T", run: () => ask("what time is it") },
  { name: "Ask: today's date", key: "D", run: () => ask("what is today's date") },
  { name: "System status", key: "S", run: () => ask("system status") },
  { name: "Show my notes", key: "N", run: () => ask("what do you remember") },
  { name: "Open GitHub", key: "G", run: () => ask("open github") },
  { name: "Open Gmail", key: "M", run: () => ask("open gmail") },
  { name: "Talk (hold Space)", key: "Space", run: () => { closePalette(); $("#state-sub").textContent = "Hold Space to talk"; } },
  { name: "Motion: full", key: "", run: () => setMotion("full") },
  { name: "Motion: reduced", key: "", run: () => setMotion("reduced") },
  { name: "Motion: still", key: "", run: () => setMotion("off") },
  { name: "Clear conversation", key: "", run: () => { $("#convo").innerHTML = ""; } },
  { name: "Replay start-up", key: "", run: () => boot(true) },
];
let palSel = 0, palItems = COMMANDS;
function openPalette(q = "") { $("#palette").hidden = false; $("#pal-q").value = q; filterPalette(); $("#pal-q").focus(); }
function closePalette() { $("#palette").hidden = true; $("#q").focus(); }
function filterPalette() {
  const q = $("#pal-q").value.toLowerCase();
  palItems = COMMANDS.filter((c) => c.name.toLowerCase().includes(q));
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  $("#pal-list").innerHTML = palItems.map((c, i) => `<li role="option" aria-selected="${i === palSel}" data-i="${i}">${esc(c.name)}${c.key ? `<small>${esc(c.key)}</small>` : ""}</li>`).join("") || `<li>No command matches</li>`;
}
$("#pal-q").addEventListener("input", () => { palSel = 0; filterPalette(); });
$("#pal-q").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palSel + 1, palItems.length - 1); filterPalette(); }
  if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(palSel - 1, 0); filterPalette(); }
  if (e.key === "Enter") { e.preventDefault(); const c = palItems[palSel]; if (c) { closePalette(); c.run(); } }
});
$("#pal-list").addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) { const c = palItems[+li.dataset.i]; closePalette(); c.run(); } });
$("#palette").addEventListener("click", (e) => { if (e.target.id === "palette") closePalette(); });
$("#open-palette").onclick = () => openPalette();
$("#quick").innerHTML = COMMANDS.slice(0, 6).map((c, i) => `<button data-q="${i}"><b>${esc(c.key || "")}</b>${esc(c.name.replace(/^Ask: /, ""))}</button>`).join("");
$("#quick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) COMMANDS[+b.dataset.q].run(); });

function setMotion(m) {
  motion = m; store.set("motion", m);
  $$(".seg [data-motion]").forEach((b) => b.setAttribute("aria-checked", b.dataset.motion === m));
  draw(performance.now(), true);
}
$$(".seg [data-motion]").forEach((b) => (b.onclick = () => setMotion(b.dataset.motion)));

// ---------------- start-up sequence (short, skippable, skipped on reduced motion) ----------------
function boot(force) {
  const el = $("#boot");
  if (!force && (motion !== "full" || store.get("booted", false) && sessionStorage.getItem("saarthi:seen"))) { el.classList.add("done"); return; }
  try { sessionStorage.setItem("saarthi:seen", "1"); } catch { /* ignore */ }
  el.classList.remove("done");
  const lines = ["Waking the console", "Reading device clock (IST)", "Checking network", "Loading local skills: time · notes · open · search", "Brain: not connected (later step)", "Ready"];
  const log = $("#boot-log"); log.innerHTML = "";
  let i = 0, done = false;
  const finish = () => { if (done) return; done = true; el.classList.add("done"); store.set("booted", true); };
  const step = () => {
    if (done) return;
    if (i >= lines.length) { setTimeout(finish, 350); return; }
    log.insertAdjacentHTML("beforeend", `<li>${lines[i]} ${i === 4 ? "<span style='color:var(--warn)'>· later</span>" : "<span>· ok</span>"}</li>`);
    i++; setTimeout(step, 230);
  };
  step();
  $("#boot-skip").onclick = finish;
}

// ---------------- go ----------------
setState("idle");
setMotion(motion);
tick(); setInterval(tick, 1000);
net(); addEventListener("online", net); addEventListener("offline", net);
system(); setInterval(system, 5000);
agenda(); setInterval(agenda, 60000);
memory();
size(); raf = requestAnimationFrame(loop);
boot();
say("sa", "Namaste. I'm SAARTHI, your console. Hold <b>Space</b> to talk, type below, or press <b>Ctrl+K</b> for commands.");
log("Console started", "local");
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => {};
