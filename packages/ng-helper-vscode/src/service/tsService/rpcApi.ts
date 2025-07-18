import {
    NgTypeCompletionRequest,
    NgTypeCompletionResponse,
    NgComponentAttrCompletionRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgRequest,
    NgComponentNameCompletionResponse,
    NgComponentAttrCompletionResponse,
    NgCtrlTypeCompletionRequest,
    NgCtrlHoverRequest,
    NgComponentNameOrAttrNameHoverRequest,
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgDefinitionResponse,
    type NgTypeDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgListComponentsAttrsRequest,
    type NgComponentsAttrsResponse,
    type NgDirectiveCompletionRequest,
    type NgDirectiveCompletionResponse,
    type NgDirectiveHoverRequest,
    type NgDirectiveDefinitionRequest,
    type NgControllerNameDefinitionRequest,
    type NgListDirectivesAttrsRequest,
    type NgDirectivesAttrsResponse,
    type NgFilterNameDefinitionRequest,
    type NgAllComponentsExpressionAttrsResponse,
    type NgComponentInfoRequest,
    type NgComponentInfoResponse,
    type NgDirectiveInfoRequest,
    type NgDirectiveInfoResponse,
} from '@ng-helper/shared/lib/plugin';
import type { CancellationToken } from 'vscode';

import type { RpcQueryControl } from './rpcQueryControl';

interface ApiInput<T> {
    params: T;
    cancelToken?: CancellationToken;
}

export class RpcApi {
    constructor(private _rpcQueryControl: RpcQueryControl) {}

    get rpcServerReady() {
        return this._rpcQueryControl.rpcServerReady;
    }

    get status() {
        return this._rpcQueryControl.status;
    }

    get loadedTsProjectRoots(): string[] {
        return this._rpcQueryControl.loadedTsProjectRoots;
    }

