import {
    getAttrValueText,
    getTagAndTheAttrNameWhenInAttrValue,
    getTemplateInnerText,
    isContainsNgFilter,
    isInDbQuote,
    isInStartTagAnd,
    isInTemplate,
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

import { getComponentCompletion } from '../service/api';
import { ensureTsServerRunning } from '../utils';

import { isComponentHtml, isComponentTag, isNgDirectiveAttr } from './utils';

export function componentType(port: number) {
    return languages.registerCompletionItemProvider('html', new TypeCompletionProvider(port), '.');
}

class TypeCompletionProvider implements CompletionItemProvider {
    constructor(private port: number) {}

    provideCompletionItems(document: TextDocument, position: Position): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
        if (isInTemplate(textBeforeCursor)) {
            const prefix = getTemplateInnerText(textBeforeCursor);
            if (prefix && !isContainsNgFilter(prefix)) {
                return this.getCompletionItems(document, prefix);
            }
        }

        let tagTextBeforeCursor = '';
        if (
            isInStartTagAnd(textBeforeCursor, (innerTagTextBeforeCursor) => {
                tagTextBeforeCursor = innerTagTextBeforeCursor;
                return isInDbQuote(innerTagTextBeforeCursor);
            })
        ) {
            const { tagName, attrName } = getTagAndTheAttrNameWhenInAttrValue(tagTextBeforeCursor);
            if (isComponentTag(tagName) || isNgDirectiveAttr(attrName)) {
                const prefix = getAttrValueText(tagTextBeforeCursor);
                if (prefix) {
                    return this.getCompletionItems(document, prefix);
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
                const isFunction = x.kind === 'method' || x.kind === 'function';
                const item = new CompletionItem(x.name, isFunction ? CompletionItemKind.Method : CompletionItemKind.Field);
                if (isFunction) {
                    let snippet = `${x.name}(`;
                    snippet += x.paramNames.map((x, i) => `\${${i + 1}:${x}}`).join(', ');
                    snippet += ')${0}';
                    item.insertText = new SnippetString(snippet);
                }
                item.detail = `(${x.kind}) ${x.name}: ${x.typeString}`;
                item.documentation = x.document;
                item.sortText = i.toString();
                return item;
            });
            return new CompletionList(items, false);
        }
    }
}