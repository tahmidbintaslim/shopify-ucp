/**
 * JSON-RPC 2.0 helpers for the public MCP endpoint.
 *
 * The endpoint is reachable by anonymous callers, so only RpcError messages
 * are ever sent back. Any other error (Prisma, Shopify API, runtime) becomes
 * a generic "Internal error"; the caller logs the details server-side.
 *
 * Keep this module free of imports: `npm test` loads it with Node's type
 * stripping, outside Vite.
 */

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const SERVER_ERROR = -32000;

export type RpcId = string | number | null;

export interface RpcErrorBody {
    jsonrpc: "2.0";
    id: RpcId;
    error: { code: number; message: string };
}

export interface RpcRequest {
    id: RpcId;
    method: string;
    params: Record<string, unknown>;
}

/** An error whose message is safe to show to an anonymous caller. */
export class RpcError extends Error {
    readonly code: number;
    readonly httpStatus: number;

    constructor(code: number, message: string, httpStatus = 200) {
        super(message);
        this.name = "RpcError";
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeId(id: unknown): RpcId {
    return typeof id === "string" || typeof id === "number" ? id : null;
}

/** The id to echo in a response, or null when the body has none. */
export function requestId(body: unknown): RpcId {
    return isPlainObject(body) ? normalizeId(body.id) : null;
}

/** Validates the shape of a parsed JSON-RPC request body. */
export function parseRpcRequest(body: unknown): RpcRequest {
    if (!isPlainObject(body) || typeof body.method !== "string") {
        throw new RpcError(INVALID_REQUEST, "Invalid Request", 400);
    }

    if (body.params !== undefined && !isPlainObject(body.params)) {
        throw new RpcError(INVALID_PARAMS, "Invalid params", 400);
    }

    return {
        id: normalizeId(body.id),
        method: body.method,
        params: body.params ?? {},
    };
}

/** Maps any thrown value to an HTTP status and a JSON-RPC error body. */
export function rpcErrorResponse(
    id: RpcId,
    error: unknown,
): { status: number; body: RpcErrorBody } {
    if (error instanceof RpcError) {
        return {
            status: error.httpStatus,
            body: {
                jsonrpc: "2.0",
                id,
                error: { code: error.code, message: error.message },
            },
        };
    }

    return {
        status: 500,
        body: {
            jsonrpc: "2.0",
            id,
            error: { code: INTERNAL_ERROR, message: "Internal error" },
        },
    };
}
