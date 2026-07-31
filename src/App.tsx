import { useState, type ReactElement } from "react"
import Layout from "./components/Layout"
import Login from "./screens/Login"
import Projects from "./screens/Projects"
import Overview from "./screens/Overview"
import Interview from "./screens/Interview"
import { Sources, PRD, Critic, IA, ScreenList, ScreenDetail, Flow, DesignSystem } from "./screens/Design"
import { Tasks, PullRequests, Runs, Tests } from "./screens/Dev"
import { ManualTasks, Releases, Settings } from "./screens/Ops"

const SCREENS: Record<string, (nav: (r: string) => void) => ReactElement> = {
  overview: (nav) => <Overview navigate={nav} />,
  sources: (nav) => <Sources navigate={nav} />,
  interview: (nav) => <Interview navigate={nav} />,
  prd: (nav) => <PRD navigate={nav} />,
  critic: (nav) => <Critic navigate={nav} />,
  ia: (nav) => <IA navigate={nav} />,
  screens: (nav) => <ScreenList navigate={nav} />,
  "screen-detail": (nav) => <ScreenDetail navigate={nav} />,
  flow: () => <Flow />,
  "design-system": () => <DesignSystem />,
  tasks: (nav) => <Tasks navigate={nav} />,
  "pull-requests": (nav) => <PullRequests navigate={nav} />,
  runs: () => <Runs />,
  tests: () => <Tests />,
  "manual-tasks": () => <ManualTasks />,
  releases: () => <Releases />,
  settings: () => <Settings />,
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

  const render = SCREENS[route] ?? SCREENS.overview
  return (
    <Layout route={route} navigate={navigate}>
      <div key={route} className="af-fade">{render(navigate)}</div>
    </Layout>
  )
}
