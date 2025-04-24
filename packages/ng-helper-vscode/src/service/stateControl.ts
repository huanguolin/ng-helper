import { TsServerTrigger } from './tsServerTrigger';

export type State = 'disconnect' | 'connected' | 'noContext' | 'addProject' | 'removeProject';
export type BarStatus = 'disconnect' | 'connected' | 'loading';
export type ListenForStatusBar = (status: BarStatus, projectStateMap: Record<string, boolean>) => void;

export class StateControl {
    private _tsServerTrigger: TsServerTrigger;
    private _notifyStatusBar?: ListenForStatusBar;

    constructor(pluginStartAt: number) {
        this._tsServerTrigger = new TsServerTrigger(pluginStartAt);
    }

    updateState(_state: State, _path?: string) {
        // TODO: impl
    }

    getProjectStates() {
        // TODO: impl
    }

    notifyStatusBar(listener: ListenForStatusBar) {
        this._notifyStatusBar = listener;
    }
}
