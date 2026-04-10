import { useState, useRef, useCallback } from "react";

// ── 상수 ──────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: "math",    label: "수학",      emoji: "📐", color: "#4F6EF7" },
  { id: "english", label: "영어",      emoji: "🔤", color: "#E05C5C" },
  { id: "korean",  label: "국어",      emoji: "📖", color: "#2BAD7E" },
  { id: "science", label: "과학",      emoji: "🔬", color: "#F5A623" },
  { id: "social",  label: "사회/역사", emoji: "🌏", color: "#9B59B6" },
];

const DIFFICULTY = [
  { id: "easy",   label: "하", color: "#22C55E", bg: "#F0FDF4" },
  { id: "medium", label: "중", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "hard",   label: "상", color: "#EF4444", bg: "#FEF2F2" },
];

const STORAGE_KEY = "odap_v3_notes";
const FOLDERS_KEY = "odap_v3_folders";

// ── 유틸 ──────────────────────────────────────────────────────────
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveNotes(notes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch {}
}
function loadFolders() {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "{}"); } catch { return {}; }
}
function saveFolders(folders) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); } catch {}
}

// ── 이미지 처리 (EXIF 방향 보정 + 리사이즈) ─────────────────────
function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.onload = () => {
        const MAX = 1200;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── 출력 HTML 생성 ────────────────────────────────────────────────
function buildPrintHTML(notes, mode, title) {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  const items = notes.map((note, i) => {
    const subj = SUBJECTS.find(s => s.id === note.subject);
    const diff = DIFFICULTY.find(d => d.id === note.difficulty);
    const color = subj?.color || "#4F6EF7";

    const questionImg = note.questionImg
      ? `<img src="${note.questionImg}" style="width:100%;max-height:180px;object-fit:contain;image-orientation:from-image;border-radius:4px;border:1px solid #e5e7eb;display:block;margin:6px 0;" />`
      : `<div style="height:120px;background:#f9fafb;border:1px dashed #e5e7eb;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">문제 사진 없음</div>`;

    const answerImg = mode === "answer" && note.answerImg
      ? `<div style="margin-top:8px;"><div style="font-size:10px;font-weight:700;color:${color};margin-bottom:4px;">▶ 정답</div><img src="${note.answerImg}" style="width:100%;max-height:140px;object-fit:contain;image-orientation:from-image;border-radius:4px;border:1px solid #e5e7eb;display:block;" /></div>`
      : mode === "question"
        ? `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px;display:flex;align-items:center;gap:6px;"><span style="font-size:10px;font-weight:700;color:#9ca3af;">정답:</span><span style="display:inline-block;width:120px;border-bottom:1px solid #374151;"></span></div>`
        : "";

    const memo = note.memo ? `<div style="margin-top:6px;font-size:10px;color:#6b7280;background:#f9fafb;padding:4px 8px;border-radius:4px;border-left:2px solid ${color};">${note.memo}</div>` : "";

    return `<div style="break-inside:avoid;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;">${subj?.emoji} ${subj?.label}</span>
        <span style="font-size:11px;font-weight:800;color:#374151;">No.${i + 1}</span>
        ${note.folder ? `<span style="font-size:10px;color:#6b7280;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${note.folder}</span>` : ""}
        ${diff ? `<span style="font-size:10px;font-weight:700;color:${diff.color};background:${diff.bg};padding:2px 6px;border-radius:4px;">난이도 ${diff.label}</span>` : ""}
        <span style="margin-left:auto;font-size:9px;color:#9ca3af;">${note.date}</span>
      </div>
      ${questionImg}${memo}${answerImg}
    </div>`;
  });

  // 좌우 2단으로 배치
  const leftItems = items.filter((_, i) => i % 2 === 0).join("");
  const rightItems = items.filter((_, i) => i % 2 === 1).join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans KR',sans-serif;background:#fff;color:#111;font-size:12px;}
  @media print{body{}.no-print{display:none!important;}@page{size:A4 portrait;margin:10mm;}}
  @media screen{body{padding:20px;max-width:900px;margin:0 auto;}}
  .columns{display:grid;grid-template-columns:1fr 1px 1fr;gap:0 16px;}
  .divider{background:#374151;width:1px;}
  .col{padding:0 8px;}
</style></head><body>
  <div class="no-print" style="background:#f0f4ff;border-bottom:2px solid #4f6ef7;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-weight:800;color:#4f6ef7;">📄 미리보기</span>
    <button onclick="window.print()" style="background:#4f6ef7;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;">🖨️ 인쇄 / PDF 저장</button>
  </div>
  <div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #111;">
    <div style="font-size:18px;font-weight:900;">${title}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:3px;">${today} | 총 ${notes.length}문제 | ${mode === "question" ? "문제지" : "정답지"}</div>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:11px;border-top:1px solid #e5e7eb;padding-top:8px;">
      <span>이름: _______________</span><span>날짜: _______________</span><span>점수: _______________</span>
    </div>
  </div>
  <div class="columns">
    <div class="col">${leftItems}</div>
    <div class="divider"></div>
    <div class="col">${rightItems}</div>
  </div>
  <div style="text-align:center;margin-top:16px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px;">📚 오답노트 — 열심히 공부하면 반드시 된다! 💪</div>
</body></html>`;
}

// ── 이미지 업로드 버튼 컴포넌트 ──────────────────────────────────
function ImageUploader({ label, dataUrl, onFile, onClear, color }) {
  const cameraRef = useRef();
  const galleryRef = useRef();

  return (
    <div>
      {dataUrl ? (
        <div style={{ position: "relative" }}>
          <img src={dataUrl} alt={label}
            style={{ width: "100%", borderRadius: 10, border: "1px solid #E5E7EB", display: "block", imageOrientation: "from-image" }} />
          <button onClick={() => { onClear(); if (cameraRef.current) cameraRef.current.value = ""; if (galleryRef.current) galleryRef.current.value = ""; }}
            style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", color: "#fff", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      ) : (
        <div style={{ border: `2px dashed ${color}66`, borderRadius: 12, padding: "16px 12px", background: `${color}08` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, textAlign: "center" }}>{label}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={e => onFile(e.target.files?.[0])} style={{ display: "none" }} />
            <input ref={galleryRef} type="file" accept="image/*"
              onChange={e => onFile(e.target.files?.[0])} style={{ display: "none" }} />
            <button onClick={() => cameraRef.current?.click()} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${color}`,
              background: color, color: "#fff",
              fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>📷 카메라</button>
            <button onClick={() => galleryRef.current?.click()} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${color}`,
              background: "#fff", color: color,
              fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>🖼️ 갤러리</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 노트 카드 ─────────────────────────────────────────────────────
function NoteCard({ note, onDelete, selected, onToggleSelect, selectMode }) {
  const [expanded, setExpanded] = useState(false);
  const subj = SUBJECTS.find(s => s.id === note.subject);
  const diff = DIFFICULTY.find(d => d.id === note.difficulty);

  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: `2px solid ${selected ? subj?.color : "#E5E7EB"}`,
      overflow: "hidden",
      boxShadow: selected ? `0 2px 12px ${subj?.color}33` : "0 1px 6px rgba(0,0,0,0.06)",
    }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        {selectMode && (
          <div onClick={() => onToggleSelect(note.id)} style={{
            width: 22, height: 22, borderRadius: 6, marginTop: 1, flexShrink: 0,
            border: `2px solid ${selected ? subj?.color : "#D1D5DB"}`,
            background: selected ? subj?.color : "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {selected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: subj?.color }}>{subj?.emoji} {subj?.label}</span>
            {note.folder && <span style={{ fontSize: 10, color: "#6B7280", background: "#F3F4F6", padding: "1px 7px", borderRadius: 999 }}>{note.folder}</span>}
            {diff && <span style={{ fontSize: 10, fontWeight: 700, color: diff.color, background: diff.bg, padding: "1px 7px", borderRadius: 999 }}>난이도 {diff.label}</span>}
          </div>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.memo || (note.folder ? `${note.folder} 오답` : "오답 문제")}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{note.date}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 15, color: "#9CA3AF", cursor: "pointer", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}
            onClick={() => setExpanded(v => !v)}>▾</span>
          {!selectMode && (
            <button onClick={e => { e.stopPropagation(); onDelete(note.id); }}
              style={{ background: "none", border: "none", color: "#D1D5DB", cursor: "pointer", fontSize: 15, padding: 4 }}>✕</button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          {note.questionImg && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>📋 문제</div>
              <img src={note.questionImg} alt="문제"
                style={{ width: "100%", borderRadius: 8, border: "1px solid #E5E7EB", display: "block", imageOrientation: "from-image" }} />
            </div>
          )}
          {note.answerImg && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: subj?.color, marginBottom: 4 }}>✅ 정답</div>
              <img src={note.answerImg} alt="정답"
                style={{ width: "100%", borderRadius: 8, border: "1px solid #E5E7EB", display: "block", imageOrientation: "from-image" }} />
            </div>
          )}
          {note.memo && (
            <div style={{ fontSize: 13, color: "#374151", background: "#F9FAFB", padding: "8px 10px", borderRadius: 8, lineHeight: 1.6, borderLeft: `3px solid ${subj?.color}` }}>
              {note.memo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 출력 탭 ───────────────────────────────────────────────────────
function PrintTab({ notes, folders }) {
  const [filterSubject, setFilterSubject] = useState("");
  const [filterFolder, setFilterFolder] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [printMode, setPrintMode] = useState("question");
  const [customTitle, setCustomTitle] = useState("");

  const filtered = notes.filter(n =>
    (!filterSubject || n.subject === filterSubject) &&
    (!filterFolder || n.folder === filterFolder) &&
    (!filterDiff || n.difficulty === filterDiff)
  );
  const targetNotes = selectMode ? filtered.filter(n => selected.has(n.id)) : filtered;
  const toggleSel = id => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // 현재 필터에 맞는 폴더 목록
  const availFolders = [...new Set(
    notes.filter(n => !filterSubject || n.subject === filterSubject).map(n => n.folder).filter(Boolean)
  )];

  const handlePrint = () => {
    if (!targetNotes.length) return;
    const subjLabel = filterSubject ? SUBJECTS.find(s => s.id === filterSubject)?.label : "전과목";
    const autoTitle = `${subjLabel} ${filterFolder || ""} ${printMode === "question" ? "문제지" : "정답지"}`.trim();
    const html = buildPrintHTML(targetNotes, printMode, customTitle.trim() || autoTitle);
    const win = window.open("", "_blank");
    if (!win) { alert("팝업이 차단됐어요. 팝업 허용 후 다시 시도하세요."); return; }
    win.document.write(html); win.document.close();
  };

  const Pill = ({ label, active, color, bg, onClick }) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
      border: `1.5px solid ${active ? (color || "#374151") : "#E5E7EB"}`,
      background: active ? (bg || "#374151") : "#fff",
      color: active ? (color ? (bg ? color : "#fff") : "#fff") : "#6B7280",
      cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 필터 */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>🔍 필터</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>과목</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Pill label={`전체 ${notes.length}`} active={!filterSubject} onClick={() => { setFilterSubject(""); setFilterFolder(""); }} />
            {SUBJECTS.map(s => {
              const cnt = notes.filter(n => n.subject === s.id).length;
              if (!cnt) return null;
              return <Pill key={s.id} label={`${s.emoji} ${s.label} ${cnt}`} active={filterSubject === s.id}
                color="#fff" bg={s.color} onClick={() => { setFilterSubject(s.id); setFilterFolder(""); }} />;
            })}
          </div>
        </div>
        {availFolders.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>시험 폴더</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              <Pill label="전체" active={!filterFolder} onClick={() => setFilterFolder("")} />
              {availFolders.map(f => (
                <Pill key={f} label={f} active={filterFolder === f} color="#4F6EF7" bg="#EEF2FF" onClick={() => setFilterFolder(f)} />
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>난이도</div>
          <div style={{ display: "flex", gap: 5 }}>
            <Pill label="전체" active={!filterDiff} onClick={() => setFilterDiff("")} />
            {DIFFICULTY.map(d => {
              const cnt = notes.filter(n => n.difficulty === d.id).length;
              if (!cnt) return null;
              return <Pill key={d.id} label={`${d.label} ${cnt}`} active={filterDiff === d.id} color={d.color} bg={d.bg} onClick={() => setFilterDiff(d.id)} />;
            })}
          </div>
        </div>
      </div>

      {/* 출력 설정 */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>⚙️ 출력 설정</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>출력 종류</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "question", label: "📝 문제지", desc: "정답 빈칸" }, { id: "answer", label: "✅ 정답지", desc: "답 사진 포함" }].map(m => (
              <button key={m.id} onClick={() => setPrintMode(m.id)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, lineHeight: 1.5,
                border: `2px solid ${printMode === m.id ? "#4F6EF7" : "#E5E7EB"}`,
                background: printMode === m.id ? "#EEF2FF" : "#fff",
                color: printMode === m.id ? "#4F6EF7" : "#6B7280",
                fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>{m.label}<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{m.desc}</span></button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontWeight: 600 }}>제목 (선택)</div>
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="예: 4월 수학 중간고사 오답"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>문제 선택</div>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${selectMode ? "#4F6EF7" : "#E5E7EB"}`,
                background: selectMode ? "#EEF2FF" : "#fff",
                color: selectMode ? "#4F6EF7" : "#6B7280",
                cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
              }}>{selectMode ? "✓ 선택중" : "직접 선택"}</button>
              {selectMode && <>
                <button onClick={() => setSelected(new Set(filtered.map(n => n.id)))} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" }}>전체</button>
                <button onClick={() => setSelected(new Set())} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" }}>해제</button>
              </>}
            </div>
          </div>
          {selectMode && <div style={{ background: "#F0F4FF", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#4F6EF7", fontWeight: 700 }}>{selected.size}개 선택 / 전체 {filtered.length}개</div>}
        </div>
      </div>

      {/* 문제 목록 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 36 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>해당 조건의 오답이 없어요</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} onDelete={() => {}} selected={selected.has(note.id)} onToggleSelect={toggleSel} selectMode={selectMode} />
          ))}
        </div>
      )}

      <div style={{ position: "sticky", bottom: 16 }}>
        <button onClick={handlePrint} disabled={!targetNotes.length} style={{
          width: "100%",
          background: !targetNotes.length ? "#9CA3AF" : "linear-gradient(135deg, #4F6EF7 0%, #7C3AED 100%)",
          color: "#fff", border: "none", borderRadius: 14, padding: "16px",
          fontSize: 16, fontWeight: 900, fontFamily: "'Noto Sans KR', sans-serif",
          cursor: !targetNotes.length ? "not-allowed" : "pointer",
          boxShadow: !targetNotes.length ? "none" : "0 4px 16px rgba(79,110,247,0.4)",
        }}>🖨️ {printMode === "question" ? "문제지" : "정답지"} 출력 · {targetNotes.length}문제</button>
      </div>
    </div>
  );
}

// ── 메인 앱 ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("add");
  const [notes, setNotes] = useState(() => loadNotes());
  const [folders, setFolders] = useState(() => loadFolders());

  // 추가 탭 상태
  const [subject, setSubject] = useState("math");
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [questionImg, setQuestionImg] = useState(null);
  const [answerImg, setAnswerImg] = useState(null);
  const [memo, setMemo] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState("");

  // 목록 탭 필터
  const [listFilterSubject, setListFilterSubject] = useState("");
  const [listFilterFolder, setListFilterFolder] = useState("");
  const [listFilterDiff, setListFilterDiff] = useState("");

  const selectedSubject = SUBJECTS.find(s => s.id === subject);
  const subjectFolders = folders[subject] || [];

  const handleSubjectChange = (id) => {
    setSubject(id);
    setFolder("");
    setNewFolder("");
    setShowNewFolder(false);
  };

  const handleImageFile = useCallback(async (file, type) => {
    if (!file) return;
    setImgError("");
    try {
      const dataUrl = await processImage(file);
      if (type === "question") setQuestionImg(dataUrl);
      else setAnswerImg(dataUrl);
    } catch (err) {
      setImgError("이미지 처리 오류: " + err.message);
    }
  }, []);

  const handleAddFolder = () => {
    const name = newFolder.trim();
    if (!name) return;
    const updated = { ...folders, [subject]: [...new Set([...(folders[subject] || []), name])] };
    setFolders(updated);
    saveFolders(updated);
    setFolder(name);
    setNewFolder("");
    setShowNewFolder(false);
  };

  const handleSave = () => {
    if (!questionImg) { setImgError("문제 사진을 먼저 추가해주세요."); return; }
    setSaving(true);
    const note = {
      id: Date.now(), subject, folder, questionImg, answerImg, memo, difficulty,
      date: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }),
    };
    const updated = [note, ...notes];
    setNotes(updated); saveNotes(updated);
    setQuestionImg(null); setAnswerImg(null); setMemo(""); setDifficulty(""); setFolder("");
    setSaving(false);
    setTab("list");
  };

  const handleDelete = useCallback(id => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated); saveNotes(updated);
  }, [notes]);

  const filteredNotes = notes.filter(n =>
    (!listFilterSubject || n.subject === listFilterSubject) &&
    (!listFilterFolder || n.folder === listFilterFolder) &&
    (!listFilterDiff || n.difficulty === listFilterDiff)
  );

  const listFolders = [...new Set(
    notes.filter(n => !listFilterSubject || n.subject === listFilterSubject).map(n => n.folder).filter(Boolean)
  )];

  const TABS = [
    { id: "add",   label: "✏️ 추가" },
    { id: "list",  label: `📋 목록${notes.length ? ` (${notes.length})` : ""}` },
    { id: "print", label: "🖨️ 출력" },
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans KR', sans-serif", background: "#F0F4FF", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{
        background: `linear-gradient(135deg, ${selectedSubject?.color} 0%, ${selectedSubject?.color}CC 100%)`,
        padding: "20px 20px 58px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
        <div style={{ position: "relative", color: "#fff" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>📚 오답노트</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>사진으로 기록하는 나만의 오답노트</div>
        </div>
        <div style={{
          position: "absolute", bottom: -18, left: "50%", transform: "translateX(-50%)",
          background: "#fff", borderRadius: 999, padding: 4, display: "flex", gap: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)", whiteSpace: "nowrap",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", borderRadius: 999, border: "none",
              background: tab === t.id ? selectedSubject?.color : "transparent",
              color: tab === t.id ? "#fff" : "#6B7280",
              fontFamily: "'Noto Sans KR', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 16px 80px" }}>

        {/* ── 추가 탭 ── */}
        {tab === "add" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* 과목 선택 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>① 과목</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {SUBJECTS.map(s => (
                  <button key={s.id} onClick={() => handleSubjectChange(s.id)} style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999,
                    border: `2px solid ${subject === s.id ? s.color : "#E5E7EB"}`,
                    background: subject === s.id ? s.color : "#fff",
                    color: subject === s.id ? "#fff" : "#374151",
                    fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    boxShadow: subject === s.id ? `0 2px 8px ${s.color}55` : "none",
                  }}><span>{s.emoji}</span>{s.label}</button>
                ))}
              </div>
            </div>

            {/* 시험 폴더 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>② 시험 폴더</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {subjectFolders.map(f => (
                  <button key={f} onClick={() => setFolder(folder === f ? "" : f)} style={{
                    padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${folder === f ? selectedSubject?.color : "#E5E7EB"}`,
                    background: folder === f ? `${selectedSubject?.color}15` : "#fff",
                    color: folder === f ? selectedSubject?.color : "#374151",
                    cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                  }}>📁 {f}</button>
                ))}
                <button onClick={() => setShowNewFolder(v => !v)} style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                  border: "1.5px dashed #9CA3AF", background: "#fff", color: "#6B7280",
                  cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                }}>+ 새 폴더</button>
              </div>
              {showNewFolder && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newFolder} onChange={e => setNewFolder(e.target.value)}
                    placeholder="예: 1학기 중간고사"
                    onKeyDown={e => e.key === "Enter" && handleAddFolder()}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${selectedSubject?.color}`,
                      fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, outline: "none",
                    }} />
                  <button onClick={handleAddFolder} style={{
                    padding: "9px 16px", borderRadius: 8, border: "none",
                    background: selectedSubject?.color, color: "#fff",
                    fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>추가</button>
                </div>
              )}
              {folder && (
                <div style={{ marginTop: 6, fontSize: 12, color: selectedSubject?.color, fontWeight: 600 }}>
                  ✓ 선택됨: {folder}
                </div>
              )}
            </div>

            {/* 문제 사진 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>③ 문제 사진 <span style={{ color: "#EF4444", fontSize: 11 }}>*필수</span></div>
              <ImageUploader label="문제 사진 추가" dataUrl={questionImg}
                onFile={f => handleImageFile(f, "question")}
                onClear={() => setQuestionImg(null)}
                color={selectedSubject?.color} />
            </div>

            {/* 정답 사진 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>④ 정답 사진 <span style={{ fontSize: 11, color: "#9CA3AF" }}>(선택)</span></div>
              <ImageUploader label="정답 사진 추가" dataUrl={answerImg}
                onFile={f => handleImageFile(f, "answer")}
                onClear={() => setAnswerImg(null)}
                color={selectedSubject?.color} />
            </div>

            {/* 메모 + 난이도 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>⑤ 메모 & 난이도 <span style={{ fontSize: 11, color: "#9CA3AF" }}>(선택)</span></div>
              <textarea value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="틀린 이유, 핵심 개념 등 메모..." style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB",
                  fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, color: "#374151",
                  resize: "vertical", minHeight: 70, boxSizing: "border-box", outline: "none", lineHeight: 1.6, marginBottom: 12,
                }} />
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>난이도</div>
              <div style={{ display: "flex", gap: 8 }}>
                {DIFFICULTY.map(d => (
                  <button key={d.id} onClick={() => setDifficulty(difficulty === d.id ? "" : d.id)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 800,
                    border: `2px solid ${difficulty === d.id ? d.color : "#E5E7EB"}`,
                    background: difficulty === d.id ? d.bg : "#fff",
                    color: difficulty === d.id ? d.color : "#9CA3AF",
                    cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                  }}>{d.label}</button>
                ))}
              </div>
            </div>

            {imgError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
                ⚠️ {imgError}
              </div>
            )}

            <button onClick={handleSave} disabled={saving || !questionImg} style={{
              background: !questionImg ? "#9CA3AF" : selectedSubject?.color,
              color: "#fff", border: "none", borderRadius: 14, padding: "16px",
              fontSize: 16, fontWeight: 800, fontFamily: "'Noto Sans KR', sans-serif",
              cursor: !questionImg ? "not-allowed" : "pointer",
              boxShadow: !questionImg ? "none" : `0 4px 16px ${selectedSubject?.color}55`,
            }}>💾 오답노트에 저장하기</button>
          </div>
        )}

        {/* ── 목록 탭 ── */}
        {tab === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 필터 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>🔍 필터</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>과목</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {[{ id: "", label: `전체 ${notes.length}`, color: "#374151", bg: "#374151" }, ...SUBJECTS.map(s => ({ id: s.id, label: `${s.emoji} ${s.label} ${notes.filter(n => n.subject === s.id).length}`, color: "#fff", bg: s.color }))].map(item => {
                    if (item.id && !notes.some(n => n.subject === item.id)) return null;
                    return (
                      <button key={item.id} onClick={() => { setListFilterSubject(item.id); setListFilterFolder(""); }} style={{
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                        border: `1.5px solid ${listFilterSubject === item.id ? item.bg : "#E5E7EB"}`,
                        background: listFilterSubject === item.id ? item.bg : "#fff",
                        color: listFilterSubject === item.id ? item.color : "#6B7280",
                        cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                      }}>{item.label}</button>
                    );
                  })}
                </div>
              </div>
              {listFolders.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>시험 폴더</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <button onClick={() => setListFilterFolder("")} style={{
                      padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      border: `1.5px solid ${!listFilterFolder ? "#374151" : "#E5E7EB"}`,
                      background: !listFilterFolder ? "#374151" : "#fff",
                      color: !listFilterFolder ? "#fff" : "#6B7280",
                      cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                    }}>전체</button>
                    {listFolders.map(f => (
                      <button key={f} onClick={() => setListFilterFolder(f)} style={{
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                        border: `1.5px solid ${listFilterFolder === f ? "#4F6EF7" : "#E5E7EB"}`,
                        background: listFilterFolder === f ? "#EEF2FF" : "#fff",
                        color: listFilterFolder === f ? "#4F6EF7" : "#6B7280",
                        cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                      }}>📁 {f}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, marginBottom: 5 }}>난이도</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button onClick={() => setListFilterDiff("")} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${!listFilterDiff ? "#374151" : "#E5E7EB"}`,
                    background: !listFilterDiff ? "#374151" : "#fff",
                    color: !listFilterDiff ? "#fff" : "#6B7280",
                    cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                  }}>전체</button>
                  {DIFFICULTY.map(d => {
                    const cnt = notes.filter(n => n.difficulty === d.id).length;
                    if (!cnt) return null;
                    return (
                      <button key={d.id} onClick={() => setListFilterDiff(d.id)} style={{
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                        border: `1.5px solid ${listFilterDiff === d.id ? d.color : "#E5E7EB"}`,
                        background: listFilterDiff === d.id ? d.bg : "#fff",
                        color: listFilterDiff === d.id ? d.color : "#6B7280",
                        cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                      }}>{d.label} {cnt}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF" }}>
                <div style={{ fontSize: 48 }}>📭</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  {notes.length === 0 ? "아직 저장된 오답이 없어요" : "해당 조건의 오답이 없어요"}
                </div>
                {notes.length === 0 && <div style={{ fontSize: 13, marginTop: 4 }}>추가 탭에서 문제 사진을 저장해보세요!</div>}
              </div>
            ) : filteredNotes.map(note => (
              <NoteCard key={note.id} note={note} onDelete={handleDelete}
                selected={false} onToggleSelect={() => {}} selectMode={false} />
            ))}
          </div>
        )}

        {/* ── 출력 탭 ── */}
        {tab === "print" && <PrintTab notes={notes} folders={folders} />}
      </div>
    </div>
  );
}
