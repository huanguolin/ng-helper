
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

                // const line = document.lineAt(position).text;
                // const linePrefix = line.slice(0, position.character);
                // if (!linePrefix.endsWith('{{')) {
                // 	return undefined;
                // }

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

const CONTROLLER_COLON_TEXT = " controller :";

async function queryTypeFromTsServer(tsFilePath: string) {
    const doc = await workspace.openTextDocument(tsFilePath);
    const text = doc.getText();
    const pi = text.indexOf(CONTROLLER_COLON_TEXT);
    console.log('====> pi: ', pi);
    if (pi < 0) {
        // TODO: only completion binds
        return undefined;
    }

    const preText = text.slice(0, pi);
    const lines = preText.split('\n');
    const line = lines.length - 1;
    const linePos = (lines.pop()?.length || 0) + CONTROLLER_COLON_TEXT.length - 1;

    const pos = new Position(line, linePos);
    const controllerClassNamePosition = doc.getWordRangeAtPosition(pos);
    if (!controllerClassNamePosition) {
        return undefined;
    }

    // this will make sure tsserver running
    await languages.setTextDocumentLanguage(doc, 'typescript');

    const list = await commands.executeCommand(
        "typescript.tsserverRequest",
        "completionInfo",
        {
            tsFilePath,
            // fixed value
            line: 1,
            offset: 1,
            /**
             * We override the "triggerCharacter" property here as a hack so
             * that we can send custom commands to TSServer
             */
            triggerCharacter: buildNgHelperTsPluginCmd('component', controllerClassNamePosition),
        });
    console.log('completionInfo: ', list);

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