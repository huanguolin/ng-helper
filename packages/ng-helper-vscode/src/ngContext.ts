import { window, type ExtensionContext, type TextDocument, type TextEditor } from 'vscode';

import type { NgHelperConfig } from './config';
import { getNormalizedPathFromDocument } from './features/utils';
import type { RpcApi } from './service/tsService/rpcApi';
import { getLastFolderName } from './utils';

type ActivatedProjectNameChangedListener = (name?: string) => void;

export class NgContext {
    private _activatedProjectName?: string;
    private _activatedProjectNameChangedListeners: ActivatedProjectNameChangedListener[] = [];

    constructor(
        public vscodeContext: ExtensionContext,
        public config: NgHelperConfig,
        public rpcApi: RpcApi,
    ) {
        this.vscodeContext.subscriptions.push(
            window.onDidChangeActiveTextEditor(this.handleActiveTextEditorChanged.bind(this)),
        );
        this.handleActiveTextEditorChanged(window.activeTextEditor);
    }

    get activatedProjectName() {
        return this._activatedProjectName;
    }

    onActivatedProjectNameChanged(listener: (name?: string) => void): () => void {
        this._activatedProjectNameChangedListeners.push(listener);
        return () => {
            this._activatedProjectNameChangedListeners = this._activatedProjectNameChangedListeners.filter(
                (x) => x !== listener,
            );
        };
    }

    isNgProjectDocument(document: TextDocument): boolean {
        const filePath = getNormalizedPathFromDocument(document);
        return this.config.isNgProjectFile(filePath);
    }

    getActivatedNgProject() {
        return this.config.userConfig.ngProjects?.find((x) => x.name === this.activatedProjectName);
    }

    getLoadedNgProject() {
        const loadedNames = this.getLoadedProjectNames();
        return this.config.userConfig.ngProjects?.filter((x) => loadedNames.includes(x.name)) ?? [];
    }

    getLoadedProjectNames(): string[] {
        const tsProjectRoots = this.rpcApi.loadedTsProjectRoots;
        if (this.config.hasProjectConfig) {
            return tsProjectRoots
                .map((p) => this.config.getNgProjectByTsProjectPath(p)?.name)
                .filter((x) => !!x) as string[];
        } else {
            return tsProjectRoots.map((p) => getLastFolderName(p));
        }
    }

    private handleActiveTextEditorChanged(editor: TextEditor | undefined) {
        if (editor && this.isNgProjectDocument(editor.document)) {
            const filePath = getNormalizedPathFromDocument(editor.document);
            this._activatedProjectName = this.config.getNgProject(filePath)?.name;
        } else {
            this._activatedProjectName = '';
        }
        this._activatedProjectNameChangedListeners.forEach((cb) => {
            cb(this.activatedProjectName);
        });
    }
}
