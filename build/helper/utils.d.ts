export declare function hasOwnProperty(obj: any, key: string): boolean;
export declare function repeat(str: string, times: int): string;
export declare function arraysEqual<T>(a: Array<T>, b: Array<T>): boolean;
export declare function dictEqual(dictA: Lookup<any>, dictB: Lookup<any>): boolean;
export declare function shallowCopy<T>(thing: Lookup<T>): Lookup<T>;
export declare function deduplicateSort(a: string[]): string[];
export declare function mapLookup<T, U>(thing: Lookup<T>, fn: (x: T) => U): Lookup<U>;
export declare function emptyLookup(lookup: Lookup<any>): boolean;
export declare function nonEmptyLookup(lookup: Lookup<any>): boolean;
export declare function safeAdd(num: number, delta: number): number;
export declare function continuousFloorExpression(variable: string, floorFn: string, size: number, offset: number): string;
export declare class ExtendableError extends Error {
    stack: string;
    constructor(message: string);
}
