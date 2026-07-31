import { useEffect, type ReactNode } from "react"

// ---------- Status semantics ----------
type Tone = "default" | "blue" | "success" | "warning" | "error" | "purple" | "neutral"

const TONE_STYLE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  default: { bg: "bg-[#f2f4f6]", fg: "text-text-secondary", dot: "bg-[#8b95a1]" },
  neutral: { bg: "bg-[#f2f4f6]", fg: "text-text-secondary", dot: "bg-[#8b95a1]" },
  blue: { bg: "bg-blue-light", fg: "text-blue", dot: "bg-blue" },
  success: { bg: "bg-success-light", fg: "text-success", dot: "bg-success" },
  warning: { bg: "bg-warning-light", fg: "text-[#b47908]", dot: "bg-warning" },
  error: { bg: "bg-error-light", fg: "text-error", dot: "bg-error" },
  purple: { bg: "bg-purple-light", fg: "text-purple", dot: "bg-purple" },
}

// Map any status label -> tone
export function toneFor(label: string): Tone {
  const s = label.trim()
  if (["완료", "성공", "통과", "병합 가능", "Merged", "등록됨", "배포 완료", "Check Success", "반영됨", "해결 완료"].some((k) => s.includes(k))) return "success"
  if (["실패", "차단", "오류", "Failed", "미등록", "치명적"].some((k) => s.includes(k))) return "error"
  if (["검토", "수정 필요", "경고", "진행 중", "확인 필요", "부분 반영", "미실행", "분석 중", "생성 중"].some((k) => s.includes(k))) return "warning"
  if (["실행 중", "실행 준비", "Draft", "대기"].some((k) => s.includes(k))) return s.includes("실행 중") ? "blue" : "neutral"
  if (["승인 대기", "Production", "수동 작업"].some((k) => s.includes(k))) return "purple"
  if (["Open", "검토 중"].some((k) => s.includes(k))) return "blue"
  return "neutral"
}

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const t = TONE_STYLE[tone ?? toneFor(String(children))]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ${t.bg} ${t.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  )
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${TONE_STYLE[tone].dot}`} />
}

// Human vs AI ownership. Kept visually distinct everywhere so it's always
// obvious who is responsible for a step — a person or an AI agent.
export function RoleChip({ owner, label }: { owner: "human" | "ai" | "both"; label?: string }) {
  const map = {
    human: { text: "사람", icon: "user", cls: "bg-warning-light text-[#b47908]" },
    ai: { text: "AI 에이전트", icon: "sparkle", cls: "bg-purple-light text-purple" },
    both: { text: "사람 + AI", icon: "handoff", cls: "bg-blue-light text-blue" },
  }[owner]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none ${map.cls}`}>
      <Icon name={map.icon} className="h-3 w-3" />
      {label ?? map.text}
    </span>
  )
}

