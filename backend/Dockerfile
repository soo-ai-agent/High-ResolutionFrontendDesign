# syntax=docker/dockerfile:1
# Kotlin/Spring 백엔드 이미지 — 프론트엔드(dist)까지 함께 빌드해 단일 오리진으로 서빙.
# 빌드 컨텍스트는 저장소 루트: docker build -f backend/Dockerfile -t agentflow-kt .

# 1) 프론트엔드 빌드
FROM node:22-slim AS web
WORKDIR /app
# CI=true: TTY 없는 빌드에서 pnpm 이 modules 정리 프롬프트로 멈추지 않게.
# COREPACK_ENABLE_DOWNLOAD_PROMPT=0: corepack 이 pnpm 다운로드를 자동 승인.
# pnpm 버전은 package.json 의 packageManager 필드(=10.34.3)로 고정 → 재현성.
ENV CI=true
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 2) 백엔드 jar (processResources 가 ../dist 를 static 으로 포함)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY backend/ backend/
COPY --from=web /app/dist/ dist/
RUN cd backend && chmod +x gradlew && ./gradlew bootJar --no-daemon -x test

# 3) 런타임 (JRE)
FROM eclipse-temurin:21-jre
WORKDIR /app
ENV PORT=8443
ENV MIRROR_DATA_DIR=/data
# 컨테이너 메모리에 맞춰 힙을 잡아요(JDK 21 은 cgroup 인식이 기본 on). VM 메모리의 70%를 힙 상한으로.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0"
# GITHUB_WEBHOOK_SECRET, (운영) SPRING_PROFILES_ACTIVE=prod + DATABASE_URL 을 주입하세요.
COPY --from=build /app/backend/build/libs/*.jar app.jar
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8443
CMD ["java", "-jar", "app.jar"]
