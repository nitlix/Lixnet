import { LixnetRequest } from "./util/request";
import { LixnetResponse } from "./util/response";

export type DebugLogger = ({
    error,
    message,
}: {
    error?: boolean;
    message: string;
}) => void;

export type FunctionInput<T> = T extends (input: infer TInput) => any
    ? TInput
    : { _TYPE_ERROR_: "Event definition must be a function type" };

export type FunctionOutput<T> = T extends (...args: any) => infer R
    ? Awaited<R>
    : { _TYPE_ERROR_: "Event definition must be a function type" };

export type LXNServerHandler<Input, Output> = (
    input: Input
) => Promise<Output> | Output;

export type LXN_ServerClient_EventType = object;

/** The inbound request passed to handlers (Next.js–style `cookies()` / `headers()`). */
export type { LixnetRequest as LXN_ServerClient_Request } from "./util/request";

export type LixnetServerInjections = {
    request: LixnetRequest;
    response: LixnetResponse;
};

// ── Stream type system ──────────────────────────────────────────────────────

/** Pull the underlying function out of a dict-style event def, or pass through a plain function. */
export type ExtractEventFunc<T> = T extends { func: infer F } ? F : T;

/** True when the event is declared as `{ type: "stream"; func: ... }`. */
export type IsStreamEvent<T> = T extends { type: "stream" } ? true : false;

/** Input type for any event format (dict or plain function). */
export type EventInput<T> = FunctionInput<ExtractEventFunc<T>>;

/** Return type for regular events. For stream events this equals the chunk type — use StreamChunkType instead. */
export type EventOutput<T> = FunctionOutput<ExtractEventFunc<T>>;

/** The per-chunk type emitted by a stream event. */
export type StreamChunkType<T> = T extends { type: "stream"; func: (...args: any) => infer R } ? R : never;

/** Keys in the Events interface that are stream events. */
export type StreamEventKeys<E> = {
    [K in keyof E]: IsStreamEvent<E[K]> extends true ? K : never;
}[keyof E];

/** Keys in the Events interface that are regular (non-stream) events. */
export type RegularEventKeys<E> = {
    [K in keyof E]: IsStreamEvent<E[K]> extends true ? never : K;
}[keyof E];

/** The `stream` object injected into stream event handlers. */
export type LXNStreamEmitter<TChunk> = {
    emit: (chunk: TChunk) => void;
};