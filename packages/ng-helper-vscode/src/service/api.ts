
import axios from 'axios';

export async function getComponentCompletion(tsFilePath: string, port: number) {
    const result = await axios.post<string[] | undefined>(
        buildUrl(port, 'command'),
        { fileName: tsFilePath },
    );
    return result.data;
}

export async function healthCheck(port: number): Promise<boolean> {
    try {
        await axios.post(buildUrl(port, 'command'));
        return true;
    } catch (_) {
        return false;
    }
}

function buildUrl(port: number, ...uris: string[]) {
    return [`http://localhost:${port}/ng-helper`, ...uris].join('/');
}