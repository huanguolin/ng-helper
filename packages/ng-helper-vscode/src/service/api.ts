
import { CompletionRequest } from '@ng-helper/shared/lib/plugin';
import axios from 'axios';

export async function getComponentCompletion(port: number, info: CompletionRequest) {
    try {
        const result = await axios.post<string[] | undefined>(buildUrl(port, 'completion'), info);
        return result.data;
    } catch (error) {
        console.log('===> ng-helper connect ts server failed: ', error);
        return;
    }
}

export async function healthCheck(port: number): Promise<boolean> {
    try {
        await axios.get(buildUrl(port, 'hc'));
        return true;
    } catch (_) {
        return false;
    }
}

function buildUrl(port: number, ...uris: string[]) {
    return [`http://localhost:${port}/ng-helper`, ...uris].join('/');
}