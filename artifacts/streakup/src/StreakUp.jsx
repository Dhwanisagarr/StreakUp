import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
const todayStr = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toISOString().split("T")[0]; };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateFull = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const LS = {
  get: (k, def) => {
    try {
      const v = localStorage.getItem(k);
      if (v === null) return def;
      const parsed = JSON.parse(v);
      if (Array.isArray(def) && !Array.isArray(parsed)) return def;
      if (typeof def === "object" && def !== null && !Array.isArray(def) && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) return def;
      return parsed;
    } catch {
      return def;
    }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const QUOTES = [
  "Every expert was once a beginner.",
  "Small consistent steps beat giant leaps.",
  "Today's effort is tomorrow's result.",
  "Show up. That's 80% of it.",
  "You don't need motivation. You need a system.",
  "Progress, not perfection.",
  "Your future self is watching.",
  "Don't break the chain.",
];

const TEMPLATES = [
  { name: "21-Day Reading Challenge", description: "Read every single day and build a lifelong habit.", duration: 21, habits: ["Read 10 pages", "Write one key takeaway", "No screens 30 min before reading"] },
  { name: "30-Day Fitness Challenge", description: "Move your body daily and transform your energy.", duration: 30, habits: ["Workout 30 minutes", "Drink 3L of water", "Walk 8,000 steps", "Sleep before midnight"] },
  { name: "66-Day Coding Challenge", description: "The science-backed duration to form a real habit.", duration: 66, habits: ["Code for 1 hour", "Push to GitHub", "Read 1 article or doc"] },
  { name: "30-Day Content Creator", description: "Build your audience one post at a time.", duration: 30, habits: ["Create & publish 1 post", "Engage with 10 comments", "Plan tomorrow's content"] },
  { name: "90-Day Deep Work", description: "90 days of focused, deliberate growth.", duration: 90, habits: ["Deep work block: 2 hours", "No social media until noon", "Journal 5 minutes", "Read 20 pages"] },
];

const BADGES = [
  { id: "day1",    emoji: "🌱", label: "First Step",      desc: "Completed your very first day",   check: (s) => s.totalCompleted >= 1 },
  { id: "streak3", emoji: "🔥", label: "On Fire",         desc: "3-day streak",                    check: (s) => s.bestStreak >= 3 },
  { id: "streak7", emoji: "⚡", label: "Week Warrior",    desc: "7-day streak",                    check: (s) => s.bestStreak >= 7 },
  { id: "streak21",emoji: "🏆", label: "21-Day Champion", desc: "21-day streak",                   check: (s) => s.bestStreak >= 21 },
  { id: "streak30",emoji: "🚀", label: "30-Day Achiever", desc: "30-day streak",                   check: (s) => s.bestStreak >= 30 },
  { id: "streak66",emoji: "⭐", label: "Habit Forged",    desc: "66-day streak",                   check: (s) => s.bestStreak >= 66 },
  { id: "legend",  emoji: "👑", label: "90-Day Legend",   desc: "90-day streak",                   check: (s) => s.bestStreak >= 90 },
  { id: "ten",     emoji: "💎", label: "10 Days Done",    desc: "10 total completed days",         check: (s) => s.totalCompleted >= 10 },
];

/* ─────────────────────────────────────────────
   CHALLENGE STATS ENGINE
───────────────────────────────────────────── */
function calcStats(challenge, dayRecords) {
  const td = todayStr();
  const totalDays = challenge.duration;
  const start = challenge.startDate;
  const end = addDays(start, totalDays - 1);

  let completedDays = 0, skippedDays = 0;
  let currentStreak = 0, bestStreak = 0, tempStreak = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    if (d > td) break;
    const rec = dayRecords[d];
    if (rec === "completed") {
      completedDays++;
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else if (rec === "skipped") {
      skippedDays++;
      tempStreak = 0;
    } else {
      if (d < td) tempStreak = 0;
    }
  }

  let cs = 0;
  for (let i = clamp(daysBetween(start, td), 0, totalDays - 1); i >= 0; i--) {
    const d = addDays(start, i);
    if (dayRecords[d] === "completed") cs++;
    else break;
  }
  currentStreak = cs;

  const pastDays = clamp(daysBetween(start, td) + 1, 0, totalDays);
  const pct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  const todayDayNum = clamp(daysBetween(start, td) + 1, 1, totalDays);
  const isActive = td >= start && td <= end;
  const isFinished = td > end;
  const todayStatus = isActive ? (dayRecords[td] || "pending") : null;

  return { completedDays, skippedDays, totalDays, pastDays, pct, currentStreak, bestStreak, todayDayNum, isActive, isFinished, todayStatus, end };
}

function globalStats(challenges, allRecords) {
  let totalCompleted = 0, bestStreak = 0;
  (Array.isArray(challenges) ? challenges : []).forEach((c) => {
    const s = calcStats(c, (allRecords && allRecords[c.id]) || {});
    totalCompleted += s.completedDays;
    bestStreak = Math.max(bestStreak, s.bestStreak);
  });
  return { totalCompleted, bestStreak };
}

function calcHabitStats(challenge, dayRecords, habitRecords) {
  const td = todayStr();
  const perHabit = {};
  let pastDays = 0;
  (challenge.habits || []).forEach(h => { perHabit[h] = 0; });
  for (let i = 0; i < challenge.duration; i++) {
    const d = addDays(challenge.startDate, i);
    if (d > td) break;
    pastDays++;
    const hr = habitRecords[d];
    (challenge.habits || []).forEach(h => {
      if (hr) { if (hr[h]) perHabit[h]++; }
      else if (dayRecords[d] === "completed") perHabit[h]++;
    });
  }
  return { perHabit, pastDays };
}

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const C = {
  bg: "#d4e7db",
  card: "#FFFFFF",
  amber: "#E86F35",
  amberLight: "#FFFBEB",
  amberMid: "#FEF3C7",
  amberBorder: "#FDE68A",
  amberDark: "#D97706",
  amberDeep: "#92400E",
  text: "#111827",
  textMid: "#374151",
  textMuted: "#6B7280",
  textLight: "#D1D5DB",
  border: "#F0EDE8",
  borderMid: "#E5E7EB",
  green: "#059669",
  greenLight: "#ECFDF5",
  greenBorder: "#A7F3D0",
  greenMid: "#34D399",
  yellow: "#FDE047",
  red: "#DC2626",
  redLight: "#FEF2F2",
  redBorder: "#FCA5A5",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
};

const font = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

/* ─────────────────────────────────────────────
   SMALL SHARED COMPONENTS
───────────────────────────────────────────── */
function Pill({ children, color = C.amberDark, bg = C.amberLight, border = C.amberBorder, style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 11px", borderRadius: 99, background: bg, border: `1px solid ${border}`, fontSize: 12, fontWeight: 700, color, fontStyle: "normal", ...style }}>
      {children}
    </span>
  );
}

function Ring({ pct, size = 64, stroke = 6, color = C.amber }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.amberMid} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

function ProgressBar({ pct, height = 6, color = C.amber, bg = C.amberMid }) {
  return (
    <div style={{ width: "100%", height, borderRadius: 99, background: bg, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   CONFIRMATION DIALOG
───────────────────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel = "Confirm", confirmColor = C.red, onConfirm, onCancel }) {
  return (
    <Overlay onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.card, borderRadius: 24, padding: "28px 24px", width: "90%", maxWidth: 380,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "popIn 0.2s ease",
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{title}</h3>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textMuted, lineHeight: 1.6, fontStyle: "normal" }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button onClick={onConfirm} style={{ ...solidBtn, background: confirmColor, flex: 1 }}>{confirmLabel}</button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClick }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClick) onClick(e);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClick]);

  return (
    <div onClick={onClick} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)", padding: 16,
    }}>
      {children}
    </div>
  );
}

