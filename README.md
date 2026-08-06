# 🌳 그늘길 — 그늘 예측 경로 앱

현재 **시간과 위치**로 태양의 방위·고도를 계산해 거리의 **그늘을 예측**하고, 햇빛을 피해
**최대한 그늘로 걸을 수 있는 경로**를 추천하는 웹앱입니다.

## 동작 방식

1. **현재 위치·시간 확인** — 브라우저 geolocation으로 출발지를 잡고(실패 시 상세 원인 안내 + 수동 선택 폴백), 30초 단위로 현재 시각을 따라갑니다.
2. **태양 위치 계산** — 외부 API 없이 순수 천문 계산(SunCalc 계열 저정밀 근사, 오차 0.5도 미만)으로 태양 방위각·고도각과 일출·일몰을 구합니다. `src/sun/sunPosition.ts`
3. **그늘 예측** — 도심 협곡(urban canyon) 모델: 건물 높이(기본 12m)와 길 폭(기본 12m)을 가정하고, 태양 고도의 그림자 길이(H/tan alt)와 길 진행 방향-태양 방위의 상대각으로 **구간별 그늘 비율**을 추정합니다. `src/shade/shadeModel.ts`
4. **경로 비교** — Tmap 보행자 경로 후보 4종(추천/대로우선/최단/계단제외)을 병렬 조회해 각 후보의 **길이 가중 그늘 비율**을 매기고, 그늘 최적 경로를 추천합니다. 지도에는 구간별 그늘 등급을 색(청록=그늘, 주황=햇빛)으로 표시합니다.
5. **시간 슬라이더** — 출발 시각을 지금~+3시간으로 옮기면 API 재호출 없이 그늘을 순수 재계산해 "언제 출발하면 그늘이 많은지"를 보여줍니다.

## 실행

```bash
pnpm install
pnpm dev        # http://localhost:8443
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest (태양 위치·그늘 모델·지오 유틸)
pnpm build
```

## 환경 변수 (`.env.local`)

`.env.example` 참고. **키가 없어도 앱은 동작**합니다(폴백 명시).

| 키 | 용도 | 미설정 시 |
|---|---|---|
| `VITE_KAKAO_JS_KEY` | Kakao 실지도 + 키워드 장소검색 | 간이 SVG 지도 + 서울 주요 지점 프리셋 |
| `VITE_TMAP_APP_KEY` | Tmap 실제 보행자 경로 후보 | 데모(격자) 경로 — "데모 경로" 배지 표시 |

## 구조

```
src/
  sun/sunPosition.ts      태양 방위·고도·일출일몰 (순수 계산, 신규)
  shade/shadeModel.ts     도심 협곡 그늘 모델 + 경로 그늘 점수 (신규)
  route/tmap.ts           Tmap 보행자 경로 클라이언트 (bueongi 이식, fetch화)
  route/mockRoutes.ts     키 미설정 시 데모 격자 경로 (신규)
  route/planShadeRoutes.ts 후보 수집 오케스트레이션 (신규)
  place/placeSearch.ts    Kakao 장소검색 + 프리셋 폴백 (신규)
  utils/currentLocation.ts 위치 조회 + 상세 실패 안내 (bueongi 이식)
  utils/kakaoMaps.ts      Kakao Maps SDK 동적 로더 (bueongi 이식)
  utils/geo.ts            haversine·경로 길이·방위각 (bueongi 이식 + 확장)
  components/             ShadeMap(실지도/간이 폴백)·SunPanel·TimeSlider·RouteCards
```

`bueongi`(안심귀가 앱) 저장소의 위치·지도·경로 기반 코드를 이식해 재사용했습니다.

## 그늘 모델의 한계

건물 실측 높이·가로수·차양 데이터 없이 균일 가정으로 계산한 **근사치**입니다. 화면에도 동일한
주의 문구를 표시합니다. 정밀도를 올리려면 건물 높이 GIS 데이터(예: 국토지리정보원 3D 건물)와
그림자 캐스팅을 백엔드에서 계산하는 확장이 필요합니다.
