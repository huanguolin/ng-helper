import { triggerTsServerByProject } from '../utils';

const AUTO_BACK_TIMEOUT = 5000;
// 至少启动3秒后才能去触发
const BASE_START_TIME = 3000;

export class TsServerTrigger {
    private _pluginStartAt: number;
    private _busy = false;
    private _timeout?: NodeJS.Timeout;

    constructor(pluginStartAt: number) {
        this._pluginStartAt = pluginStartAt;
    }

    trigger(filePath: string) {
        if (this.busy) {
            return;
        }

        this._busy = true;

        const setDone = () => {
            clearTimeout(this._timeout);
            this._busy = false;
        };

        // 至少在插件启动一段时间后才能去触发。
        this._timeout = setTimeout(() => {
            this._timeout = setTimeout(setDone, AUTO_BACK_TIMEOUT);
            void triggerTsServerByProject(filePath);
        }, this.getDelay());

        return setDone;
    }

    get busy() {
        return this._busy;
    }

    private getDelay() {
        const timeCost = Date.now() - this._pluginStartAt;
        return timeCost > BASE_START_TIME ? 0 : BASE_START_TIME - timeCost;
    }
}
