import type { StateControl } from '../stateControl';

import { RpcApi } from './rpcApi';
import { RpcControl } from './rpcControl';
import { RpcQueryControl } from './rpcQueryControl';

export class TsService {
    private _rpcControl: RpcControl;
    private _rpcQueryControl: RpcQueryControl;
    private _rpcApi: RpcApi;

    constructor(stateControl: StateControl) {
        this._rpcControl = new RpcControl(stateControl);
        this._rpcQueryControl = new RpcQueryControl(this._rpcControl, stateControl);
        this._rpcApi = new RpcApi(this._rpcQueryControl);
    }

    start(port: number): RpcApi {
        this._rpcControl.start(port);
        return this._rpcApi;
    }

    dispose() {
        this._rpcControl.dispose();
    }
}
