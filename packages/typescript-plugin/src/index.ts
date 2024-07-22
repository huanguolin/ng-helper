import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { overrideGetSemanticDiagnostics } from './diagnostic';
import { createNgHelperServer } from './ngHelperServer';

const ngHelperServer = createNgHelperServer();

export = init;

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            const result = ngHelperServer.addProject({ info, modules });
            if (!result) {
                return info.languageService;
            }

            const { getContext, removeProject } = result;

            // Set up decorator object
            const proxy: ts.LanguageService = buildProxy(info);

            overrideGetSemanticDiagnostics({ proxy, info, getContext });

            // dispose
            proxy.dispose = () => {
                removeProject();
                info.languageService.dispose();
            };

            return proxy;
        },
        onConfigurationChanged(config: NgPluginConfiguration) {
            ngHelperServer.updateConfig(config);
        },
    };
}

function buildProxy(info: ts.server.PluginCreateInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proxy: ts.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
        const x = info.languageService[k]!;
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        // eslint-disable-next-line @typescript-eslint/ban-types
        proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }
    return proxy;
}