function Sheet({ children, onClose, maxHeight = "92vh" }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 200,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: C.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 640,
        maxHeight, overflowY: "auto", padding: "0 0 max(24px, env(safe-area-inset-bottom))",
        animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.borderMid, margin: "12px auto 0" }} />
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHALLENGE FORM (Create / Edit)
───────────────────────────────────────────── */
function ChallengeForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [start, setStart] = useState(initial?.startDate || todayStr());
  const [durKey, setDurKey] = useState(() => {
    const opts = ["21", "30", "66", "90"];
    return opts.includes(String(initial?.duration)) ? String(initial.duration) : "custom";
  });
  const [customDur, setCustomDur] = useState(String(initial?.duration || 30));
  const [habits, setHabits] = useState(() => (initial?.habits || []).map(h => ({ id: uid(), name: h })));
  const [newHabit, setNewHabit] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [compReqKey, setCompReqKey] = useState(() => {
    const v = initial?.completionReq;
    if (!v || v === 100) return "100";
    if (v === 75) return "75";
    if (v === 50) return "50";
    return "custom";
  });
  const [customCompReq, setCustomCompReq] = useState(String(initial?.completionReq ?? 100));
  const nameRef = useRef();

  const dur = durKey === "custom" ? parseInt(customDur) || 1 : parseInt(durKey);
  const compReq = compReqKey === "custom" ? Math.min(100, Math.max(1, parseInt(customCompReq) || 100)) : parseInt(compReqKey);

  const addHabit = () => {
    if (!newHabit.trim()) return;
    setHabits(h => [...h, { id: uid(), name: newHabit.trim() }]);
    setNewHabit("");
  };

  const handleSave = () => {
    if (!name.trim()) { nameRef.current?.focus(); return; }
    if (dur < 1 || dur > 365) return;
    if (habits.length === 0) return alert("Add at least one habit.");
    onSave({ name: name.trim(), description: desc.trim(), startDate: start, duration: dur, habits: habits.map(h => h.name), completionReq: compReq });
  };

  return (
    <Sheet onClose={onClose} maxHeight="96vh">
      <div style={{ padding: "24px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{initial ? "Edit Challenge" : "New Challenge"}</h2>
          <button onClick={onClose} style={{ ...iconBtn }}>✕</button>
        </div>

        <FormLabel>Challenge name</FormLabel>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 30-Day Fitness Journey" style={inputSt} />

        <FormLabel>Description <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span></FormLabel>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="What is your main goal?" style={{ ...inputSt, resize: "vertical" }} />

        <FormLabel>Start date</FormLabel>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputSt} />

        <FormLabel>Duration</FormLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {["21", "30", "66", "90", "custom"].map(k => (
            <button key={k} onClick={() => setDurKey(k)} style={{
              padding: "8px 16px", borderRadius: 99, border: `2px solid ${durKey === k ? C.amber : C.borderMid}`,
              background: durKey === k ? C.amberLight : "transparent",
              color: durKey === k ? C.amberDeep : C.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: font, transition: "all 0.15s", fontStyle: "normal",
            }}>{k === "custom" ? "Custom" : `${k} days`}</button>
          ))}
        </div>
        {durKey === "custom" && (
          <input type="number" min={1} max={365} value={customDur} onChange={e => setCustomDur(e.target.value)} placeholder="Number of days" style={{ ...inputSt, marginBottom: 4 }} />
        )}

        <FormLabel style={{ marginTop: 20 }}>Daily habits</FormLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newHabit} onChange={e => setNewHabit(e.target.value)} placeholder="e.g. Read 10 pages" onKeyDown={e => e.key === "Enter" && addHabit()} style={{ ...inputSt, margin: 0, flex: 1 }} />
          <button onClick={addHabit} style={{ ...solidBtn, padding: "0 18px", flexShrink: 0 }}>Add Habit</button>
        </div>

        {habits.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: "4px 0 12px", textAlign: "center", fontStyle: "normal" }}>Add at least one daily habit above.</p>
        )}

        {habits.map((h, i) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.amberLight, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.amberBorder}` }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button onClick={() => i > 0 && setHabits(hs => { const n=[...hs]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; })} style={{ ...iconBtn, fontSize: 10, padding: 2 }}>▲</button>
              <button onClick={() => i < habits.length-1 && setHabits(hs => { const n=[...hs]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; })} style={{ ...iconBtn, fontSize: 10, padding: 2 }}>▼</button>
            </div>
            {editId === h.id ? (
              <>
                <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") { setHabits(hs => hs.map(x => x.id === h.id ? {...x, name: editVal} : x)); setEditId(null); }}} style={{ ...inputSt, margin: 0, flex: 1, padding: "6px 10px", fontSize: 13 }} />
                <button onClick={() => { setHabits(hs => hs.map(x => x.id === h.id ? {...x, name: editVal} : x)); setEditId(null); }} style={{ ...iconBtn, color: C.green }}>✓</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, color: C.textMid, fontWeight: 500, fontStyle: "normal" }}>{h.name}</span>
                <button onClick={() => { setEditId(h.id); setEditVal(h.name); }} style={{ ...iconBtn }}>✎</button>
                <button onClick={() => setHabits(hs => hs.filter(x => x.id !== h.id))} style={{ ...iconBtn, color: C.red }}>✕</button>
              </>
            )}
          </div>
        ))}

        <FormLabel style={{ marginTop: 20 }}>Daily Completion Requirement</FormLabel>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: C.textMuted, lineHeight: 1.5, fontStyle: "normal" }}>
          How many habits must be completed for the day to count toward your streak?
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[{ k: "100", l: "100%" }, { k: "75", l: "75%" }, { k: "50", l: "50%" }, { k: "custom", l: "Custom" }].map(({ k, l }) => (
            <button key={k} onClick={() => setCompReqKey(k)} style={{
              padding: "8px 16px", borderRadius: 99, border: `2px solid ${compReqKey === k ? C.amber : C.borderMid}`,
              background: compReqKey === k ? C.amberLight : "transparent",
              color: compReqKey === k ? C.amberDeep : C.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: font, transition: "all 0.15s", fontStyle: "normal",
            }}>{l}</button>
          ))}
        </div>
        {compReqKey === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input type="number" min={1} max={100} value={customCompReq} onChange={e => setCustomCompReq(e.target.value)} placeholder="e.g. 80" style={{ ...inputSt, margin: 0, flex: 1 }} />
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 700 }}>%</span>
          </div>
        )}
        {compReq < 100 && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.green, fontWeight: 600, fontStyle: "normal" }}>
            Flexible mode — complete {Math.max(1, Math.ceil((habits.length || 1) * compReq / 100))} of {habits.length || "?"} habits per day.
          </p>
        )}

        <button onClick={handleSave} style={{ ...solidBtn, width: "100%", padding: "16px", marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: 800 }}>
          {initial ? "Save Changes" : `Start ${dur}-Day Challenge`}
        </button>
      </div>
    </Sheet>
  );
}

function FormLabel({ children, style }) {
  return <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, marginTop: 16, fontStyle: "normal", ...style }}>{children}</label>;
}

/* ─────────────────────────────────────────────
   TODAY SCREEN (Primary Dashboard)
───────────────────────────────────────────── */
function TodayScreen({ challenges, allRecords, onComplete, onSkip, onCreateChallenge, onShowTemplates }) {
  const td = todayStr();
  const activeChallenges = challenges.filter(c => {
    const end = addDays(c.startDate, c.duration - 1);
    return td >= c.startDate && td <= end;
  });

  const [checks, setChecks] = useState(() => {
    const init = {};
    activeChallenges.forEach(c => {
      init[c.id] = Object.fromEntries(c.habits.map(h => [h, false]));
    });
    return init;
  });

  const [skipId, setSkipId] = useState(null);

  useEffect(() => {
    setChecks(prev => {
      const next = {};
      activeChallenges.forEach(c => {
        next[c.id] = prev[c.id] || Object.fromEntries(c.habits.map(h => [h, false]));
      });
      return next;
    });
  }, [challenges.length]);

  const toggle = (cid, habit) => {
    setChecks(prev => ({ ...prev, [cid]: { ...prev[cid], [habit]: !prev[cid]?.[habit] } }));
  };

  const quote = QUOTES[new Date().getDay() % QUOTES.length];
  const statsG = globalStats(challenges, allRecords);

  // REDESIGNED POLISHED EMPTY STATE (Requirement 8)
  if (activeChallenges.length === 0) {
    return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 0 60px" }}>
        <div style={{
          background: C.card, borderRadius: 28, border: `1.5px solid ${C.border}`,
          padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 99, background: C.amberLight,
            border: `2px solid ${C.amberBorder}`, margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
          }}>
            🎯
          </div>

          <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 800, color: C.text, fontStyle: "normal" }}>
            Start Your First Challenge
          </h2>
          <p style={{ margin: "0 auto 32px", color: C.textMuted, fontSize: 16, maxWidth: 440, lineHeight: 1.6, fontStyle: "normal" }}>
            Build daily consistency with a time-boxed habit challenge. Create your own or choose a pre-made template.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onCreateChallenge} style={{ ...solidBtn, padding: "14px 28px", fontSize: 15, fontWeight: 800 }}>
              + Create a Challenge
            </button>
            <button onClick={onShowTemplates} style={{ ...ghostBtn, padding: "14px 24px", fontSize: 15, fontWeight: 700 }}>
              Browse Templates
            </button>
          </div>
        </div>

        {/* TEMPLATE QUICK STARTERS */}
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, fontStyle: "normal" }}>Popular Challenge Templates</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {TEMPLATES.slice(0, 3).map((t, idx) => (
              <div key={idx} onClick={onShowTemplates} style={{
                background: C.card, borderRadius: 20, border: `1.5px solid ${C.border}`,
                padding: "20px", cursor: "pointer", transition: "all 0.2s ease",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.amber}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Pill>{t.duration} Days</Pill>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.amberDark }}>{t.habits.length} habits</span>
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{t.name}</h4>
                <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.5, fontStyle: "normal" }}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-today-layout" style={{ paddingBottom: 60 }}>
      {/* LEFT MAIN COLUMN: Active Challenges */}
      <div>
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontStyle: "normal" }}>
            {fmtDateFull(td)}
          </p>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 900, color: C.text, fontStyle: "normal" }}>Today's Check-In</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "normal" }}>"{quote}"</p>
        </div>

        {activeChallenges.map(c => {
          const rec = (allRecords[c.id] || {})[td];
          const isDone = rec === "completed";
          const isSkipped = rec === "skipped";
          const stats = calcStats(c, allRecords[c.id] || {});
          const habitChecks = checks[c.id] || {};
          const checkedCount = c.habits.filter(h => habitChecks[h]).length;
          const reqPct = c.completionReq || 100;
          const threshold = Math.max(1, Math.ceil(c.habits.length * reqPct / 100));
          const canComplete = checkedCount >= threshold;

          return (
            <div key={c.id} style={{
              margin: "0 0 24px",
              background: C.card,
              borderRadius: 24,
              border: `1.5px solid ${isDone ? C.greenBorder : isSkipped ? C.borderMid : C.amberBorder}`,
              overflow: "hidden",
              boxShadow: isDone ? "0 2px 20px rgba(5,150,105,0.08)" : "0 2px 20px rgba(232,111,53,0.06)",
            }}>
              {/* Card Header */}
              <div style={{
                padding: "20px 24px",
                background: isDone ? C.greenLight : isSkipped ? "#F9FAFB" : C.amberLight,
                borderBottom: `1px solid ${isDone ? C.greenBorder : isSkipped ? C.borderMid : C.amberBorder}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{c.name}</h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill>Day {stats.todayDayNum} of {stats.totalDays}</Pill>
                      {stats.currentStreak > 0 && <Pill color={C.amberDark} bg="#FFE0BD" border={C.amberBorder}>🔥 {stats.currentStreak} day streak</Pill>}
                    </div>
                  </div>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Ring pct={stats.pct} size={54} stroke={5} color={isDone ? C.green : C.amber} />
                    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: isDone ? C.green : C.amberDeep, fontStyle: "normal" }}>
                      {stats.pct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "20px 24px" }}>
                {isDone ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                    <p style={{ margin: 0, fontWeight: 800, color: C.green, fontSize: 16, fontStyle: "normal" }}>Day completed! Great job showing up.</p>
                  </div>
                ) : isSkipped ? (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>⏭️</div>
                    <p style={{ margin: 0, fontWeight: 700, color: C.textMuted, fontSize: 16, fontStyle: "normal" }}>Skipped today. Tomorrow is a new chance.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      {c.habits.map((h, i) => {
                        const checked = !!habitChecks[h];
                        return (
                          <button key={i} onClick={() => toggle(c.id, h)} style={{
                            display: "flex", alignItems: "center", gap: 14, width: "100%",
                            background: "none", border: "none", cursor: "pointer", padding: "12px 0",
                            borderBottom: i < c.habits.length - 1 ? `1px solid ${C.border}` : "none",
                            textAlign: "left", fontFamily: font,
                          }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                              border: `2px solid ${checked ? C.amber : C.borderMid}`,
                              background: checked ? C.amber : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.18s ease",
                            }}>
                              {checked && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                            <span style={{
                              fontSize: 15, color: checked ? C.textMuted : C.text,
                              textDecoration: checked ? "line-through" : "none",
                              fontWeight: checked ? 400 : 600, fontStyle: "normal",
                            }}>{h}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => onComplete(c.id, habitChecks)}
                      disabled={!canComplete}
                      style={{
                        ...solidBtn, width: "100%", padding: "16px",
                        fontSize: 16, fontWeight: 800,
                        opacity: canComplete ? 1 : 0.5,
                        cursor: canComplete ? "pointer" : "not-allowed",
                        marginBottom: 10,
                        background: canComplete ? C.amber : C.borderMid,
                        color: canComplete ? "#ffffff" : C.textMuted,
                      }}
                    >
                      {canComplete ? "✓ Complete Today" : `${threshold - checkedCount} more habit${threshold - checkedCount !== 1 ? "s" : ""} needed`}
                    </button>

                    <button onClick={() => setSkipId(c.id)} style={{ ...ghostBtn, width: "100%", fontSize: 14 }}>
                      Skip Today
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* RIGHT SIDEBAR COLUMN: Overview & Quick Stats */}
      <div>
        <div style={{
          background: C.card, borderRadius: 24, border: `1.5px solid ${C.border}`,
          padding: "24px", position: "sticky", top: 90,
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: C.text, fontStyle: "normal" }}>Daily Momentum</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: C.amberLight, borderRadius: 16, padding: "16px", border: `1px solid ${C.amberBorder}`, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.amberDark, fontStyle: "normal" }}>🔥 {statsG.bestStreak}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDeep, marginTop: 2, fontStyle: "normal" }}>Best Streak</div>
            </div>
            <div style={{ background: C.greenLight, borderRadius: 16, padding: "16px", border: `1px solid ${C.greenBorder}`, textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.green, fontStyle: "normal" }}>🎯 {statsG.totalCompleted}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginTop: 2, fontStyle: "normal" }}>Days Done</div>
            </div>
          </div>

          <div style={{ background: C.bg, borderRadius: 16, padding: "16px", border: `1px solid ${C.borderMid}`, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontStyle: "normal" }}>Quick Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={onCreateChallenge} style={{ ...solidBtn, width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>+ New Challenge</button>
              <button onClick={onShowTemplates} style={{ ...ghostBtn, width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>Browse Templates</button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 1.5, fontStyle: "normal" }}>
            StreakUp tracks habits locally in your browser. Consistent steps lead to lasting momentum.
          </div>
        </div>
      </div>

      {skipId && (
        <ConfirmDialog
          title="Skip today?"
          message="Skipping will maintain your streak history without marking today as completed. Are you sure?"
          confirmLabel="Skip Today"
          confirmColor={C.textMid}
          onConfirm={() => { onSkip(skipId); setSkipId(null); }}
          onCancel={() => setSkipId(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHALLENGES LIST SCREEN
───────────────────────────────────────────── */
function ChallengesScreen({ challenges, allRecords, onSelect, onEdit, onDuplicate, onDelete, onCreate, onShowTemplates }) {
  const td = todayStr();
  const [menuId, setMenuId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  if (challenges.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 0 60px", textAlign: "center" }}>
        <div style={{
          background: C.card, borderRadius: 28, border: `1.5px solid ${C.border}`,
          padding: "48px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: C.text, fontStyle: "normal" }}>No Challenges Yet</h2>
          <p style={{ margin: "0 auto 24px", color: C.textMuted, fontSize: 15, maxWidth: 360, lineHeight: 1.6, fontStyle: "normal" }}>
            Create your first habit challenge to start tracking daily consistency.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={onCreate} style={{ ...solidBtn, padding: "14px 28px" }}>+ Create Challenge</button>
            <button onClick={onShowTemplates} style={{ ...ghostBtn, padding: "14px 24px" }}>Browse Templates</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 60 }} onClick={() => menuId && setMenuId(null)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: C.text, fontStyle: "normal" }}>My Challenges</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "normal" }}>{challenges.length} challenge{challenges.length !== 1 ? "s" : ""} active & tracked</p>
        </div>
        <button onClick={onCreate} style={{ ...solidBtn, padding: "10px 20px" }}>+ New Challenge</button>
      </div>

      <div className="tracker-grid-cards">
        {challenges.map(c => {
          const stats = calcStats(c, allRecords[c.id] || {});
          const status = stats.isFinished ? "finished" : stats.isActive ? "active" : "upcoming";
          const statusColor = { active: C.green, finished: C.textMuted, upcoming: C.blue }[status];
          const statusLabel = { active: "Active", finished: "Finished", upcoming: "Upcoming" }[status];
          const todayRec = (allRecords[c.id] || {})[td];

          return (
            <div key={c.id} onClick={() => onSelect(c)} style={{
              background: C.card, borderRadius: 20, border: `1.5px solid ${C.border}`,
              cursor: "pointer", overflow: "visible", position: "relative",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = ""; }}
            >
              <div style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, textTransform: "uppercase", letterSpacing: "0.06em", fontStyle: "normal" }}>{statusLabel}</span>
                      {status === "active" && todayRec === "completed" && <span style={{ fontSize: 11, fontWeight: 700, color: C.green, fontStyle: "normal" }}>✓ Done today</span>}
                      {status === "active" && todayRec === "skipped" && <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, fontStyle: "normal" }}>⏭ Skipped</span>}
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "normal" }}>{c.name}</h3>
                    <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontStyle: "normal" }}>{fmtDate(c.startDate)} → {fmtDate(stats.end)} · {c.habits.length} habits</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <Ring pct={stats.pct} size={48} stroke={5} color={stats.isFinished ? C.textMuted : C.amber} />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.amberDeep, fontStyle: "normal" }}>{stats.pct}%</span>
                    </div>

                    <button onClick={e => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                      style={{ ...iconBtn, width: 32, height: 32, borderRadius: 10, background: menuId === c.id ? C.amberMid : "transparent" }}>
                      ⋯
                    </button>

                    {menuId === c.id && (
                      <div onClick={e => e.stopPropagation()} style={{
                        position: "absolute", top: 10, right: 10, background: C.card, borderRadius: 16,
                        border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                        zIndex: 50, minWidth: 160, overflow: "hidden",
                      }}>
                        {[
                          { label: "✎ Edit", action: () => { setMenuId(null); onEdit(c); } },
                          { label: "⧉ Duplicate", action: () => { setMenuId(null); onDuplicate(c); } },
                          { label: "✕ Delete", action: () => { setMenuId(null); setDeleteId(c.id); }, danger: true },
                        ].map(({ label, action, danger }) => (
                          <button key={label} onClick={action} style={{
                            display: "block", width: "100%", padding: "12px 16px", background: "none",
                            border: "none", textAlign: "left", fontSize: 14, fontWeight: 600,
                            color: danger ? C.red : C.text, cursor: "pointer", fontFamily: font, fontStyle: "normal",
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = danger ? C.redLight : C.bg}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                          >{label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: C.textMuted, fontWeight: 600, fontStyle: "normal" }}>
                    <span>{stats.completedDays} / {stats.totalDays} days done</span>
                    {stats.currentStreak > 0 && <span>🔥 {stats.currentStreak} day streak</span>}
                  </div>
                  <ProgressBar pct={stats.pct} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete challenge?"
          message="This will permanently delete the challenge and all its history. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHALLENGE DETAIL SCREEN
───────────────────────────────────────────── */
function DetailScreen({ challenge, records, habitRecords, onBack, onEdit, onDuplicate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const td = todayStr();
  const stats = calcStats(challenge, records);
  const habitStats = calcHabitStats(challenge, records, habitRecords);
  const reqPct = challenge.completionReq || 100;

  const start = challenge.startDate;
  const end = stats.end;

  return (
    <div style={{ paddingBottom: 60 }} onClick={() => showMenu && setShowMenu(false)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...ghostBtn, gap: 6, padding: "8px 16px", fontSize: 13 }}>← Back to Challenges</button>
        <div style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }} style={{ ...iconBtn, width: 36, height: 36, borderRadius: 12, background: showMenu ? C.amberMid : "transparent" }}>⋯</button>
          {showMenu && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 40, right: 0, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 50, minWidth: 160, overflow: "hidden" }}>
              {[
                { label: "✎ Edit", action: () => { setShowMenu(false); onEdit(); } },
                { label: "⧉ Duplicate", action: () => { setShowMenu(false); onDuplicate(); } },
                { label: "✕ Delete", action: () => { setShowMenu(false); setConfirmDelete(true); }, danger: true },
              ].map(({ label, action, danger }) => (
                <button key={label} onClick={action} style={{ display: "block", width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 14, fontWeight: 600, color: danger ? C.red : C.text, cursor: "pointer", fontFamily: font, fontStyle: "normal" }}
                  onMouseEnter={e => e.currentTarget.style.background = danger ? C.redLight : C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div style={{ background: C.amberLight, borderRadius: 24, border: `1.5px solid ${C.amberBorder}`, padding: "24px", marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: C.text, fontStyle: "normal" }}>{challenge.name}</h1>
        {challenge.description && <p style={{ margin: "0 0 14px", fontSize: 15, color: C.textMid, lineHeight: 1.5, fontStyle: "normal" }}>{challenge.description}</p>}
        
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Pill>{fmtDate(challenge.startDate)} → {fmtDate(end)}</Pill>
          <Pill color={C.amberDark}>{challenge.duration} Days</Pill>
          {reqPct < 100 && <Pill color={C.green} bg={C.greenLight} border={C.greenBorder}>Flexible Mode ({reqPct}%)</Pill>}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, fontWeight: 700, color: C.amberDeep, fontStyle: "normal" }}>
            <span>Progress Overview</span>
            <span>{stats.completedDays} / {stats.totalDays} Days ({stats.pct}%)</span>
          </div>
          <ProgressBar pct={stats.pct} height={8} />
        </div>
      </div>

      {/* Habits Breakdown */}
      <div style={{ background: C.card, borderRadius: 24, border: `1.5px solid ${C.border}`, padding: "24px", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: C.text, fontStyle: "normal" }}>Daily Habits</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {challenge.habits.map((h, i) => {
            const count = habitStats.perHabit[h] || 0;
            const pct = habitStats.pastDays > 0 ? Math.round((count / habitStats.pastDays) * 100) : 0;
            return (
              <div key={i} style={{ background: C.bg, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.borderMid}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4, fontStyle: "normal" }}>{h}</div>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, fontStyle: "normal" }}>Completed {count} times ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete challenge?"
          message="This action cannot be undone. All completion history for this challenge will be deleted."
          confirmLabel="Delete Challenge"
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATS SCREEN
───────────────────────────────────────────── */
function StatsScreen({ challenges, allRecords }) {
  const statsG = globalStats(challenges, allRecords);

  const unlockedBadges = BADGES.filter(b => b.check({ totalCompleted: statsG.totalCompleted, bestStreak: statsG.bestStreak }));

  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: C.text, fontStyle: "normal" }}>Statistics & Badges</h1>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "normal" }}>Track your lifetime consistency and earned achievements</p>
      </div>

      {/* KPI Cards */}
      <div className="tracker-stats-kpi-grid">
        <div style={{ background: C.card, borderRadius: 20, padding: "20px", border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amberDark, fontStyle: "normal" }}>🎯 {statsG.totalCompleted}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 4, fontStyle: "normal" }}>Total Days Completed</div>
        </div>
        <div style={{ background: C.card, borderRadius: 20, padding: "20px", border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amberDark, fontStyle: "normal" }}>🔥 {statsG.bestStreak}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 4, fontStyle: "normal" }}>Best Streak Record</div>
        </div>
        <div style={{ background: C.card, borderRadius: 20, padding: "20px", border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amberDark, fontStyle: "normal" }}>🏆 {unlockedBadges.length} / {BADGES.length}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 4, fontStyle: "normal" }}>Badges Earned</div>
        </div>
        <div style={{ background: C.card, borderRadius: 20, padding: "20px", border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amberDark, fontStyle: "normal" }}>⚡ {challenges.length}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginTop: 4, fontStyle: "normal" }}>Total Challenges</div>
        </div>
      </div>

      {/* Badges Grid */}
      <div style={{ background: C.card, borderRadius: 24, border: `1.5px solid ${C.border}`, padding: "24px", marginBottom: 28 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: C.text, fontStyle: "normal" }}>Achievements</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {BADGES.map(b => {
            const unlocked = b.check({ totalCompleted: statsG.totalCompleted, bestStreak: statsG.bestStreak });
            return (
              <div key={b.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                borderRadius: 16, background: unlocked ? C.amberLight : C.bg,
                border: `1px solid ${unlocked ? C.amberBorder : C.borderMid}`,
                opacity: unlocked ? 1 : 0.6,
              }}>
                <span style={{ fontSize: 32 }}>{b.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: unlocked ? C.amberDeep : C.textMuted, fontStyle: "normal" }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "normal" }}>{b.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FORMATTED NOTE TEXT WITH CLICKABLE URL LINKS
───────────────────────────────────────────── */
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function FormattedNoteText({ text }) {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const elements = [];
    let lastIndex = 0;
    let match;
    URL_REGEX.lastIndex = 0;

    while ((match = URL_REGEX.exec(line)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        elements.push(line.substring(lastIndex, matchIndex));
      }

      let cleanText = matchText;
      let trailingPunct = "";
      const punctMatch = cleanText.match(/[.,;!?)]+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        cleanText = cleanText.slice(0, -trailingPunct.length);
      }

      let href = cleanText;
      if (cleanText.toLowerCase().startsWith("www.")) {
        href = "http://" + cleanText;
      }

      elements.push(
        <a
          key={`link-${lineIdx}-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color: "#be4f20",
            textDecoration: "underline",
            fontWeight: 700,
            wordBreak: "break-word"
          }}
        >
          {cleanText}
        </a>
      );

      if (trailingPunct) {
        elements.push(trailingPunct);
      }

      lastIndex = matchIndex + matchText.length;
    }

    if (lastIndex < line.length) {
      elements.push(line.substring(lastIndex));
    }

    return (
      <span key={`line-${lineIdx}`}>
        {elements}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

/* ─────────────────────────────────────────────
   NOTES SCREEN
───────────────────────────────────────────── */
function NotesScreen({ notes, challenges = [], onNew, onEdit, onDelete, onDuplicate }) {
  const [deleteId, setDeleteId] = useState(null);
  const [filterChallengeId, setFilterChallengeId] = useState("all");

  const filteredNotes = notes.filter(n => {
    if (filterChallengeId === "all") return true;
    if (filterChallengeId === "unlinked") return !n.challengeId;
    return n.challengeId === filterChallengeId;
  });

  if (notes.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 0 60px", textAlign: "center" }}>
        <div style={{
          background: C.card, borderRadius: 28, border: `1.5px solid ${C.border}`,
          padding: "48px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: C.text, fontStyle: "normal" }}>No Notes Saved</h2>
          <p style={{ margin: "0 auto 24px", color: C.textMuted, fontSize: 15, maxWidth: 360, lineHeight: 1.6, fontStyle: "normal" }}>
            Keep track of daily reflections, habit ideas, and link notes directly to your active challenges.
          </p>
          <button onClick={() => onNew()} style={{ ...solidBtn, padding: "14px 28px" }}>+ Create First Note</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: C.text, fontStyle: "normal" }}>Reflections & Notes</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "normal" }}>{notes.length} note{notes.length !== 1 ? "s" : ""} saved · Linked to active challenges</p>
        </div>
        <button onClick={() => onNew()} style={{ ...solidBtn, padding: "10px 20px" }}>+ New Note</button>
      </div>

      {/* FILTER BAR FOR LINKED CHALLENGES */}
      {challenges.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 12 }}>
          <button
            onClick={() => setFilterChallengeId("all")}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
              background: filterChallengeId === "all" ? C.amber : C.bg,
              color: filterChallengeId === "all" ? "#fff" : C.textMid,
              border: `1px solid ${filterChallengeId === "all" ? C.amber : C.borderMid}`,
              cursor: "pointer", fontStyle: "normal"
            }}
          >
            All Notes ({notes.length})
          </button>
          {challenges.map(c => {
            const count = notes.filter(n => n.challengeId === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilterChallengeId(c.id)}
                style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
                  background: filterChallengeId === c.id ? C.amber : C.bg,
                  color: filterChallengeId === c.id ? "#fff" : C.textMid,
                  border: `1px solid ${filterChallengeId === c.id ? C.amber : C.borderMid}`,
                  cursor: "pointer", fontStyle: "normal", whiteSpace: "nowrap"
                }}
              >
                🎯 {c.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="tracker-notes-grid">
        {filteredNotes.map(n => {
          const linkedC = challenges.find(c => c.id === n.challengeId);
          return (
            <div key={n.id} onClick={() => onEdit(n)} style={{
              background: C.card, borderRadius: 20, border: `1.5px solid ${C.border}`,
              padding: "20px", cursor: "pointer", transition: "all 0.2s ease",
              display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 190,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = ""; }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{n.title || "Untitled Note"}</h3>
                  <button onClick={e => { e.stopPropagation(); onDuplicate(n); }} style={{ ...iconBtn, fontSize: 14 }} title="Duplicate">⧉</button>
                </div>

                {linkedC && (
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: C.amberDark, background: C.amberPale,
                    borderRadius: 8, padding: "4px 8px", width: "fit-content", marginBottom: 10,
                    display: "inline-flex", alignItems: "center", gap: 5, fontStyle: "normal"
                  }}>
                    <span>🎯</span> {linkedC.name}
                  </div>
                )}

                <p style={{ margin: "0 0 16px", fontSize: 14, color: C.textMid, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", fontStyle: "normal", wordBreak: "break-word" }}>
                  <FormattedNoteText text={n.content} />
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, fontStyle: "normal" }}>{fmtDate(n.updatedAt ? n.updatedAt.split("T")[0] : todayStr())}</span>
                <button onClick={e => { e.stopPropagation(); setDeleteId(n.id); }} style={{ ...iconBtn, color: C.red, fontSize: 14 }} title="Delete">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Delete note?"
          message="This note will be permanently removed. Are you sure?"
          confirmLabel="Delete"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function NoteEditor({ note, initialChallengeId, challenges = [], onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [challengeId, setChallengeId] = useState(note?.challengeId || initialChallengeId || "");

  const handleSave = () => {
    onSave({
      id: note?.id || uid(),
      title,
      content,
      challengeId: challengeId || null,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <Sheet onClose={onClose} maxHeight="85vh">
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{note ? "Edit Note" : "New Note"}</h2>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title..." style={{ ...inputSt, fontSize: 18, fontWeight: 800, marginBottom: 14 }} />

        {/* LINK TO CHALLENGE SELECTOR */}
        {challenges.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.amberDark, marginBottom: 6, fontStyle: "normal" }}>
              🔗 LINK TO A CHALLENGE (OPTIONAL)
            </label>
            <select
              value={challengeId}
              onChange={e => setChallengeId(e.target.value)}
              style={{ ...inputSt, cursor: "pointer", background: "#ffffff", fontWeight: 700 }}
            >
              <option value="">-- No linked challenge --</option>
              {challenges.map(c => (
                <option key={c.id} value={c.id}>
                  🎯 {c.name} ({c.duration} Days)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CLICKABLE LINK PREVIEW SECTION */}
        {content && content.match(URL_REGEX) && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: C.textMuted, marginBottom: 6, fontStyle: "normal", letterSpacing: "0.05em" }}>
              🔗 CLICKABLE LINKS PREVIEW
            </label>
            <div style={{
              background: C.bg, borderRadius: 14, border: `1.5px solid ${C.borderMid}`,
              padding: "12px 14px", fontSize: 14, color: C.text, lineHeight: 1.6,
              wordBreak: "break-word", maxHeight: 120, overflowY: "auto"
            }}>
              <FormattedNoteText text={content} />
            </div>
          </div>
        )}

        <textarea value={content} onChange={e => setContent(e.target.value)} rows={7} placeholder="Write your reflection or paste URLs..." style={{ ...inputSt, resize: "vertical", marginBottom: 20 }} />

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={handleSave} style={{ ...solidBtn, flex: 1 }}>Save Note</button>
        </div>
      </div>
    </Sheet>
  );
}

function TemplatesScreen({ onUse }) {
  return (
    <div style={{ padding: "20px 24px 32px" }}>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: C.textMuted, fontStyle: "normal" }}>Choose a pre-built challenge template to quickly start tracking.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {TEMPLATES.map((t, idx) => (
          <div key={idx} style={{ background: C.bg, borderRadius: 18, padding: "18px", border: `1px solid ${C.borderMid}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Pill>{t.duration} Days</Pill>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amberDark, fontStyle: "normal" }}>{t.habits.length} habits</span>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: C.text, fontStyle: "normal" }}>{t.name}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textMuted, lineHeight: 1.5, fontStyle: "normal" }}>{t.description}</p>
            <button onClick={() => onUse(t)} style={{ ...solidBtn, width: "100%", padding: "10px", fontSize: 13, fontWeight: 700 }}>Use Template</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SHARED BUTTON STYLES
