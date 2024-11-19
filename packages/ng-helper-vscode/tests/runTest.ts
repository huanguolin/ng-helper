import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './testRunner.js');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            version: '1.93.1',
            extensionDevelopmentPath,
            extensionTestsPath,
            // 禁用其他插件，只启用当前插件
            // launchArgs: ['--disable-extensions', '--extensions-dir', 'none'],
        });
    } catch {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

void main();
