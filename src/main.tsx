import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { hydrateData } from './data'
import { fetchBootstrap } from './lib/api'

const root = ReactDOM.createRoot(document.getElementById('root')!)

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f6', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#191f28' }}>데이터를 불러오지 못했어요</div>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: '#4e5968' }}>{message}</p>
        <p style={{ marginTop: 4, fontSize: 12, color: '#8b95a1' }}>서버가 실행 중인지 확인하세요. (개발: <code>pnpm dev</code> · 프로덕션: <code>pnpm serve</code>)</p>
        <button onClick={() => location.reload()} style={{ marginTop: 16, height: 40, padding: '0 16px', borderRadius: 10, border: 'none', background: '#3182f6', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>다시 시도</button>
      </div>
    </div>
  )
}

async function boot() {
  try {
    hydrateData(await fetchBootstrap())
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (e) {
    root.render(<ErrorScreen message={e instanceof Error ? e.message : String(e)} />)
  }
}

boot()
