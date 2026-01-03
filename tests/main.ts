import { LixnetServer } from "../src/exports";

export interface LXNRPC_Events {
    cache_getProfile: ({ search }: { search: string }) => Promise<string>;
}

const server = new LixnetServer<LXNRPC_Events>({});

server.on({
    event: "cache_getProfile",
    handler: async ({ search }) => {
        return `Hello, ${search}!`;
    },
});
