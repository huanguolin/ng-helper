import { NgCompletionRequest } from '@ng-helper/shared/lib/plugin';
import express from 'express';

import { getComponentCompletions, getComponentControllerAs } from './completion';
import { PluginContext } from './type';
import { buildLogMsg } from './utils';

export function initHttpServer(getContext: (fileName: string) => PluginContext | undefined) {
    const app = express();
    app.use(express.json());

    app.get('/ng-helper/hc', (_, res) => res.send());

    app.post('/ng-helper/component/completion', (req, res) => {
        const body = req.body as NgCompletionRequest;
        try {
            const ctx = getContext(body.fileName);
            if (!ctx) {
                return res.send();
            }
            ctx.logger.info(buildLogMsg('completion request:', body));
            const response = getComponentCompletions(ctx, body.prefix);
            ctx.logger.info(buildLogMsg('completion response:', response));
            res.send(response);
        } catch (error) {
            res.status(500).send(error);
        }
    });

    app.post('/ng-helper/component/controller-as', (req, res) => {
        const body = req.body as NgCompletionRequest;
        try {
            const ctx = getContext(body.fileName);
            if (!ctx) {
                return res.send();
            }
            ctx.logger.info(buildLogMsg('controller-as request:', body));
            const response = getComponentControllerAs(ctx);
            ctx.logger.info(buildLogMsg('controller-as response:', response));
            res.send(response);
        } catch (error) {
            res.status(500).send(error);
        }
    });

    return app;
}
