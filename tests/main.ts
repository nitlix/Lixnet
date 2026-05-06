import { LixnetClient, LixnetRequest, LixnetResponse, LixnetServer, LXNStreamEmitter } from "../src/exports";

type ProfileChunk = { message: string };

const handler = async ({
    search,
    request,
    response,
    stream,
}: {
    search: string;
    request: LixnetRequest;
    response: LixnetResponse;
    stream: LXNStreamEmitter<ProfileChunk>;
}) => {
    stream.emit({ message: `Hello, ${search}!` });
};

export interface LXNRPC_Events {
    cache_getProfile: {
        type: "stream";
        func: ({
            search,
        }: {
            search: string;
        }) => ProfileChunk;
    };
}

const server = new LixnetServer<LXNRPC_Events>({});

server.onStream({
    event: "cache_getProfile",
    handler: handler,
});

const client = new LixnetClient<LXNRPC_Events>({
    rpcUrl: "http://localhost:3000",
});

client.call("cache_getProfile", { search: "John Doe" }, {

});