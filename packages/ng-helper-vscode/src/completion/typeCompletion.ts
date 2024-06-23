import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList, Position, ProviderResult, TextDocument, languages, workspace } from "vscode";
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

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        return this.getCompletionItems(document, position).then((res) => {
            console.log('completionInfo: ', res);
            return null;
        }, (err) => {
            console.log('completionInfo err: ', err);
            return null;
        });
    }

    resolveCompletionItem?(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        return item;
    }

    private async getCompletionItems(document: TextDocument, position: Position) {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        await ensureTsServerRunning(tsFilePath, this.port);

        return getComponentCompletion(tsFilePath, this.port);
    }
}