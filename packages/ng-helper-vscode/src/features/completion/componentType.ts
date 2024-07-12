import {
    getTextInDbQuotes,
    getTagAndTheAttrNameWhenInAttrValue,
    getTextInTemplate,
    isContainsNgFilter,
    isInStartTagAnd,
    TagAndCurrentAttrName,
    getBeforeCursorText,
} from '@ng-helper/shared/lib/html';
import {
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Position,
    ProviderResult,
    Range,
    SnippetString,
    TextDocument,
    languages,
} from 'vscode';

import { getComponentCompletion } from '../../service/api';
import { ensureTsServerRunning } from '../../utils';
import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from '../utils';

export function componentType(port: number) {
    return languages.registerCompletionItemProvider('html', new TypeCompletionProvider(port), '.');
}

class TypeCompletionProvider implements CompletionItemProvider {
    constructor(private port: number) {}

    provideCompletionItems(document: TextDocument, position: Position): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        const docText = document.getText();
        // 由于输入时光标的位置是虚拟的，并不占空间，所以需要减 1，
        // 否则查找的结果可能不正确。
        const offset = document.offsetAt(position) - 1;
        const tplText = getTextInTemplate(docText, offset);
        if (tplText) {
            const prefix = getBeforeCursorText(tplText);
            if (prefix && !isContainsNgFilter(prefix)) {
                return this.getCompletionItems(document, prefix);
            }
        }

        const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
        let tagInfo: TagAndCurrentAttrName | undefined = undefined;
        const isInStartTag = isInStartTagAnd(textBeforeCursor, (tagTextBeforeCursor) => {
            tagInfo = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
            return Boolean(tagInfo.tagName && tagInfo.attrName);
        });
        if (isInStartTag && tagInfo) {
            const { tagName, attrName } = tagInfo;
            if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                const attrValueText = getTextInDbQuotes(docText, offset);
                if (attrValueText) {
                    const prefix = processPrefix(attrName, attrValueText ? getBeforeCursorText(attrValueText) : '');
                    if (prefix) {
                        return this.getCompletionItems(document, prefix + '.'); // 由于上面的把 offset - 1 了，所以这里不包含 '.', 需要加回来
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
    if (attrName === 'ng-class' && prefix.startsWith('{') && prefix.includes(':')) {
        return prefix.split(':').pop()!;
    }
    return prefix;
}
