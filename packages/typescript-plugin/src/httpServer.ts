import { PluginContext } from "./type";
import { getComponentCompletions } from "./completion";
import express from 'express';
import { CompletionRequest } from "@ng-helper/shared/lib/plugin";

export function initHttpServer(getContext: (fileName: string) => PluginContext | undefined) {
    const app = express();
    app.use(express.json());

    app.get('/ng-helper/hc', (_, res) => res.send());

    app.post('/ng-helper/completion', (req, res) => {
        const body = req.body as CompletionRequest;
        try {
            const ctx = getContext(body.fileName);
            if (!ctx) {
                return res.send();
            }
            const response = getComponentCompletions(ctx);
            res.send(response);
        } catch (error) {
            res.status(500).send(error);
        }
    });

    return app;
}
