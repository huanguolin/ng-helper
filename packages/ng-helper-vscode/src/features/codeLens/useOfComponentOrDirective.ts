import { kebabCase } from 'change-case';
import { languages, TextDocument, CodeLens, Range } from 'vscode';

import type { NgContext } from '../../ngContext';

const STRING_REGEX = `(['"])(\\.|(?!\\1).)*?\\1`;
const MATCH_DIRECTIVE = new RegExp(`\\.directive\\(\\s*${STRING_REGEX}`, 'g');
const MATCH_COMPONENT = new RegExp(`\\.component\\(\\s*${STRING_REGEX}`, 'g');
const MATCH_NAME = new RegExp(STRING_REGEX);

export function searchUseOfComponentOrDirective(ngContext: NgContext) {
    return languages.registerCodeLensProvider(['typescript', 'javascript'], {
        provideCodeLenses(document: TextDocument): CodeLens[] {
            if (!ngContext.isNgProjectDocument(document)) {
                return [];
            }

            const codeLenses: CodeLens[] = [];
            const text = document.getText();
            let match: RegExpExecArray | null;

            MATCH_DIRECTIVE.lastIndex = 0;
            MATCH_COMPONENT.lastIndex = 0;
            while ((match = MATCH_DIRECTIVE.exec(text)) !== null || (match = MATCH_COMPONENT.exec(text)) !== null) {
                const matchStr = match[0];
                const type = matchStr.startsWith('.directive') ? 'directive' : 'component';
                const name = matchStr.match(MATCH_NAME)![0].slice(1, -1);
                const kebabName = kebabCase(name);
                const position = document.positionAt(match.index + matchStr.length);
                const range = new Range(position, position);
                codeLenses.push(
                    new CodeLens(range, {
                        title: `Search where to use ${type}: "${kebabName}"`,
                        command: 'workbench.action.findInFiles',
                        arguments: [
                            {
                                triggerSearch: true,
                                // 这里简单处理，不去考虑指令只能作为组件使用的情况，也减少用户困惑
                                query: type === 'component' ? `<${kebabName}` : kebabName,
                                isRegex: false,
                                isCaseSensitive: true,
                                matchWholeWord: true,
                                filesToInclude: '*.html,*.js,*.ts', // js/ts 中有可能有 template 字符串也需要搜索
                                useExcludeSettingsAndIgnoreFiles: true,
                            },
                        ],
                    }),
                );
            }

            return codeLenses;
        },
    });
}
