import type {
    EventInput,
    EventOutput,
    LXN_ServerClient_EventType,
    RegularEventKeys,
    StreamChunkType,
    StreamEventKeys,
} from "./types";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type LXNStreamCallOptions<TChunk> = Prettify<{
    onStreamChunk?: (chunk: TChunk) => void;
} & Omit<RequestInit, "method" | "body">>;

export default class LixnetClient<Events extends LXN_ServerClient_EventType> {
    private rpcUrl: string;

    public constructor({ rpcUrl }: { rpcUrl: string }) {
        this.rpcUrl = rpcUrl;
    }

    public call<K extends RegularEventKeys<Events>>(
        event: K,
        input: EventInput<Events[K]>,
        options?: RequestInit
    ): Promise<EventOutput<Events[K]>>;

    public call<K extends StreamEventKeys<Events>>(
        event: K,
        input: EventInput<Events[K]>,
        options?: LXNStreamCallOptions<StreamChunkType<Events[K]>>
    ): Promise<void>;

    public async call(event: any, input: any, options: any = {}): Promise<any> {
        const { onStreamChunk, ...fetchOptions } = options;

        const response = await fetch(this.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event, input }),
            ...fetchOptions,
        });

        if (onStreamChunk) {
            if (!response.body) throw new Error("Stream response has no body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop()!;

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed.stream === true) onStreamChunk(parsed.data);
                    } catch { /* skip malformed line */ }
                }
            }

            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer.trim());
                    if (parsed.stream === true) onStreamChunk(parsed.data);
                } catch { /* skip */ }
            }

            return;
        }

        const json = await response.json();
        if (json.error) throw new Error(json.error);
        return json.data;
    }
}
