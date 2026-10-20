import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    INTERNAL_ERROR,
    INVALID_PARAMS,
    INVALID_REQUEST,
    RpcError,
    SERVER_ERROR,
    normalizeId,
    parseRpcRequest,
    parseToolCall,
    requestId,
    rpcErrorResponse,
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
