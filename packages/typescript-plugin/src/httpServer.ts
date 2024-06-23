import { TypeScriptContextWithSourceFile } from "./type";
import { getComponentCompletions } from "./completion";
import express from 'express';

export function initHttpServer(getContext: (fileName: string) => TypeScriptContextWithSourceFile | undefined) {
    const app = express();
    app.use(express.json());

    app.post('/ng-helper/command', (req, res) => {
        const body = req.body as { fileName: string; };
        try {
            const ctx = getContext(body.fileName);
            if (!ctx) {
                return res.send();
            }
            const response = getComponentCompletions(ctx);
            res.send(response);
        } catch {
            res.status(500).send({});
        }
    });
    return app;
}
