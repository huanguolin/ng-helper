import {
    getTextInTemplate,
    isContainsNgFilter,
    getBeforeCursorText,
    Cursor,
    getTheAttrWhileCursorAtValue,
    getHtmlTagAt,
} from '@ng-helper/shared/lib/html';
import { NgCtrlInfo, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Position,
    SnippetString,
    TextDocument,
    languages,
} from 'vscode';

import { timeCost } from '../../debug';
import { getComponentTypeCompletionApi, getControllerTypeCompletionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getControllerNameInfoFromHtml, getCorrespondingTsFileName, isComponentHtml, isComponentTagName, isNgDirectiveAttr } from '../utils';

export function type(port: number) {
    return languages.registerCompletionItemProvider('html', new TypeCompletionProvider(port), '.');
}

class TypeCompletionProvider implements CompletionItemProvider {
    constructor(private port: number) {}

    async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
    ): Promise<CompletionList<CompletionItem> | undefined> {
        if (isComponentHtml(document)) {
            return timeCost('provideComponentTypeCompletion', async () => {
                try {
                    return await this.provideComponentTypeCompletion({ document, position, token });
                } catch (error) {
                    console.error('provideComponentTypeCompletion() error:', error);
                    return undefined;
                }
            });
        }

        const ctrlInfo = getControllerNameInfoFromHtml(document);
        if (ctrlInfo && ctrlInfo.controllerAs) {
            return timeCost('provideControllerTypeCompletion', async () => {
                try {
                    return await this.provideControllerTypeCompletion({ document, position, ctrlInfo, token });
                } catch (error) {
                    console.error('provideControllerTypeCompletion() error:', error);
                    return undefined;
                }
            });
        }
    }

    private async provideControllerTypeCompletion({
        document,
        position,
        ctrlInfo,
        token,
    }: {
        document: TextDocument;
        position: Position;
        ctrlInfo: NgCtrlInfo;
        token: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const docText = document.getText();
        const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

        // 模版 {{}} 中
        const tplText = getTextInTemplate(docText, cursor);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return await this.getControllerTypeCompletionItems({ document, prefix, ctrlInfo, vscodeCancelToken: token });
            }
        }

        // 组件属性值中 或者 ng-* 属性值中
        const tag = getHtmlTagAt(docText, cursor);
        if (tag) {
            const attr = getTheAttrWhileCursorAtValue(tag, cursor);
            if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
                let prefix = attr.value.text.slice(0, cursor.at - attr.value.start);
                if (prefix && !isContainsNgFilter(prefix)) {
                    prefix = processPrefix(attr.name.text, prefix);
                    if (prefix) {
                        return await this.getControllerTypeCompletionItems({ document, prefix, ctrlInfo, vscodeCancelToken: token });
                    }
                }
            }
        }
    }

    private async provideComponentTypeCompletion({
        document,
        position,
        token,
    }: {
        document: TextDocument;
        position: Position;
        token: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const docText = document.getText();
        const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

        // 模版 {{}} 中
        const tplText = getTextInTemplate(docText, cursor);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return await this.getComponentTypeCompletionItems(document, prefix, token);
            }
        }

        // 组件属性值中 或者 ng-* 属性值中
        const tag = getHtmlTagAt(docText, cursor);
        if (tag) {
            const attr = getTheAttrWhileCursorAtValue(tag, cursor);
            if (attr && attr.value && (isComponentTagName(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
                let prefix = attr.value.text.slice(0, cursor.at - attr.value.start);
                if (prefix && !isContainsNgFilter(prefix)) {
                    prefix = processPrefix(attr.name.text, prefix);
                    if (prefix) {
                        return await this.getComponentTypeCompletionItems(document, prefix, token);
                    }
                }
            }
        }
    }
    private async getControllerTypeCompletionItems({
        document,
        prefix,
        ctrlInfo,
        vscodeCancelToken,
    }: {
        document: TextDocument;
        prefix: string;
        ctrlInfo: NgCtrlInfo;
        vscodeCancelToken: CancellationToken;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        const tsFilePath = (await getCorrespondingTsFileName(document, ctrlInfo.controllerName))!;

        if (!(await checkNgHelperServerRunning(tsFilePath, this.port))) {
            return;
        }

        const res = await getControllerTypeCompletionApi({ port: this.port, vscodeCancelToken, info: { fileName: tsFilePath, prefix, ...ctrlInfo } });
        if (res) {
            return this.buildCompletionList(res);
        }
    }

    private async getComponentTypeCompletionItems(
        document: TextDocument,
        prefix: string,
        vscodeCancelToken: CancellationToken,
    ): Promise<CompletionList<CompletionItem> | undefined> {
        const tsFilePath = (await getCorrespondingTsFileName(document))!;

        if (!(await checkNgHelperServerRunning(tsFilePath, this.port))) {
            return;
        }

        const res = await getComponentTypeCompletionApi({ port: this.port, vscodeCancelToken, info: { fileName: tsFilePath, prefix } });
        if (res) {
            return this.buildCompletionList(res);
        }
    }

    private buildCompletionList(res: NgTypeInfo[]) {
        const items = res.map((x, i) => {
            const item = new CompletionItem(x.name, x.isFunction ? CompletionItemKind.Method : CompletionItemKind.Field);
            if (x.isFunction) {
                // 分两段补全，第一段是函数名，第二段是参数
                let snippet = `${x.name}$1(`;
                snippet += x.paramNames!.map((x, i) => `\${${i + 2}:${x}}`).join(', ');
                snippet += ')$0';
                item.insertText = new SnippetString(snippet);
            }
            item.detail = `(${x.kind}) ${x.name}: ${x.typeString}`;
            item.documentation = x.document;
            item.sortText = i.toString().padStart(3, '0');
            return item;
        });
        return new CompletionList(items, false);
    }
}

// 特殊处理:
// 输入：prefix = "{ 'class-name': ctrl."
// 输出：prefix = "ctrl."
function processPrefix(attrName: string, prefix: string): string {
    prefix = prefix.trim();
    if ((attrName === 'ng-class' || attrName === 'ng-style') && prefix.startsWith('{') && prefix.includes(':')) {
        return prefix.split(':').pop()!;
    }
    return prefix;
}
