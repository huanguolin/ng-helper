import { triggerTsServerByProject } from '../utils';

export type State = 'disconnect' | 'connected' | 'canNotQuery' | 'noContext' | 'addProject' | 'removeProject';
export type BarStatus = 'disconnect' | 'connected' | 'loading';
export type ListenForStatusBar = (status: BarStatus, projectRoots: string[]) => void;

const MAX_LOADING_TIME = 5000;
// 至少启动3秒后才能去触发
const BASE_START_TIME = 3000;

/**
 * 状态控制器: 主要是将 rpc 和 tsService 的状态转换为 vscode状态栏的状态。
 *
 * rpc 和 tsService 的状态见 {@link State}；
 * 状态栏显示的状态见 {@link BarStatus}；
 */
export class StateControl {
    private _notifyStatusBar?: ListenForStatusBar;
    private _pluginStartAt: number;
    private _loadingTimeout?: NodeJS.Timeout;
    private _isLoading = false;
    private _loadingFlag = '';
    private _isRpcServerReady = false;
    private _projectRoots: string[] = [];

    constructor(pluginStartAt: number) {
        this._pluginStartAt = pluginStartAt;
    }

    updateState(state: State, path?: string) {
        console.debug(`[StateControl] updateState: ${state}, path: ${path}`);

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
                this.rpcServerReady = false;
                this.forceCloseLoading();
                break;
            case 'canNotQuery':
                this.triggerTsProjectLoading(path!, 'canNotQuery');
                break;
            case 'connected':
                this.rpcServerReady = true;
                this.closeLoading('canNotQuery');
                break;
            case 'noContext':
                this.triggerTsProjectLoading(path!, path!);
                break;
            case 'addProject':
                this.closeLoading(path!);
                this._projectRoots.push(path!);
                break;
            case 'removeProject':
                this._projectRoots = this._projectRoots.filter((x) => x !== path!);
                break;
            default:
                break;
        }
        this.handleStateChange();
    }

    notifyStatusBar(listener: ListenForStatusBar) {
        this._notifyStatusBar = listener;
    }

    get rpcServerReady() {
        return this._isRpcServerReady;
    }

    private set rpcServerReady(value: boolean) {
        this._isRpcServerReady = value;
        this.handleStateChange();
    }

    private handleStateChange() {
        const barStatus = this._isLoading ? 'loading' : this.rpcServerReady ? 'connected' : 'disconnect';
        this._notifyStatusBar?.(barStatus, this._projectRoots);
    }

    private triggerTsProjectLoading(filePath: string, flag: string) {
        if (this._isLoading) {
            return;
        }

        this._isLoading = true;
        this._loadingFlag = flag;

        // 至少在插件启动一段时间后才能去触发。
        this._loadingTimeout = setTimeout(() => {
            this._loadingTimeout = setTimeout(() => this.closeLoading(flag), MAX_LOADING_TIME);
            void triggerTsServerByProject(filePath);
        }, this.getDelay());
    }

    private closeLoading(flag: string) {
        if (!this._loadingFlag.startsWith(flag)) {
            return;
        }

        this.forceCloseLoading();
    }

    private forceCloseLoading() {
        clearTimeout(this._loadingTimeout);
        this._isLoading = false;
        this._loadingFlag = '';
        this.handleStateChange();
    }

    private getDelay() {
        const timeCost = Date.now() - this._pluginStartAt;
        return timeCost > BASE_START_TIME ? 0 : BASE_START_TIME - timeCost;
    }
}
