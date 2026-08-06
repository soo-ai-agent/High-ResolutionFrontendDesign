import { useState, type ReactElement } from "react"
import Layout from "./components/Layout"
import Login from "./screens/Login"
import Projects from "./screens/Projects"
import Pipeline from "./screens/Pipeline"
import Mirror from "./screens/Mirror"
import Board from "./screens/Board"
import { HumanTasks, Settings } from "./screens/Ops"
import ProjectDocScreen from "./screens/ProjectDoc"
import TasksScreen from "./screens/Tasks"
import QaScreen from "./screens/Qa"
import type { ProjectItem } from "./data"

// MVP 6화면: 로그인 · 프로젝트 · 진행 흐름 · GitHub 미러 · Projects 보드 · 휴먼태스크 · 설정(연동)
const SCREENS: Record<string, (nav: (r: string) => void, project: ProjectItem | null) => ReactElement> = {
  pipeline: (nav, project) => <Pipeline navigate={nav} project={project} />,
  prd: (_nav, project) => <ProjectDocScreen project={project} docType="prd" />,
  ia: (_nav, project) => <ProjectDocScreen project={project} docType="ia" />,
  rules: (_nav, project) => <ProjectDocScreen project={project} docType="rules" />,
  tasks: (_nav, project) => <TasksScreen project={project} />,
  mirror: (nav) => <Mirror navigate={nav} />,
  "projects-board": () => <Board />,
  "human-tasks": (_nav, project) => <HumanTasks project={project} />,
  qa: () => <QaScreen />,
  settings: (nav) => <Settings navigate={nav} />,
}

export default function App() {
  const [route, setRoute] = useState("login")
  // 안쪽(Layout) 화면들이 보여줄 실제 선택 프로젝트 — 카드 클릭 시 채워져요.
  const [project, setProject] = useState<ProjectItem | null>(null)
  const navigate = (r: string) => {
    setRoute(r)
    const main = document.querySelector("main")
    if (main) main.scrollTop = 0
  }

  if (route === "login") return <Login onLogin={() => navigate("projects")} />
  if (route === "projects")
    return <Projects navigate={navigate} onOpen={(p) => { setProject(p); navigate("pipeline") }} />

  const render = SCREENS[route] ?? SCREENS.pipeline
  return (
    <Layout route={route} navigate={navigate} project={project}>
      <div key={route} className="af-fade">{render(navigate, project)}</div>
    </Layout>
  )
}
