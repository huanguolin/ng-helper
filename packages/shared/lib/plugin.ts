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
    isFilter?: boolean;
    paramNames?: string[];
}

export type InjectionCheckMode = 'strict_equal' | 'ignore_case_word_match' | 'count_match' | 'off';

export interface NgPluginConfiguration {
    port: number;
    injectionCheckMode: InjectionCheckMode;
    /**
     * Ts 项目到 AngularJS 项目的映射。
     * ts plugin 这边主要用这个做两件事：
     * 1. 控制某个项目是否启用注入到 ts language service 中的功能（像依赖注入检查、service 名字跳转等），并控制它们作用的文件范围；
     * 2. 控制 client 查询时，需要去哪个 ts project 中查询。
     * 如果没有配置这个，则使用之前的自动处理的方案。
     * 自动处理的问题，就是对应上面的两点：
     * 1. 可能处理了不该处理的项目；
     * 2. 项目查找可能会错。
     */
    projectMappings?: Array<{
        tsProjectPath: string;
        ngProjectPath: string;
    }>;
}

export interface NgRequest {
    fileName: string;
}

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
    /**
     * 如果 hover 的是 ng-repeat 的数组项，则需要指定该项的属性名。此时 cursorAt 为 -1。
     * 举例：{ contextString: 'ctrl.items[0]', hoverPropName: 'item', cursorAt: -1 }
     */
    hoverPropName?: string;
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

export interface NgListComponentsAttrsRequest extends NgRequest {
    componentNames: string[];
}

export interface NgListDirectivesAttrsRequest extends NgRequest {
    maybeDirectiveNames: string[];
}

export interface NgControllerNameDefinitionRequest extends NgRequest {
    controllerName: string;
}

export interface NgFilterNameDefinitionRequest extends NgRequest {
    filterName: string;
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
export type NgComponentsAttrsResponse = Record<string, string[]> | undefined;
export type NgDirectivesAttrsResponse = NgComponentsAttrsResponse;
