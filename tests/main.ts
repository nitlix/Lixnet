import { LixnetStreamClient, LixnetStreamServer } from "../src/exports";

interface LXNRPC_StreamEvents {
    cache_getProfile: ({ search }: { search: string }) => { message: string };
}

const server = new LixnetStreamServer<LXNRPC_StreamEvents>({});

server.on({
    event: "cache_getProfile",
    handler: async ({ search, stream }) => {
        stream.emit({ message: `Hello, ${search}!` });
    },
});

const client = new LixnetStreamClient<LXNRPC_StreamEvents>({
    rpcUrl: "http://localhost:3000",
});

client.call("cache_getProfile", { search: "John Doe" }, {
    onStreamChunk: (chunk) => {
        console.log(chunk.message);
    },
});
