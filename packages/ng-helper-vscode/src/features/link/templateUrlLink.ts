import { type TextDocument, Range, Uri } from 'vscode';

import { normalizePath, getFiles, isFileExistsOnWorkspace } from '../../utils';

import type { MyLink } from '.';

/**
 * 匹配单双引号字符串。
 * (\\.|(?!\\1).) 分为两个部分：
 * 1. \\. 匹配被转义的任意字符。
 * 2. (?!\\1). 匹配一个非引号字符，用于确保匹配的字符串不包含引号。
 */
const URL_REGEX_STR = `(['"])(\\.|(?!\\1).)*?\\1`;
const TEMPLATE_URL_REGEX_STR = `templateUrl\\s*:\\s*${URL_REGEX_STR}`;
const MATCH_URL = new RegExp(URL_REGEX_STR);
const MATCH_ALL_TEMPLATE_URL = new RegExp(TEMPLATE_URL_REGEX_STR, 'g');

export function findTemplateUrlLink(text: string, document: TextDocument): MyLink[] {
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
            links.push({
                type: 'templateUrl',
                fileName: document.fileName,
                url: url,
                range,
                tooltip: 'Go to HTML file',
            });
        }
    }
    return links;
}

export async function resolveTemplateUrlLink(link: MyLink): Promise<MyLink | undefined> {
    const targetPath = await resolveHtmlPath(link.fileName, link.url);

    if (targetPath && (await isFileExistsOnWorkspace(Uri.file(targetPath)))) {
        link.target = Uri.file(targetPath);
        return link;
    }
}

async function resolveHtmlPath(fileName: string, templateUrl: string): Promise<string | undefined> {
    const htmlTailPart = normalizePath(templateUrl);

    // 找到对应的 html 文件
    const htmlFiles = await getFiles(fileName, { predicate: (filePath) => filePath.endsWith(htmlTailPart) });
    return htmlFiles[0];
}
