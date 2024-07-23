import { NgCompletionRequest, NgCompletionResponse, NgHoverRequest, NgHoverResponse, NgRequest } from '@ng-helper/shared/lib/plugin';
import axios, { CancelToken } from 'axios';
import { CancellationToken } from 'vscode';

import { normalizePath } from '../utils';

interface ApiInput<T> {
    port: number;
    info: T;
    vscodeCancelToken: CancellationToken;
}

interface BizRequestInput<T> {
    url: string;
    info: T;
    apiName: string;
    vscodeCancelToken: CancellationToken;
}

export function getComponentHover({ port, vscodeCancelToken, info }: ApiInput<NgHoverRequest>) {
    return bizRequest<NgHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'component', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentHover',
    });
}

export function getComponentCompletion({ port, vscodeCancelToken, info }: ApiInput<NgCompletionRequest>) {
    return bizRequest<NgCompletionRequest, NgCompletionResponse>({
        url: buildUrl(port, 'component', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentCompletion',
    });
}

export function getComponentControllerAs({ port, vscodeCancelToken, info }: ApiInput<NgRequest>) {
    return bizRequest<NgRequest, string | undefined>({
        url: buildUrl(port, 'component', 'controller-as'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentControllerAs',
    });
}

export async function healthCheck(port: number): Promise<boolean> {
    try {
        await axios.get(buildUrl(port, 'hc'));
        return true;
    } catch (_) {
        return false;
    }
}

async function bizRequest<TInput extends NgRequest, TOutput>({ vscodeCancelToken, info, url, apiName }: BizRequestInput<TInput>) {
    try {
        info.fileName = normalizePath(info.fileName);
        console.log(`${apiName}() request: `, info);
        const result = await axios.post<TOutput>(url, info, {
            cancelToken: getAxiosCancelToken(vscodeCancelToken),
        });
        console.log(`${apiName}() result: `, result.data);
        return result.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log(`${apiName}() cancelled by vscode.`);
        } else {
            console.log(`${apiName}() failed: `, error);
        }
    }
}

function getAxiosCancelToken(vscodeCancelToken: CancellationToken): CancelToken {
    const axiosCancelToken = axios.CancelToken.source();

    vscodeCancelToken.onCancellationRequested(() => {
        axiosCancelToken.cancel('Operation cancelled by VS Code');
    });

    return axiosCancelToken.token;
}

function buildUrl(port: number, ...uris: string[]) {
    if (!port) {
        throw new Error('port is required');
    }
    const url = [`http://localhost:${port}/ng-helper`, ...uris].join('/');
    return url;
}
