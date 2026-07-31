# syntax=docker/dockerfile:1

# ---- build: 프론트엔드(dist)와 bootstrap.json 생성 ----
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
# 의존성 먼저 — 소스가 바뀌어도 레이어 캐시 재사용
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime: 정적 dist + 무의존성 node:http API 서버 ----
# server/*.mjs 는 node 내장 모듈만 써서 node_modules 가 필요 없어요.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8443
# 미러 저장 위치 — 아래 VOLUME 에 영속화돼요.
ENV MIRROR_DATA_DIR=/data
# GITHUB_WEBHOOK_SECRET 는 배포 시 주입하세요(미설정 시 서명 검증 생략=개발용).

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8443
CMD ["node", "server/index.mjs"]
