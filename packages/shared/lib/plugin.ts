export interface PluginConfiguration {
    port: number;
}

export interface CompletionRequest {
    fileName: string;
    prefix: string;
}

export interface CompletionResponseItem {
    kind: 'property' | 'method';
    name: string;
    typeInfo: string;
    document: string;
}

export type CompletionResponse = CompletionResponseItem[] | undefined;