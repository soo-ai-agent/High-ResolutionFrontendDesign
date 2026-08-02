import { useState, type ReactElement } from "react"
import Layout from "./components/Layout"
import Login from "./screens/Login"
import Projects from "./screens/Projects"
import Pipeline from "./screens/Pipeline"
import Mirror from "./screens/Mirror"
import Board from "./screens/Board"
import { HumanTasks, Settings } from "./screens/Ops"

// MVP 6화면: 로그인 · 프로젝트 · 진행 흐름 · GitHub 미러 · Projects 보드 · 휴먼태스크 · 설정(연동)
const SCREENS: Record<string, (nav: (r: string) => void) => ReactElement> = {
  pipeline: (nav) => <Pipeline navigate={nav} />,
  mirror: (nav) => <Mirror navigate={nav} />,
  "projects-board": () => <Board />,
  "human-tasks": () => <HumanTasks />,
  settings: (nav) => <Settings navigate={nav} />,
}

export default function App() {
  const [route, setRoute] = useState("login")
  const navigate = (r: string) => {
    setRoute(r)
    const main = document.querySelector("main")
    if (main) main.scrollTop = 0
  }

  if (route === "login") return <Login onLogin={() => navigate("projects")} />
  if (route === "projects") return <Projects navigate={navigate} />

  const render = SCREENS[route] ?? SCREENS.pipeline
  return (
    <Layout route={route} navigate={navigate}>
      <div key={route} className="af-fade">{render(navigate)}</div>
    </Layout>
  )
}
