
import { NgCompletionRequest, NgCompletionResponse, NgRequest } from '@ng-helper/shared/lib/plugin';
import axios from 'axios';

export async function getComponentCompletion(port: number, info: NgCompletionRequest) {
    try {
        const result = await axios.post<NgCompletionResponse>(buildUrl(port, 'component', 'completion'), info);
        console.log('getComponentCompletion result: ', result.data);
        return result.data;
    } catch (error) {
        console.log('getComponentCompletion failed: ', error);
    }
}

export async function getComponentControllerAs(port: number, info: NgRequest) {
    try {
        const result = await axios.post<string | undefined>(buildUrl(port, 'component', 'controller-as'), info);
        console.log('getComponentControllerAs result: ', result.data);
        return result.data;
    } catch (error) {
        console.log('getComponentControllerAs failed: ', error);
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
    if (!port) {
        throw new Error('port is required');
    }
    const url = [`http://localhost:${port}/ng-helper`, ...uris].join('/');
    return url;
}