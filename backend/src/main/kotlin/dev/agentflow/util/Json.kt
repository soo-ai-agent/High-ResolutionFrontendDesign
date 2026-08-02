package dev.agentflow.util

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

// JPA AttributeConverter 는 Spring 빈이 아니라 직접 인스턴스화되므로 자체 ObjectMapper 를 둬요.
object Json {
  val mapper: ObjectMapper = jacksonObjectMapper()
}
