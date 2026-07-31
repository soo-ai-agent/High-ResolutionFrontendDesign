# 배포 가이드 (실제 도구 전환 · Phase 0)

이 앱은 **정적 프론트엔드(dist)** + **무의존성 API 서버**(`server/index.mjs`, node 내장 모듈만 사용)로 구성돼요.
같은 서버가 SPA를 서빙하고 `/api/*`(GitHub 프록시·웹훅 수신·미러 읽기)를 처리해요.

> 아직 결정 대기: **인증 모델**(단일 사용자 PAT ↔ GitHub OAuth), **호스트 선택**. 아래는 그 결정과 무관하게 필요한 공통 토대예요.

## 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `PORT` | — | `8443` | 서버 리슨 포트 |
| `MIRROR_DATA_DIR` | 권장 | `server/.data` | 미러 JSON 저장 위치. 컨테이너에선 **영속 볼륨**을 가리키게 하세요(`/data`). |
| `GITHUB_WEBHOOK_SECRET` | 운영 필수 | (없음) | 웹훅 `x-hub-signature-256` HMAC 검증 키. **미설정 시 검증을 생략**하고 이벤트를 `미검증`으로 저장(개발용). 운영에선 반드시 설정하고, GitHub 웹훅 등록 시 같은 값을 넣으세요. |

> PAT는 환경 변수가 아니라 **런타임에 설정 › 연동**에서 연결해요(서버 메모리 보관). 프로세스 재시작 시 사라져요 — 아래 "인증" 참고.

## 로컬에서 운영 모드로 실행

```bash
pnpm install
pnpm build            # dist/ + dist/bootstrap.json 생성
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32) \
MIRROR_DATA_DIR=./.data \
pnpm serve            # → http://localhost:8443
```

헬스체크: `GET /api/health` → `{"ok":true}`

## Docker

```bash
docker build -t agent-flow .
docker run -p 8443:8443 \
  -e GITHUB_WEBHOOK_SECRET=<secret> \
  -v agent-flow-data:/data \
  agent-flow
```

- 런타임 이미지는 `node:22-slim` + `dist/` + `server/` 뿐 — **node_modules 없음**(서버가 무의존성).
- `/data` 볼륨에 미러가 영속돼요.

## GitHub 웹훅 연결 (배포 후)

1. **설정 › 연동**에서 PAT로 GitHub 연결 (`admin:repo_hook` 권한 포함).
2. **GitHub 미러 › 웹훅 연결** 카드에서:
   - 전달 URL = `https://<배포주소>/api/webhook/github`
   - 시크릿 = `GITHUB_WEBHOOK_SECRET` 과 **동일한 값**
   - **웹훅 등록** → 저장소에 수신 웹훅 생성.
3. 조직 레벨 `projects_v2_item`(실 보드 이동)은 조직 설정의 웹훅에서 따로 켜세요.

## 인증 (결정 필요)

- **현재: 단일 사용자 PAT** — 서버 메모리에 토큰 1개. 재시작 시 재연결 필요. 내부·개인용 도구면 이대로 충분.
- **확장: GitHub OAuth App** — 다중 사용자·팀용. 각자 GitHub 로그인 → 서버가 코드 교환·세션 관리. 콜백 URL 등록이 필요하므로 **호스트 확정 후** 진행.

## Fly.io 배포 (권장 · `fly.toml` 준비됨)

`fly.toml` 과 `Dockerfile` 은 이미 리포에 있어요. flyctl 로 그대로 배포돼요.

```bash
# 0) flyctl 설치 + 로그인 (최초 1회)
curl -L https://fly.io/install.sh | sh
fly auth login

# 1) 앱 이름 정하기 (전역 고유) — fly.toml 의 app = "agent-flow" 를 원하는 이름으로 바꾸거나:
fly apps create <내-앱이름>       # 그리고 fly.toml 의 app 값도 동일하게 수정

# 2) 미러 영속 볼륨 생성 (fly.toml 의 리전과 동일하게)
fly volumes create data --region nrt --size 1

# 3) 웹훅 시크릿 주입 (fly.toml 에 두지 않아요)
fly secrets set GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
#   → 출력된 값을 잘 보관하세요. 나중에 웹훅 등록 시 같은 값을 넣어요.

# 4) 배포 (원격 빌더가 Dockerfile 을 빌드)
fly deploy

# 5) 확인
fly open                         # 브라우저로 앱 열기
curl https://<앱>.fly.dev/api/health   # → {"ok":true}
```

- `fly.toml` 은 `min_machines_running = 1` 로 **최소 1대 상시가동** → 웹훅 콜드스타트 누락 방지.
  비용을 줄이려면 `0` 으로 낮출 수 있지만, 정지 상태에서 들어온 웹훅이 깨어나기 전 타임아웃될 수 있어요.
- 헬스체크는 `/api/health`, 미러는 `/data` 볼륨에 영속.
- 배포 후 **설정 › 연동**에서 PAT 연결 → **GitHub 미러 › 웹훅 연결**에서 전달 URL `https://<앱>.fly.dev/api/webhook/github` + 3)의 시크릿으로 등록.

## 다른 호스트 (택1 · 컨테이너 기반이면 위 Dockerfile 그대로)

- **Render** — Web Service(Docker), Disk를 `/data`에 마운트, 환경 변수로 시크릿 주입. GitHub 연동 배포 간편.
- **Cloud Run** — 서버리스. 단, 파일 영속이 어려우니 이 경우 `server/db.mjs`를 외부 DB(예: Cloud SQL/Postgres) DAO로 교체 필요.

## 다음 단계 (Phase 1 후보)

- 관찰 루프부터 실데이터화(실 저장소 웹훅 → 미러 → 보드/미러 화면).
- 미러 백필: 연결 직후 현재 이슈·PR·런을 프록시로 한 번 당겨오기(웹훅은 미래 이벤트만 줌).
- 파일 저장 → SQLite/Postgres DAO 교체(동일 `db` 인터페이스 유지).
