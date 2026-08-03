package dev.agentflow.util

import dev.agentflow.dto.ProjectRepo

// 저장소 좌표 해석 — URL 이 있으면 URL 의 owner/이름, 없으면 프로젝트 org/이름.
object RepoCoords {
  private val URL_RE = Regex("""github\.com[:/]+([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$""")

  fun of(org: String, repo: ProjectRepo): Pair<String, String> {
    val m = URL_RE.find(repo.url)
    return if (m != null) m.groupValues[1] to m.groupValues[2] else org to repo.name
  }
}
