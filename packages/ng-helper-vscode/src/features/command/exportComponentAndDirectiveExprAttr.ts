import type { ExportedExpressionAttrsData } from '@ng-helper/shared/lib/exportData';
import type { NgAllComponentsExpressionAttrsResponse } from '@ng-helper/shared/lib/plugin';
import { kebabCase } from 'change-case';
import { Uri, window, workspace } from 'vscode';

import { logger } from '../../logger';
import type { NgContext } from '../../ngContext';

import { createCommand } from './utils';

const myLogger = logger.prefixWith('exportComponentAndDirectiveExprAttr');

export function exportComponentAndDirectiveExprAttrCommand(ngContext: NgContext) {
    return createCommand('exportComponentAndDirectiveExprAttr', async () => {
        await exportComponentAndDirectiveExprAttr(ngContext);
    });
}

async function exportComponentAndDirectiveExprAttr(ngContext: NgContext) {
    try {
        if (!ngContext.config.hasProjectConfig) {
            await window.showErrorMessage('You need to configure "ngProjects" to continue.');
            return;
        }

        if (!ngContext.getLoadedProjectNames().length) {
            await window.showInformationMessage('Cannot export before any project is loaded.');
            return;
        }

        const exportData = await fetchAllExpressionAttributes(ngContext);
        if (!exportData) {
            await window.showInformationMessage('No data to export.');
            return;
        }

        const saveUri = await showSaveDialog();
        if (!saveUri) {
            return; // 用户取消了操作
        }

        await saveExportDataToFile(exportData, saveUri);
        await showSuccessMessage(exportData, saveUri);
    } catch (error) {
        myLogger.logError('Export failed', error);
        await window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function fetchAllExpressionAttributes(ngContext: NgContext): Promise<ExportedExpressionAttrsData | undefined> {
    return await window.withProgress(
        {
            location: { viewId: 'ng-helper.progressView' },
            title: 'Exporting Component and Directive Expression Attributes...',
            cancellable: true,
        },
        async (progress, token) => {
            progress.report({
                increment: 0,
                message: 'Fetching all component and directive expression attributes...',
            });

            // 获取所有组件和指令的 expression attributes
            let allAttrsData: NgAllComponentsExpressionAttrsResponse = {};
            try {
                const activatedProjectRoot = ngContext.getLoadedNgProject()[0].path;
                const allAttrsResult = await ngContext.rpcApi.listAllComponentsAndDirectivesExpressionAttrs({
                    params: {
                        fileName: activatedProjectRoot, // 这个特殊，直接给一个项目根目录就可以
                    },
                    cancelToken: token,
                });

                if (allAttrsResult) {
                    allAttrsData = kebabCaseResult(allAttrsResult);
                }
            } catch (error) {
                myLogger.logError('Failed to fetch all component and directive expression attributes', error);
                throw error; // 抛出错误，让用户知道操作失败
            }

            if (token.isCancellationRequested) {
                return undefined;
            }

            progress.report({ increment: 90, message: 'Generating export file...' });

            // 组合数据
            return {
                timestamp: new Date().toISOString(),
                metadata: {
                    totalItems: Object.values(allAttrsData).reduce((acc, curr) => acc + Object.keys(curr).length, 0),
                    exportType: 'expression-attributes',
                    description: 'Contains all component and directive expression attributes',
                },
                expressionAttributes: allAttrsData,
            } as ExportedExpressionAttrsData;
        },
    );
}

async function showSaveDialog() {
    return await window.showSaveDialog({
        defaultUri: Uri.file('ng-expression-attrs.json'),
        filters: {
            'JSON files': ['json'],
            'All files': ['*'],
        },
        title: 'Save Component and Directive Expression Attributes',
    });
}

async function saveExportDataToFile(exportData: ExportedExpressionAttrsData, saveUri: Uri) {
    const jsonContent = JSON.stringify(exportData, null, 2);
    await workspace.fs.writeFile(saveUri, Buffer.from(jsonContent, 'utf8'));
}

async function showSuccessMessage(exportData: ExportedExpressionAttrsData, saveUri: Uri) {
    const message = `Successfully exported ${exportData.metadata.totalItems} component and directive expression attributes to ${saveUri.fsPath}`;
    const action = await window.showInformationMessage(message, 'Open File');
    if (action === 'Open File') {
        await window.showTextDocument(saveUri);
    }
}

function kebabCaseResult(data: NgAllComponentsExpressionAttrsResponse) {
    const result: NgAllComponentsExpressionAttrsResponse = {};
    for (const [projectRoot, map] of Object.entries(data)) {
        result[projectRoot] = Object.fromEntries(
            Object.entries(map).map(([key, value]) => [kebabCase(key), value.map((x) => kebabCase(x))]),
        );
    }
    return result;
}