    getFilterNameDefinitionApi({ params, cancelToken }: ApiInput<NgFilterNameDefinitionRequest>) {
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            'definition/filter/name',
            params,
            'getFilterNameDefinitionApi',
            cancelToken,
        );
    }

    listDirectivesStringAttrs({ params, cancelToken }: ApiInput<NgListDirectivesAttrsRequest>) {
        return this._rpcQueryControl.query<NgDirectivesAttrsResponse>(
            'attrs/string/directives',
            params,
            'listDirectivesStringAttrs',
            cancelToken,
        );
    }

    listComponentsStringAttrs({ params, cancelToken }: ApiInput<NgListComponentsAttrsRequest>) {
        return this._rpcQueryControl.query<NgComponentsAttrsResponse>(
            'attrs/string/components',
            params,
            'listComponentsStringAttrs',
            cancelToken,
        );
    }

    listDirectivesExpressionAttrs({ params, cancelToken }: ApiInput<NgListDirectivesAttrsRequest>) {
        return this._rpcQueryControl.query<NgDirectivesAttrsResponse>(
            'attrs/expression/directives',
            params,
            'listDirectivesExpressionAttrs',
            cancelToken,
        );
    }

    listComponentsExpressionAttrs({ params, cancelToken }: ApiInput<NgListComponentsAttrsRequest>) {
        return this._rpcQueryControl.query<NgComponentsAttrsResponse>(
            'attrs/expression/components',
            params,
            'listComponentsExpressionAttrs',
            cancelToken,
        );
    }

    listAllComponentsAndDirectivesExpressionAttrs({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcQueryControl.query<NgAllComponentsExpressionAttrsResponse>(
            'attrs/expression/all',
            params,
            'listAllComponentsAndDirectivesExpressionAttrs',
            cancelToken,
        );
    }

    getControllerNameDefinitionApi({ params, cancelToken }: ApiInput<NgControllerNameDefinitionRequest>) {
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            'definition/controller/name',
            params,
            'getControllerNameDefinitionApi',
            cancelToken,
        );
    }

    getDirectiveDefinitionApi({ params, cancelToken }: ApiInput<NgDirectiveDefinitionRequest>) {
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            'definition/directive',
            params,
            'getDirectiveDefinitionApi',
            cancelToken,
        );
    }

    getControllerTypeDefinitionApi({ params, cancelToken }: ApiInput<NgCtrlTypeDefinitionRequest>) {
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            'definition/controller/type',
            params,
            'getControllerTypeDefinitionApi',
            cancelToken,
        );
    }

    getComponentTypeDefinitionApi({ params, cancelToken }: ApiInput<NgTypeDefinitionRequest>) {
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            'definition/component/type',
            params,
            'getComponentTypeDefinitionApi',
            cancelToken,
        );
    }

    getComponentNameOrAttrNameDefinitionApi({
        params,
        cancelToken,
    }: ApiInput<NgComponentNameOrAttrNameDefinitionRequest>) {
        const path = params.hoverInfo.type === 'attrName' ? 'definition/component/attr' : 'definition/component/name';
        return this._rpcQueryControl.query<NgDefinitionResponse>(
            path,
            params,
            'getComponentNameOrAttrNameDefinitionApi',
            cancelToken,
        );
    }

    getControllerTypeHoverApi({ params, cancelToken }: ApiInput<NgCtrlHoverRequest>) {
        return this._rpcQueryControl.query<NgHoverResponse>(
            'hover/controller/type',
            params,
            'getControllerTypeHoverApi',
            cancelToken,
        );
    }

    getComponentTypeHoverApi({ params, cancelToken }: ApiInput<NgHoverRequest>) {
        return this._rpcQueryControl.query<NgHoverResponse>(
            'hover/component/type',
            params,
            'getComponentTypeHoverApi',
            cancelToken,
        );
    }

    getComponentNameOrAttrNameHoverApi({ params, cancelToken }: ApiInput<NgComponentNameOrAttrNameHoverRequest>) {
        const path = params.hoverInfo.type === 'attrName' ? 'hover/component/attr' : 'hover/component/name';
        return this._rpcQueryControl.query<NgHoverResponse>(
            path,
            params,
            'getComponentNameOrAttrNameHoverApi',
            cancelToken,
        );
    }

    getDirectiveHoverApi({ params, cancelToken }: ApiInput<NgDirectiveHoverRequest>) {
        return this._rpcQueryControl.query<NgHoverResponse>(
            'hover/directive',
            params,
            'getDirectiveHoverApi',
            cancelToken,
        );
    }

    getFilterNameHoverApi({ params, cancelToken }: ApiInput<NgHoverRequest>) {
        return this._rpcQueryControl.query<NgHoverResponse>(
            'hover/filter/name',
            params,
            'getFilterNameHoverApi',
            cancelToken,
        );
    }

    getFilterNameCompletionApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcQueryControl.query<NgTypeCompletionResponse>(
            'completion/filter/name',
            params,
            'getFilterNameCompletionApi',
            cancelToken,
        );
    }

    getControllerTypeCompletionApi({ params, cancelToken }: ApiInput<NgCtrlTypeCompletionRequest>) {
        return this._rpcQueryControl.query<NgTypeCompletionResponse>(
            'completion/controller/type',
            params,
            'getControllerTypeCompletionApi',
            cancelToken,
        );
    }

    getDirectiveCompletionApi({ params, cancelToken }: ApiInput<NgDirectiveCompletionRequest>) {
        return this._rpcQueryControl.query<NgDirectiveCompletionResponse>(
            'completion/directive',
            params,
            'getDirectiveCompletionApi',
            cancelToken,
        );
    }

    getComponentTypeCompletionApi({ params, cancelToken }: ApiInput<NgTypeCompletionRequest>) {
        return this._rpcQueryControl.query<NgTypeCompletionResponse>(
            'completion/component/type',
            params,
            'getComponentTypeCompletionApi',
            cancelToken,
        );
    }

    getComponentNameCompletionApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcQueryControl.query<NgComponentNameCompletionResponse>(
            'completion/component/name',
            params,
            'getComponentNameCompletionApi',
            cancelToken,
        );
    }

    getComponentAttrCompletionApi({ params, cancelToken }: ApiInput<NgComponentAttrCompletionRequest>) {
        return this._rpcQueryControl.query<NgComponentAttrCompletionResponse>(
            'completion/component/attr',
            params,
            'getComponentAttrCompletionApi',
            cancelToken,
        );
    }

    getComponentControllerAsApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcQueryControl.query<string | undefined>(
            'controller-as/component',
            params,
            'getComponentControllerAsApi',
            cancelToken,
        );
    }

    resolveComponentInfoApi({ params, cancelToken }: ApiInput<NgComponentInfoRequest>) {
        return this._rpcQueryControl.query<NgComponentInfoResponse>(
            'component/info',
            params,
            'resolveComponentInfoApi',
            cancelToken,
        );
    }

    resolveDirectiveInfoApi({ params, cancelToken }: ApiInput<NgDirectiveInfoRequest>) {
        return this._rpcQueryControl.query<NgDirectiveInfoResponse>(
            'directive/info',
            params,
            'resolveDirectiveInfoApi',
            cancelToken,
        );
    }
}
