export interface Credentials {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken?: string;
}
export interface CredentialsProvider {
    getCredentials: () => Promise<Credentials>;
}
export interface ClientConfig extends Partial<Credentials> {
    region?: string;
    net?: string;
    credentialsProvider?: CredentialsProvider;
    userAgent?: string;
    use_https?: boolean;
    endpoint?: string;
}
export interface RequestOptions extends RequestInit {
    timeout?: number;
}
export interface LogContent {
    [key: string]: string;
}
export interface LogInput {
    timestamp: number;
    content: LogContent;
    timestampNsPart?: number;
}
export interface LogGroupInput {
    logs: LogInput[];
    tags?: Array<Record<string, string>>;
    topic?: string;
    source?: string;
}
declare class Client {
    region?: string;
    net?: string;
    endpoint: string;
    use_https: boolean;
    userAgent: string;
    accessKeyId?: string;
    accessKeySecret?: string;
    securityToken?: string;
    credentialsProvider?: CredentialsProvider;
    constructor(config: ClientConfig);
    private validateCredentials;
    private static isAsyncFunction;
    _getCredentials(): Promise<Credentials>;
    _request(verb: string, projectName: string | undefined, resourcePath: string, queries: Record<string, unknown> | undefined, body: Buffer | null, headers: Record<string, string | number>, options?: RequestOptions): Promise<unknown>;
    _sign(verb: string, resourcePath: string, queries: Record<string, unknown>, headers: Record<string, string | number>, credentials: Credentials): string;
    getProject(projectName: string, options?: RequestOptions): Promise<unknown>;
    getProjectLogs(projectName: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    createProject(projectName: string, data: {
        description?: string;
    }, options?: RequestOptions): Promise<unknown>;
    deleteProject(projectName: string, options?: RequestOptions): Promise<unknown>;
    listLogStore(projectName: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    createLogStore(projectName: string, logstoreName: string, data?: {
        ttl?: number;
        shardCount?: number;
    }, options?: RequestOptions): Promise<unknown>;
    deleteLogStore(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown>;
    updateLogStore(projectName: string, logstoreName: string, data?: {
        ttl?: number;
        shardCount?: number;
    }, options?: RequestOptions): Promise<unknown>;
    getLogStore(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown>;
    getIndexConfig(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown>;
    createIndex(projectName: string, logstoreName: string, index: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    updateIndex(projectName: string, logstoreName: string, index: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    deleteIndex(projectName: string, logstoreName: string, options?: RequestOptions): Promise<unknown>;
    getLogs(projectName: string, logstoreName: string, from: Date, to: Date, data?: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    getHistograms(projectName: string, logstoreName: string, from: Date, to: Date, data?: Record<string, unknown>, options?: RequestOptions): Promise<unknown>;
    postLogStoreLogs(projectName: string, logstoreName: string, data: LogGroupInput, options?: RequestOptions): Promise<unknown>;
}
export default Client;
