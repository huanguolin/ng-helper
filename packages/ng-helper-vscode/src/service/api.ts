import {
    NgCompletionRequest,
    NgTypeCompletionResponse,
    NgComponentAttrRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgRequest,
    NgResponse,
    NgComponentNameCompletionResponse,
    NgComponentAttrCompletionResponse,
} from '@ng-helper/shared/lib/plugin';
import axios, { CancelToken } from 'axios';
import { CancellationToken } from 'vscode';

import { normalizePath, triggerTsServerByProject } from '../utils';

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

export function getComponentHoverApi({ port, vscodeCancelToken, info }: ApiInput<NgHoverRequest>) {
    return bizRequest<NgHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'component', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentHoverApi',
    });
}

export function getComponentTypeCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgCompletionRequest>) {
    return bizRequest<NgCompletionRequest, NgTypeCompletionResponse>({
        url: buildUrl(port, 'component', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentTypeCompletionApi',
    });
}

export function getComponentNameCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgRequest>) {
    return bizRequest<NgRequest, NgComponentNameCompletionResponse>({
        url: buildUrl(port, 'component', 'name', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentNameCompletionApi',
    });
}

export function getComponentAttrCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgComponentAttrRequest>) {
    return bizRequest<NgComponentAttrRequest, NgComponentAttrCompletionResponse>({
        url: buildUrl(port, 'component', 'attr', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentAttrCompletionApi',
    });
}

export function getComponentControllerAsApi({ port, vscodeCancelToken, info }: ApiInput<NgRequest>) {
    return bizRequest<NgRequest, string | undefined>({
        url: buildUrl(port, 'component', 'controller-as'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentControllerAsApi',
    });
}

export async function checkNgHelperServerRunningApi(port: number): Promise<boolean> {
    try {
        await axios.get(buildUrl(port, 'hc'));
        return true;
    } catch (_) {
        console.log('checkNgHelperServerRunningApi() failed.');
        return false;
    }
}

async function bizRequest<TInput extends NgRequest, TOutput>({ vscodeCancelToken, info, url, apiName }: BizRequestInput<TInput>) {
    try {
        info.fileName = normalizePath(info.fileName);
        console.log(`${apiName}() request: `, info);
        const result = await axios.post<NgResponse<TOutput>>(url, info, {
            cancelToken: getAxiosCancelToken(vscodeCancelToken),
        });
        console.log(`${apiName}() result: `, result.data);
        if (result.data.errKey === 'NO_CONTEXT') {
            await triggerTsServerByProject(info.fileName);
            return;
        }
        return result.data.data!;
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
