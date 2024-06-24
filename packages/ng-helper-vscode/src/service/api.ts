
import { CompletionRequest, CompletionResponse } from '@ng-helper/shared/lib/plugin';
import axios from 'axios';

export async function getComponentCompletion(port: number, info: CompletionRequest) {
    try {
        const result = await axios.post<CompletionResponse>(buildUrl(port, 'completion'), info);
        console.log('getComponentCompletion result: ', result.data);
        return result.data;
    } catch (error) {
        console.log('getComponentCompletion failed: ', error);
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