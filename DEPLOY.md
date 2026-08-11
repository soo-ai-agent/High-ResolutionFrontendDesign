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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 선택 | (없음) | 이메일 알림(검토 대기·리뷰 한도·브리지 실패·CI 회복 오류) 발신 서버. 받는 주소는 **설정 › 외부 알림 채널**에서 입력. `SMTP_STARTTLS=false` 로 STARTTLS 끔. |
| `E2E_COMMAND` | 선택 | (없음) | 대시보드 '테스트 실행' 버튼이 스폰할 명령 (예: `node e2e/run.mjs`). |
| `BRIDGE_COMMAND` / `BRIDGE_GIT_BASE` | 선택 | claude CLI / github.com | 로컬 브리지의 실행 명령·클론 원격 베이스 오버라이드. |
| `DATABASE_URL` | prod | — | 두 형식 지원: `jdbc:postgresql://host:5432/db`(+ `DATABASE_USER`/`DATABASE_PASSWORD`) **또는** `postgres://user:pass@host:5432/db` DSN(Fly/Render/Heroku). `prod` 프로파일이면 JPA가 테이블을 자동 생성(ddl-auto=update). |

> PAT는 환경 변수가 아니라 **런타임에 설정 › 연동**에서 연결해요. 연결하면 데이터 폴더 DB에
> 평문 저장돼 **재시작에도 유지**돼요(데이터 폴더 접근 권한 = 토큰 접근 권한 — 볼륨 권한에 주의).

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

## Docker Hub 로 설치 (권장 Docker 경로)

빌드는 GitHub Actions 가 하고, 서버는 이미지를 받아 실행만 해요.

1. **이미지 발행 (1회 설정 + 버튼 1번)**
   - Docker Hub → Account Settings → Security → **New Access Token** (Read & Write) 발급.
   - GitHub 저장소 Settings → Secrets and variables → Actions 에 등록:
     `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
   - Actions 탭 → **Publish to Docker Hub** → Run workflow
     → `<아이디>/agent-flow:latest` + `:v<실행번호>` 태그로 발행돼요.
2. **서버에서 실행** — 저장소 루트의 `docker-compose.yml` 사용:
   ```bash
   # .env 예시
   DOCKERHUB_IMAGE=<아이디>/agent-flow:latest
   GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
   ANTHROPIC_API_KEY=sk-ant-...

   docker compose up -d          # → http://<서버>:8443
   ```
3. **HTTPS 도메인 연결** — GitHub 웹훅이 서버에 닿아야 자동화 루프(상태 전이·리뷰·CI 회복)가 돌아요.
   Caddy/Nginx/Traefik 등 리버스 프록시로 `https://<도메인>` → `localhost:8443` 을 연결하세요.
4. 업데이트: 워크플로 재실행 → 서버에서 `docker compose pull && docker compose up -d`.

## GitHub 웹훅 연결 (배포 후)
1. **설정 › 연동**에서 PAT 연결 (`admin:repo_hook` 포함).
2. **GitHub 미러 › 웹훅 연결**: 전달 URL `https://<배포주소>/api/webhook/github` + `GITHUB_WEBHOOK_SECRET` 과 동일한 시크릿 → 등록.
3. 조직 레벨 `projects_v2_item`(실 보드 이동)은 조직 웹훅에서 따로 켜세요.

## Fly.io (`fly.toml` 준비됨 · `backend/Dockerfile` 사용)

아래 `<app>` 을 **전역 고유한** 원하는 앱 이름으로 바꿔 넣으세요(모든 명령 + `fly.toml` 3번째 줄까지 동일하게).

```bash
# 1) flyctl 설치 — 설치기는 ~/.fly/bin 에 넣지만 현재 셸 PATH 엔 추가하지 않아요.
#    그래서 install 과 login 을 && 로 잇지 말고, PATH 를 명시적으로 넣은 뒤 로그인.
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"; export PATH="$FLYCTL_INSTALL/bin:$PATH"
fly auth login
# (또는 패키지 매니저로 설치하면 PATH 에 바로 잡혀요: brew install flyctl 등)

# 2) 앱 생성 + fly.toml 동기화 — 이름이 어긋나면 이후 명령이 'Could not find App' 로 실패해요.
fly apps create <app>
#   ↑ 그런 다음 fly.toml 3번째 줄을 만든 이름과 똑같이 편집: app = "<app>"

# 3) 영속 볼륨(H2용) + 웹훅 시크릿 — deploy 전에 먼저.
fly volumes create data --region nrt --size 1     # 리전은 fly.toml primary_region 과 동일
fly secrets set GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)

# 4) (권장) 운영 Postgres — attach 가 DATABASE_URL(postgres:// DSN)을 자동 주입, 백엔드가 그 형식 지원.
fly postgres create --name <app>-db --region nrt  # 설정 프리셋을 물어보면 'Development' 선택(대화형)
fly postgres attach <app>-db                       # → DATABASE_URL 시크릿 설정됨
fly secrets set SPRING_PROFILES_ACTIVE=prod        # attach '다음'에! (prod 인데 DATABASE_URL 없으면 부팅 실패)
#   ↑ 최신 flyctl 은 관리형 Postgres 를 권장: `fly mpg create` / `fly mpg attach <cluster>` (동일하게 DATABASE_URL 주입)

# 5) 배포 + 확인
fly deploy
curl https://<app>.fly.dev/api/health              # → {"ok":true}
```
- **리전 일치**: 볼륨·Postgres·앱을 같은 리전(`nrt`)으로. `fly.toml` 의 `primary_region` 과도 맞추세요.
- **메모리**: 첫 배포는 `[[vm]] memory = "1024mb"`(Spring Boot 여유). 안정화 후 `fly logs` 로 RSS 확인해 512mb 로 낮춰도 돼요.
- **상시가동**: `auto_stop_machines="off"` 로 머신을 끄지 않아 웹훅 콜드스타트 누락을 막아요.
- **Postgres(`prod`)** 를 붙이면 JPA가 테이블을 자동 생성(ddl-auto=update)하고 재시작·다중 머신에도 데이터가 유지돼요.
  Postgres 미사용 시 기본 H2 파일이 `/data` 볼륨에 영속(단일 머신).

## 인증(확장)
현재 단일 사용자 PAT(서버 메모리). 다중 사용자·팀이면 Spring Security + GitHub OAuth 로 확장.
