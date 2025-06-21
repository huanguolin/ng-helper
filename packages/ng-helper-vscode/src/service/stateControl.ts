import { logger } from '../logger';
import { triggerTsServerByProject } from '../utils';

export type State = 'disconnect' | 'connected' | 'canNotQuery' | 'noContext' | 'addProject' | 'removeProject';
export type BarStatus = 'disconnect' | 'connected' | 'loading';
export type ListenForStatusBar = (status: BarStatus, projectRoots: string[]) => void;

const MAX_LOADING_TIME = 20000;
// 至少启动多久才能去触发
const BASE_START_TIME = 0;

const myLogger = logger.prefixWith('StateControl');

/**
 * 状态控制器: 主要是将 rpc 和 tsService 的状态转换为 vscode状态栏的状态。
 *
 * rpc 和 tsService 的状态见 {@link State}；
 * 状态栏显示的状态见 {@link BarStatus}；
 */
export class StateControl {
    private _notifyStatusBar?: ListenForStatusBar;
    private _pluginStartAt: number;
    private _isRpcServerReady = false;
    private _isLoading = false;
    private _projectRoots: string[] = [];
    private _loadingTimeout?: ReturnType<typeof setTimeout>;
    private _hasPopupWarning = false;

    constructor(pluginStartAt: number) {
        this._pluginStartAt = pluginStartAt;
    }

    updateState(state: State, path?: string) {
        myLogger.logInfo(`updateState(): ${state}, path: ${path}`);
        this.logSnapshot();

        // 状态出现的顺序是:
        // 1. 插件第一次启动：
        // disconnect -> canNotQuery -> connected -> addProject
        // 2. 插件启动后，打开新项目：
        // -> noContext -> addProject
        // 3. 插件启动后，关闭项目：
        // -> removeProject
        // 4. 插件启动后，断开连接：
        // -> disconnect
        switch (state) {
            case 'disconnect':
                this.setRpcServerReady(false);
                this.setIsLoading(false);
                break;
            case 'canNotQuery':
                this.triggerTsProjectLoading(path!);
                break;
            case 'connected':
                this.setRpcServerReady(true);
                this.setIsLoading(false);
                break;
            case 'noContext':
                this.triggerTsProjectLoading(path!);
                break;
            case 'addProject':
                this.addProjectRoot(path!);
                this.setIsLoading(false);
                break;
            case 'removeProject':
                this.removeProjectRoot(path!);
                break;
            default:
                break;
        }
    }

    notifyStatusBar(listener: ListenForStatusBar) {
        this._notifyStatusBar = listener;
    }

    get loadedTsProjectRoots(): string[] {
        return this._projectRoots;
    }

    get rpcServerReady() {
        return this._isRpcServerReady;
    }

    get status() {
        return this._isLoading ? 'loading' : this.rpcServerReady ? 'connected' : 'disconnect';
    }

    private setRpcServerReady(value: boolean) {
        this._isRpcServerReady = value;
        this.handleStateChange();
    }

    private setIsLoading(value: boolean) {
        if (value) {
            this._loadingTimeout = setTimeout(() => this.setIsLoading(false), MAX_LOADING_TIME);
        } else {
            clearTimeout(this._loadingTimeout);
        }
        this._isLoading = value;
        this.handleStateChange();
    }

    private addProjectRoot(rootPath: string) {
        if (this.loadedTsProjectRoots.includes(rootPath)) {
            return;
        }
        this._projectRoots.push(rootPath);
        this.handleStateChange();
    }

    private removeProjectRoot(rootPath: string) {
        this._projectRoots = this._projectRoots.filter((x) => x !== rootPath);
        this.handleStateChange();
    }

    private handleStateChange() {
        const barStatus = this.status;
        myLogger.logInfo(`handleStateChange(): barStatus: ${barStatus}`);
        this.logSnapshot();
        this._notifyStatusBar?.(barStatus, this.loadedTsProjectRoots);
    }

    private triggerTsProjectLoading(filePath: string) {
        // 至少在插件启动一段时间后才能去触发。
        if (this.getDelay() > 0) {
            return;
        }

        if (this._isLoading || this._hasPopupWarning) {
            return;
        }

        this._hasPopupWarning = true;
        void triggerTsServerByProject(filePath)
            .then((ok) => {
                if (ok) {
                    this.setIsLoading(true);
                }
            })
            .finally(() => {
                this._hasPopupWarning = false;
            });
    }

    private logSnapshot() {
        const snapshot: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(this)) {
            if (typeof value !== 'function') {
                snapshot[key] = value;
            }
        }
        myLogger.logDebug('snapshot: ', snapshot);
    }

    private getDelay() {
        const timeCost = Date.now() - this._pluginStartAt;
        return timeCost > BASE_START_TIME ? 0 : BASE_START_TIME - timeCost;
    }
}
