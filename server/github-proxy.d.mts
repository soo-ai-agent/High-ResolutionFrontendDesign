import type { IncomingMessage, ServerResponse } from "node:http"

/** /api/github/* 요청을 처리해요. 처리했으면 true, 아니면 false 를 반환해요. */
export function handleGithub(req: IncomingMessage, res: ServerResponse): Promise<boolean>
