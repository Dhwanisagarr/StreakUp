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
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
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
   dayRecords: { [dateStr]: "completed" | "skipped" }
   Streak only counts "completed" days consecutively.
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
      // missed (past, no record)
      if (d < td) tempStreak = 0;
    }
  }

  // current streak: backwards from today
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
  challenges.forEach((c) => {
    const s = calcStats(c, allRecords[c.id] || {});
    totalCompleted += s.completedDays;
    bestStreak = Math.max(bestStreak, s.bestStreak);
  });
  return { totalCompleted, bestStreak };
}

function calcHabitStats(challenge, dayRecords, habitRecords) {
  const td = todayStr();
  const perHabit = {};
  let pastDays = 0;
  challenge.habits.forEach(h => { perHabit[h] = 0; });
  for (let i = 0; i < challenge.duration; i++) {
    const d = addDays(challenge.startDate, i);
    if (d > td) break;
    pastDays++;
    const hr = habitRecords[d];
    challenge.habits.forEach(h => {
      if (hr) { if (hr[h]) perHabit[h]++; }
      else if (dayRecords[d] === "completed") perHabit[h]++; // legacy: all-or-nothing days count all habits
    });
  }
  return { perHabit, pastDays };
}

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const C = {
  bg: "#FAFAF7",
  card: "#FFFFFF",
  amber: "#F59E0B",
  amberLight: "#FFFBEB",
  amberMid: "#FEF3C7",
  amberBorder: "#FDE68A",
  amberDark: "#D97706",
  amberDeep: "#92400E",
  text: "#111827",
  textMid: "#374151",
  textMuted: "#9CA3AF",
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

const font = "'DM Sans', 'Helvetica Neue', sans-serif";

/* ─────────────────────────────────────────────
   SMALL SHARED COMPONENTS
───────────────────────────────────────────── */
function Pill({ children, color = C.amber, bg = C.amberLight, border = C.amberBorder, style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, background: bg, border: `1px solid ${border}`, fontSize: 12, fontWeight: 600, color, ...style }}>
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
        background: C.card, borderRadius: 24, padding: "28px 24px", width: "90%", maxWidth: 360,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "popIn 0.2s ease",
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: C.text }}>{title}</h3>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button onClick={onConfirm} style={{ ...solidBtn, background: confirmColor, flex: 1 }}>{confirmLabel}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ─────────────────────────────────────────────
   OVERLAY WRAPPER
