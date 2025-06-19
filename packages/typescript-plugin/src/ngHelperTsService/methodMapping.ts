import type {
    NgFilterNameDefinitionRequest,
    NgControllerNameDefinitionRequest,
    NgComponentNameOrAttrNameDefinitionRequest,
    NgTypeDefinitionRequest,
    NgCtrlTypeDefinitionRequest,
    NgDirectiveDefinitionRequest,
    NgHoverRequest,
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgDirectiveHoverRequest,
    NgTypeCompletionRequest,
    NgComponentAttrCompletionRequest,
    NgDirectiveCompletionRequest,
    NgCtrlTypeCompletionRequest,
    NgListDirectivesAttrsRequest,
    NgListComponentsAttrsRequest,
} from '@ng-helper/shared/lib/plugin';

import {
    getComponentAttrCompletions,
    getComponentControllerAs,
    getComponentNameCompletions,
    getComponentTypeCompletions,
    getControllerTypeCompletions,
    getDirectiveCompletions,
    getFilterNameCompletions,
} from '../completion';
import {
    getComponentNameOrAttrNameDefinitionInfo,
    getComponentTypeDefinitionInfo,
    getControllerNameDefinitionInfo,
    getControllerTypeDefinitionInfo,
    getDirectiveDefinitionInfo,
    getFilterNameDefinitionInfo,
} from '../definition';
import {
    getComponentNameOrAttrNameHoverInfo,
    getComponentTypeHoverInfo,
    getControllerTypeHoverInfo,
    getDirectiveHoverInfo,
    getFilterNameHoverInfo,
} from '../hover';
import {
    getComponentsExpressionAttrsInfo,
    getComponentsStringAttrsInfo,
    getDirectivesExpressionAttrsInfo,
    getDirectivesStringAttrsInfo,
} from '../other';
import type { PluginContext } from '../type';

import type { RpcMethodConfig } from './RpcRouter';

const definitionMethods = {
    'definition/component/attr': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) =>
            getComponentNameOrAttrNameDefinitionInfo(ctx, ngRequest as NgComponentNameOrAttrNameDefinitionRequest),
    },
    'definition/component/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) =>
            getComponentNameOrAttrNameDefinitionInfo(ctx, ngRequest as NgComponentNameOrAttrNameDefinitionRequest),
    },
    'definition/component/type': {
        isCoreCtx: false,
        handler: (ctx, ngRequest) =>
            getComponentTypeDefinitionInfo(ctx as PluginContext, ngRequest as NgTypeDefinitionRequest),
    },
    'definition/controller/name': {
        isCoreCtx: false,
        handler: (ctx, ngRequest) =>
            getControllerNameDefinitionInfo(ctx as PluginContext, ngRequest as NgControllerNameDefinitionRequest),
    },
    'definition/controller/type': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getControllerTypeDefinitionInfo(ctx, ngRequest as NgCtrlTypeDefinitionRequest),
    },
    'definition/directive': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getDirectiveDefinitionInfo(ctx, ngRequest as NgDirectiveDefinitionRequest),
    },
    'definition/filter/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getFilterNameDefinitionInfo(ctx, ngRequest as NgFilterNameDefinitionRequest),
    },
} satisfies Record<string, RpcMethodConfig>;

const completionMethods = {
    'completion/component/attr': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) =>
            getComponentAttrCompletions(
                ctx,
                (ngRequest as NgComponentAttrCompletionRequest).fileName,
                (ngRequest as NgComponentAttrCompletionRequest).componentName,
            ),
    },
    'completion/component/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getComponentNameCompletions(ctx, ngRequest.fileName),
    },
    'completion/component/type': {
        isCoreCtx: false,
        handler: (ctx, ngRequest) =>
            getComponentTypeCompletions(ctx as PluginContext, (ngRequest as NgTypeCompletionRequest).prefix),
    },
    'completion/controller/type': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getControllerTypeCompletions(ctx, ngRequest as NgCtrlTypeCompletionRequest),
    },
    'completion/directive': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getDirectiveCompletions(ctx, ngRequest as NgDirectiveCompletionRequest),
    },
    'completion/filter/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getFilterNameCompletions(ctx, ngRequest),
    },
} satisfies Record<string, RpcMethodConfig>;

const hoverMethods = {
    'hover/component/attr': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) =>
            getComponentNameOrAttrNameHoverInfo(ctx, ngRequest as NgComponentNameOrAttrNameHoverRequest),
    },
    'hover/component/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) =>
            getComponentNameOrAttrNameHoverInfo(ctx, ngRequest as NgComponentNameOrAttrNameHoverRequest),
    },
    'hover/component/type': {
        isCoreCtx: false,
        handler: (ctx, ngRequest) => getComponentTypeHoverInfo(ctx as PluginContext, ngRequest as NgHoverRequest),
    },
    'hover/controller/type': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getControllerTypeHoverInfo(ctx, ngRequest as NgCtrlHoverRequest),
    },
    'hover/directive': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getDirectiveHoverInfo(ctx, ngRequest as NgDirectiveHoverRequest),
    },
    'hover/filter/name': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getFilterNameHoverInfo(ctx, ngRequest as NgHoverRequest),
    },
} satisfies Record<string, RpcMethodConfig>;

const otherMethods = {
    'controller-as/component': {
        isCoreCtx: false,
        handler: (ctx) => getComponentControllerAs(ctx as PluginContext),
    },
    'attrs/string/components': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getComponentsStringAttrsInfo(ctx, ngRequest as NgListComponentsAttrsRequest),
    },
    'attrs/string/directives': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getDirectivesStringAttrsInfo(ctx, ngRequest as NgListDirectivesAttrsRequest),
    },
    'attrs/expression/components': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getComponentsExpressionAttrsInfo(ctx, ngRequest as NgListComponentsAttrsRequest),
    },
    'attrs/expression/directives': {
        isCoreCtx: true,
        handler: (ctx, ngRequest) => getDirectivesExpressionAttrsInfo(ctx, ngRequest as NgListDirectivesAttrsRequest),
    },
} satisfies Record<string, RpcMethodConfig>;

export const methodMapping = {
    ...definitionMethods,
    ...completionMethods,
    ...hoverMethods,
    ...otherMethods,
} as const satisfies Record<string, RpcMethodConfig>;
