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
    type NgListComponentsStringAttrsRequest,
    type NgComponentsStringAttrsResponse,
    type NgDirectiveCompletionRequest,
    type NgDirectiveCompletionResponse,
    type NgDirectiveHoverRequest,
    type NgDirectiveDefinitionRequest,
    type NgControllerNameDefinitionRequest,
    type NgListDirectivesStringAttrsRequest,
    type NgDirectivesStringAttrsResponse,
    type NgFilterNameDefinitionRequest,
} from '@ng-helper/shared/lib/plugin';
import type { CancellationToken } from 'vscode';

import type { RpcServer } from './rpcServer';

interface ApiInput<T> {
    params: T;
    cancelToken: CancellationToken;
}

export class TsService {
    constructor(private _rpcServer: RpcServer) {}

    getFilterNameDefinitionApi({ params, cancelToken }: ApiInput<NgFilterNameDefinitionRequest>) {
        return this._rpcServer.query<NgDefinitionResponse>(
            'definition/filter/name',
            params,
            'getFilterNameDefinitionApi',
            cancelToken,
        );
    }

    listDirectivesStringAttrs({ params, cancelToken }: ApiInput<NgListDirectivesStringAttrsRequest>) {
        return this._rpcServer.query<NgDirectivesStringAttrsResponse>(
            'attrs/string/directives',
            params,
            'listDirectivesStringAttrs',
            cancelToken,
        );
    }

    listComponentsStringAttrs({ params, cancelToken }: ApiInput<NgListComponentsStringAttrsRequest>) {
        return this._rpcServer.query<NgComponentsStringAttrsResponse>(
            'attrs/string/components',
            params,
            'listComponentsStringAttrs',
            cancelToken,
        );
    }

    getControllerNameDefinitionApi({ params, cancelToken }: ApiInput<NgControllerNameDefinitionRequest>) {
        return this._rpcServer.query<NgDefinitionResponse>(
            'definition/controller/name',
            params,
            'getControllerNameDefinitionApi',
            cancelToken,
        );
    }

    getDirectiveDefinitionApi({ params, cancelToken }: ApiInput<NgDirectiveDefinitionRequest>) {
        return this._rpcServer.query<NgDefinitionResponse>(
            'definition/directive',
            params,
            'getDirectiveDefinitionApi',
            cancelToken,
        );
    }

    getControllerTypeDefinitionApi({ params, cancelToken }: ApiInput<NgCtrlTypeDefinitionRequest>) {
        return this._rpcServer.query<NgDefinitionResponse>(
            'definition/controller/type',
            params,
            'getControllerTypeDefinitionApi',
            cancelToken,
        );
    }

    getComponentTypeDefinitionApi({ params, cancelToken }: ApiInput<NgTypeDefinitionRequest>) {
        return this._rpcServer.query<NgDefinitionResponse>(
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
        return this._rpcServer.query<NgDefinitionResponse>(
            path,
            params,
            'getComponentNameOrAttrNameDefinitionApi',
            cancelToken,
        );
    }

    getControllerTypeHoverApi({ params, cancelToken }: ApiInput<NgCtrlHoverRequest>) {
        return this._rpcServer.query<NgHoverResponse>(
            'hover/controller/type',
            params,
            'getControllerTypeHoverApi',
            cancelToken,
        );
    }

    getComponentTypeHoverApi({ params, cancelToken }: ApiInput<NgHoverRequest>) {
        return this._rpcServer.query<NgHoverResponse>(
            'hover/component/type',
            params,
            'getComponentTypeHoverApi',
            cancelToken,
        );
    }

    getComponentNameOrAttrNameHoverApi({ params, cancelToken }: ApiInput<NgComponentNameOrAttrNameHoverRequest>) {
        const path = params.hoverInfo.type === 'attrName' ? 'hover/component/attr' : 'hover/component/name';
        return this._rpcServer.query<NgHoverResponse>(path, params, 'getComponentNameOrAttrNameHoverApi', cancelToken);
    }

    getDirectiveHoverApi({ params, cancelToken }: ApiInput<NgDirectiveHoverRequest>) {
        return this._rpcServer.query<NgHoverResponse>('hover/directive', params, 'getDirectiveHoverApi', cancelToken);
    }

    getFilterNameHoverApi({ params, cancelToken }: ApiInput<NgHoverRequest>) {
        return this._rpcServer.query<NgHoverResponse>(
            'hover/filter/name',
            params,
            'getFilterNameHoverApi',
            cancelToken,
        );
    }

    getFilterNameCompletionApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcServer.query<NgTypeCompletionResponse>(
            'completion/filter/name',
            params,
            'getFilterNameCompletionApi',
            cancelToken,
        );
    }

    getControllerTypeCompletionApi({ params, cancelToken }: ApiInput<NgCtrlTypeCompletionRequest>) {
        return this._rpcServer.query<NgTypeCompletionResponse>(
            'completion/controller/type',
            params,
            'getControllerTypeCompletionApi',
            cancelToken,
        );
    }

    getDirectiveCompletionApi({ params, cancelToken }: ApiInput<NgDirectiveCompletionRequest>) {
        return this._rpcServer.query<NgDirectiveCompletionResponse>(
            'completion/directive',
            params,
            'getDirectiveCompletionApi',
            cancelToken,
        );
    }

    getComponentTypeCompletionApi({ params, cancelToken }: ApiInput<NgTypeCompletionRequest>) {
        return this._rpcServer.query<NgTypeCompletionResponse>(
            'completion/component/type',
            params,
            'getComponentTypeCompletionApi',
            cancelToken,
        );
    }

    getComponentNameCompletionApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcServer.query<NgComponentNameCompletionResponse>(
            'completion/component/name',
            params,
            'getComponentNameCompletionApi',
            cancelToken,
        );
    }

    getComponentAttrCompletionApi({ params, cancelToken }: ApiInput<NgComponentAttrCompletionRequest>) {
        return this._rpcServer.query<NgComponentAttrCompletionResponse>(
            'completion/component/attr',
            params,
            'getComponentAttrCompletionApi',
            cancelToken,
        );
    }

    getComponentControllerAsApi({ params, cancelToken }: ApiInput<NgRequest>) {
        return this._rpcServer.query<string | undefined>(
            'controller-as/component',
            params,
            'getComponentControllerAsApi',
            cancelToken,
        );
    }
}
