// 외부 알림 채널 (Slack Webhook · 이메일) — 설정 화면이 써요.
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`
    try {
      const body = (await res.json()) as { message?: string; error?: string }
      msg = body.message || body.error || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export type NotifyStatus = { slackConfigured: boolean; emailTo: string | null; smtpConfigured: boolean; emailReady: boolean }
export type NotifyTest = { slack: { ok: boolean; message: string }; email: { ok: boolean; message: string } }

export const getNotifyStatus = () => j<NotifyStatus>("/api/notify/status")

export const setNotifyConfig = (cfg: { slackWebhook?: string; emailTo?: string }) =>
  j<NotifyStatus>("/api/notify/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  })

export const testNotify = () => j<NotifyTest>("/api/notify/test", { method: "POST" })
