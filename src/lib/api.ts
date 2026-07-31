// 서버에서 앱 데이터를 받아오는 클라이언트.
// 개발/프리뷰에서는 Vite 서버의 API 미들웨어가, 프로덕션에서는 Node 서버가
// /api/bootstrap 을 제공해요. 정적 호스팅만 있는 경우 /bootstrap.json 으로 폴백해요.

export type Bootstrap = Record<string, any>

async function tryFetch(url: string): Promise<Bootstrap | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) return null
    return (await res.json()) as Bootstrap
  } catch {
    return null
  }
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const data = (await tryFetch("/api/bootstrap")) ?? (await tryFetch("/bootstrap.json"))
  if (!data) throw new Error("서버에서 데이터를 불러오지 못했어요. (/api/bootstrap)")
  return data
}
