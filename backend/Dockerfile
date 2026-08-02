# syntax=docker/dockerfile:1
# Kotlin/Spring 백엔드 이미지 — 프론트엔드(dist)까지 함께 빌드해 단일 오리진으로 서빙.
# 빌드 컨텍스트는 저장소 루트: docker build -f backend/Dockerfile -t agentflow-kt .

# 1) 프론트엔드 빌드
FROM node:22-slim AS web
WORKDIR /app
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
# GITHUB_WEBHOOK_SECRET, (운영) SPRING_PROFILES_ACTIVE=prod + DATABASE_URL 을 주입하세요.
COPY --from=build /app/backend/build/libs/*.jar app.jar
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8443
CMD ["java", "-jar", "app.jar"]
