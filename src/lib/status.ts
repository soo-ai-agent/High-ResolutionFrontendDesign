// 상단바(헤더)용 실서버 상태 훅.
//
// GitHub 연결 상태(/api/github/status)와 DB 미러 요약(/api/mirror/summary)을 합쳐서
// 헤더가 "실제" 상태를 보여주게 해요. 하드코딩된 배지를 대체해요.
import { useEffect, useState } from "react"
import { useGitHub } from "./github"
import { getSummary, type MirrorSummary } from "./mirror"

export function useServerStatus(pollMs = 15000) {
  const { connected, user } = useGitHub()
  const [summary, setSummary] = useState<MirrorSummary | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const s = await getSummary()
        if (alive) setSummary(s)
      } catch {
        // 서버 미가동/일시 오류는 조용히 무시 — 다음 폴링에서 회복돼요.
      }
    }
    void tick()
    const id = window.setInterval(tick, pollMs)
    const onFocus = () => void tick()
    window.addEventListener("focus", onFocus)
    return () => {
      alive = false
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [pollMs])

  return { connected, user, summary }
}
