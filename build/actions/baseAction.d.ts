/// <reference path="../datatypes/dataset.d.ts" />
/// <reference path="../expressions/baseExpression.d.ts" />
import { Timezone, Duration } from "chronoshift";
import { Expression, ExpressionJS, Indexer, Alterations, BooleanExpressionIterator, SubstitutionFn } from "../expressions/baseExpression";
import { PlyType, DatasetFullType, PlyTypeSimple, FullType } from "../types";
import { SQLDialect } from "../dialect/baseDialect";
import { ComputeFn } from "../datatypes/dataset";
import { Instance } from "immutable-class";
import { Direction } from "./sortAction";
import { LiteralExpression } from "../expressions/literalExpression";
import { RefExpression } from "../expressions/refExpression";
import { ChainExpression } from "../expressions/chainExpression";
export interface Splits {
    [name: string]: Expression;
}
export interface SplitsJS {
    [name: string]: ExpressionJS;
}
export declare type CaseType = 'upperCase' | 'lowerCase';
export interface ActionValue {
    action?: string;
    name?: string;
    dataName?: string;
    expression?: Expression;
    splits?: Splits;
    direction?: Direction;
    limit?: int;
    size?: number;
    offset?: number;
    duration?: Duration;
    timezone?: Timezone;
    part?: string;
    step?: number;
    position?: int;
    length?: int;
    regexp?: string;
    quantile?: number;
    selector?: string;
    prop?: Lookup<any>;
    custom?: string;
    compare?: string;
    lookup?: string;
    attributes?: string[];
    simple?: boolean;
    transformType?: CaseType;
    outputType?: PlyTypeSimple;
}
export interface ActionJS {
    action?: string;
    name?: string;
    dataName?: string;
    expression?: ExpressionJS;
    splits?: SplitsJS;
    direction?: Direction;
    limit?: int;
    size?: number;
    offset?: number;
    duration?: string;
    timezone?: string;
    part?: string;
    step?: number;
    position?: int;
    length?: int;
    regexp?: string;
    quantile?: number;
    selector?: string;
    prop?: Lookup<any>;
    custom?: string;
    compare?: string;
    lookup?: string;
    attributes?: string[];
    transformType?: CaseType;
    outputType?: PlyTypeSimple;
}
export interface Environment {
    timezone?: Timezone;
}
export declare abstract class Action implements Instance<ActionValue, ActionJS> {
    static jsToValue(parameters: ActionJS): ActionValue;
    static actionsDependOn(actions: Action[], name: string): boolean;
    static isAction(candidate: any): candidate is Action;
    static classMap: Lookup<typeof Action>;
    static register(act: typeof Action): void;
    static fromJS(actionJS: ActionJS): Action;
    static fromValue(value: ActionValue): Action;
    action: string;
    expression: Expression;
    simple: boolean;
    constructor(parameters: ActionValue, dummy?: any);
    protected _ensureAction(action: string): void;
    protected _toStringParameters(expressionString: string): string[];
    toString(indent?: int): string;
    valueOf(): ActionValue;
    toJS(): ActionJS;
    toJSON(): ActionJS;
    equals(other: Action): boolean;
    isAggregate(): boolean;
    protected _checkInputTypes(inputType: PlyType): void;
    protected _checkNoExpression(): void;
    protected _checkExpressionTypes(...neededTypes: string[]): void;
    abstract getOutputType(inputType: PlyType): PlyType;
    abstract getNecessaryInputTypes(): PlyType | PlyType[];
    protected _stringTransformInputType: ("NULL" | "BOOLEAN" | "NUMBER" | "TIME" | "STRING" | "NUMBER_RANGE" | "TIME_RANGE" | "STRING_RANGE" | "SET" | "SET/NULL" | "SET/BOOLEAN" | "SET/NUMBER" | "SET/TIME" | "SET/STRING" | "SET/NUMBER_RANGE" | "SET/TIME_RANGE" | "SET/STRING_RANGE" | "DATASET")[];
    protected _stringTransformOutputType(inputType: PlyType): PlyType;
    getNeededType(): PlyType;
    abstract _fillRefSubstitutions(typeContext: DatasetFullType, inputType: FullType, indexer: Indexer, alterations: Alterations): FullType;
    protected _getFnHelper(inputType: PlyType, inputFn: ComputeFn, expressionFn: ComputeFn): ComputeFn;
    getFn(inputType: PlyType, inputFn: ComputeFn): ComputeFn;
    protected _getJSHelper(inputType: PlyType, inputJS: string, expressionJS: string): string;
    getJS(inputType: PlyType, inputJS: string, datumVar: string): string;
    protected _getSQLHelper(inputType: PlyType, dialect: SQLDialect, inputSQL: string, expressionSQL: string): string;
    getSQL(inputType: PlyType, inputSQL: string, dialect: SQLDialect): string;
    expressionCount(): int;
    fullyDefined(): boolean;
    protected _specialSimplify(simpleExpression: Expression): Action;
    simplify(): Action;
    protected _removeAction(inputType: PlyType): boolean;
    protected _nukeExpression(precedingExpression: Expression): Expression;
    protected _distributeAction(): Action[];
    protected _performOnLiteral(literalExpression: LiteralExpression): Expression;
    protected _performOnRef(refExpression: RefExpression): Expression;
    protected _foldWithPrevAction(prevAction: Action): Action;
    protected _putBeforeLastAction(lastAction: Action): Action;
    protected _performOnSimpleChain(chainExpression: ChainExpression): Expression;
    performOnSimple(simpleExpression: Expression): Expression;
    getExpressions(): Expression[];
    getFreeReferences(): string[];
    _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean;
    substitute(substitutionFn: SubstitutionFn, thisArg?: any): Action;
    _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Action;
    canDistribute(): boolean;
    distribute(preEx: Expression): Expression;
    changeExpression(newExpression: Expression): Action;
    isNester(): boolean;
    getLiteralValue(): any;
    maxPossibleSplitValues(): number;
    getUpgradedType(type: PlyType): Action;
    needsEnvironment(): boolean;
    defineEnvironment(environment: Environment): Action;
    getTimezone(): Timezone;
    alignsWith(actions: Action[]): boolean;
}