// Small "DB ↔ Git 동기화됨" marker — data is stored in the DB and mirrored to Git.
export function SyncMark({ synced = true }: { synced?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${synced ? "bg-success-light text-success" : "bg-warning-light text-[#b47908]"}`}>
      <Icon name="sync" className="h-3 w-3" />
      DB {synced ? "↔" : "⇢"} Git {synced ? "동기화됨" : "동기화 중"}
    </span>
  )
}

// ---------- Buttons ----------
type BtnProps = {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "tertiary" | "danger"
  size?: "sm" | "md"
  icon?: ReactNode
  loading?: boolean
  full?: boolean
  disabled?: boolean
}
export function Button({ children, onClick, variant = "secondary", size = "md", icon, loading, full, disabled }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-all duration-150 active:scale-[.98] disabled:opacity-50 select-none"
  const sizes = size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11 px-4 text-[14px]"
  const variants = {
    primary: "bg-blue text-white hover:bg-blue-hover",
    secondary: "bg-[#f2f4f6] text-text-primary hover:bg-[#e9edf1]",
    tertiary: "bg-transparent text-text-secondary hover:bg-hover",
    danger: "bg-error-light text-error hover:bg-[#ffe1e3]",
  }
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${sizes} ${variants[variant]} ${full ? "w-full" : ""}`}>
      {loading ? <span className="af-spin h-4 w-4 rounded-full border-2 border-white/40 border-t-white" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, label, active }: { children: ReactNode; onClick?: () => void; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 ${active ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"}`}
    >
      {children}
    </button>
  )
}

// ---------- Card ----------
export function Card({ children, className = "", onClick, hover }: { children: ReactNode; className?: string; onClick?: () => void; hover?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[16px] border border-line bg-surface ${hover ? "cursor-pointer transition-all duration-200 hover:border-line-strong hover:shadow-[0_4px_16px_rgba(25,31,40,0.06)]" : ""} ${className}`}
    >
      {children}
    </div>
  )
}

export function SummaryCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: Tone }) {
  const accent = TONE_STYLE[tone].fg
  return (
    <Card className="p-5">
      <div className="text-[13px] font-medium text-text-tertiary">{label}</div>
      <div className={`mt-2 text-[28px] font-bold leading-tight tracking-tight ${tone === "default" ? "text-text-primary" : accent}`}>{value}</div>
      {sub && <div className="mt-1 text-[12px] font-medium text-text-tertiary">{sub}</div>}
    </Card>
  )
}

export function SectionTitle({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-text-primary">{title}</h1>
        {desc && <p className="mt-2 text-[14px] text-text-secondary">{desc}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------- Search ----------
export function SearchField({ placeholder = "검색", value, onChange }: { placeholder?: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 focus-within:border-blue">
      <Icon name="search" className="h-4 w-4 text-text-tertiary" />
      <input placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} className="w-full bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-tertiary" />
    </div>
  )
}

export function Toggle({ on, onChange, danger }: { on: boolean; onChange?: () => void; danger?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? (danger ? "bg-error" : "bg-blue") : "bg-line-strong"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-6" : "left-1"}`} />
    </button>
  )
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`relative px-3.5 py-3 text-[14px] font-semibold transition-colors ${active === t ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
        >
          {t}
          {active === t && <span className="absolute inset-x-3.5 -bottom-px h-0.5 rounded-full bg-blue" />}
        </button>
      ))}
    </div>
  )
}

// ---------- Drawer ----------
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    if (open) window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="af-overlay absolute inset-0 bg-[#191f28]/25" onClick={onClose} />
      <aside className="af-drawer relative flex h-full w-full max-w-[440px] flex-col bg-surface shadow-[var(--shadow-drawer)]">
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div className="min-w-0 text-[15px] font-bold text-text-primary">{title}</div>
          <div className="flex items-center gap-1">
            <IconButton label="GitHub에서 열기"><Icon name="github" className="h-5 w-5" /></IconButton>
            <IconButton label="닫기" onClick={onClose}><Icon name="close" className="h-5 w-5" /></IconButton>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-line bg-surface-2 px-5 py-4">{footer}</footer>}
      </aside>
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="af-overlay absolute inset-0 bg-[#191f28]/30" onClick={onClose} />
      <div className="af-fade relative w-full max-w-[480px] rounded-[20px] bg-surface p-6 shadow-[var(--shadow-modal)]">
        <h2 className="text-[19px] font-bold text-text-primary">{title}</h2>
        <div className="mt-4 text-[14px] text-text-secondary">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Empty / states ----------
export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line bg-surface-2 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-light text-blue">
        <Icon name="inbox" className="h-7 w-7" />
      </div>
      <div className="mt-4 text-[16px] font-bold text-text-primary">{title}</div>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-text-secondary">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[13px] text-text-tertiary">{label}</span>
      <span className="text-right text-[13px] font-medium text-text-primary">{value}</span>
    </div>
  )
}

export function Progress({ value, tone = "blue" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef1f4]">
      <div className={`h-full rounded-full ${TONE_STYLE[tone].dot} transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ---------- Icons (inline SVG, stroke-based) ----------
const PATHS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  github: <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 2-2.5 3.5" /><path d="M12 17h.01" /></>,
  sync: <><path d="M21 12a9 9 0 0 1-9 9c-2.5 0-4.7-1-6.3-2.7L3 16" /><path d="M3 12a9 9 0 0 1 9-9c2.5 0 4.7 1 6.3 2.7L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M6 4v16l14-8z" />,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  critic: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  ia: <><rect x="9" y="3" width="6" height="4" rx="1" /><rect x="3" y="17" width="6" height="4" rx="1" /><rect x="15" y="17" width="6" height="4" rx="1" /><path d="M12 7v4M12 11H6v6M12 11h6v6" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  flow: <><rect x="4" y="3" width="7" height="5" rx="1.5" /><rect x="13" y="16" width="7" height="5" rx="1.5" /><path d="M7.5 8v4a2 2 0 0 0 2 2h7" /></>,
  palette: <><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="10" r="1" /></>,
  board: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>,
  pr: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5v7M18 15.5V11a3 3 0 0 0-3-3h-3l2-2m-2 2 2 2" /></>,
  runs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  test: <><path d="M9 3h6M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" /></>,
  manual: <><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 19 4.6l-.1.1" /></>,
  rocket: <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.7a1.9 1.9 0 0 0-3 -.3Z" /><path d="M12 15 9 12a11 11 0 0 1 6-8c2.5-.6 4 1 4 1s1.6 1.5 1 4a11 11 0 0 1-8 6Z" /><circle cx="14.5" cy="9.5" r="1.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  cmd: <><path d="M9 4a3 3 0 1 0 0 6h6a3 3 0 1 0 0-6 3 3 0 0 0-3 3v10a3 3 0 1 1-3-3h6a3 3 0 1 1 3 3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18 4v3M20 5.5h-3" /></>,
  handoff: <><path d="M7 8h9l-2.5-2.5M17 16H8l2.5 2.5" /></>,
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name] ?? PATHS.overview}
    </svg>
  )
}
