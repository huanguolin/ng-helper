import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, CompletionList, Position, ProviderResult, TextDocument, languages, workspace } from "vscode";
import { isComponentHtml } from "./utils";
import { getComponentCompletion } from "../service/api";

export function typeCompletion(port: number) {
    return languages.registerCompletionItemProvider(
        'html',
        new TypeCompletionProvider(port),
        '.'
    )
}

class TypeCompletionProvider implements CompletionItemProvider {
    private tsRunning = false;

    constructor(private port: number) {
    }

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
        if (!isComponentHtml(document)) {
            return undefined;
        }

        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';

        return this.makeSureTsServerRunning(tsFilePath).then(() => getComponentCompletion(tsFilePath, this.port)).then((res) => {
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

    private async makeSureTsServerRunning(tsFilePath: string) {
        if (this.tsRunning) {
            return;
        }

        const doc = await workspace.openTextDocument(tsFilePath);
        // this will make sure tsserver running
        await languages.setTextDocumentLanguage(doc, 'typescript');
        this.tsRunning = true;
    }
}