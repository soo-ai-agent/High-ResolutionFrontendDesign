import type { IncomingMessage, ServerResponse } from "node:http"

/** /api/webhook/* 와 /api/mirror/* 요청을 처리해요. 처리했으면 true, 아니면 false. */
export function handleMirror(req: IncomingMessage, res: ServerResponse): Promise<boolean>