───────────────────────────────────────────── */
const solidBtn = {
  background: C.amber, color: "#ffffff", border: "none", borderRadius: 14, padding: "12px 20px",
  fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.18s ease",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontStyle: "normal",
};
const ghostBtn = {
  background: "transparent", color: C.textMid, border: `1.5px solid ${C.borderMid}`,
  borderRadius: 14, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  fontFamily: font, transition: "all 0.18s ease", display: "inline-flex", alignItems: "center",
  justifyContent: "center", fontStyle: "normal",
};
const iconBtn = {
  background: "transparent", border: "none", cursor: "pointer", color: C.textMuted,
  fontSize: 16, padding: 6, borderRadius: 8, display: "flex", alignItems: "center",
  justifyContent: "center", fontFamily: font, transition: "background 0.15s", fontStyle: "normal",
};
const inputSt = {
  width: "100%", padding: "13px 14px", borderRadius: 13, border: `1.5px solid ${C.borderMid}`,
  fontSize: 15, color: C.text, background: "#ffffff", fontFamily: font, outline: "none",
  boxSizing: "border-box", marginBottom: 0, transition: "border-color 0.15s", fontStyle: "normal",
};

/* ─────────────────────────────────────────────
   ROOT APP CONTAINER
───────────────────────────────────────────── */
export default function StreakUp({ onReturnToLanding }) {
  const [challenges, setChallenges] = useState(() => LS.get("su2_challenges", []));
  const [allRecords, setAllRecords] = useState(() => LS.get("su2_records", {}));
  const [allHabitRecords, setAllHabitRecords] = useState(() => LS.get("su2_habit_records", {}));

  const [notes, setNotes] = useState(() => LS.get("su2_notes", []));
  const [editingNote, setEditingNote] = useState(null);

  const [tab, setTab] = useState("today");
  const [detailId, setDetailId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editChallenge, setEditChallenge] = useState(null);
  const [templateSeed, setTemplateSeed] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { LS.set("su2_challenges", challenges); }, [challenges]);
  useEffect(() => { LS.set("su2_records", allRecords); }, [allRecords]);
  useEffect(() => { LS.set("su2_habit_records", allHabitRecords); }, [allHabitRecords]);
  useEffect(() => { LS.set("su2_notes", notes); }, [notes]);

  useEffect(() => {
    setNotes(ns => {
      const seen = new Set();
      return ns.filter(n => {
        const key = `${n.title}|||${n.content}|||${n.createdAt}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }, []);

  const openNewNote = useCallback(() => setEditingNote("__new__"), []);
  const openEditNote = useCallback((note) => setEditingNote(note), []);

  const saveNote = useCallback((data) => {
    if (!data.title.trim() && !data.content.trim()) return;
    const now = new Date().toISOString();
    setNotes(ns => {
      const idx = ns.findIndex(n => n.id === data.id);
      if (idx >= 0) {
        const updated = [...ns];
        updated[idx] = { ...updated[idx], ...data, updatedAt: now };
        return updated;
      }
      return [{ createdAt: now, ...data, updatedAt: now }, ...ns];
    });
  }, []);

  const deleteNote = useCallback((id) => {
    setNotes(ns => ns.filter(n => n.id !== id));
  }, []);

  const duplicateNote = useCallback((note) => {
    const now = new Date().toISOString();
    setNotes(ns => [{ ...note, id: uid(), title: note.title + " (Copy)", createdAt: now, updatedAt: now }, ...ns]);
  }, []);

  const saveChallenge = useCallback((data) => {
    if (editChallenge) {
      setChallenges(cs => cs.map(c => c.id === editChallenge.id ? { ...editChallenge, ...data } : c));
    } else {
      setChallenges(cs => [...cs, { id: uid(), ...data }]);
    }
    setShowForm(false);
    setEditChallenge(null);
    setTemplateSeed(null);
  }, [editChallenge]);

  const deleteChallenge = useCallback((id) => {
    setChallenges(cs => cs.filter(c => c.id !== id));
    setAllRecords(r => { const n = { ...r }; delete n[id]; return n; });
    setDetailId(null);
  }, []);

  const duplicateChallenge = useCallback((c) => {
    const newC = { ...c, id: uid(), name: c.name + " (copy)", startDate: todayStr() };
    setChallenges(cs => [...cs, newC]);
  }, []);

  const completeDay = useCallback((challengeId, habitChecks) => {
    const td = todayStr();
    setAllRecords(prev => ({
      ...prev,
      [challengeId]: { ...(prev[challengeId] || {}), [td]: "completed" },
    }));
    if (habitChecks) {
      setAllHabitRecords(prev => ({
        ...prev,
        [challengeId]: { ...(prev[challengeId] || {}), [td]: habitChecks },
      }));
    }
  }, []);

  const skipDay = useCallback((challengeId) => {
    const td = todayStr();
    setAllRecords(prev => ({
      ...prev,
      [challengeId]: { ...(prev[challengeId] || {}), [td]: "skipped" },
    }));
  }, []);

  const openEdit = (c) => { setEditChallenge(c); setTemplateSeed(null); setShowForm(true); };
  const openCreate = () => { setEditChallenge(null); setTemplateSeed(null); setShowForm(true); };

  const detailChallenge = challenges.find(c => c.id === detailId);

  const navTabs = [
    { id: "today", label: "Today", emoji: "☀️" },
    { id: "challenges", label: "Challenges", emoji: "🎯" },
    { id: "stats", label: "Stats", emoji: "📊" },
    { id: "notes", label: "Notes", emoji: "📝" },
  ];

  const td = todayStr();
  const pendingToday = challenges.filter(c => {
    const end = addDays(c.startDate, c.duration - 1);
    if (td < c.startDate || td > end) return false;
    return !(allRecords[c.id] || {})[td];
  }).length;

  return (
    <div className="tracker-app-shell">
      {/* HEADER BAR (FULL VIEWPORT WIDTH) */}
      <header className="tracker-header">
        <div className="tracker-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              onClick={onReturnToLanding}
              style={{ cursor: onReturnToLanding ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 8 }}
              title="Return to Landing Page"
              data-testid="brand-logo-return-landing"
            >
              {onReturnToLanding && (
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: "1.5px solid rgba(26, 60, 48, 0.16)",
                    color: C.amber,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 800,
                    transition: "all 0.15s ease",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                  }}
                  title="Return to Landing Page"
                >
                  ←
                </span>
              )}
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", color: C.amber, fontStyle: "normal" }}>
                StreakUp
              </span>
            </div>
          </div>

          {/* DESKTOP CENTER NAVIGATION TABS */}
          <nav className="tracker-desktop-nav" aria-label="Tracker Navigation">
            {navTabs.map(n => {
              const active = tab === n.id && !detailId;
              return (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); setDetailId(null); }}
                  className={`tracker-desktop-nav-tab${active ? " is-active" : ""}`}
                >
                  <span>{n.emoji}</span>
                  <span>{n.label}</span>
                  {n.id === "today" && pendingToday > 0 && (
                    <span style={{ background: C.red, color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>
                      {pendingToday}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* DESKTOP RIGHT ACTIONS */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {tab === "notes" ? (
              <button onClick={openNewNote} style={{ ...solidBtn, padding: "8px 16px", fontSize: 13, borderRadius: 12 }}>+ New Note</button>
            ) : (
              <>
                <button onClick={() => setShowTemplates(true)} style={{ ...ghostBtn, padding: "8px 14px", fontSize: 13, borderRadius: 12 }}>Templates</button>
                <button onClick={openCreate} style={{ ...solidBtn, padding: "8px 16px", fontSize: 13, borderRadius: 12 }}>+ New Challenge</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN DESKTOP / TABLET CONTENT CONTAINER */}
      <main className="tracker-main-container">
        {detailId && detailChallenge ? (
          <DetailScreen
            challenge={detailChallenge}
            records={allRecords[detailId] || {}}
            habitRecords={allHabitRecords[detailId] || {}}
            onBack={() => setDetailId(null)}
            onEdit={() => openEdit(detailChallenge)}
            onDuplicate={() => { duplicateChallenge(detailChallenge); setDetailId(null); }}
            onDelete={() => deleteChallenge(detailId)}
          />
        ) : tab === "today" ? (
          <TodayScreen
            challenges={challenges}
            allRecords={allRecords}
            onComplete={completeDay}
            onSkip={skipDay}
            onCreateChallenge={openCreate}
            onShowTemplates={() => setShowTemplates(true)}
          />
        ) : tab === "challenges" ? (
          <ChallengesScreen
            challenges={challenges}
            allRecords={allRecords}
            onSelect={c => setDetailId(c.id)}
            onEdit={openEdit}
            onDuplicate={duplicateChallenge}
            onDelete={deleteChallenge}
            onCreate={openCreate}
            onShowTemplates={() => setShowTemplates(true)}
          />
        ) : tab === "notes" ? (
          <NotesScreen
            notes={notes}
            challenges={challenges}
            onNew={openNewNote}
            onEdit={openEditNote}
            onDelete={deleteNote}
            onDuplicate={duplicateNote}
          />
        ) : (
          <StatsScreen challenges={challenges} allRecords={allRecords} />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION (Hidden on Desktop & Tablet) */}
      <div className="tracker-mobile-bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, width: "100%",
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)",
        borderTop: `1px solid ${C.border}`, zIndex: 100,
        padding: "8px 0 max(12px, env(safe-area-inset-bottom, 12px))",
        display: detailId ? "none" : "flex",
      }}>
        {navTabs.map(n => {
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => { setTab(n.id); setDetailId(null); }} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", cursor: "pointer", padding: "4px 0", position: "relative",
            }}>
              <span style={{ fontSize: 20, lineHeight: 1, filter: active ? "none" : "grayscale(80%) opacity(60%)" }}>{n.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? C.amber : C.textMuted, fontFamily: font, fontStyle: "normal" }}>{n.label}</span>
              {n.id === "today" && pendingToday > 0 && (
                <span style={{ position: "absolute", top: 0, right: "calc(50% - 18px)", background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 99, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>
                  {pendingToday}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MODALS */}
      {editingNote !== null && (
        <NoteEditor
          note={typeof editingNote === "object" ? editingNote : null}
          initialChallengeId={typeof editingNote === "string" && editingNote !== "__new__" ? editingNote : null}
          challenges={challenges}
          onSave={saveNote}
          onClose={() => setEditingNote(null)}
        />
      )}

      {showForm && (
        <ChallengeForm
          initial={editChallenge || (templateSeed ? { ...templateSeed, startDate: todayStr() } : null)}
          onSave={saveChallenge}
          onClose={() => { setShowForm(false); setEditChallenge(null); setTemplateSeed(null); }}
        />
      )}

      {showTemplates && (
        <Sheet onClose={() => setShowTemplates(false)} maxHeight="92vh">
          <div style={{ padding: "24px 24px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, fontStyle: "normal" }}>Challenge Templates</h2>
              <button onClick={() => setShowTemplates(false)} style={iconBtn}>✕</button>
            </div>
          </div>
          <TemplatesScreen onUse={t => { setTemplateSeed(t); setShowTemplates(false); setEditChallenge(null); setShowForm(true); }} />
        </Sheet>
      )}
    </div>
  );
}
