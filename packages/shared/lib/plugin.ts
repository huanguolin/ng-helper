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

export type InjectionCheckMode = 'strict_equal' | 'ignore_case_word_match' | 'count_match' | 'off';

export interface NgPluginConfiguration {
    port: number;
    injectionCheckMode: InjectionCheckMode;
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

export interface NgComponentAttrCompletionRequest extends NgRequest {
    componentName: string;
}

export interface NgDirectiveCompletionRequest extends NgRequest {
    queryType: 'directive' | 'directiveAttr';
    attrNames: string[];
    /**
     * 光标后面是哪个属性。
     * 必须是 attrNames 中的一个，或者为空字符串（代表在最前面）。
     */
    afterCursorAttrName: string;
}

export interface NgHoverRequest extends NgRequest {
    contextString: string;
    cursorAt: number;
}

export interface NgElementHoverInfo {
    type: 'tagName' | 'attrName';
    /**
     * camelCase(tagName)
     */
    name: string;
    /**
     * camelCase(tagName)
     */
    tagName: string;
    /**
     * camelCase(tagName)
     */
    parentTagName?: string;
    /**
     * camelCase(attrName)
     */
    attrNames: string[];
}
export interface NgComponentNameOrAttrNameHoverRequest extends NgRequest {
    hoverInfo: NgElementHoverInfo;
}

export interface NgCtrlHoverRequest extends NgHoverRequest, NgCtrlInfo {}

export interface NgDirectiveHoverRequest extends NgRequest {
    attrNames: string[];
    cursorAtAttrName: string;
}

export interface NgComponentNameOrAttrNameDefinitionRequest extends NgRequest {
    hoverInfo: NgElementHoverInfo;
}

export interface NgTypeDefinitionRequest extends NgHoverRequest {}

export interface NgCtrlTypeDefinitionRequest extends NgCtrlHoverRequest {}

export interface NgDirectiveDefinitionRequest extends NgDirectiveHoverRequest {}

export interface NgListComponentsStringAttrsRequest extends NgRequest {
    componentNames: string[];
}

export interface NgHoverInfo {
    formattedTypeString: string;
    document: string;
}

export interface NgComponentNameInfo {
    componentName: string;
    transclude?: boolean | Record<string, string>;
}

export interface NgDefinitionInfo {
    filePath: string;
    start: number;
    end: number;
}

export type NgDefinitionResponse = NgDefinitionInfo | undefined;
export type NgHoverResponse = NgHoverInfo | undefined;
export type NgTypeCompletionResponse = NgTypeInfo[] | undefined;
export type NgComponentNameCompletionResponse = NgComponentNameInfo[] | undefined;
export type NgComponentAttrCompletionResponse = NgTypeInfo[] | undefined;
export type NgDirectiveCompletionResponse = NgTypeInfo[] | undefined;
export type NgComponentsStringAttrsResponse = Record<string, string[]> | undefined;
