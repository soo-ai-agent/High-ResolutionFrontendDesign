import type { LatLng } from '../types/geo';
import { hasValidLatLng } from './geo';

export type CurrentLocationFailureCode =
  'unsupported' | 'permission_denied' | 'unavailable' | 'timeout' | 'invalid_coordinates';

export class CurrentLocationError extends Error {
  readonly code: CurrentLocationFailureCode;
  /** 브라우저 geolocation 이 준 원문 코드(1/2/3) — 상세 안내에 노출. */
  readonly rawCode?: number;
  /** 브라우저 geolocation 이 준 원문 메시지 — 상세 안내에 노출. */
  readonly detail?: string;

  constructor(code: CurrentLocationFailureCode, message: string, opts?: { rawCode?: number; detail?: string }) {
    super(message);
    this.name = 'CurrentLocationError';
    this.code = code;
    this.rawCode = opts?.rawCode;
    this.detail = opts?.detail;
  }
}

export interface GeolocationProvider {
  getCurrentPosition: (
    success: (position: { coords: { latitude: number; longitude: number } }) => void,
    error?: (error: { code?: number; message?: string }) => void,
    options?: PositionOptions,
  ) => void;
}

export interface CurrentLocationOptions {
  geolocation?: GeolocationProvider | null;
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}

function getDefaultGeolocation(): GeolocationProvider | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator.geolocation as GeolocationProvider | undefined;
}

export function toCurrentLocationError(error: { code?: number; message?: string }): CurrentLocationError {
  const opts = { rawCode: error.code, detail: error.message };
  if (error.code === 1) {
    return new CurrentLocationError('permission_denied', 'Location permission was denied', opts);
  }
  if (error.code === 3) {
    return new CurrentLocationError('timeout', 'Location request timed out', opts);
  }
  return new CurrentLocationError('unavailable', error.message || 'Location is unavailable', opts);
}

/** geolocation 실패 객체를 사용자 안내 문구로 바로 변환(호출부 편의). */
export function getGeolocationErrorMessage(error: { code?: number; message?: string }): string {
  return getCurrentLocationErrorMessage(toCurrentLocationError(error));
}

/**
 * 위치 실패 팝업용 상세 안내(제목 + 여러 줄 설명).
 * 권한을 허용했는데도 실패하는 경우(POSITION_UNAVAILABLE 등)의 실제 원인과 조치를 구체적으로 알린다.
 * 브라우저가 준 원문 코드/메시지, 보안 컨텍스트 여부까지 함께 노출한다.
 */
export function getCurrentLocationErrorDetail(error: unknown): { title: string; description: string } {
  const isCurrentLocationError = error instanceof CurrentLocationError;
  const code: CurrentLocationFailureCode = isCurrentLocationError ? error.code : 'unavailable';
  const rawCode: number | undefined = isCurrentLocationError ? error.rawCode : undefined;
  const rawDetail: string | undefined = isCurrentLocationError
    ? error.detail
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : undefined;

  const lines: string[] = [];
  let title: string;
  switch (code) {
    case 'permission_denied':
      title = '위치 권한이 거부되었어요';
      lines.push('주소창 왼쪽 자물쇠 → 위치 "허용"으로 바꾸고, OS(브라우저) 위치 권한도 확인해 주세요.');
      break;
    case 'timeout':
      title = '위치 확인 시간이 초과됐어요';
      lines.push('제한 시간 안에 위치를 못 잡았어요. 다시 시도해 주세요.');
      lines.push('• 데스크톱은 GPS가 없어 Wi‑Fi/네트워크로 대략 위치를 잡아요 — 인터넷 연결을 확인하세요.');
      lines.push('• 실내·지하는 신호가 약할 수 있어요. 창가나 실외에서 시도해 보세요.');
      break;
    case 'unsupported':
      title = '이 환경에서는 위치를 쓸 수 없어요';
      lines.push('브라우저가 geolocation을 지원하지 않거나 비활성화돼 있어요.');
      break;
    case 'invalid_coordinates':
      title = '받은 위치 좌표가 올바르지 않아요';
      lines.push('위치는 수신했지만 좌표가 유효 범위를 벗어났어요. 다시 시도해 주세요.');
      break;
    case 'unavailable':
    default: {
      // macOS Core Location "denied"(kCLErrorDomain 오류 1) 시그니처면, OS 위치 권한 문제로 콕 집어 안내한다.
      const osDenied = /kclerror|core ?location|denied/i.test(rawDetail ?? '');
      if (osDenied) {
        title = '기기(OS) 위치 권한이 꺼져 있어요';
        lines.push(
          '브라우저 사이트 권한은 허용됐지만, macOS 시스템에서 위치 서비스가 꺼져 있거나 이 브라우저에 위치 권한이 없어요.',
        );
        lines.push(
          '설정 방법(macOS): 시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스 → 켜기, 그리고 사용 중인 브라우저를 "허용"으로.',
        );
        lines.push('설정 후 브라우저를 완전히 종료했다 다시 열어 주세요.');
      } else {
        title = '권한은 허용됐지만 위치를 못 가져왔어요';
        lines.push('가능한 원인:');
        lines.push('• OS(기기)의 위치 서비스가 꺼져 있음');
        lines.push('• Wi‑Fi/GPS 신호가 없거나 실내라 측위 불가');
        lines.push('• 브라우저 위치 공급자(네트워크)가 응답하지 않음');
      }
      break;
    }
  }

  // 보안 컨텍스트: HTTP(비 localhost)면 브라우저가 위치를 아예 차단한다.
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    lines.push('⚠ 지금 비보안(HTTP)으로 접속 중이라 브라우저가 위치를 차단해요. HTTPS 또는 localhost로 접속하세요.');
  }
  if (rawCode != null) {
    lines.push(`(브라우저 코드 ${rawCode})`);
  }
  if (rawDetail && rawDetail.trim()) {
    lines.push(`상세: ${rawDetail.trim()}`);
  }

  return { title, description: lines.join('\n') };
}