───────────────────────────────────────────── */
function Overlay({ children, onClick }) {
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

/* ─────────────────────────────────────────────
   BOTTOM SHEET WRAPPER
───────────────────────────────────────────── */
function Sheet({ children, onClose, maxHeight = "92vh" }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.5)", zIndex: 200,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: C.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 600,
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
   CHALLENGE FORM (create / edit)
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
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>{initial ? "Edit Challenge" : "New Challenge"}</h2>
          <button onClick={onClose} style={{ ...iconBtn }}>✕</button>
        </div>

        <FormLabel>Challenge name</FormLabel>
        <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 30-Day Fitness Journey"
          style={inputSt} />

        <FormLabel>Description <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span></FormLabel>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="What's the goal?"
          style={{ ...inputSt, resize: "vertical" }} />

        <FormLabel>Start date</FormLabel>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputSt} />

        <FormLabel>Duration</FormLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {["21", "30", "66", "90", "custom"].map(k => (
            <button key={k} onClick={() => setDurKey(k)} style={{
              padding: "8px 16px", borderRadius: 99, border: `2px solid ${durKey === k ? C.amber : C.borderMid}`,
              background: durKey === k ? C.amberLight : "transparent",
              color: durKey === k ? C.amberDeep : C.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: font,
              transition: "all 0.15s",
            }}>{k === "custom" ? "Custom" : `${k}d`}</button>
          ))}
        </div>
        {durKey === "custom" && (
          <input type="number" min={1} max={365} value={customDur} onChange={e => setCustomDur(e.target.value)}
            placeholder="Number of days" style={{ ...inputSt, marginBottom: 4 }} />
        )}

        <FormLabel style={{ marginTop: 20 }}>Daily habits</FormLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newHabit} onChange={e => setNewHabit(e.target.value)} placeholder="e.g. Read 10 pages"
            onKeyDown={e => e.key === "Enter" && addHabit()} style={{ ...inputSt, margin: 0, flex: 1 }} />
          <button onClick={addHabit} style={{ ...solidBtn, padding: "0 18px", flexShrink: 0 }}>Add</button>
        </div>

        {habits.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: "4px 0 12px", textAlign: "center" }}>No habits yet — add at least one above.</p>
        )}

        {habits.map((h, i) => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.amberLight, borderRadius: 12, marginBottom: 8, border: `1px solid ${C.amberBorder}` }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <button onClick={() => i > 0 && setHabits(hs => { const n=[...hs]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; })} style={{ ...iconBtn, fontSize: 10, padding: 2 }}>▲</button>
              <button onClick={() => i < habits.length-1 && setHabits(hs => { const n=[...hs]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; })} style={{ ...iconBtn, fontSize: 10, padding: 2 }}>▼</button>
            </div>
            {editId === h.id ? (
              <>
                <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === "Enter") { setHabits(hs => hs.map(x => x.id === h.id ? {...x, name: editVal} : x)); setEditId(null); }}}
                  style={{ ...inputSt, margin: 0, flex: 1, padding: "6px 10px", fontSize: 13 }} />
                <button onClick={() => { setHabits(hs => hs.map(x => x.id === h.id ? {...x, name: editVal} : x)); setEditId(null); }}
                  style={{ ...iconBtn, color: C.green }}>✓</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, color: C.textMid }}>{h.name}</span>
                <button onClick={() => { setEditId(h.id); setEditVal(h.name); }} style={{ ...iconBtn }}>✎</button>
                <button onClick={() => setHabits(hs => hs.filter(x => x.id !== h.id))} style={{ ...iconBtn, color: C.red }}>✕</button>
              </>
            )}
          </div>
        ))}

        <FormLabel style={{ marginTop: 20 }}>Daily Completion Requirement</FormLabel>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
          How many habits must be done for the day to count toward your streak?
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[{ k: "100", l: "100%" }, { k: "75", l: "75%" }, { k: "50", l: "50%" }, { k: "custom", l: "Custom" }].map(({ k, l }) => (
            <button key={k} onClick={() => setCompReqKey(k)} style={{
              padding: "8px 16px", borderRadius: 99, border: `2px solid ${compReqKey === k ? C.amber : C.borderMid}`,
              background: compReqKey === k ? C.amberLight : "transparent",
              color: compReqKey === k ? C.amberDeep : C.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: font, transition: "all 0.15s",
            }}>{l}</button>
          ))}
        </div>
        {compReqKey === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <input type="number" min={1} max={100} value={customCompReq}
              onChange={e => setCustomCompReq(e.target.value)}
              placeholder="e.g. 80" style={{ ...inputSt, margin: 0, flex: 1 }} />
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 700 }}>%</span>
          </div>
        )}
        {compReq < 100 && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.green, fontWeight: 600 }}>
            ✓ Flexible mode — complete {Math.max(1, Math.ceil((habits.length || 1) * compReq / 100))} of {habits.length || "?"} habits per day.
          </p>
        )}

        <button onClick={handleSave} style={{ ...solidBtn, width: "100%", padding: "16px", marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: 800 }}>
          {initial ? "Save changes" : `Start ${dur}-Day Challenge 🚀`}
        </button>
      </div>
    </Sheet>
  );
}

function FormLabel({ children, style }) {
  return <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, marginTop: 16, ...style }}>{children}</label>;
}

