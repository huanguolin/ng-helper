export const EMBEDDED_CONTENT_FLAG = 'embedded-content';

export function isEmbeddedContentFile(filePath: string): boolean {
    return filePath.startsWith(EMBEDDED_CONTENT_FLAG);
}
