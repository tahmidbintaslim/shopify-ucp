import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    INTERNAL_ERROR,
    INVALID_PARAMS,
    INVALID_REQUEST,
    RpcError,
    SEARCH_LIMIT_DEFAULT,
    SEARCH_LIMIT_MAX,
    SERVER_ERROR,
    clampSearchLimit,
    normalizeId,
    parseRpcRequest,
    parseToolCall,
    requestId,
    requireStringArg,
    rpcErrorResponse,
    serviceUnavailable,
} from "../app/utils/json-rpc.ts";

describe("rpcErrorResponse", () => {
    it("hides the message of an unexpected error behind a generic 500", () => {
        const leaked =
            "No database host or connection string was set, and key parameters have default values (host: localhost)";
        const { status, body } = rpcErrorResponse(7, new Error(leaked));

        assert.equal(status, 500);
        assert.deepEqual(body, {
            jsonrpc: "2.0",
            id: 7,
            error: { code: INTERNAL_ERROR, message: "Internal error" },
        });
        assert.ok(!JSON.stringify(body).includes("localhost"));
    });

    it("treats thrown non-Error values as internal errors", () => {
        const { status, body } = rpcErrorResponse(null, "boom");

        assert.equal(status, 500);
        assert.equal(body.error.message, "Internal error");
    });

    it("passes through the code, message and status of an RpcError", () => {
        const { status, body } = rpcErrorResponse(
            "abc",
            new RpcError(SERVER_ERROR, "Shop not found", 404),
        );

        assert.equal(status, 404);
        assert.deepEqual(body, {
            jsonrpc: "2.0",
            id: "abc",
            error: { code: SERVER_ERROR, message: "Shop not found" },
        });
    });

    it("defaults an RpcError to HTTP 200", () => {
        const { status } = rpcErrorResponse(1, new RpcError(INVALID_PARAMS, "Invalid params"));

        assert.equal(status, 200);
    });
});

describe("parseRpcRequest", () => {
    it("accepts a well-formed request", () => {
        assert.deepEqual(
            parseRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
            { id: 1, method: "tools/list", params: {} },
        );
    });

    for (const [label, body] of [
        ["null", null],
        ["a string", "tools/list"],
        ["a batch array", [{ jsonrpc: "2.0", id: 1, method: "tools/list" }]],
        ["a missing method", { jsonrpc: "2.0", id: 1 }],
        ["a non-string method", { jsonrpc: "2.0", id: 1, method: 42 }],
    ] as const) {
        it(`rejects ${label} as an invalid request (400)`, () => {
            assert.throws(
                () => parseRpcRequest(body),
                (error: unknown) =>
                    error instanceof RpcError &&
                    error.code === INVALID_REQUEST &&
                    error.httpStatus === 400,
            );
        });
    }

    it("rejects params that are not an object", () => {
        assert.throws(
            () => parseRpcRequest({ id: 1, method: "tools/call", params: ["x"] }),
            (error: unknown) =>
                error instanceof RpcError &&
                error.code === INVALID_PARAMS &&
                error.httpStatus === 400,
        );
    });
});

describe("parseToolCall", () => {
    it("returns the tool name and arguments", () => {
        assert.deepEqual(
            parseToolCall({ name: "search_products", arguments: { query: "hat" } }),
            { name: "search_products", args: { query: "hat" } },
        );
    });

    it("defaults missing or null arguments to an empty object", () => {
        assert.deepEqual(parseToolCall({ name: "get_store_info" }), {
            name: "get_store_info",
            args: {},
        });
        assert.deepEqual(parseToolCall({ name: "get_store_info", arguments: null }), {
            name: "get_store_info",
            args: {},
        });
    });

    for (const [label, params] of [
        ["a missing name", {}],
        ["a non-string name", { name: 7 }],
        ["array arguments", { name: "get_product", arguments: ["hat"] }],
        ["string arguments", { name: "get_product", arguments: "hat" }],
    ] as const) {
        it(`rejects ${label} as invalid params (400)`, () => {
            assert.throws(
                () => parseToolCall(params as Record<string, unknown>),
                (error: unknown) =>
                    error instanceof RpcError &&
                    error.code === INVALID_PARAMS &&
                    error.httpStatus === 400,
            );
        });
    }
});

describe("normalizeId", () => {
    it("keeps string and number ids and drops anything else", () => {
        assert.equal(normalizeId("a"), "a");
        assert.equal(normalizeId(0), 0);
        assert.equal(normalizeId({ nested: true }), null);
        assert.equal(normalizeId(undefined), null);
    });
});

describe("requestId", () => {
    it("reads the id of a request object, even one that fails validation", () => {
        assert.equal(requestId({ id: 4, method: "tools/call", params: [1] }), 4);
        assert.equal(requestId({ id: "x" }), "x");
    });

    it("returns null for bodies with no usable id", () => {
        assert.equal(requestId([{ id: 1, method: "tools/list" }]), null);
        assert.equal(requestId(null), null);
        assert.equal(requestId({ method: "tools/list" }), null);
    });
});

describe("serviceUnavailable", () => {
    it("maps to HTTP 503 with a generic message", () => {
        const { status, body } = rpcErrorResponse(3, serviceUnavailable());

        assert.equal(status, 503);
        assert.deepEqual(body.error, { code: SERVER_ERROR, message: "Service unavailable" });
    });
});

describe("requireStringArg", () => {
    it("returns the trimmed value", () => {
        assert.equal(requireStringArg({ query: "  red dress " }, "query"), "red dress");
    });

    for (const value of [undefined, null, 42, "", "   ", ["a"], { a: 1 }]) {
        it(`rejects ${JSON.stringify(value)} with a 400 invalid params error`, () => {
            assert.throws(
                () => requireStringArg({ query: value }, "query"),
                (error: unknown) =>
                    error instanceof RpcError &&
                    error.code === INVALID_PARAMS &&
                    error.httpStatus === 400 &&
                    error.message.includes('"query"'),
            );
        });
    }
});

describe("clampSearchLimit", () => {
    it("uses the default for a missing or non-numeric value", () => {
        for (const value of [undefined, null, "20", Number.NaN, Number.POSITIVE_INFINITY]) {
            assert.equal(clampSearchLimit(value), SEARCH_LIMIT_DEFAULT);
        }
    });

    it("keeps a value inside the range", () => {
        assert.equal(clampSearchLimit(1), 1);
        assert.equal(clampSearchLimit(25), 25);
        assert.equal(clampSearchLimit(SEARCH_LIMIT_MAX), SEARCH_LIMIT_MAX);
    });

    it("clamps values outside the range and drops fractions", () => {
        assert.equal(clampSearchLimit(0), 1);
        assert.equal(clampSearchLimit(-5), 1);
        assert.equal(clampSearchLimit(10_000), SEARCH_LIMIT_MAX);
        assert.equal(clampSearchLimit(7.9), 7);
    });
});
