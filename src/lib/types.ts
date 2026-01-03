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

export type LXNServerHandler<Input> = (input: Input) => Promise<any> | any;

export type LXN_ServerClient_EventType = object;

export type LXN_ServerClient_Request = Request & {
    setAdditionalInit: (init: ResponseInit) => void;
};
