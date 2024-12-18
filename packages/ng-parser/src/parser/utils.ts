import type { Location } from '../types';

export function resolveLocation<T extends Location>(...nodes: T[]): Location {
    if (nodes.length === 0) {
        throw new Error('No nodes provided');
    }

    return {
        start: get('start', Math.min),
        end: get('end', Math.max),
    };

    function get(name: keyof Location, pick: (...values: number[]) => number) {
        return pick(...nodes.filter((x) => x[name] >= 0).map((x) => x[name]));
    }
}
