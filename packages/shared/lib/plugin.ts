export interface PluginConfiguration {
    port: number;
}

export interface CompletionRequest {
    fileName: string;
    prefix: string;
}