/* ─────────────────────────────────────────────
   TODAY CHECK-IN SCREEN  (primary screen)
───────────────────────────────────────────── */
function TodayScreen({ challenges, allRecords, onComplete, onSkip, onCreateChallenge }) {
  const td = todayStr();
  const activeChallenges = challenges.filter(c => {
    const end = addDays(c.startDate, c.duration - 1);
    return td >= c.startDate && td <= end;
  });

  // Per-challenge local habit checks (only used within this screen before "Complete Today")
  const [checks, setChecks] = useState(() => {
    const init = {};
    activeChallenges.forEach(c => {
      init[c.id] = Object.fromEntries(c.habits.map(h => [h, false]));
    });
    return init;
  });

  const [skipId, setSkipId] = useState(null); // challenge id pending skip confirm

  // Reset checks when challenges change (e.g. after completing)
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

  if (activeChallenges.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: C.text }}>No active challenges</h2>
        <p style={{ margin: "0 0 28px", color: C.textMuted, fontSize: 15, maxWidth: 280, lineHeight: 1.6 }}>
          Create your first challenge and start building consistency today.
        </p>
        <button onClick={onCreateChallenge} style={{ ...solidBtn, padding: "15px 36px", fontSize: 16, fontWeight: 800 }}>
          Create a Challenge
        </button>
      </div>
    );
  }

  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Date header */}
      <div style={{ padding: "4px 20px 20px" }}>
        <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {fmtDateFull(td)}
        </p>
        <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, color: C.text }}>Today's Check-In</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "italic" }}>"{quote}"</p>
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
            margin: "0 16px 20px",
            background: C.card,
            borderRadius: 24,
            border: `1.5px solid ${isDone ? C.greenBorder : isSkipped ? C.borderMid : C.amberBorder}`,
            overflow: "hidden",
            boxShadow: isDone ? "0 2px 20px rgba(5,150,105,0.08)" : "0 2px 20px rgba(245,158,11,0.06)",
            transition: "all 0.3s ease",
          }}>
            {/* Card header */}
            <div style={{ padding: "18px 20px 14px", background: isDone ? C.greenLight : isSkipped ? "#F9FAFB" : C.amberLight, borderBottom: `1px solid ${isDone ? C.greenBorder : isSkipped ? C.borderMid : C.amberBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.text }}>{c.name}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill>Day {stats.todayDayNum} of {stats.totalDays}</Pill>
                    {stats.currentStreak > 0 && <Pill emoji="🔥">🔥 {stats.currentStreak} streak</Pill>}
                  </div>
                </div>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Ring pct={stats.pct} size={52} stroke={5} color={isDone ? C.green : C.amber} />
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isDone ? C.green : C.amberDeep }}>
                    {stats.pct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px" }}>
              {isDone ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <p style={{ margin: 0, fontWeight: 700, color: C.green, fontSize: 15 }}>Day completed! Great work.</p>
                </div>
              ) : isSkipped ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>⏭️</div>
                  <p style={{ margin: 0, fontWeight: 700, color: C.textMuted, fontSize: 15 }}>Skipped today. Tomorrow is a new chance.</p>
                </div>
              ) : (
                <>
                  {/* Habit checklist */}
                  <div style={{ marginBottom: 16 }}>
                    {c.habits.map((h, i) => {
                      const checked = !!habitChecks[h];
                      return (
                        <button key={i} onClick={() => toggle(c.id, h)} style={{
                          display: "flex", alignItems: "center", gap: 14, width: "100%",
                          background: "none", border: "none", cursor: "pointer", padding: "11px 0",
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
                            transition: "all 0.18s",
                            fontWeight: checked ? 400 : 500,
                          }}>{h}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Progress hint */}
                  {checkedCount > 0 && !canComplete && (
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textMuted }}>
                      {checkedCount}/{c.habits.length} habits — need {threshold} to complete ({reqPct}% rule).
                    </p>
                  )}
                  {checkedCount === 0 && reqPct < 100 && (
                    <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textMuted }}>
                      Need {threshold} of {c.habits.length} habits ({reqPct}% rule).
                    </p>
                  )}

                  {/* CTA buttons */}
                  <button
                    onClick={() => onComplete(c.id, habitChecks)}
                    disabled={!canComplete}
                    style={{
                      ...solidBtn, width: "100%", padding: "15px",
                      fontSize: 16, fontWeight: 800,
                      opacity: canComplete ? 1 : 0.45,
                      cursor: canComplete ? "pointer" : "not-allowed",
                      marginBottom: 10,
                      background: canComplete ? `linear-gradient(135deg, ${C.amber}, ${C.amberDark})` : C.amber,
                      boxShadow: canComplete ? "0 4px 20px rgba(245,158,11,0.4)" : "none",
                      transform: "translateY(0)",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={e => canComplete && (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
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

      {skipId && (
        <ConfirmDialog
          title="Skip today?"
          message="Skipping will not break your streak but this day won't count as completed. Are you sure?"
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
function ChallengesScreen({ challenges, allRecords, onSelect, onEdit, onDuplicate, onDelete, onCreate }) {
  const td = todayStr();
  const [menuId, setMenuId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  if (challenges.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: C.text }}>No challenges yet</h2>
        <p style={{ margin: "0 0 24px", color: C.textMuted, fontSize: 14, maxWidth: 260, lineHeight: 1.6 }}>Create your first challenge to start tracking your streaks.</p>
        <button onClick={onCreate} style={{ ...solidBtn, padding: "13px 28px" }}>Create Challenge</button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 100 }} onClick={() => menuId && setMenuId(null)}>
      <div style={{ padding: "4px 20px 20px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: C.text }}>My Challenges</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>{challenges.length} challenge{challenges.length !== 1 ? "s" : ""} total</p>
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
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
              transition: "box-shadow 0.2s, transform 0.2s",
              boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = ""; }}
            >
              <div style={{ padding: "18px 18px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{statusLabel}</span>
                      {status === "active" && todayRec === "completed" && <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓ Done today</span>}
                      {status === "active" && todayRec === "skipped" && <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>⏭ Skipped</span>}
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{fmtDate(c.startDate)} → {fmtDate(stats.end)} · {c.habits.length} habits</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <Ring pct={stats.pct} size={48} stroke={5} color={stats.isFinished ? C.textMuted : C.amber} />
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.amberDeep }}>{stats.pct}%</span>
                    </div>

                    {/* ⋯ menu */}
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
                          { label: "✎  Edit", action: () => { setMenuId(null); onEdit(c); } },
                          { label: "⧉  Duplicate", action: () => { setMenuId(null); onDuplicate(c); } },
                          { label: "✕  Delete", action: () => { setMenuId(null); setDeleteId(c.id); }, danger: true },
                        ].map(({ label, action, danger }) => (
                          <button key={label} onClick={action} style={{
                            display: "block", width: "100%", padding: "13px 16px", background: "none",
                            border: "none", textAlign: "left", fontSize: 14, fontWeight: 600,
                            color: danger ? C.red : C.text, cursor: "pointer", fontFamily: font,
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = danger ? C.redLight : C.bg}
                            onMouseLeave={e => e.currentTarget.style.background = "none"}
                          >{label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: C.textMuted }}>
                    <span>{stats.completedDays} / {stats.totalDays} days done</span>
                    {stats.currentStreak > 0 && <span>🔥 {stats.currentStreak} streak</span>}
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

  // Calendar
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(challenge.startDate + "T00:00:00");
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const start = challenge.startDate;
  const end = stats.end;

  const getDayBg = (dateStr) => {
    if (dateStr < start || dateStr > end) return "transparent";
    if (dateStr > td) return C.border;
    const r = records[dateStr];
    if (r === "skipped") return C.amberMid;
    const hr = habitRecords[dateStr];
    if (hr) {
      const total = challenge.habits.length;
      const done = challenge.habits.filter(h => hr[h]).length;
      const pct = total > 0 ? (done / total) * 100 : 0;
      if (pct >= 100) return C.green;
      if (pct >= reqPct) return C.greenMid;
      if (pct > 0) return C.yellow;
      return C.redLight;
    }
    if (r === "completed") return C.green; // legacy: all-or-nothing day
    if (dateStr < td) return C.redLight;   // missed (no record, past)
    return "transparent";
  };

  const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  const firstDow = new Date(calMonth.y, calMonth.m, 1).getDay();

  return (
    <div style={{ paddingBottom: 100 }} onClick={() => showMenu && setShowMenu(false)}>
      {/* Back + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px 16px" }}>
        <button onClick={onBack} style={{ ...ghostBtn, gap: 4 }}>← Back</button>
        <div style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }} style={{ ...iconBtn, width: 36, height: 36, borderRadius: 12, background: showMenu ? C.amberMid : "transparent" }}>⋯</button>
          {showMenu && (
            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 40, right: 0, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 50, minWidth: 160, overflow: "hidden" }}>
              {[
                { label: "✎  Edit", action: () => { setShowMenu(false); onEdit(); } },
                { label: "⧉  Duplicate", action: () => { setShowMenu(false); onDuplicate(); } },
                { label: "✕  Delete", action: () => { setShowMenu(false); setConfirmDelete(true); }, danger: true },
              ].map(({ label, action, danger }) => (
                <button key={label} onClick={action} style={{ display: "block", width: "100%", padding: "13px 16px", background: "none", border: "none", textAlign: "left", fontSize: 14, fontWeight: 600, color: danger ? C.red : C.text, cursor: "pointer", fontFamily: font }}
                  onMouseEnter={e => e.currentTarget.style.background = danger ? C.redLight : C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div style={{ margin: "0 16px 20px", background: C.amberLight, borderRadius: 24, border: `1.5px solid ${C.amberBorder}`, padding: "20px 20px 18px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: C.text }}>{challenge.name}</h2>
        {challenge.description && <p style={{ margin: "0 0 12px", fontSize: 14, color: C.textMid }}>{challenge.description}</p>}
        <p style={{ margin: "0 0 8px", fontSize: 13, color: C.textMuted }}>{fmtDate(challenge.startDate)} → {fmtDate(end)} · {challenge.duration} days</p>
        {reqPct < 100 && (
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: C.green }}>
            ✓ Flexible — {reqPct}% daily completion rule
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>{stats.completedDays} / {stats.totalDays} days complete</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.amberDeep }}>{stats.pct}%</span>
        </div>
        <ProgressBar pct={stats.pct} height={10} />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {[
            { label: "🔥 Streak", val: stats.currentStreak },
            { label: "🏆 Best", val: stats.bestStreak },
            { label: "⏭ Skipped", val: stats.skippedDays },
          ].map(x => (
            <div key={x.label} style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "10px 8px", textAlign: "center", border: `1px solid ${C.amberBorder}` }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.amberDeep }}>{x.val}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>{x.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Habits */}
      <div style={{ margin: "0 16px 20px", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>Daily Habits ({challenge.habits.length})</h3>
          {reqPct < 100 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 99, padding: "2px 8px" }}>
              {reqPct}% rule
            </span>
          )}
        </div>
        {challenge.habits.map((h, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < challenge.habits.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: C.textMid }}>{h}</span>
          </div>
        ))}
      </div>

      {/* Habit Analytics */}
      {habitStats.pastDays > 0 && (
        <div style={{ margin: "0 16px 20px", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "18px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: C.text }}>Habit Analytics</h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: C.textMuted }}>
            Across {habitStats.pastDays} tracked day{habitStats.pastDays !== 1 ? "s" : ""}
          </p>
          {challenge.habits.map((h, i) => {
            const done = habitStats.perHabit[h] || 0;
            const pct = habitStats.pastDays > 0 ? Math.round((done / habitStats.pastDays) * 100) : 0;
            return (
              <div key={i} style={{ marginBottom: i < challenge.habits.length - 1 ? 16 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textMid, flex: 1, marginRight: 8 }}>{h}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.amberDeep, flexShrink: 0 }}>
                    {done}/{habitStats.pastDays} days ({pct}%)
                  </span>
                </div>
                <ProgressBar pct={pct} height={5} color={pct >= 75 ? C.green : pct >= 50 ? C.amber : C.textLight} />
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar */}
      <div style={{ margin: "0 16px 20px", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>Progress Calendar</h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })} style={iconBtn}>‹</button>
            <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })} style={iconBtn}>›</button>
          </div>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
          {new Date(calMonth.y, calMonth.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: C.textMuted, fontWeight: 700, paddingBottom: 4 }}>{d}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const bg = getDayBg(ds);
            const inRange = ds >= start && ds <= end && ds <= td;
            const textColor = bg === C.green || bg === C.greenMid ? "#fff" : C.textMid;
            return (
              <div key={day} style={{ height: 32, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: inRange ? 600 : 400, color: textColor, border: ds === td ? `2px solid ${C.amber}` : "none" }}>
                {day}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {[
            [C.green, "All done"],
            ...(reqPct < 100 ? [[C.greenMid, "Goal met"], [C.yellow, "Partial"]] : []),
            [C.redLight, "Missed"],
            [C.amberMid, "Skipped"],
            [C.border, "Future"],
          ].map(([bg, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: `1px solid ${C.borderMid}` }} />
              <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete challenge?"
          message="This will permanently delete the challenge and all its history. This cannot be undone."
          confirmLabel="Delete forever"
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TEMPLATES SCREEN
───────────────────────────────────────────── */
function TemplatesScreen({ onUse }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "4px 20px 20px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: C.text }}>Templates</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>Proven challenges to get you started.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
        {TEMPLATES.map((t, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", cursor: "pointer" }} onClick={() => setOpen(open === i ? null : i)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <Pill style={{ marginBottom: 8 }}>{t.duration} Days</Pill>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.text }}>{t.name}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>{t.description}</p>
                </div>
                <span style={{ fontSize: 18, color: C.textMuted, marginLeft: 12 }}>{open === i ? "↑" : "↓"}</span>
              </div>
            </div>
            {open === i && (
              <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>Daily Habits</p>
                {t.habits.map((h, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 14, color: C.textMid }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />
                    {h}
                  </div>
                ))}
                <button onClick={() => onUse(t)} style={{ ...solidBtn, width: "100%", marginTop: 14, padding: "13px" }}>
                  Use This Template →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATS SCREEN
───────────────────────────────────────────── */
function StatsScreen({ challenges, allRecords }) {
  const td = todayStr();
  const gs = useMemo(() => globalStats(challenges, allRecords), [challenges, allRecords]);
  const earnedBadges = BADGES.filter(b => b.check(gs));

  // weekly bars
  const week = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(td, -6 + i);
    const label = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    let done = 0, total = 0;
    challenges.forEach(c => {
      if (d < c.startDate || d > addDays(c.startDate, c.duration - 1)) return;
      total++;
      if ((allRecords[c.id] || {})[d] === "completed") done++;
    });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { label, pct, done, total };
  });
  const maxBar = Math.max(...week.map(w => w.pct), 1);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: "4px 20px 20px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: C.text }}>Your Stats</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted }}>All time performance.</p>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 16px", marginBottom: 20 }}>
        {[
          { label: "Days Completed", val: gs.totalCompleted, emoji: "✅" },
          { label: "Best Streak", val: `${gs.bestStreak}d`, emoji: "🔥" },
          { label: "Challenges", val: challenges.length, emoji: "🎯" },
          { label: "Badges Earned", val: `${earnedBadges.length}/${BADGES.length}`, emoji: "🏅" },
        ].map(x => (
          <div key={x.label} style={{ background: C.card, borderRadius: 18, padding: "18px 16px", border: `1px solid ${C.border}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 24 }}>{x.emoji}</p>
            <p style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 900, color: C.text }}>{x.val}</p>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{x.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly bars */}
      <div style={{ margin: "0 16px 20px", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "18px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: C.text }}>This Week</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {week.map(w => (
            <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{w.pct > 0 ? `${w.pct}%` : ""}</span>
              <div style={{ width: "100%", background: C.amberMid, borderRadius: 6, height: 60, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                <div style={{ width: "100%", height: `${(w.pct / maxBar) * 100}%`, background: w.pct === 100 ? C.green : C.amber, transition: "height 0.5s ease", borderRadius: 6 }} />
              </div>
              <span style={{ fontSize: 10, color: C.textMuted }}>{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div style={{ margin: "0 16px", background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: "18px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: C.text }}>Badges</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
          {BADGES.map(b => {
            const earned = b.check(gs);
            return (
              <div key={b.id} style={{
                padding: "14px 10px", borderRadius: 16, textAlign: "center",
                background: earned ? C.amberLight : C.bg,
                border: `1.5px solid ${earned ? C.amberBorder : C.border}`,
                opacity: earned ? 1 : 0.5,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{b.emoji}</div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 800, color: earned ? C.amberDeep : C.textMuted }}>{b.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   NOTES FEATURE
───────────────────────────────────────────── */

const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TEST_REGEX = /^https?:\/\/[^\s]+$/;

function renderTextWithLinks(text) {
  if (!text) return null;
  const parts = text.split(URL_SPLIT_REGEX);
  return parts.map((part, i) =>
    URL_TEST_REGEX.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{ color: C.blue, textDecoration: "underline", wordBreak: "break-all" }}
          onClick={e => e.stopPropagation()}>{part}</a>
      : <span key={i}>{part}</span>
  );
}

function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoteEditor({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [saved, setSaved] = useState(true);
  const [preview, setPreview] = useState(false);
  const autoSaveRef = useRef(null);
  const noteIdRef = useRef(note?.id || uid());
  const isNew = !note;

  const doSave = useCallback((t, c) => {
    onSave({ id: noteIdRef.current, title: t, content: c });
    setSaved(true);
  }, [onSave]);

  useEffect(() => {
    if (isNew && title === "" && content === "") return;
    setSaved(false);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => doSave(title, content), 800);
    return () => clearTimeout(autoSaveRef.current);
  }, [title, content]);

  const handleClose = () => {
    clearTimeout(autoSaveRef.current);
    if (title.trim() || content.trim()) doSave(title, content);
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300, background: C.bg,
      display: "flex", flexDirection: "column", fontFamily: font,
      animation: "slideUp 0.22s cubic-bezier(0.32,0.72,0,1)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(250,250,247,0.95)", backdropFilter: "blur(16px)",
        flexShrink: 0, gap: 10,
      }}>
        <button onClick={handleClose} style={{ ...ghostBtn, padding: "8px 16px", fontSize: 14, gap: 6, flexShrink: 0 }}>← Done</button>

        {/* Edit / Preview toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", background: C.amberMid, borderRadius: 99, padding: 3 }}>
            {[{ label: "Edit", val: false }, { label: "Preview", val: true }].map(({ label, val }) => (
              <button key={label} onClick={() => setPreview(val)} style={{
                padding: "4px 14px", borderRadius: 99, border: "none", cursor: "pointer",
                fontFamily: font, fontSize: 12, fontWeight: 700,
                background: preview === val ? C.amber : "transparent",
                color: preview === val ? "#fff" : C.textMuted,
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: saved ? C.textMuted : C.amber, transition: "color 0.3s", flexShrink: 0 }}>
            {saved ? "Saved" : "Saving…"}
          </span>
        </div>

        <button onClick={handleClose} style={{ ...solidBtn, padding: "8px 18px", fontSize: 14, flexShrink: 0 }}>Save</button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 40px" }}>
        {/* Title — always shown in both modes */}
        {preview ? (
          <h2 style={{
            margin: "0 0 16px", fontSize: 24, fontWeight: 900, color: title ? C.text : C.textMuted,
            fontFamily: font,
          }}>{title || "Untitled"}</h2>
        ) : (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title…"
            autoFocus={isNew}
            style={{
              width: "100%", border: "none", outline: "none", background: "transparent",
              fontSize: 24, fontWeight: 900, color: C.text, fontFamily: font,
              marginBottom: 16, padding: 0, boxSizing: "border-box",
            }}
          />
        )}

        {/* Content — textarea in Edit mode, rendered links in Preview mode */}
        {preview ? (
          <div style={{
            fontSize: 15, lineHeight: 1.75, color: C.textMid, fontFamily: font,
            whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: "60vh",
          }}>
            {content.trim()
              ? renderTextWithLinks(content)
              : <span style={{ color: C.textLight, fontStyle: "italic" }}>Nothing to preview yet.</span>}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={"Start writing…\n\nTip: switch to Preview to see clickable links."}
            style={{
              width: "100%", border: "none", outline: "none", background: "transparent",
              fontSize: 15, lineHeight: 1.75, color: C.textMid, fontFamily: font,
              resize: "none", minHeight: "60vh", padding: 0, boxSizing: "border-box",
            }}
          />
        )}
      </div>
    </div>
  );
}

function NotesScreen({ notes, onNew, onEdit, onDelete, onDuplicate }) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuId) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    const handleKey = (e) => { if (e.key === "Escape") setMenuId(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuId]);

  const openMenu = (e, noteId) => {
    e.stopPropagation();
    if (menuId === noteId) { setMenuId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 144;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
    setMenuPos({ top, right: window.innerWidth - rect.right });
    setMenuId(noteId);
  };

  const menuNote = notes.find(n => n.id === menuId);

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ paddingBottom: 120 }} onClick={() => menuId && setMenuId(null)}>

      {/* Fixed-position dropdown — rendered outside cards to avoid stacking/overlap issues */}
      {menuId && menuNote && (
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: menuPos.top, right: menuPos.right,
            background: C.card, borderRadius: 16,
            border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            zIndex: 400, minWidth: 164, overflow: "hidden",
          }}
        >
          {[
            { label: "✎  Edit", action: () => { setMenuId(null); onEdit(menuNote); } },
            { label: "⧉  Duplicate", action: () => { setMenuId(null); onDuplicate(menuNote); } },
            { label: "✕  Delete", action: () => { setMenuId(null); setDeleteId(menuNote.id); }, danger: true },
          ].map(({ label, action, danger }) => (
            <button key={label} onClick={action} style={{
              display: "block", width: "100%", padding: "13px 16px", background: "none",
              border: "none", textAlign: "left", fontSize: 14, fontWeight: 600,
              color: danger ? C.red : C.text, cursor: "pointer", fontFamily: font,
            }}
              onMouseEnter={e => e.currentTarget.style.background = danger ? C.redLight : C.bg}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >{label}</button>
          ))}
        </div>
      )}
      {/* Header */}
      <div style={{ padding: "4px 20px 16px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: C.text }}>Notes</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: C.textMuted }}>
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </p>
        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: C.textMuted, pointerEvents: "none" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            style={{ ...inputSt, paddingLeft: 38, marginBottom: 0 }}
          />
        </div>
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "52vh", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>📝</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: C.text }}>Your ideas deserve a home</h3>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: C.textMuted, maxWidth: 260, lineHeight: 1.65 }}>
            Create your first note to capture links, ideas, and resources.
          </p>
          <button onClick={onNew} style={{ ...solidBtn, padding: "13px 28px", fontSize: 15, fontWeight: 800 }}>
            + Create First Note
          </button>
        </div>
      )}

      {/* No search results */}
      {notes.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 15, color: C.textMuted }}>No notes match "{search}"</p>
        </div>
      )}

      {/* Notes list */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(n => {
          const previewText = n.content.trim().slice(0, 200).replace(/\n+/g, " · ");
          return (
            <div key={n.id}
              onClick={() => onEdit(n)}
              style={{
                background: C.card, borderRadius: 20, border: `1.5px solid ${C.border}`,
                padding: "16px 16px 14px", cursor: "pointer", position: "relative",
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.09)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = ""; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 5px", fontSize: 16, fontWeight: 800, color: n.title ? C.text : C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.title || "Untitled"}
                  </h3>
                  {previewText && (
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: C.textMuted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {renderTextWithLinks(previewText)}
                    </p>
                  )}
                  <span style={{ fontSize: 11, color: C.textLight, fontWeight: 500 }}>
                    Updated {fmtRelative(n.updatedAt)}
                  </span>
                </div>

                {/* ⋯ menu — triggers fixed-position dropdown rendered at top of NotesScreen */}
                <button
                  onClick={e => openMenu(e, n.id)}
                  style={{ ...iconBtn, width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: menuId === n.id ? C.amberMid : "transparent" }}
                >⋯</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating + New Note button */}
      {notes.length > 0 && (
        <button
          onClick={onNew}
          style={{
            position: "fixed", bottom: 88, right: "max(16px, calc(50% - 284px))",
            background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`,
            color: "#fff", border: "none", borderRadius: 99,
            padding: "14px 22px", fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: font,
            boxShadow: "0 6px 24px rgba(245,158,11,0.45)",
            display: "flex", alignItems: "center", gap: 8, zIndex: 90,
            transition: "transform 0.18s, box-shadow 0.18s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(245,158,11,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 6px 24px rgba(245,158,11,0.45)"; }}
        >
          + New Note
        </button>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete this note?"
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { onDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SHARED BUTTON STYLES
───────────────────────────────────────────── */
const solidBtn = {
  background: C.amber, color: "#fff", border: "none", borderRadius: 14, padding: "12px 20px",
  fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
};
const ghostBtn = {
  background: "transparent", color: C.textMid, border: `1.5px solid ${C.borderMid}`,
  borderRadius: 14, padding: "11px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer",
  fontFamily: font, transition: "all 0.18s", display: "inline-flex", alignItems: "center",
  justifyContent: "center",
};
const iconBtn = {
  background: "transparent", border: "none", cursor: "pointer", color: C.textMuted,
  fontSize: 16, padding: 6, borderRadius: 8, display: "flex", alignItems: "center",
  justifyContent: "center", fontFamily: font, transition: "background 0.15s",
};
const inputSt = {
  width: "100%", padding: "13px 14px", borderRadius: 13, border: `1.5px solid ${C.borderMid}`,
  fontSize: 15, color: C.text, background: "#fff", fontFamily: font, outline: "none",
  boxSizing: "border-box", marginBottom: 0, transition: "border-color 0.15s",
};

/* ─────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────── */
export default function StreakUp() {
  const [challenges, setChallenges] = useState(() => LS.get("su2_challenges", []));
  const [allRecords, setAllRecords] = useState(() => LS.get("su2_records", {}));
  const [allHabitRecords, setAllHabitRecords] = useState(() => LS.get("su2_habit_records", {}));
  // records[challengeId][dateStr] = "completed" | "skipped"
  // habitRecords[challengeId][dateStr] = { [habitName]: boolean }

  const [notes, setNotes] = useState(() => LS.get("su2_notes", []));
  const [editingNote, setEditingNote] = useState(null); // null | { note | "__new__" }

  const [tab, setTab] = useState("today"); // today | challenges | stats | notes
  const [detailId, setDetailId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editChallenge, setEditChallenge] = useState(null);
  const [templateSeed, setTemplateSeed] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { LS.set("su2_challenges", challenges); }, [challenges]);
  useEffect(() => { LS.set("su2_records", allRecords); }, [allRecords]);
  useEffect(() => { LS.set("su2_habit_records", allHabitRecords); }, [allHabitRecords]);
  useEffect(() => { LS.set("su2_notes", notes); }, [notes]);

  // Startup dedup: remove notes with identical title + content + createdAt
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

  // Active challenge count for badge on Today tab
  const td = todayStr();
  const pendingToday = challenges.filter(c => {
    const end = addDays(c.startDate, c.duration - 1);
    if (td < c.startDate || td > end) return false;
    return !(allRecords[c.id] || {})[td];
  }).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, maxWidth: 600, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: ${C.bg}; }
        input:focus, textarea:focus { border-color: ${C.amber} !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.15) !important; }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.amberBorder}; border-radius: 99px; }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100, padding: "14px 20px 12px",
        background: "rgba(250,250,247,0.92)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            StreakUp
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tab === "notes" ? (
            <button onClick={openNewNote} style={{ ...solidBtn, padding: "8px 16px", fontSize: 13, borderRadius: 11 }}>+ New Note</button>
          ) : (
            <>
              <button onClick={() => { setShowTemplates(true); }} style={{ ...ghostBtn, padding: "8px 14px", fontSize: 13, borderRadius: 11 }}>Templates</button>
              <button onClick={openCreate} style={{ ...solidBtn, padding: "8px 16px", fontSize: 13, borderRadius: 11 }}>+ New</button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ paddingTop: 16, animation: "fadeIn 0.2s ease" }}>
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
          <TodayScreen challenges={challenges} allRecords={allRecords} onComplete={completeDay} onSkip={skipDay} onCreateChallenge={openCreate} />
        ) : tab === "challenges" ? (
          <ChallengesScreen
            challenges={challenges}
            allRecords={allRecords}
            onSelect={c => setDetailId(c.id)}
            onEdit={openEdit}
            onDuplicate={duplicateChallenge}
            onDelete={deleteChallenge}
            onCreate={openCreate}
          />
        ) : tab === "notes" ? (
          <NotesScreen
            notes={notes}
            onNew={openNewNote}
            onEdit={openEditNote}
            onDelete={deleteNote}
            onDuplicate={duplicateNote}
          />
        ) : (
          <StatsScreen challenges={challenges} allRecords={allRecords} />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 600,
        background: "rgba(255,255,255,0.94)", backdropFilter: "blur(16px)",
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
              <span style={{ fontSize: 22, lineHeight: 1, filter: active ? "none" : "grayscale(80%) opacity(60%)" }}>{n.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? C.amber : C.textMuted, fontFamily: font }}>{n.label}</span>
              {n.id === "today" && pendingToday > 0 && (
                <span style={{ position: "absolute", top: 0, right: "calc(50% - 18px)", background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 99, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>
                  {pendingToday}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Note Editor overlay */}
      {editingNote !== null && (
        <NoteEditor
          note={editingNote === "__new__" ? null : editingNote}
          onSave={saveNote}
          onClose={() => setEditingNote(null)}
        />
      )}

      {/* Modals */}
      {showForm && (
        <ChallengeForm
          initial={editChallenge || (templateSeed ? { ...templateSeed, startDate: todayStr() } : null)}
          onSave={saveChallenge}
          onClose={() => { setShowForm(false); setEditChallenge(null); setTemplateSeed(null); }}
        />
      )}

      {showTemplates && (
        <Sheet onClose={() => setShowTemplates(false)} maxHeight="92vh">
          <div style={{ padding: "20px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Templates</h2>
              <button onClick={() => setShowTemplates(false)} style={iconBtn}>✕</button>
            </div>
          </div>
          <TemplatesScreen onUse={t => { setTemplateSeed(t); setShowTemplates(false); setEditChallenge(null); setShowForm(true); }} />
        </Sheet>
      )}
    </div>
  );
}
