plugins {
  id("org.springframework.boot") version "3.3.5"
  id("io.spring.dependency-management") version "1.1.6"
  kotlin("jvm") version "1.9.25"
  kotlin("plugin.spring") version "1.9.25"
  kotlin("plugin.jpa") version "1.9.25"
}

group = "dev.agentflow"
version = "0.1.0"

java {
  toolchain { languageVersion.set(JavaLanguageVersion.of(21)) }
}

repositories {
  mavenCentral()
}

dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
  implementation("org.springframework.boot:spring-boot-starter-data-jpa")
  implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
  implementation("org.jetbrains.kotlin:kotlin-reflect")
  runtimeOnly("com.h2database:h2")            // 로컬/기본 프로파일
  runtimeOnly("org.postgresql:postgresql")    // 운영(prod) 프로파일
  testImplementation("org.springframework.boot:spring-boot-starter-test")
}

kotlin {
  compilerOptions {
    freeCompilerArgs.add("-Xjsr305=strict")
  }
}

// JPA 엔티티는 no-arg 생성자가 필요해요 (kotlin-jpa 플러그인이 처리).
allOpen {
  annotation("jakarta.persistence.Entity")
  annotation("jakarta.persistence.MappedSuperclass")
  annotation("jakarta.persistence.Embeddable")
}

tasks.withType<Test> {
  useJUnitPlatform()
}

// bootJar(실행 가능한 fat jar)만 산출물로 남겨요. Spring Boot 가 기본으로 만드는
// `-plain.jar` 를 끄면 build/libs 에 jar 가 항상 하나뿐 → Dockerfile 의 `*.jar` COPY 가 결정적.
tasks.named("jar") { enabled = false }

// 프론트엔드 빌드(../dist)를 정적 리소스(static/)로 포함 — 단일 오리진으로 SPA + API 서빙.
// 먼저 `pnpm build` 로 dist 를 만들어 두세요. dist 가 없으면 조용히 건너뛰어요.
tasks.processResources {
  from(rootProject.projectDir.parentFile.resolve("dist")) { into("static") }
}
