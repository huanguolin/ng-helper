import * as vscode from 'vscode';
import { createCommand } from './utils';

export function createComponentCommand() {
    return createCommand('createComponent', async (path: vscode.Uri) => {
        if (!path) {
            vscode.window.showInformationMessage("Use this command from the Explorer context menu, and on 'components' folder.");
            return;
        }

        await createComponent(path);
    });
}

async function createComponent(path: vscode.Uri) {
    const componentName = await vscode.window.showInputBox({ prompt: 'Component Name:' });
    if (!componentName) {
        return;
    }

    // 创建文件夹和文件
    const dir = vscode.Uri.joinPath(path, componentName);
    const ts = vscode.Uri.joinPath(dir, componentName + '.component.ts');
    const html = vscode.Uri.joinPath(dir, componentName + '.component.html');
    const less = vscode.Uri.joinPath(dir, componentName + '.component.less');
    await vscode.workspace.fs.createDirectory(dir);
    await vscode.workspace.fs.writeFile(ts, Buffer.from(''));
    await vscode.workspace.fs.writeFile(html, Buffer.from(''));
    await vscode.workspace.fs.writeFile(less, Buffer.from(`${componentName} { display: block; }`));

    // 展开文件夹，并选中 component.ts 文件
    await vscode.commands.executeCommand('revealInExplorer', dir);
    await vscode.window.showTextDocument(ts);
}