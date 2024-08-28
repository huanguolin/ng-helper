import {
    type ExtensionContext,
    window,
    workspace,
    type DecorationOptions,
    Range,
    languages,
    Uri,
    Location,
    Position,
    type TextDocument,
} from 'vscode';

import { isFileExistsOnWorkspace, normalizePath, getFiles } from '../../utils';

const UNDERLINE_DECORATION_TYPE = window.createTextEditorDecorationType({ textDecoration: 'underline' });
const URL_REGEX_STR = `(['"])(\\.|(?!\\1).)*?\\1`;
const TEMPLATE_URL_REGEX_STR = `templateUrl\\s*:\\s*${URL_REGEX_STR}`;
const MATCH_URL = new RegExp(URL_REGEX_STR);
const MATCH_TEMPLATE_URL = new RegExp(TEMPLATE_URL_REGEX_STR);
const MATCH_ALL_TEMPLATE_URL = new RegExp(TEMPLATE_URL_REGEX_STR, 'g');

export function registerGotoHtml(context: ExtensionContext) {
    provideGotoHtmlDefinition(context);
    decorateTemplateUrls(context);
}

function decorateTemplateUrls(context: ExtensionContext) {
    // for open vscode with last opened file
    updateDecorations();

    // watch & update
    context.subscriptions.push(workspace.onDidChangeTextDocument(updateDecorations, null));
    context.subscriptions.push(window.onDidChangeActiveTextEditor(updateDecorations, null));
}

function updateDecorations() {
    const editor = window.activeTextEditor;
    if (!editor) {
        return;
    }

    if (editor.document.languageId !== 'javascript' && editor.document.languageId !== 'typescript') {
        return;
    }

    const text = editor.document.getText();
    const decorations: DecorationOptions[] = [];
    let match: RegExpExecArray | null;

    MATCH_ALL_TEMPLATE_URL.lastIndex = 0;
    while ((match = MATCH_ALL_TEMPLATE_URL.exec(text)) !== null) {
        const matchStr = match[0];
        const url = matchStr.match(MATCH_URL)![0].slice(1, -1);
        const startPos = editor.document.positionAt(match.index + matchStr.indexOf(url));
        const endPos = editor.document.positionAt(match.index + matchStr.length - 1);
        const range = new Range(startPos, endPos);
        decorations.push({ range });
    }

    editor.setDecorations(UNDERLINE_DECORATION_TYPE, decorations);
}

function provideGotoHtmlDefinition(context: ExtensionContext) {
    context.subscriptions.push(
        languages.registerDefinitionProvider(
            [
                { scheme: 'file', language: 'javascript' },
                { scheme: 'file', language: 'typescript' },
            ],
            {
                async provideDefinition(document, position) {
                    // 不考虑 es6 模板字符串，因为这种情况下，往往只有在运行时才能确定 templateUrl 的值
                    const range = document.getWordRangeAtPosition(position, MATCH_TEMPLATE_URL);
                    if (!range) {
                        return;
                    }

                    const text = document.getText(range);
                    const matched = text.match(MATCH_URL); // 匹配字符串
                    if (!matched || matched.length < 2) {
                        return;
                    }

                    // 取捕获组的内容, 并去掉引号
                    const relativePath = matched[0].slice(1, -1);
                    const line = document.lineAt(position.line);
                    const urlStart = line.text.indexOf(relativePath);
                    const urlEnd = urlStart + relativePath.length;
                    // 判断光标是否在 templateUrl 的字符串中
                    if (position.character < urlStart || position.character >= urlEnd) {
                        return;
                    }

                    const targetPath = await resolveHtmlPath(document, relativePath);

                    if (targetPath && (await isFileExistsOnWorkspace(Uri.file(targetPath)))) {
                        return new Location(Uri.file(targetPath), new Position(0, 0));
                    }
                },
            },
        ),
    );
}

async function resolveHtmlPath(document: TextDocument, templateUrl: string): Promise<string | undefined> {
    const htmlTailPart = normalizePath(templateUrl);

    // 找到对应的 html 文件
    const htmlFiles = await getFiles(document.fileName, { predicate: (filePath) => filePath.endsWith(htmlTailPart) });
    return htmlFiles[0];
}
