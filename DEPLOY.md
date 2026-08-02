# 배포 가이드 (Kotlin/Spring 백엔드)

백엔드는 **Kotlin + Spring Boot**(`backend/`)이고, 빌드된 **프론트엔드(dist)를 static 리소스로 포함**해
단일 오리진으로 SPA + `/api/*` 를 함께 서빙해요. (Node 백엔드는 은퇴했어요.)

## 구성
- 프론트엔드: React + Vite → `dist/`
- 백엔드: Spring Boot 3.3(Web + Data JPA), Java 21. **기본 H2 파일 DB**, **운영 Postgres**(`prod` 프로파일).
- 시드(`/api/bootstrap`)는 `src/data.source.ts` → `dist/bootstrap.json` → 백엔드 `static/` 으로 포함.

## 환경 변수

| 변수 | 필수 | 기본 | 설명 |
|---|---|---|---|
| `PORT` | — | `8443` | 서버 포트 |
| `MIRROR_DATA_DIR` | 권장 | `./.data` | H2 파일 위치. 컨테이너에선 영속 볼륨(`/data`). |
| `GITHUB_WEBHOOK_SECRET` | 운영 필수 | (없음) | 웹훅 `x-hub-signature-256` HMAC 키. 미설정 시 검증 생략(개발용). |
| `GITHUB_API_BASE` | — | `https://api.github.com` | GH Enterprise/테스트 스텁용. |
| `SPRING_PROFILES_ACTIVE` | 운영 | (default=H2) | `prod` → Postgres. |
| `DATABASE_URL` | prod | — | Postgres JDBC URL(+ `DATABASE_USER`/`DATABASE_PASSWORD`). |

> PAT는 환경 변수가 아니라 **런타임에 설정 › 연동**에서 연결해요(서버 메모리). 재시작 시 사라져요.

## 로컬 실행

```bash
pnpm install && pnpm build          # 프론트 dist (백엔드가 static 으로 서빙)
cd backend
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32) MIRROR_DATA_DIR=./.data PORT=8443 \
  ./gradlew bootRun                 # → http://localhost:8443 (SPA + API)
# 또는: ./gradlew bootJar && java -jar build/libs/agentflow-backend-0.1.0.jar
```

### 프론트만 따로(HMR) 개발할 때
`pnpm backend` 는 백엔드를 **8080**으로 띄우고, `pnpm dev`(Vite 8443)는 `/api` 를 그 8080으로 프록시해요
(기본 `BACKEND_URL=http://127.0.0.1:8080`). 두 터미널에서:
```bash
pnpm backend    # 백엔드(8080) — cd backend && PORT=8080 ./gradlew bootRun
pnpm dev        # 프론트(8443, /api → 8080 프록시)
```
헬스체크: `GET /api/health` → `{"ok":true}`

## Docker

```bash
docker build -f backend/Dockerfile -t agent-flow .    # 컨텍스트=저장소 루트(프론트+백엔드 함께 빌드)
docker run -p 8443:8443 -e GITHUB_WEBHOOK_SECRET=<secret> -v agent-flow-data:/data agent-flow
```

## GitHub 웹훅 연결 (배포 후)
1. **설정 › 연동**에서 PAT 연결 (`admin:repo_hook` 포함).
2. **GitHub 미러 › 웹훅 연결**: 전달 URL `https://<배포주소>/api/webhook/github` + `GITHUB_WEBHOOK_SECRET` 과 동일한 시크릿 → 등록.
3. 조직 레벨 `projects_v2_item`(실 보드 이동)은 조직 웹훅에서 따로 켜세요.

## Fly.io (`fly.toml` 준비됨 · `backend/Dockerfile` 사용)
```bash
curl -L https://fly.io/install.sh | sh && fly auth login
fly apps create <내-앱이름>                 # fly.toml 의 app 값도 동일하게
fly volumes create data --region nrt --size 1
fly secrets set GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
# (운영 Postgres) fly secrets set SPRING_PROFILES_ACTIVE=prod DATABASE_URL=postgres://...
fly deploy
curl https://<앱>.fly.dev/api/health        # → {"ok":true}
```
- `min_machines_running=1`(상시가동)로 웹훅 콜드스타트 누락 방지. VM 512MB(JVM).
- H2 파일은 `/data` 볼륨에 영속. 다중 머신/영속 강화가 필요하면 **Postgres**(`prod`)로.

## 인증(확장)
현재 단일 사용자 PAT(서버 메모리). 다중 사용자·팀이면 Spring Security + GitHub OAuth 로 확장.
