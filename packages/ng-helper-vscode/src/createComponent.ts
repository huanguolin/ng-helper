import { Uri, commands, window, workspace } from 'vscode';
import { createCommand } from './utils';

export function createComponentCommand() {
    return createCommand('createComponent', async (path: Uri) => {
        if (!path) {
            window.showInformationMessage("Use this command from the Explorer context menu, and on 'components' folder.");
            return;
        }

        await createComponent(path);
    });
}

async function createComponent(path: Uri) {
    const componentName = await window.showInputBox({ prompt: 'Component Name:' });
    if (!componentName) {
        return;
    }

    // 创建文件夹和文件
    const dir = Uri.joinPath(path, componentName);
    const ts = Uri.joinPath(dir, componentName + '.component.ts');
    const html = Uri.joinPath(dir, componentName + '.component.html');
    const less = Uri.joinPath(dir, componentName + '.component.less');
    await workspace.fs.createDirectory(dir);
    await workspace.fs.writeFile(ts, Buffer.from(''));
    await workspace.fs.writeFile(html, Buffer.from(''));
    await workspace.fs.writeFile(less, Buffer.from(`${componentName} { display: block; }`));

    // 展开文件夹，并选中 component.ts 文件
    await commands.executeCommand('revealInExplorer', dir);
    await window.showTextDocument(ts);
}