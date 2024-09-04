import { type ExtensionContext, Range, languages, Uri, type TextDocument, type DocumentLink } from 'vscode';

import { isFileExistsOnWorkspace, normalizePath, getFiles } from '../../utils';

type MyLink = DocumentLink & { fileName: string; url: string };

const URL_REGEX_STR = `(['"])(\\.|(?!\\1).)*?\\1`;
const TEMPLATE_URL_REGEX_STR = `templateUrl\\s*:\\s*${URL_REGEX_STR}`;
const MATCH_URL = new RegExp(URL_REGEX_STR);
const MATCH_ALL_TEMPLATE_URL = new RegExp(TEMPLATE_URL_REGEX_STR, 'g');

export function registerGotoHtml(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerDocumentLinkProvider(
            [
                { scheme: 'file', language: 'javascript' },
                { scheme: 'file', language: 'typescript' },
            ],
            {
                provideDocumentLinks: getLinks,
                resolveDocumentLink: async (link: MyLink) => {
                    const targetPath = await resolveHtmlPath(link.fileName, link.url);

                    if (targetPath && (await isFileExistsOnWorkspace(Uri.file(targetPath)))) {
                        link.target = Uri.file(targetPath);
                        return link;
                    }
                },
            },
        ),
    );
}

function getLinks(document: TextDocument): MyLink[] {
    const text = document.getText();

    const links: MyLink[] = [];

    MATCH_ALL_TEMPLATE_URL.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MATCH_ALL_TEMPLATE_URL.exec(text)) !== null) {
        const matchStr = match[0];
        const url = matchStr.match(MATCH_URL)![0].slice(1, -1);

        if (url.includes('/')) {
            const startPos = document.positionAt(match.index + matchStr.indexOf(url));
            const endPos = document.positionAt(match.index + matchStr.length - 1);
            const range = new Range(startPos, endPos);
            links.push({ fileName: document.fileName, url: url, range, tooltip: 'Go to HTML file' });
        }
    }

    return links;
}

async function resolveHtmlPath(fileName: string, templateUrl: string): Promise<string | undefined> {
    const htmlTailPart = normalizePath(templateUrl);

    // 找到对应的 html 文件
    const htmlFiles = await getFiles(fileName, { predicate: (filePath) => filePath.endsWith(htmlTailPart) });
    return htmlFiles[0];
}
