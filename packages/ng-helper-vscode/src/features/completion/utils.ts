import type { CompletionItem } from 'vscode';

export type NgHelperInfoForCompletion = {
    type: 'componentName' | 'directiveName';
    name: string;
    /**
     * 用于请求时查找对应的 ts project.
     */
    filePath: string;
    /**
     * type 为 componentName 时可用。
     */
    prefixChar?: '' | '<';
};

export interface NgHelperCompletionItem extends CompletionItem {
    ngHelperInfo: NgHelperInfoForCompletion;
}

export function addNgHelperInfoToCompletionItem(
    item: CompletionItem,
    ngHelperInfo: NgHelperInfoForCompletion,
): NgHelperCompletionItem {
    const result = item as NgHelperCompletionItem;
    result.ngHelperInfo = ngHelperInfo;
    return result;
}
