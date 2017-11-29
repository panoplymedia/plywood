/// <reference types="q" />
import * as Q from 'q';
import { Expression, ExpressionValue, ExpressionJS, Alterations, Indexer } from "./baseExpression";
import { PlyType, DatasetFullType, FullType } from "../types";
import { SQLDialect } from "../dialect/baseDialect";
import { PlywoodValue } from "../datatypes/index";
import { ComputeFn } from "../datatypes/dataset";
export declare const POSSIBLE_TYPES: Lookup<number>;
export declare class RefExpression extends Expression {
    static SIMPLE_NAME_REGEXP: RegExp;
    static fromJS(parameters: ExpressionJS): RefExpression;
    static parse(str: string): RefExpression;
    static validType(typeName: string): boolean;
    static toJavaScriptSafeName(variableName: string): string;
    static findProperty(obj: any, key: string): any;
    static findPropertyCI(obj: any, key: string): any;
    nest: int;
    name: string;
    remote: boolean;
    ignoreCase: boolean;
    constructor(parameters: ExpressionValue);
    valueOf(): ExpressionValue;
    toJS(): ExpressionJS;
    toString(): string;
    getFn(): ComputeFn;
    getJS(datumVar: string): string;
    getSQL(dialect: SQLDialect, minimal?: boolean): string;
    equals(other: RefExpression): boolean;
    isRemote(): boolean;
    _fillRefSubstitutions(typeContext: DatasetFullType, indexer: Indexer, alterations: Alterations): FullType;
    incrementNesting(by?: int): RefExpression;
    _computeResolvedSimulate(): PlywoodValue;
    _computeResolved(): Q.Promise<PlywoodValue>;
    maxPossibleSplitValues(): number;
    upgradeToType(targetType: PlyType): Expression;
    toCaseInsensitive(): Expression;
    private changeType(newType);
}