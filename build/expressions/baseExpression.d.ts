/// <reference types="q" />
import * as Q from 'q';
import { Timezone } from "chronoshift";
import { Instance } from "immutable-class";
import { PlyType, DatasetFullType, PlyTypeSingleValue, FullType } from "../types";
import { LiteralExpression } from "./literalExpression";
import { ChainExpression } from "./chainExpression";
import { RefExpression } from "./refExpression";
import { SQLDialect } from "../dialect/baseDialect";
import { Action, ApplyAction, Environment } from "../actions/index";
import { Dataset, Datum, PlywoodValue } from "../datatypes/index";
import { ActionJS, CaseType } from "../actions/baseAction";
import { Direction } from "../actions/sortAction";
import { ComputeFn } from "../datatypes/dataset";
import { External, ExternalJS } from "../external/baseExternal";
export interface BooleanExpressionIterator {
    (ex?: Expression, index?: int, depth?: int, nestDiff?: int): boolean;
}
export interface VoidExpressionIterator {
    (ex?: Expression, index?: int, depth?: int, nestDiff?: int): void;
}
export interface SubstitutionFn {
    (ex?: Expression, index?: int, depth?: int, nestDiff?: int): Expression;
}
export interface ExpressionMatchFn {
    (ex?: Expression): boolean;
}
export interface ActionMatchFn {
    (action?: Action): boolean;
}
export interface ActionSubstitutionFn {
    (preEx?: Expression, action?: Action): Expression;
}
export interface DatasetBreakdown {
    singleDatasetActions: ApplyAction[];
    combineExpression: Expression;
}
export interface Digest {
    expression: Expression;
    undigested: ApplyAction;
}
export interface Indexer {
    index: int;
}
export declare type Alterations = Lookup<Expression>;
export interface SQLParse {
    verb: string;
    rewrite?: string;
    expression?: Expression;
    table?: string;
    database?: string;
    rest?: string;
}
export interface ExpressionValue {
    op?: string;
    type?: PlyType;
    simple?: boolean;
    value?: any;
    name?: string;
    nest?: int;
    external?: External;
    expression?: Expression;
    actions?: Action[];
    ignoreCase?: boolean;
    remote?: boolean;
}
export interface ExpressionJS {
    op: string;
    type?: PlyType;
    value?: any;
    name?: string;
    nest?: int;
    external?: ExternalJS;
    expression?: ExpressionJS;
    action?: ActionJS;
    actions?: ActionJS[];
    ignoreCase?: boolean;
}
export interface ExtractAndRest {
    extract: Expression;
    rest: Expression;
}
export declare type IfNotFound = "throw" | "leave" | "null";
export interface SubstituteActionOptions {
    onceInChain?: boolean;
}
export declare function ply(dataset?: Dataset): LiteralExpression;
export declare function $(name: string, nest?: number, type?: PlyType): RefExpression;
export declare function $(name: string, type?: PlyType): RefExpression;
export declare function i$(name: string, nest?: number, type?: PlyType): RefExpression;
export declare function r(value: any): LiteralExpression;
export declare function toJS(thing: any): any;
export interface PEGParserOptions {
    cache?: boolean;
    allowedStartRules?: string;
    output?: string;
    optimize?: string;
    plugins?: any;
    [key: string]: any;
}
export interface PEGParser {
    parse: (str: string, options?: PEGParserOptions) => any;
}
export declare abstract class Expression implements Instance<ExpressionValue, ExpressionJS> {
    static NULL: LiteralExpression;
    static ZERO: LiteralExpression;
    static ONE: LiteralExpression;
    static FALSE: LiteralExpression;
    static TRUE: LiteralExpression;
    static EMPTY_STRING: LiteralExpression;
    static EMPTY_SET: LiteralExpression;
    static expressionParser: PEGParser;
    static plyqlParser: PEGParser;
    static defaultParserTimezone: Timezone;
    static isExpression(candidate: any): candidate is Expression;
    static expressionLookupFromJS(expressionJSs: Lookup<ExpressionJS>): Lookup<Expression>;
    static expressionLookupToJS(expressions: Lookup<Expression>): Lookup<ExpressionJS>;
    static parse(str: string, timezone?: Timezone): Expression;
    static parseSQL(str: string, timezone?: Timezone): SQLParse;
    static fromJSLoose(param: any): Expression;
    static inOrIs(lhs: Expression, value: any): Expression;
    static jsNullSafetyUnary(inputJS: string, ifNotNull: (str: string) => string): string;
    static jsNullSafetyBinary(lhs: string, rhs: string, combine: (lhs: string, rhs: string) => string, lhsCantBeNull?: boolean, rhsCantBeNull?: boolean): string;
    static and(expressions: Expression[]): Expression;
    static or(expressions: Expression[]): Expression;
    static add(expressions: Expression[]): Expression;
    static subtract(expressions: Expression[]): Expression;
    static multiply(expressions: Expression[]): Expression;
    static power(expressions: Expression[]): Expression;
    static concat(expressions: Expression[]): Expression;
    static classMap: Lookup<typeof Expression>;
    static register(ex: typeof Expression): void;
    static fromJS(expressionJS: ExpressionJS): Expression;
    op: string;
    type: PlyType;
    simple: boolean;
    constructor(parameters: ExpressionValue, dummy?: any);
    protected _ensureOp(op: string): void;
    valueOf(): ExpressionValue;
    toJS(): ExpressionJS;
    toJSON(): ExpressionJS;
    toString(indent?: int): string;
    equals(other: Expression): boolean;
    canHaveType(wantedType: string): boolean;
    expressionCount(): int;
    isOp(op: string): boolean;
    containsOp(op: string): boolean;
    hasExternal(): boolean;
    getBaseExternals(): External[];
    getRawExternals(): External[];
    getFreeReferences(): string[];
    getFreeReferenceIndexes(): number[];
    incrementNesting(by?: int): Expression;
    simplify(): Expression;
    every(iter: BooleanExpressionIterator, thisArg?: any): boolean;
    _everyHelper(iter: BooleanExpressionIterator, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): boolean;
    some(iter: BooleanExpressionIterator, thisArg?: any): boolean;
    forEach(iter: VoidExpressionIterator, thisArg?: any): void;
    substitute(substitutionFn: SubstitutionFn, thisArg?: any): Expression;
    _substituteHelper(substitutionFn: SubstitutionFn, thisArg: any, indexer: Indexer, depth: int, nestDiff: int): Expression;
    substituteAction(actionMatchFn: ActionMatchFn, actionSubstitutionFn: ActionSubstitutionFn, options?: SubstituteActionOptions, thisArg?: any): Expression;
    abstract getFn(): ComputeFn;
    abstract getJS(datumVar: string): string;
    getJSFn(datumVar?: string): string;
    abstract getSQL(dialect: SQLDialect): string;
    extractFromAnd(matchFn: ExpressionMatchFn): ExtractAndRest;
    breakdownByDataset(tempNamePrefix: string): DatasetBreakdown;
    actionize(containingAction: string): Action[];
    getExpressionPattern(actionType: string): Expression[];
    firstAction(): Action;
    lastAction(): Action;
    headActions(n: int): Expression;
    popAction(): Expression;
    getLiteralValue(): any;
    bumpStringLiteralToTime(): Expression;
    bumpStringLiteralToSetString(): Expression;
    upgradeToType(targetType: PlyType): Expression;
    performAction(action: Action, markSimple?: boolean): ChainExpression;
    performActions(actions: Action[], markSimple?: boolean): Expression;
    private _performMultiAction(action, exs);
    add(...exs: any[]): ChainExpression;
    subtract(...exs: any[]): ChainExpression;
    negate(): ChainExpression;
    multiply(...exs: any[]): ChainExpression;
    divide(...exs: any[]): ChainExpression;
    reciprocate(): ChainExpression;
    sqrt(): ChainExpression;
    power(...exs: any[]): ChainExpression;
    fallback(ex: any): ChainExpression;
    is(ex: any): ChainExpression;
    isnt(ex: any): ChainExpression;
    lessThan(ex: any): ChainExpression;
    lessThanOrEqual(ex: any): ChainExpression;
    greaterThan(ex: any): ChainExpression;
    greaterThanOrEqual(ex: any): ChainExpression;
    contains(ex: any, compare?: string): ChainExpression;
    match(re: string): ChainExpression;
    in(start: Date, end: Date): ChainExpression;
    in(start: number, end: number): ChainExpression;
    in(start: string, end: string): ChainExpression;
    in(ex: any): ChainExpression;
    overlap(ex: any): ChainExpression;
    not(): ChainExpression;
    and(...exs: any[]): ChainExpression;
    or(...exs: any[]): ChainExpression;
    substr(position: number, length: number): ChainExpression;
    extract(re: string): ChainExpression;
    concat(...exs: any[]): ChainExpression;
    lookup(lookup: string): ChainExpression;
    indexOf(ex: any): ChainExpression;
    transformCase(transformType: CaseType): ChainExpression;
    customTransform(custom: string, outputType?: PlyTypeSingleValue): ChainExpression;
    numberBucket(size: number, offset?: number): ChainExpression;
    absolute(): ChainExpression;
    length(): ChainExpression;
    timeBucket(duration: any, timezone?: any): ChainExpression;
    timeFloor(duration: any, timezone?: any): ChainExpression;
    timeShift(duration: any, step: number, timezone?: any): ChainExpression;
    timeRange(duration: any, step: number, timezone?: any): ChainExpression;
    timePart(part: string, timezone?: any): ChainExpression;
    cast(outputType: PlyType): ChainExpression;
    cardinality(): ChainExpression;
    filter(ex: any): ChainExpression;
    split(splits: any, dataName?: string): ChainExpression;
    split(ex: any, name: string, dataName?: string): ChainExpression;
    apply(name: string, ex: any): ChainExpression;
    sort(ex: any, direction?: Direction): ChainExpression;
    limit(limit: number): ChainExpression;
    select(...attributes: string[]): ChainExpression;
    count(): ChainExpression;
    sum(ex: any): ChainExpression;
    min(ex: any): ChainExpression;
    max(ex: any): ChainExpression;
    average(ex: any): ChainExpression;
    countDistinct(ex: any): ChainExpression;
    quantile(ex: any, quantile: number): ChainExpression;
    custom(custom: string): ChainExpression;
    customAggregate(custom: string): ChainExpression;
    join(ex: any): ChainExpression;
    defineEnvironment(environment: Environment): Expression;
    referenceCheck(context: Datum): Expression;
    definedInTypeContext(typeContext: DatasetFullType): boolean;
    referenceCheckInTypeContext(typeContext: DatasetFullType): Expression;
    _fillRefSubstitutions(typeContext: DatasetFullType, indexer: Indexer, alterations: Alterations): FullType;
    resolve(context: Datum, ifNotFound?: IfNotFound): Expression;
    resolveWithExpressions(expressions: Lookup<Expression>, ifNotFound?: IfNotFound): Expression;
    resolved(): boolean;
    contained(): boolean;
    decomposeAverage(countEx?: Expression): Expression;
    distribute(): Expression;
    abstract maxPossibleSplitValues(): number;
    private _initialPrepare(context, environment);
    simulate(context?: Datum, environment?: Environment): PlywoodValue;
    simulateQueryPlan(context?: Datum, environment?: Environment): any[];
    abstract _computeResolvedSimulate(lastNode: boolean, simulatedQueries: any[]): PlywoodValue;
    compute(context?: Datum, environment?: Environment): Q.Promise<PlywoodValue>;
    abstract _computeResolved(lastNode: boolean): Q.Promise<PlywoodValue>;
}
