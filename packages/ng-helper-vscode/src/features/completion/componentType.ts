import {
    getTextInTemplate,
    isContainsNgFilter,
    getBeforeCursorText,
    Cursor,
    getTheAttrWhileCursorAtValue,
    getHtmlTagByCursor,
} from '@ng-helper/shared/lib/html';
import { CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, SnippetString, TextDocument, languages } from 'vscode';

import { getComponentCompletion } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from '../utils';

export function componentType(port: number) {
    return languages.registerCompletionItemProvider('html', new TypeCompletionProvider(port), '.');
}

class TypeCompletionProvider implements CompletionItemProvider {
    constructor(private port: number) {}

    async provideCompletionItems(document: TextDocument, position: Position): Promise<CompletionList<CompletionItem> | undefined> {
        try {
            return await this.provideTypeCompletion({ document, position });
        } catch (error) {
            console.error('provideTypeCompletion() error:', error);
            return undefined;
        }
    }

    private async provideTypeCompletion({
        document,
        position,
    }: {
        document: TextDocument;
        position: Position;
    }): Promise<CompletionList<CompletionItem> | undefined> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        const docText = document.getText();
        const cursor: Cursor = { at: document.offsetAt(position), isHover: false };

        // 模版 {{}} 中
        const tplText = getTextInTemplate(docText, cursor);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return await this.getCompletionItems(document, prefix);
            }
        }

        // 组件属性值中 或者 ng-* 属性值中
        const tag = getHtmlTagByCursor(docText, cursor);
        if (tag) {
            const attr = getTheAttrWhileCursorAtValue(tag, cursor);
            if (attr && (isComponentTag(tag.tagName) || isNgDirectiveAttr(attr.name.text))) {
                let prefix = attr.value.text.slice(0, cursor.at - attr.value.start);
                if (prefix && !isContainsNgFilter(prefix)) {
                    prefix = processPrefix(attr.name.text, prefix);
                    if (prefix) {
                        return await this.getCompletionItems(document, prefix);
                    }
                }
            }
        }
    }

    private async getCompletionItems(document: TextDocument, prefix: string): Promise<CompletionList<CompletionItem> | undefined> {
        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        await ensureTsServerRunning(tsFilePath, this.port);

        const res = await getComponentCompletion(this.port, { fileName: tsFilePath, prefix });
        if (res) {
            const items = res.map((x, i) => {
                const item = new CompletionItem(x.name, x.isFunction ? CompletionItemKind.Method : CompletionItemKind.Field);
                if (x.isFunction) {
                    let snippet = `${x.name}(`;
                    snippet += x.paramNames!.map((x, i) => `\${${i + 1}:${x}}`).join(', ');
                    snippet += ')${0}';
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
