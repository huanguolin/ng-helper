import { getTemplateInnerText, isContainsNgFilter, isInTemplate } from '@ng-helper/shared/lib/html';
import {
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    Position,
    ProviderResult,
    Range,
    TextDocument,
    languages,
} from 'vscode';

import { getComponentCompletion } from '../service/api';
import { ensureTsServerRunning } from '../utils';

import { isComponentHtml } from './utils';

export function typeCompletion(port: number) {
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
    }

    private async getCompletionItems(document: TextDocument, prefix: string): Promise<CompletionList<CompletionItem> | undefined> {
        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        await ensureTsServerRunning(tsFilePath, this.port);

        const res = await getComponentCompletion(this.port, { fileName: tsFilePath, prefix });
        if (res) {
            const items = res.map((x) => {
                const item = new CompletionItem(x.name, x.kind === 'property' ? CompletionItemKind.Field : CompletionItemKind.Method);
                item.detail = `(${x.kind}) ${x.name}: ${x.typeString}`;
                item.documentation = x.document;
                return item;
            });
            return new CompletionList(items, false);
        }
    }
}
