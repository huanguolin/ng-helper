import { type ExtensionContext, languages, type TextDocument, type DocumentLink, type CancellationToken } from 'vscode';

import { findControllerNameLink, resolveControllerNameLink } from './controllerNameLink';
import { findTemplateUrlLink, resolveTemplateUrlLink } from './templateUrlLink';

export type MyLink = DocumentLink & {
    type: 'controllerName' | 'templateUrl';
    fileName: string;
    url: string;
};

export function registerLink(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerDocumentLinkProvider(
            [
                { scheme: 'file', language: 'javascript' },
                { scheme: 'file', language: 'typescript' },
            ],
            {
                provideDocumentLinks: function (document: TextDocument): MyLink[] {
                    const text = document.getText();
                    return [...findControllerNameLink(text, document), ...findTemplateUrlLink(text, document)];
                },
                resolveDocumentLink: async function (
                    link: MyLink,
                    token: CancellationToken,
                ): Promise<MyLink | undefined> {
                    switch (link.type) {
                        case 'templateUrl':
                            return await resolveTemplateUrlLink(link);
                        case 'controllerName':
                            return await resolveControllerNameLink(link, token, port);
                    }
                },
            },
        ),
    );
}
