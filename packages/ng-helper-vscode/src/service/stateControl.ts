import { triggerTsServerByProject } from '../utils';

export type State = 'disconnect' | 'connected' | 'canNotQuery' | 'noContext' | 'addProject' | 'removeProject';
export type BarStatus = 'disconnect' | 'connected' | 'loading';
export type ListenForStatusBar = (status: BarStatus, projectRoots: string[]) => void;

const MAX_LOADING_TIME = 5000;
// 至少启动3秒后才能去触发
const BASE_START_TIME = 3000;

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
        switch (state) {
            case 'disconnect':
                this._isRpcServerReady = false;
                break;
            case 'connected':
                this._isRpcServerReady = true;
                this.closeLoading('canNotQuery');
                break;
            case 'canNotQuery':
                this.triggerTsProjectLoading(path!, 'canNotQuery');
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

    private handleStateChange() {
        const barStatus = this._isLoading ? 'loading' : this._isRpcServerReady ? 'connected' : 'disconnect';
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

        clearTimeout(this._loadingTimeout);
        this._isLoading = false;
        this.handleStateChange();
    }

    private getDelay() {
        const timeCost = Date.now() - this._pluginStartAt;
        return timeCost > BASE_START_TIME ? 0 : BASE_START_TIME - timeCost;
    }
}
