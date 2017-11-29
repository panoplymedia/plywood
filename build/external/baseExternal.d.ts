/// <reference types="q" />
import * as Q from 'q';
import { Timezone, Duration } from "chronoshift";
import { DatasetFullType, FullType } from "../types";
import { Expression, ChainExpression } from "../expressions/index";
import { PlywoodValue, Datum, Dataset } from "../datatypes/dataset";
import { Attributes, AttributeInfo, AttributeJSs } from "../datatypes/attributeInfo";
import { Action, ApplyAction, LimitAction, SelectAction, SortAction, SplitAction } from "../actions/index";
import { CustomDruidAggregations, CustomDruidTransforms } from "./druidExternal";
import { ExpressionJS } from "../expressions/baseExpression";
export interface PostProcess {
    (result: any): PlywoodValue;
}
export interface NextFn<Q, R> {
    (prevQuery: Q, prevResult: R): Q;
}
export interface QueryAndPostProcess<T> {
    query: T;
    postProcess: PostProcess;
    next?: NextFn<T, any>;
}
export interface Inflater {
    (d: Datum, i: number, data: Datum[]): void;
}
export declare type QueryMode = "raw" | "value" | "total" | "split";
export interface ExternalValue {
    engine?: string;
    version?: string;
    suppress?: boolean;
    source?: string | string[];
    rollup?: boolean;
    attributes?: Attributes;
    attributeOverrides?: Attributes;
    derivedAttributes?: Lookup<Expression>;
    delegates?: External[];
    concealBuckets?: boolean;
    mode?: QueryMode;
    dataName?: string;
    rawAttributes?: Attributes;
    filter?: Expression;
    valueExpression?: ChainExpression;
    select?: SelectAction;
    split?: SplitAction;
    applies?: ApplyAction[];
    sort?: SortAction;
    limit?: LimitAction;
    havingFilter?: Expression;
    timeAttribute?: string;
    customAggregations?: CustomDruidAggregations;
    customTransforms?: CustomDruidTransforms;
    allowEternity?: boolean;
    allowSelectQueries?: boolean;
    introspectionStrategy?: string;
    exactResultsOnly?: boolean;
    context?: Lookup<any>;
    requester?: Requester.PlywoodRequester<any>;
}
export interface ExternalJS {
    engine: string;
    version?: string;
    source?: string | string[];
    rollup?: boolean;
    attributes?: AttributeJSs;
    attributeOverrides?: AttributeJSs;
    derivedAttributes?: Lookup<ExpressionJS>;
    filter?: ExpressionJS;
    rawAttributes?: AttributeJSs;
    concealBuckets?: boolean;
    timeAttribute?: string;
    customAggregations?: CustomDruidAggregations;
    customTransforms?: CustomDruidTransforms;
    allowEternity?: boolean;
    allowSelectQueries?: boolean;
    introspectionStrategy?: string;
    exactResultsOnly?: boolean;
    context?: Lookup<any>;
}
export interface ApplySegregation {
    aggregateApplies: ApplyAction[];
    postAggregateApplies: ApplyAction[];
}
export interface AttributesAndApplies {
    attributes?: Attributes;
    applies?: ApplyAction[];
}
export declare abstract class External {
    static type: string;
    static SEGMENT_NAME: string;
    static VALUE_NAME: string;
    static isExternal(candidate: any): candidate is External;
    static extractVersion(v: string): string;
    static versionLessThan(va: string, vb: string): boolean;
    static deduplicateExternals(externals: External[]): External[];
    static makeZeroDatum(applies: ApplyAction[]): Datum;
    static normalizeAndAddApply(attributesAndApplies: AttributesAndApplies, apply: ApplyAction): AttributesAndApplies;
    static segregationAggregateApplies(applies: ApplyAction[]): ApplySegregation;
    static getCommonFilterFromExternals(externals: External[]): Expression;
    static getMergedDerivedAttributesFromExternals(externals: External[]): Lookup<Expression>;
    static getSimpleInflater(splitExpression: Expression, label: string): Inflater;
    static booleanInflaterFactory(label: string): Inflater;
    static timeRangeInflaterFactory(label: string, duration: Duration, timezone: Timezone): Inflater;
    static numberRangeInflaterFactory(label: string, rangeSize: number): Inflater;
    static numberInflaterFactory(label: string): Inflater;
    static timeInflaterFactory(label: string): Inflater;
    static setStringInflaterFactory(label: string): Inflater;
    static setCardinalityInflaterFactory(label: string): Inflater;
    static jsToValue(parameters: ExternalJS, requester: Requester.PlywoodRequester<any>): ExternalValue;
    static classMap: Lookup<typeof External>;
    static register(ex: typeof External, id?: string): void;
    static getConstructorFor(engine: string): typeof External;
    static fromJS(parameters: ExternalJS, requester?: Requester.PlywoodRequester<any>): External;
    static fromValue(parameters: ExternalValue): External;
    engine: string;
    version: string;
    source: string | string[];
    suppress: boolean;
    rollup: boolean;
    attributes: Attributes;
    attributeOverrides: Attributes;
    derivedAttributes: Lookup<Expression>;
    delegates: External[];
    concealBuckets: boolean;
    rawAttributes: Attributes;
    requester: Requester.PlywoodRequester<any>;
    mode: QueryMode;
    filter: Expression;
    valueExpression: ChainExpression;
    select: SelectAction;
    split: SplitAction;
    dataName: string;
    applies: ApplyAction[];
    sort: SortAction;
    limit: LimitAction;
    havingFilter: Expression;
    constructor(parameters: ExternalValue, dummy?: any);
    protected _ensureEngine(engine: string): void;
    protected _ensureMinVersion(minVersion: string): void;
    valueOf(): ExternalValue;
    toJS(): ExternalJS;
    toJSON(): ExternalJS;
    toString(): string;
    equals(other: External): boolean;
    equalBase(other: External): boolean;
    changeVersion(version: string): External;
    attachRequester(requester: Requester.PlywoodRequester<any>): External;
    versionBefore(neededVersion: string): boolean;
    getAttributesInfo(attributeName: string): AttributeInfo;
    updateAttribute(newAttribute: AttributeInfo): External;
    show(): External;
    hasAttribute(name: string): boolean;
    expressionDefined(ex: Expression): boolean;
    bucketsConcealed(ex: Expression): boolean;
    canHandleFilter(ex: Expression): boolean;
    canHandleTotal(): boolean;
    canHandleSplit(ex: Expression): boolean;
    canHandleApply(ex: Expression): boolean;
    canHandleSort(sortAction: SortAction): boolean;
    canHandleLimit(limitAction: LimitAction): boolean;
    canHandleHavingFilter(ex: Expression): boolean;
    addDelegate(delegate: External): External;
    getBase(): External;
    getRaw(): External;
    makeTotal(applies: ApplyAction[]): External;
    addAction(action: Action): External;
    private _addFilterAction(action);
    addFilter(expression: Expression): External;
    private _addSelectAction(selectAction);
    private _addSplitAction(splitAction);
    private _addApplyAction(action);
    private _addSortAction(action);
    private _addLimitAction(action);
    private _addAggregateAction(action);
    private _addPostAggregateAction(action);
    prePack(prefix: Expression, myAction: Action): External;
    valueExpressionWithinFilter(withinFilter: Expression): ChainExpression;
    toValueApply(): ApplyAction;
    sortOnLabel(): boolean;
    inlineDerivedAttributes(expression: Expression): Expression;
    inlineDerivedAttributesInAggregate(expression: Expression): Expression;
    switchToRollupCount(expression: Expression): Expression;
    getRollupCountName(): string;
    getQuerySplit(): SplitAction;
    getQueryFilter(): Expression;
    getSelectedAttributes(): Attributes;
    addNextExternal(dataset: Dataset): Dataset;
    getDelegate(): External;
    simulateValue(lastNode: boolean, simulatedQueries: any[], externalForNext?: External): PlywoodValue;
    getQueryAndPostProcess(): QueryAndPostProcess<any>;
    queryValue(lastNode: boolean, externalForNext?: External): Q.Promise<PlywoodValue>;
    needsIntrospect(): boolean;
    protected abstract getIntrospectAttributes(): Q.Promise<Attributes>;
    introspect(): Q.Promise<External>;
    getRawDatasetType(): Lookup<FullType>;
    getFullType(): DatasetFullType;
}
