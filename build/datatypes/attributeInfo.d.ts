import { Instance } from "immutable-class";
import { PlyType, FullType } from "../types";
import { ActionJS, Action } from "../actions/baseAction";
export declare type Attributes = AttributeInfo[];
export declare type AttributeJSs = AttributeInfoJS[];
export interface AttributeInfoValue {
    special?: string;
    name: string;
    type?: PlyType;
    datasetType?: Lookup<FullType>;
    unsplitable?: boolean;
    makerAction?: Action;
    separator?: string;
    rangeSize?: number;
    digitsBeforeDecimal?: int;
    digitsAfterDecimal?: int;
}
export interface AttributeInfoJS {
    special?: string;
    name: string;
    type?: PlyType;
    datasetType?: Lookup<FullType>;
    unsplitable?: boolean;
    makerAction?: ActionJS;
    separator?: string;
    rangeSize?: number;
    digitsBeforeDecimal?: int;
    digitsAfterDecimal?: int;
}
export declare class AttributeInfo implements Instance<AttributeInfoValue, AttributeInfoJS> {
    static isAttributeInfo(candidate: any): candidate is AttributeInfo;
    static jsToValue(parameters: AttributeInfoJS): AttributeInfoValue;
    static classMap: Lookup<typeof AttributeInfo>;
    static register(ex: typeof AttributeInfo): void;
    static fromJS(parameters: AttributeInfoJS): AttributeInfo;
    static fromJSs(attributeJSs: AttributeJSs): Attributes;
    static toJSs(attributes: Attributes): AttributeJSs;
    static override(attributes: Attributes, attributeOverrides: Attributes): Attributes;
    special: string;
    name: string;
    type: PlyType;
    datasetType: Lookup<FullType>;
    unsplitable: boolean;
    makerAction: Action;
    constructor(parameters: AttributeInfoValue);
    _ensureSpecial(special: string): void;
    _ensureType(myType: PlyType): void;
    toString(): string;
    valueOf(): AttributeInfoValue;
    toJS(): AttributeInfoJS;
    toJSON(): AttributeInfoJS;
    equals(other: AttributeInfo): boolean;
    serialize(value: any): any;
    change(propertyName: string, newValue: any): AttributeInfo;
}
export declare class UniqueAttributeInfo extends AttributeInfo {
    static fromJS(parameters: AttributeInfoJS): UniqueAttributeInfo;
    constructor(parameters: AttributeInfoValue);
    serialize(value: any): string;
}
export declare class ThetaAttributeInfo extends AttributeInfo {
    static fromJS(parameters: AttributeInfoJS): ThetaAttributeInfo;
    constructor(parameters: AttributeInfoValue);
    serialize(value: any): string;
}
export declare class HistogramAttributeInfo extends AttributeInfo {
    static fromJS(parameters: AttributeInfoJS): HistogramAttributeInfo;
    constructor(parameters: AttributeInfoValue);
    serialize(value: any): string;
}
