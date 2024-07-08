export type NgTypeKind = 'property' | 'method' | 'function';

export type NgTypeInfo = NgPropertyTypeInfo | NgFunctionLikeTypeInfo;

export interface NgBaseTypeInfo {
    kind: NgTypeKind;
    name: string;
    typeString: string;
    document: string;
}

export interface NgPropertyTypeInfo extends NgBaseTypeInfo {
    kind: 'property';
}

export interface NgFunctionLikeTypeInfo extends NgBaseTypeInfo {
    kind: 'method' | 'function';
    paramNames: string[];
    returnType: string;
}

export interface NgPluginConfiguration {
    port: number;
}

export interface NgRequest {
    fileName: string;
}

export interface NgCompletionRequest extends NgRequest {
    prefix: string;
}

export interface NgHoverRequest extends NgRequest {
    contextString: string;
}

export type NgHoverResponse = NgTypeInfo | undefined;

export type NgCompletionResponseItem = NgTypeInfo;
export type NgCompletionResponse = NgCompletionResponseItem[] | undefined;
