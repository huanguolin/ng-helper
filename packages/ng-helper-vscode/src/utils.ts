import { window, workspace, Uri } from "vscode";
import { healthCheck } from "./service/api";


let tsRunning = false;
export async function ensureTsServerRunning(tsFilePath: string, port: number) {
    if (tsRunning) {
        return;
    }

    tsRunning = await healthCheck(port);
    if (tsRunning) {
        return;
    }

    if (await isFileExistsOnWorkspace(Uri.file(tsFilePath))) {
        const selection = await window.showErrorMessage(
            "To access features like auto-completion, you need to open a TypeScript file at least once. Otherwise, the relevant information won't be available. Click 'OK' and we will automatically open one for you.",
            'OK');
        if (selection === 'OK') {
            // 目前只能通过打开 ts 文档来确保，tsserver 真正运行起来，这样插件才能跑起来。
            const document = await workspace.openTextDocument(Uri.file(tsFilePath));
            await window.showTextDocument(document);

            // Mark ts server running
            tsRunning = true;
        }
    }

}

export async function isFileExistsOnWorkspace(fileUri: Uri): Promise<boolean> {
	try {
		// 文件不存在会 throw error
        // 为什么不用 node.js 的 fs 方法？因为它们没有考虑 remote file 等情况。
		await workspace.fs.stat(fileUri);
		return true;
	} catch {
		return false;
	}
}

