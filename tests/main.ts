import { LixnetClient, LixnetServer } from "../src/exports";

const handler = async ({
    search,
    request,
}: {
    search: string;
    request: Request;
}) => {
    return { message: `Hello, ${search}!` };
};

export interface LXNRPC_Events {
    cache_getProfile: ({
        search,
    }: {
        search: string;
    }) => ReturnType<typeof handler>;
}

const server = new LixnetServer<LXNRPC_Events>({});

server.on({
    event: "cache_getProfile",
    handler,
});

const client = new LixnetClient<LXNRPC_Events>({
    rpcUrl: "http://localhost:3000",
});

client.call("cache_getProfile", { search: "John Doe" }).then((result) => {
    console.log(result.message);
});
