
import { languages, TextDocument, Position, workspace, commands } from 'vscode';
import { buildNgHelperTsPluginCmd, isComponentHtml } from './utils';

export function dotCompletion() {
    return languages.registerCompletionItemProvider(
        'html',
        {
            provideCompletionItems(document: TextDocument, position: Position) {
                if (!isComponentHtml(document)) {
                    return undefined;
                }

                // remove .html add .ts
                const file = document.fileName.slice(0, -5) + '.ts';

                return queryTypeFromTsServer(file)
                    // .then(() => {
                    //     return commands
                    //         .executeCommand("typescript.tsserverRequest",
                    //             "completionInfo",
                    //             {
                    //                 file,
                    //                 line: 37,
                    //                 offset: 18,
                    //                 triggerCharacter: '.',
                    //             }).then((list: any) => {
                    //                 console.log('completionInfo: ', list);
                    //                 // return list;

                    //                 type CompletionItemInfo = {
                    //                     name: string;
                    //                     kindModifiers: string;
                    //                     kind: string;
                    //                 };

                    //                 return list.body.entries
                    //                     .filter((x: CompletionItemInfo) =>
                    //                         !x.kindModifiers.includes('private') &&
                    //                         ['method', 'property'].includes(x.kind) &&
                    //                         !x.name.startsWith('$'))
                    //                     .map((x: CompletionItemInfo) =>
                    //                         new CompletionItem(x.name,
                    //                             x.kind === 'method'
                    //                                 ? CompletionItemKind.Method
                    //                                 : CompletionItemKind.Field));
                    //             }, (err) => {
                    //                 console.log('completionInfo error: ', err);
                    //                 return;
                    //             });
                    // });

            }
        },
        '.',
    );
}

async function queryTypeFromTsServer(tsFilePath: string) {
    const doc = await workspace.openTextDocument(tsFilePath);

    // this will make sure tsserver running
    await languages.setTextDocumentLanguage(doc, 'typescript');

    const list = await commands.executeCommand(
        "typescript.tsserverRequest",
        "completionInfo",
        {
            file: tsFilePath,
            // fixed value
            line: 1,
            offset: 1,
            /**
             * We override the "triggerCharacter" property here as a hack so
             * that we can send custom commands to TSServer
             */
            triggerCharacter: buildNgHelperTsPluginCmd('component'),
            // triggerCharacter: '',
        }).then((res) => {
            console.log('completionInfo: ', res);
            return res;
        }, (err) => {
            console.log('completionInfo err: ', err);
        });

    return [];

    // return list.body.entries
    //     .filter((x: CompletionItemInfo) =>
    //         !x.kindModifiers.includes('private') &&
    //         ['method', 'property'].includes(x.kind) &&
    //         !x.name.startsWith('$'))
    //     .map((x: CompletionItemInfo) =>
    //         new CompletionItem(x.name,
    //             x.kind === 'method'
    //                 ? CompletionItemKind.Method
    //                 : CompletionItemKind.Field));
}

type CompletionItemInfo = {
    name: string;
    kindModifiers: string;
    kind: string;
};