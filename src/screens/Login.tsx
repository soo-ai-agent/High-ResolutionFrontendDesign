import { Button, Icon } from "../components/ui"

export default function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0f1b33] p-14 lg:flex">
        <div className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-blue">
            <Icon name="flow" className="h-5 w-5" />
          </span>
          <span className="text-[19px] font-bold">Agent Flow</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-[40px] font-bold leading-[1.25] tracking-tight text-white">
            기획부터 배포까지,<br />GitHub 안에서 자연스럽게
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[#a9b7cf]">
            PRD, 개발 작업, Pull Request와 배포 상태를 한곳에서 관리하세요.
          </p>
        </div>

        <AbstractGraphic />
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-16 h-72 w-72 rounded-full bg-purple/20 blur-3xl" />
      </div>

      {/* Right login card */}
      <div className="flex items-center justify-center bg-app p-6">
        <div className="w-full max-w-[400px] rounded-[20px] border border-line bg-surface p-8 shadow-[var(--shadow-modal)]">
          <h2 className="text-[24px] font-bold tracking-tight text-text-primary">GitHub로 시작하기</h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary">
            저장소를 연결하고 자동화 상태를 확인할 수 있어요.
          </p>

          <div className="mt-8">
            <Button variant="primary" full onClick={onLogin} icon={<Icon name="github" className="h-5 w-5" />}>
              GitHub로 계속하기
            </Button>
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-[12px] bg-surface-2 p-4">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
            <p className="text-[12px] leading-relaxed text-text-tertiary">
              저장소 접근 권한은 연결 과정에서 직접 선택할 수 있어요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AbstractGraphic() {
  const nodes = [
    { x: 12, y: 20, label: "Issue", tone: "#3182f6" },
    { x: 62, y: 12, label: "Actions", tone: "#7c5cfc" },
    { x: 40, y: 52, label: "Agent", tone: "#00a86b" },
    { x: 80, y: 60, label: "PR", tone: "#3182f6" },
  ]
  return (
    <div className="relative z-10 h-56 w-full max-w-lg">
      <svg viewBox="0 0 100 72" className="h-full w-full">
        <path d="M12 24 L40 52 L80 60 M62 16 L40 52" stroke="#2a3d5f" strokeWidth="0.6" fill="none" strokeDasharray="2 2" />
      </svg>
      {nodes.map((n) => (
        <div key={n.label} className="absolute flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <span className="h-2 w-2 rounded-full" style={{ background: n.tone }} />
          <span className="text-[12px] font-semibold text-[#dbe4f2]">{n.label}</span>
        </div>
      ))}
    </div>
  )
}
