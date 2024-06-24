import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, Position, ProviderResult, TextDocument, languages } from "vscode";
import { ensureTsServerRunning, isComponentHtml } from "./utils";
import { getComponentCompletion } from "../service/api";

export function typeCompletion(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        new TypeCompletionProvider(port),
        '.'
    )
}

class TypeCompletionProvider implements CompletionItemProvider {

    constructor(private port: number) {
    }

    provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext,
    ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        return this.getCompletionItems(document, position);
    }

    resolveCompletionItem?(
        item: CompletionItem,
        token: CancellationToken,
    ): ProviderResult<CompletionItem> {
        return item;
    }

    private async getCompletionItems(
        document: TextDocument,
        position: Position,
    ): Promise<CompletionItem[] | undefined> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        await ensureTsServerRunning(tsFilePath, this.port);

        const res = await getComponentCompletion(this.port, { fileName: tsFilePath, prefix: '.' });
        if (res) {
            return res.map(x => {
                const item = new CompletionItem(x.name, x.kind === 'method' ? CompletionItemKind.Method : CompletionItemKind.Field);
                item.detail = `(${x.kind}) ${x.name}: ${x.typeInfo}`;
                item.documentation = x.document;
                return item;
            });
        }
    }
}