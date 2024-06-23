import { ExtensionContext, Uri, commands, workspace } from "vscode";
import { EXT_CONF_PATH, EXT_IS_ACTIVATED, defaultPort } from "./constants";
import { configTsPluginConfiguration } from "./service/config";

export async function activateExt(): Promise<number | undefined> {
    const canActivated = await canActivate();
	if (!canActivated) {
		return;
	}
	
	const port = await configTsPluginConfiguration(defaultPort);
    if (!port) {
        return;
    }

	commands.executeCommand('setContext', EXT_IS_ACTIVATED, true);

    return port;
}

async function canActivate(): Promise<boolean> {
	const workspaceFolders = workspace.workspaceFolders;
	if (!workspaceFolders) {
		return false;
	}

	const rootWorkspaceUri = workspaceFolders[0].uri;
	const confUri = Uri.joinPath(rootWorkspaceUri, EXT_CONF_PATH);
	try {
		// 文件不存在会 throw error
		await workspace.fs.stat(confUri);
		return true;
	} catch {
		return false;
	}
}