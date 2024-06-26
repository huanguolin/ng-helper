export interface NgPluginConfiguration {
    port: number;
}

export interface NgRequest {
    fileName: string;
}

export interface NgCompletionRequest extends NgRequest {
    prefix: string;
}

export interface NgCompletionResponseItem {
    kind: 'property' | 'method';
    name: string;
    typeInfo: string;
    document: string;
}

export type NgCompletionResponse = NgCompletionResponseItem[] | undefined;