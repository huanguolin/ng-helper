import type { NgDefinitionInfo } from '@ng-helper/shared/lib/plugin';
import { Location, Range, Uri, languages, workspace, type Definition, type ExtensionContext, type TextDocument } from 'vscode';

import { timeCost } from '../../debug';
import { getComponentNameOrAttrNameDefinitionApi } from '../../service/api';
import { checkNgHelperServerRunning } from '../../utils';
import { getCorrespondingTsFileName, getHoveredComponentNameOrAttr } from '../utils';

export function registerDefinition(context: ExtensionContext, port: number) {
    context.subscriptions.push(
        languages.registerDefinitionProvider('html', {
            async provideDefinition(document, position, token) {
                const componentHoverInfo = getHoveredComponentNameOrAttr(document, document.offsetAt(position));
                if (componentHoverInfo) {
                    return timeCost('provideComponentNameOrAttrNameDefinition', async () => {
                        try {
                            if (componentHoverInfo.type === 'attrName' && componentHoverInfo.name.startsWith('ng')) {
                                // TODO ng-* 处理
                                return;
                            }
                            const tsFilePath = await checkServiceAndGetTsFilePath(document, port);
                            const definitionInfo = await getComponentNameOrAttrNameDefinitionApi({
                                port,
                                vscodeCancelToken: token,
                                info: { fileName: tsFilePath!, hoverInfo: componentHoverInfo },
                            });
                            return await buildDefinition(definitionInfo);
                        } catch (error) {
                            console.error('provideComponentNameOrAttrNameDefinition() error:', error);
                        }
                    });
                }
            },
        }),
    );
}

async function checkServiceAndGetTsFilePath(document: TextDocument, port: number): Promise<string | undefined> {
    const tsFilePath = (await getCorrespondingTsFileName(document))!;

    if (!(await checkNgHelperServerRunning(tsFilePath, port))) {
        return;
    }

    return tsFilePath;
}

async function buildDefinition(definitionInfo: NgDefinitionInfo | undefined): Promise<Definition | undefined> {
    if (!definitionInfo) {
        return;
    }

    const uri = Uri.file(definitionInfo.filePath);
    const document = await workspace.openTextDocument(uri);
    const start = document.positionAt(definitionInfo.start);
    const end = document.positionAt(definitionInfo.end);
    return new Location(uri, new Range(start, end));
}
