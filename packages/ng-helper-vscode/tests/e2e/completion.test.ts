import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as vscode from 'vscode';

import {
    APP_PAGES_P2_HTML_PATH,
    APP_PAGES_P4_HTML_PATH,
    BAZ_QUX_COMPONENT_HTML_PATH,
    BEST_XYZ_DIRECTIVE_JS_PATH,
    COMPLETION_COMMAND,
    DRAG_SOURCE_COMPONENT_TS_PATH,
} from '../testConstants';
import { activate, setupChaiSnapshotPlugin, sleep } from '../testUtils';

describe('Completion', () => {
    setupChaiSnapshotPlugin();

    before(async () => {
        await activate();
    });

    describe('component name/attr', () => {
        it('get completion info of component name', async () => {
            // 这里同时也测试了，补全组件时，会排除当前所在的组件
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(1, 6),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: '<',
            });
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(1, 6),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('get completion info of component attr', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(3, 9),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: ' ',
            });
        });
    });

    describe('transclude', () => {
        /**
         * <common-panel>
         *     <panel-toolbar></panel-toolbar>
         *     |    <- 这里补全时，会把有名字的 transclude 的优先排列，并会排除 panel-toolbar
         * </common-panel>
         */
        it('get completion info with transclude', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(7, 1),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: '<',
            });
        });
    });

    describe('directive name/attr', () => {
        it('get completion info of directive name', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(10, 7),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('get completion info of directive attr', async () => {
            // 这个同时测试了，依据光标位置，总是获取光标前最近的那个指令的属性

            // 获取 best-xyz 的属性，它排在第一
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(12, 16),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: ' ',
            });

            // 获取 number-check 的属性，它排在第二, 并且结果集中排除了已经存在的 min 属性
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(12, 42),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: ' ',
            });
        });
    });

    describe('ng-*', () => {
        it('get completion info of "ng-*"', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(14, 7),
                itemsFilter: (item) => typeof item.label === 'string' && item.label.startsWith('ng-'),
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });
    });

    describe('type', () => {
        it('get completion info of "ctrl" (component html)', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(16, 3),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('get completion info of "ctrl.*" (component html)', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(18, 7),
                triggerChar: '.',
            });
        });

        it('get completion info of "ctrl" (controller html)', async () => {
            await testCompletion({
                filePath: APP_PAGES_P2_HTML_PATH,
                position: new vscode.Position(2, 19),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('get completion info of "ctrl.obj.*" (controller html)', async () => {
            await testCompletion({
                filePath: APP_PAGES_P2_HTML_PATH,
                position: new vscode.Position(4, 27),
                triggerChar: '.',
            });
        });
    });

    describe('ng-repeat', () => {
        it('get completion info of ng-repeat scope (component html)', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH, // 这里是 component html
                position: new vscode.Position(23, 13),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });
        it('get completion info of ng-repeat scope (controller html)', async () => {
            await testCompletion({
                filePath: APP_PAGES_P2_HTML_PATH, // 这里是 controller html
                position: new vscode.Position(7, 17),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });
    });

    describe('filter', () => {
        it('get completion info of filter', async () => {
            await testCompletion({
                filePath: BAZ_QUX_COMPONENT_HTML_PATH,
                position: new vscode.Position(20, 11),
                ignoreIsIncomplete: true,
                itemsFilter: (item) => item.detail?.startsWith('(filter)') ?? false,
            });
        });

        it('get completion info of filter (not component/controller html)', async () => {
            await testCompletion({
                filePath: APP_PAGES_P4_HTML_PATH,
                position: new vscode.Position(5, 19),
                ignoreIsIncomplete: true,
                itemsFilter: (item) => item.detail?.startsWith('(filter)') ?? false,
            });
        });
    });

    describe('inline html', () => {
        it('component name', async () => {
            await testCompletion({
                filePath: BEST_XYZ_DIRECTIVE_JS_PATH,
                position: new vscode.Position(13, 2),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: '<',
            });
        });
        it('component attr', async () => {
            await testCompletion({
                filePath: BEST_XYZ_DIRECTIVE_JS_PATH,
                position: new vscode.Position(15, 10),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: ' ',
            });
        });
        it('directive name', async () => {
            await testCompletion({
                filePath: BEST_XYZ_DIRECTIVE_JS_PATH,
                position: new vscode.Position(17, 7),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('directive attr', async () => {
            await testCompletion({
                filePath: BEST_XYZ_DIRECTIVE_JS_PATH,
                position: new vscode.Position(19, 16),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                triggerChar: ' ',
            });
        });

        it('ng-*', async () => {
            await testCompletion({
                filePath: BEST_XYZ_DIRECTIVE_JS_PATH,
                position: new vscode.Position(21, 7),
                itemsFilter: (item) => typeof item.label === 'string' && item.label.startsWith('ng-if'),
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });
        });

        it('type', async () => {
            // ctrl
            await testCompletion({
                filePath: DRAG_SOURCE_COMPONENT_TS_PATH,
                position: new vscode.Position(34, 11),
                itemsFilter: (item) => item.detail === '[ng-helper]',
                // 注意：这里不能有 triggerChar，否则结果为空，因为内部实现如果有 triggerChar 就直接返回了。
            });

            // ctrl.*
            await testCompletion({
                filePath: DRAG_SOURCE_COMPONENT_TS_PATH,
                position: new vscode.Position(36, 15),
                triggerChar: '.',
            });
        });

        it('filter', async () => {
            await testCompletion({
                filePath: DRAG_SOURCE_COMPONENT_TS_PATH,
                position: new vscode.Position(38, 32),
                ignoreIsIncomplete: true,
                itemsFilter: (item) => item.detail?.startsWith('(filter)') ?? false,
            });
        });
    });
});

async function testCompletion({
    filePath,
    position,
    itemsFilter,
    triggerChar,
    ignoreIsIncomplete,
    waitSeconds,
}: {
    filePath: string;
    position: vscode.Position;
    itemsFilter?: (item: vscode.CompletionItem) => boolean;
    triggerChar?: string;
    ignoreIsIncomplete?: boolean;
    waitSeconds?: number;
}) {
    // show the document
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    if (waitSeconds) {
        await sleep(waitSeconds * 1000);
    }

    // get completion info
    const completionInfoList = await vscode.commands.executeCommand<vscode.CompletionList>(
        COMPLETION_COMMAND,
        vscode.Uri.file(filePath),
        position,
        triggerChar,
    );

    // assert
    if (!ignoreIsIncomplete) {
        expect(completionInfoList.isIncomplete).to.be.false;
    }
    let items = completionInfoList.items;
    if (itemsFilter) {
        items = items.filter(itemsFilter);
    }
    expect(items.length).to.be.greaterThan(0);
    expect(items).toMatchSnapshot();
}
