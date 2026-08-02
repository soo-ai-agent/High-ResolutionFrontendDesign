# Agent Flow — Kotlin/Spring 백엔드

Node 백엔드(`server/*.mjs`)와 **동일한 `/api/*` 계약**을 Kotlin + Spring Boot 로 이식한 것.
프론트엔드는 한 줄도 바뀌지 않아요 (같은 계약을 호출).

## 스택
- Kotlin 1.9 · Spring Boot 3.3 (Web, Data JPA) · Java 21
- **로컬/기본**: H2 파일 DB · **운영(prod)**: Postgres (프로파일)
- 무프레임워크 Node 대비: 실 DB(JPA)·검증·생태계. 대신 JVM 무게.

## 엔드포인트 (Node 와 동일)
`/api/health` · `/api/bootstrap` · `/api/github/{status,connect,disconnect,issues,claude,hooks,hooks/ping,backfill}` ·
`/api/webhook/github`(HMAC) · `/api/mirror/{summary,issues(PATCH),pulls,runs,repos,events,board,reset,projects}`

## 실행 (로컬 · H2)
```bash
pnpm build                 # 프론트엔드 dist 생성 (백엔드가 static 으로 서빙)
cd backend
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32) MIRROR_DATA_DIR=./.data PORT=8443 \
  ./gradlew bootRun
# 또는: ./gradlew bootJar && java -jar build/libs/agentflow-backend-0.1.0.jar
```
→ http://localhost:8443 (SPA + API 단일 오리진)

## 환경 변수
| 변수 | 기본 | 설명 |
|---|---|---|
| `PORT` | 8443 | 리슨 포트 |
| `MIRROR_DATA_DIR` | ./.data | H2 파일 위치(컨테이너에선 볼륨) |
| `GITHUB_WEBHOOK_SECRET` | (없음) | 웹훅 HMAC 키. 미설정 시 검증 생략(개발용) |
| `GITHUB_API_BASE` | api.github.com | GH Enterprise/테스트 스텁용 |
| `SPRING_PROFILES_ACTIVE` | (default=H2) | `prod` → Postgres |
| `DATABASE_URL` | — | prod: `jdbc:postgresql://…`(+`DATABASE_USER`/`DATABASE_PASSWORD`) 또는 `postgres://user:pass@host/db` DSN. `DataSourceConfig` 가 둘 다 파싱. |

## Docker
```bash
docker build -f backend/Dockerfile -t agentflow-kt .   # 컨텍스트=저장소 루트
docker run -p 8443:8443 -e GITHUB_WEBHOOK_SECRET=... -v kt-data:/data agentflow-kt
```

## 운영 전환 메모
- 시드(`bootstrap.json`)는 프론트 빌드 산출물을 복사해 리소스로 포함 — 서버 소유 시드가 필요하면 이 파일을 관리하세요.
- Node 백엔드(`server/`)는 전환 중 병렬로 남겨둘 수 있어요. 같은 계약이라 프론트는 어느 쪽이든 동작.
