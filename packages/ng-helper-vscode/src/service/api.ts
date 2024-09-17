import {
    NgTypeCompletionRequest,
    NgTypeCompletionResponse,
    NgComponentAttrCompletionRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgRequest,
    NgResponse,
    NgComponentNameCompletionResponse,
    NgComponentAttrCompletionResponse,
    NgCtrlTypeCompletionRequest,
    NgCtrlHoverRequest,
    NgComponentNameOrAttrNameHoverRequest,
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgDefinitionResponse,
    type NgTypeDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgListComponentsStringAttrsRequest,
    type NgComponentsStringAttrsResponse,
    type NgDirectiveCompletionRequest,
    type NgDirectiveCompletionResponse,
    type NgDirectiveHoverRequest,
    type NgDirectiveDefinitionRequest,
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

export function listComponentsStringAttrs({ port, vscodeCancelToken, info }: ApiInput<NgListComponentsStringAttrsRequest>) {
    return bizRequest<NgListComponentsStringAttrsRequest, NgComponentsStringAttrsResponse>({
        url: buildUrl(port, 'components', 'string', 'attrs'),
        info,
        vscodeCancelToken,
        apiName: 'listComponentsStringAttrs',
    });
}

export function getDirectiveDefinitionApi({ port, vscodeCancelToken, info }: ApiInput<NgDirectiveDefinitionRequest>) {
    return bizRequest<NgDirectiveDefinitionRequest, NgDefinitionResponse>({
        url: buildUrl(port, 'directive', 'definition'),
        info,
        vscodeCancelToken,
        apiName: 'getDirectiveDefinitionApi',
    });
}

export function getControllerTypeDefinitionApi({ port, vscodeCancelToken, info }: ApiInput<NgCtrlTypeDefinitionRequest>) {
    return bizRequest<NgCtrlTypeDefinitionRequest, NgDefinitionResponse>({
        url: buildUrl(port, 'controller', 'type', 'definition'),
        info,
        vscodeCancelToken,
        apiName: 'getControllerTypeDefinitionApi',
    });
}

export function getComponentTypeDefinitionApi({ port, vscodeCancelToken, info }: ApiInput<NgTypeDefinitionRequest>) {
    return bizRequest<NgTypeDefinitionRequest, NgDefinitionResponse>({
        url: buildUrl(port, 'component', 'type', 'definition'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentTypeDefinitionApi',
    });
}

export function getComponentNameOrAttrNameDefinitionApi({ port, vscodeCancelToken, info }: ApiInput<NgComponentNameOrAttrNameDefinitionRequest>) {
    return bizRequest<NgComponentNameOrAttrNameDefinitionRequest, NgDefinitionResponse>({
        url: buildUrl(port, 'component', info.hoverInfo.type === 'attrName' ? 'attr' : 'name', 'definition'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentNameOrAttrNameDefinitionApi',
    });
}

export function getControllerTypeHoverApi({ port, vscodeCancelToken, info }: ApiInput<NgCtrlHoverRequest>) {
    return bizRequest<NgCtrlHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'controller', 'type', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getControllerTypeHoverApi',
    });
}

export function getComponentTypeHoverApi({ port, vscodeCancelToken, info }: ApiInput<NgHoverRequest>) {
    return bizRequest<NgHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'component', 'type', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentTypeHoverApi',
    });
}

export function getComponentNameOrAttrNameHoverApi({ port, vscodeCancelToken, info }: ApiInput<NgComponentNameOrAttrNameHoverRequest>) {
    return bizRequest<NgComponentNameOrAttrNameHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'component', info.hoverInfo.type === 'attrName' ? 'attr' : 'name', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getComponentNameOrAttrNameHoverApi',
    });
}

export function getDirectiveHoverApi({ port, vscodeCancelToken, info }: ApiInput<NgDirectiveHoverRequest>) {
    return bizRequest<NgDirectiveHoverRequest, NgHoverResponse>({
        url: buildUrl(port, 'directive', 'hover'),
        info,
        vscodeCancelToken,
        apiName: 'getDirectiveHoverApi',
    });
}

export function getControllerTypeCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgCtrlTypeCompletionRequest>) {
    return bizRequest<NgCtrlTypeCompletionRequest, NgTypeCompletionResponse>({
        url: buildUrl(port, 'controller', 'type', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getControllerTypeCompletionApi',
    });
}

export function getDirectiveCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgDirectiveCompletionRequest>) {
    return bizRequest<NgDirectiveCompletionRequest, NgDirectiveCompletionResponse>({
        url: buildUrl(port, 'directive', 'completion'),
        info,
        vscodeCancelToken,
        apiName: 'getDirectiveCompletionApi',
    });
}

export function getComponentTypeCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgTypeCompletionRequest>) {
    return bizRequest<NgTypeCompletionRequest, NgTypeCompletionResponse>({
        url: buildUrl(port, 'component', 'type', 'completion'),
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

export function getComponentAttrCompletionApi({ port, vscodeCancelToken, info }: ApiInput<NgComponentAttrCompletionRequest>) {
    return bizRequest<NgComponentAttrCompletionRequest, NgComponentAttrCompletionResponse>({
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
