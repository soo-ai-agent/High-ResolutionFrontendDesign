package dev.agentflow.domain

import com.fasterxml.jackson.module.kotlin.readValue
import dev.agentflow.dto.ProjectRepo
import dev.agentflow.util.Json
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

// 복합 필드(리스트 등)는 JSON 텍스트 컬럼으로 저장해요 — H2/Postgres 공통으로 동작.
@Converter
class StringListConverter : AttributeConverter<List<String>, String> {
  override fun convertToDatabaseColumn(attribute: List<String>?): String = Json.mapper.writeValueAsString(attribute ?: emptyList<String>())
  override fun convertToEntityAttribute(dbData: String?): List<String> =
    if (dbData.isNullOrBlank()) emptyList() else Json.mapper.readValue(dbData)
}

@Converter
class ProjectRepoListConverter : AttributeConverter<List<ProjectRepo>, String> {
  override fun convertToDatabaseColumn(attribute: List<ProjectRepo>?): String = Json.mapper.writeValueAsString(attribute ?: emptyList<ProjectRepo>())
  override fun convertToEntityAttribute(dbData: String?): List<ProjectRepo> =
    if (dbData.isNullOrBlank()) emptyList() else Json.mapper.readValue(dbData)
}
