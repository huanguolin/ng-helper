import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, ProviderResult, Range, TextDocument, languages } from "vscode";
import { isComponentHtml, isInStartTagAndCanCompletionNgX } from "./utils";
import { ensureTsServerRunning } from "../utils";
import { getComponentCompletion } from "../service/api";
import { getFromTemplateStart, isInTemplate } from "@ng-helper/shared/lib/html";

export function typeCompletion(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        new TypeCompletionProvider(port),
        '.'
    );
}

class TypeCompletionProvider implements CompletionItemProvider {

    constructor(private port: number) { }

    provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
        if (isInTemplate(textBeforeCursor)) {
            const prefix = this.getTemplatePrefix(textBeforeCursor);
            if (prefix) {
                return this.getCompletionItems(document, prefix);
            }
        }
    }

    private getTemplatePrefix(textBeforeCursor: string): string {
        const text = getFromTemplateStart(textBeforeCursor)!;
        return text
            .trim()
            .replace(/(^{{|\.$)/g, '')
            .trim();
    }

    private async getCompletionItems(
        document: TextDocument,
        prefix: string,
    ): Promise<CompletionList<CompletionItem> | undefined> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        await ensureTsServerRunning(tsFilePath, this.port);

        const res = await getComponentCompletion(this.port, { fileName: tsFilePath, prefix });
        if (res) {
            const items = res.map(x => {
                const item = new CompletionItem(x.name, x.kind === 'method' ? CompletionItemKind.Method : CompletionItemKind.Field);
                item.detail = `(${x.kind}) ${x.name}: ${x.typeInfo}`;
                item.documentation = x.document;
                return item;
            });
            return new CompletionList(items, false);
        }
    }
}