export function getCurrentLocationErrorMessage(error: unknown): string {
  const code: CurrentLocationFailureCode = error instanceof CurrentLocationError ? error.code : 'unavailable';
  switch (code) {
    case 'unsupported':
      return '이 브라우저에서는 현재 위치를 사용할 수 없어요.';
    case 'permission_denied':
      return '위치 권한이 거부되었어요. 브라우저 설정에서 위치 권한을 허용해 주세요.';
    case 'timeout':
      return '현재 위치 확인 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.';
    case 'invalid_coordinates':
      return '현재 위치 좌표가 올바르지 않아요. 다시 시도해 주세요.';
    case 'unavailable':
    default:
      return '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

export function getBrowserCurrentLocation(options: CurrentLocationOptions = {}): Promise<LatLng> {
  const geolocation: GeolocationProvider | undefined = 'geolocation' in options ? (options.geolocation ?? undefined) : getDefaultGeolocation();
  if (!geolocation) {
    return Promise.reject(new CurrentLocationError('unsupported', 'Geolocation is not supported'));
  }

  return new Promise((resolve, reject) => {
    let settled: boolean = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const settle = (run: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (watchdog) {
        clearTimeout(watchdog);
      }
      run();
    };

    // 워치독: 내장 브라우저(Electron)처럼 성공/에러 콜백이 오지도 않고 timeout 옵션을 무시한 채 멈추는
    // 경우, Promise 가 영영 안 끝나면 호출부가 실패 알림조차 못 띄운다. 무응답이면 timeout 으로 reject 해
    // 반드시 실패로 귀결시킨다(→ 호출부가 "위치를 못 가져왔다" 알림을 띄울 수 있게).
    watchdog = setTimeout(
      () => {
        settle(() =>
          reject(
            new CurrentLocationError('timeout', 'Location request timed out (no response)', {
              detail:
                '브라우저가 위치 요청에 응답하지 않았어요(무응답). OS 위치 서비스가 꺼져 있거나 측위 신호가 없을 수 있어요.',
            }),
          ),
        );
      },
      (options.timeoutMs ?? 15_000) + 3_000,
    );

    geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!hasValidLatLng(origin)) {
          settle(() =>
            reject(new CurrentLocationError('invalid_coordinates', 'Geolocation returned invalid coordinates')),
          );
          return;
        }

        settle(() => resolve(origin));
      },
      (error) => settle(() => reject(toCurrentLocationError(error))),
      {
        // 기본은 저정밀(네트워크/Wi‑Fi 측위) — GPS 없는 데스크톱/실내에서 high-accuracy 가 fix 를
        // 못 얻고 code 3(timeout)으로 실패하던 문제를 피한다. 정밀이 필요한 호출부만 명시적으로 켠다.
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        // 여유 있는 타임아웃 + 최근 위치 재사용 허용(캐시된 fix 가 있으면 즉시 반환 → 실패율↓).
        timeout: options.timeoutMs ?? 15_000,
        maximumAge: options.maximumAgeMs ?? 60_000,
      },
    );
  });
}
