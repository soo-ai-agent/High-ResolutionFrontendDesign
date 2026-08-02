package dev.agentflow.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.core.env.Environment
import java.net.URI
import javax.sql.DataSource

// prod 프로파일에서만 활성. DATABASE_URL 을 두 형식 모두 받아요:
//  1) jdbc:postgresql://host:5432/db          (+ DATABASE_USER / DATABASE_PASSWORD)
//  2) postgres(ql)://user:pass@host:5432/db    (Fly/Render/Heroku 가 주는 DSN)
@Configuration
@Profile("prod")
class DataSourceConfig {

  @Bean
  fun dataSource(env: Environment): DataSource {
    val raw = env.getProperty("DATABASE_URL")?.trim().orEmpty()
    require(raw.isNotEmpty()) { "prod 프로파일엔 DATABASE_URL 이 필요해요." }

    val cfg = HikariConfig().apply { driverClassName = "org.postgresql.Driver" }
    if (raw.startsWith("jdbc:")) {
      cfg.jdbcUrl = raw
      cfg.username = env.getProperty("DATABASE_USER").orEmpty()
      cfg.password = env.getProperty("DATABASE_PASSWORD").orEmpty()
    } else {
      val uri = URI(raw) // postgres://user:pass@host:port/db?sslmode=require
      val userInfo = uri.userInfo?.split(":", limit = 2) ?: emptyList()
      val port = if (uri.port > 0) uri.port else 5432
      val db = uri.path.trimStart('/')
      val query = uri.query?.let { "?$it" } ?: ""
      cfg.jdbcUrl = "jdbc:postgresql://${uri.host}:$port/$db$query"
      cfg.username = userInfo.getOrElse(0) { env.getProperty("DATABASE_USER").orEmpty() }
      cfg.password = userInfo.getOrElse(1) { env.getProperty("DATABASE_PASSWORD").orEmpty() }
    }
    return HikariDataSource(cfg)
  }
}
