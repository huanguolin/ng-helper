/**
 * 表示与父类型的关系。
 * NgFieldKind 并不是表示 type 的类型分类。
 */
export type NgFieldKind = 'property' | 'method';

export interface NgTypeInfo {
    kind: NgFieldKind;
    name: string;
    typeString: string;
    document: string;
    isFunction: boolean;
    paramNames?: string[];
}

export interface NgPluginConfiguration {
    port: number;
    /**
     * 从 vscode plugin 那边传过来，必须是绝对路径，且按照字符串长度从长到短排序。
     */
    projectRoots: string[];
}

export interface NgRequest {
    fileName: string;
}

export interface NgCompletionRequest extends NgRequest {
    prefix: string;
}

export interface NgHoverRequest extends NgRequest {
    contextString: string;
    cursorAt: number;
}

export interface NgHoverInfo {
    formattedTypeString: string;
    document: string;
}

export type NgHoverResponse = NgHoverInfo | undefined;

export type NgCompletionResponseItem = NgTypeInfo;
export type NgCompletionResponse = NgCompletionResponseItem[] | undefined;
