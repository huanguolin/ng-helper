
import axios from 'axios';

export async function getComponentCompletion(tsFilePath: string, port: number) {
    const result = await axios.post<string[] | undefined>(
        `http://localhost:${port}/ng-helper/command`,
        { fileName: tsFilePath },
    );
    return result.data;
}