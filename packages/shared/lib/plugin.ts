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
    optional?: boolean;
    isFunction: boolean;
    paramNames?: string[];
}

export interface NgPluginConfiguration {
    port: number;
}

export interface NgRequest {
    fileName: string;
}

export type NgResponse<T> = {
    errKey?: 'NO_CONTEXT';
    data?: T;
};

export interface NgTypeCompletionRequest extends NgRequest {
    prefix: string;
}

export interface NgCtrlInfo {
    controllerName: string;
    controllerAs?: string;
}

export interface NgCtrlTypeCompletionRequest extends NgTypeCompletionRequest, NgCtrlInfo {}

export interface NgHoverRequest extends NgRequest {
    contextString: string;
    cursorAt: number;
}

export interface NgCtrlHoverRequest extends NgHoverRequest, NgCtrlInfo {}

export interface NgComponentAttrRequest extends NgRequest {
    componentName: string;
}

export interface NgHoverInfo {
    formattedTypeString: string;
    document: string;
}

export interface NgComponentNameInfo {
    componentName: string;
    transclude?: boolean | string[];
}

export type NgHoverResponse = NgHoverInfo | undefined;
export type NgTypeCompletionResponse = NgTypeInfo[] | undefined;
export type NgComponentNameCompletionResponse = NgComponentNameInfo[] | undefined;
export type NgComponentAttrCompletionResponse = NgTypeInfo[] | undefined;
