import { Uri, commands, window, workspace } from 'vscode';

import type { NgContext } from '../../ngContext';

import { createCommand } from './utils';

export function createComponentCommand(ngContext: NgContext) {
    return createCommand('createComponent', async (path: Uri) => {
        if (!path) {
            return;
        }

        await createComponent(path, ngContext);
    });
}

async function createComponent(path: Uri, ngContext: NgContext) {
    const { componentStyleFileExt, componentScriptFileExt } = ngContext.config.userConfig;
    const componentName = await window.showInputBox({ prompt: 'Component Name:' });
    if (!componentName) {
        return;
    }

    // 创建文件夹和文件
    const dir = Uri.joinPath(path, componentName);
    const html = Uri.joinPath(dir, componentName + '.component.html');
    const style = Uri.joinPath(dir, componentName + '.component.' + componentStyleFileExt!);
    const script = Uri.joinPath(dir, componentName + '.component.' + componentScriptFileExt!);
    await workspace.fs.createDirectory(dir);
    await workspace.fs.writeFile(html, Buffer.from(''));
    await workspace.fs.writeFile(style, Buffer.from(`${componentName} { display: block; }`));
    await workspace.fs.writeFile(script, Buffer.from(''));

    // 展开文件夹，并选中 component.ts 文件
    await commands.executeCommand('revealInExplorer', dir);
    await window.showTextDocument(script);
}
