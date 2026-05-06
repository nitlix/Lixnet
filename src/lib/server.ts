import { z } from "zod";
import LixnetLog from "./util/log";
import type {
    DebugLogger,
    EventInput,
    EventOutput,
    LXNServerHandler,
    LXNStreamEmitter,
    LXN_ServerClient_EventType,
    RegularEventKeys,
    StreamChunkType,
    StreamEventKeys,
} from "./types";
import { LixnetResponse } from "./util/response";
import { LixnetRequest, wrapLixnetRequest } from "./util/request";
import getDefaultFormatter from "./util/getDefaultFormatter";

type LXNRegistryEntry = {
    isStream: boolean;
    handler: (input: any) => any;
    schema?: z.ZodSchema<any>;
};

type LXNServerRegularEventInput<
    Events extends LXN_ServerClient_EventType,
    K extends RegularEventKeys<Events>
> = {
    event: K;
    handler: LXNServerHandler<
        EventInput<Events[K]> & { request: LixnetRequest; response: LixnetResponse },
        EventOutput<Events[K]>
    >;
    schema?: z.ZodSchema<any>;
};

type LXNServerStreamEventInput<
    Events extends LXN_ServerClient_EventType,
    K extends StreamEventKeys<Events>
> = {
    event: K;
    handler: (
        input: EventInput<Events[K]> & {
            request: LixnetRequest;
            response: LixnetResponse;
            stream: LXNStreamEmitter<StreamChunkType<Events[K]>>;
        }
    ) => Promise<void> | void;
    schema?: z.ZodSchema<any>;
};

export default class LixnetServer<Events extends LXN_ServerClient_EventType> {
    private events: Record<string, LXNRegistryEntry> = {};
    private logger: DebugLogger = LixnetLog;
    private debugLog: boolean = false;
    private formatter: (this: LixnetResponse) => Response;
    private defaultHeaders: Record<string, string>;

    public constructor({
        debugLog = false,
        logger,
        formatter,
        defaultHeaders = {},
    }: {
        debugLog?: boolean;
        logger?: DebugLogger;
        formatter?: (this: LixnetResponse) => Response;
        defaultHeaders?: Record<string, string>;
    }) {
        this.debugLog = debugLog;
        this.defaultHeaders = defaultHeaders;
        logger ? (this.logger = logger) : "";
        this.formatter = formatter ?? getDefaultFormatter(defaultHeaders);
    }

    public on<K extends RegularEventKeys<Events> & string>(
        input:
            | LXNServerRegularEventInput<Events, K>
            | LXNServerRegularEventInput<Events, K>[]
    ) {
        if (Array.isArray(input)) {
            input.forEach((ev) => {
                this.events[ev.event as string] = {
                    isStream: false,
                    handler: ev.handler as any,
                    schema: ev.schema,
                };
            });
        } else {
            this.events[input.event as string] = {
                isStream: false,
                handler: input.handler as any,
                schema: input.schema,
            };
        }
    }

    public onStream<K extends StreamEventKeys<Events> & string>(
        input:
            | LXNServerStreamEventInput<Events, K>
            | LXNServerStreamEventInput<Events, K>[]
    ) {
        if (Array.isArray(input)) {
            input.forEach((ev) => {
                this.events[ev.event as string] = {
                    isStream: true,
                    handler: ev.handler as any,
                    schema: ev.schema,
                };
            });
        } else {
            this.events[input.event as string] = {
                isStream: true,
                handler: input.handler as any,
                schema: input.schema,
            };
        }
    }

    public async handle(request: Request) {
        const requestClone = request.clone();
        const response = new LixnetResponse({ formatter: this.formatter });

        let jsonData: any;
        try {
            jsonData = await request.json();
        } catch {
            if (this.debugLog) this.logger({ error: true, message: "Invalid JSON" });
            response.error("Invalid JSON");
            return response.format();
        }

        if (jsonData === null || typeof jsonData !== "object" || Array.isArray(jsonData)) {
            response.error("Invalid request body");
            return response.format();
        }

        if (!jsonData.event) {
            response.error("Event not found");
            return response.format();
        }

        if (!("input" in jsonData)) {
            response.error("Input not found");
            return response.format();
        }

        const event = this.events[jsonData.event];
        if (!event) {
            response.error("Event not found");
            return response.format();
        }

        let validatedInput: any;
        try {
            validatedInput = event.schema
                ? event.schema.parse(jsonData.input)
                : jsonData.input;
        } catch (error) {
            if (error instanceof z.ZodError) {
                response.error("Invalid input");
            } else {
                response.error("Handler error");
            }
            return response.format();
        }

        const newRequest: LixnetRequest = wrapLixnetRequest(requestClone, {
            header: response.header.bind(response),
            deleteHeader: response.deleteHeader.bind(response),
            cookie: response.cookie.bind(response),
            deleteCookie: response.deleteCookie.bind(response),
            responseHeaders: response.responseHeaders,
            responseHeaderDeletes: response.responseHeaderDeletes,
            responseCookies: response.responseCookies,
        });

        if (event.isStream) {
            return this.handleStream(event, validatedInput, newRequest, response);
        }

        try {
            const data = await event.handler({
                ...validatedInput,
                request: newRequest,
                response,
            });

            if (!(data === undefined || data === null)) {
                response.data(data);
            }

            return response.format();
        } catch {
            response.error("Handler error");
            return response.format();
        }
    }

    private handleStream(
        event: LXNRegistryEntry,
        validatedInput: any,
        newRequest: LixnetRequest,
        response: LixnetResponse
    ): Response {
        const encoder = new TextEncoder();
        let streamController!: ReadableStreamDefaultController<Uint8Array>;

        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                streamController = controller;
            },
        });

        const stream: LXNStreamEmitter<any> = {
            emit: (chunk: any) => {
                streamController.enqueue(
                    encoder.encode(JSON.stringify({ stream: true, data: chunk }) + "\n")
                );
            },
        };

        (async () => {
            try {
                await event.handler({ ...validatedInput, request: newRequest, response, stream });
            } catch {
                if (this.debugLog) this.logger({ error: true, message: "Stream handler error" });
            } finally {
                streamController.close();
            }
        })();

        const headers = new Headers({
            "Content-Type": "application/x-ndjson",
            "X-Server": "Lixnet",
            ...this.defaultHeaders,
        });
        for (const [name, value] of Object.entries(response.responseHeaders)) {
            headers.set(name, value);
        }
        for (const name of response.responseHeaderDeletes) {
            headers.delete(name);
        }

        return new Response(body, { status: 200, headers });
    }
}
