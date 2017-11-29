/// <reference types="q" />
import * as Q from 'q';
import { Timezone, Duration } from "chronoshift";
import { PlyType } from "../types";
import { ExtendableError } from "../helper/utils";
import { Expression } from "../expressions/index";
import { Action, ApplyAction, CountDistinctAction, CustomAggregateAction, FallbackAction, LimitAction, QuantileAction, SortAction, SplitAction } from "../actions/index";
import { AttributeInfo, Attributes, Dataset, Datum, NumberRange, Set, PlywoodValue } from "../datatypes/index";
import { External, ExternalJS, ExternalValue, Inflater, NextFn, PostProcess, QueryAndPostProcess } from "./baseExternal";
import { PlywoodRange } from "../datatypes/range";
export declare class InvalidResultError extends ExtendableError {
    result: any;
    constructor(message: string, result: any);
}
export interface CustomDruidAggregation {
    aggregation: Druid.Aggregation;
    accessType?: string;
}
export interface CustomDruidTransform {
    extractionFn: Druid.ExtractionFn;
}
export declare type CustomDruidAggregations = Lookup<CustomDruidAggregation>;
export declare type CustomDruidTransforms = Lookup<CustomDruidTransform>;
export interface DruidFilterAndIntervals {
    filter: Druid.Filter;
    intervals: Druid.Intervals;
}
export interface AggregationsAndPostAggregations {
    aggregations: Druid.Aggregation[];
    postAggregations: Druid.PostAggregation[];
}
export interface Normalizer {
    (result: any): Datum[];
}
export interface GranularityInflater {
    granularity: Druid.Granularity;
    inflater: Inflater;
}
export interface DimensionInflater {
    dimension: Druid.DimensionSpec;
    inflater?: Inflater;
}
export interface DimensionInflaterHaving extends DimensionInflater {
    having?: Expression;
}
export interface DruidSplit {
    queryType: string;
    timestampLabel?: string;
    granularity: Druid.Granularity | string;
    dimension?: Druid.DimensionSpec;
    dimensions?: Druid.DimensionSpec[];
    leftoverHavingFilter?: Expression;
    postProcess: PostProcess;
}
export interface IntrospectPostProcess {
    (result: any): Attributes;
}
export declare class DruidExternal extends External {
    static type: string;
    static TRUE_INTERVAL: string;
    static FALSE_INTERVAL: string;
    static VALID_INTROSPECTION_STRATEGIES: string[];
    static DEFAULT_INTROSPECTION_STRATEGY: string;
    static SELECT_INIT_LIMIT: number;
    static SELECT_MAX_LIMIT: number;
    static fromJS(parameters: ExternalJS, requester: Requester.PlywoodRequester<any>): DruidExternal;
    static getSourceList(requester: Requester.PlywoodRequester<any>): Q.Promise<string[]>;
    static getVersion(requester: Requester.PlywoodRequester<any>): Q.Promise<string>;
    static cleanDatumInPlace(datum: Datum): void;
    static correctTimeBoundaryResult(result: Druid.TimeBoundaryResults): boolean;
    static correctTimeseriesResult(result: Druid.TimeseriesResults): boolean;
    static correctTopNResult(result: Druid.DruidResults): boolean;
    static correctGroupByResult(result: Druid.GroupByResults): boolean;
    static correctSelectResult(result: Druid.SelectResults): boolean;
    static correctStatusResult(result: Druid.StatusResult): boolean;
    static timeBoundaryPostProcessFactory(applies: ApplyAction[]): PostProcess;
    static valuePostProcess(res: Druid.TimeseriesResults): PlywoodValue;
    static totalPostProcessFactory(applies: ApplyAction[]): (res: Druid.TimeseriesDatum[]) => Dataset;
    static wrapFunctionTryCatch(lines: string[]): string;
    static timeseriesNormalizerFactory(timestampLabel?: string): Normalizer;
    static topNNormalizer(res: Druid.DruidResults): Datum[];
    static groupByNormalizerFactory(timestampLabel?: string): Normalizer;
    static selectNormalizerFactory(timestampLabel: string): Normalizer;
    static postProcessFactory(normalizer: Normalizer, inflaters: Inflater[], attributes: Attributes): (res: any) => Dataset;
    static selectNextFactory(limit: number, descending: boolean): NextFn<Druid.Query, Druid.SelectResults>;
    static generateMakerAction(aggregation: Druid.Aggregation): Action;
    static segmentMetadataPostProcessFactory(timeAttribute: string): IntrospectPostProcess;
    static introspectPostProcessFactory(timeAttribute: string): IntrospectPostProcess;
    static movePagingIdentifiers(pagingIdentifiers: Druid.PagingIdentifiers, increment: number): Druid.PagingIdentifiers;
    static TIME_PART_TO_FORMAT: Lookup<string>;
    static TIME_PART_TO_EXPR: Lookup<string>;
    static timePartToExtraction(part: string, timezone: Timezone): Druid.ExtractionFn;
    static SPAN_TO_FLOOR_FORMAT: Lookup<string>;
    static SPAN_TO_PROPERTY: Lookup<string>;
    static timeFloorToExtraction(duration: Duration, timezone: Timezone): Druid.ExtractionFn;
    static caseToDruid: Lookup<string>;
    timeAttribute: string;
    customAggregations: CustomDruidAggregations;
    customTransforms: CustomDruidTransforms;
    allowEternity: boolean;
    allowSelectQueries: boolean;
    introspectionStrategy: string;
    exactResultsOnly: boolean;
    context: Lookup<any>;
    constructor(parameters: ExternalValue);
    valueOf(): ExternalValue;
    toJS(): ExternalJS;
    equals(other: DruidExternal): boolean;
    getSingleReferenceAttributeInfo(ex: Expression): AttributeInfo;
    canHandleFilter(ex: Expression): boolean;
    canHandleTotal(): boolean;
    canHandleSplit(ex: Expression): boolean;
    canHandleApply(ex: Expression): boolean;
    canHandleSort(sortAction: SortAction): boolean;
    canHandleLimit(limitAction: LimitAction): boolean;
    canHandleHavingFilter(ex: Expression): boolean;
    isTimeseries(): boolean;
    getDruidDataSource(): Druid.DataSource;
    getDimensionNameForAttribureInfo(attributeInfo: AttributeInfo): string;
    checkFilterExtractability(attributeInfo: AttributeInfo): void;
    makeJavaScriptFilter(ex: Expression): Druid.Filter;
    makeExtractionFilter(ex: Expression): Druid.Filter;
    makeSelectorFilter(ex: Expression, value: any): Druid.Filter;
    makeInFilter(ex: Expression, valueSet: Set): Druid.Filter;
    makeBoundFilter(ex: Expression, range: PlywoodRange): Druid.Filter;
    makeRegexFilter(ex: Expression, regex: string): Druid.Filter;
    makeContainsFilter(lhs: Expression, rhs: Expression, compare: string): Druid.Filter;
    timelessFilterToDruid(filter: Expression, aggregatorFilter: boolean): Druid.Filter;
    timeFilterToIntervals(filter: Expression): Druid.Intervals;
    filterToDruid(filter: Expression): DruidFilterAndIntervals;
    isTimeRef(ex: Expression): boolean;
    splitExpressionToGranularityInflater(splitExpression: Expression, label: string): GranularityInflater;
    expressionToExtractionFn(expression: Expression): Druid.ExtractionFn;
    private _expressionToExtractionFns(expression, extractionFns);
    private _processRefExtractionFn(ref, extractionFns);
    actionToExtractionFn(action: Action, fallbackAction: FallbackAction, expressionType?: PlyType): Druid.ExtractionFn;
    private _processConcatExtractionFn(pattern, extractionFns);
    private customTransformToExtractionFn(action);
    actionToJavaScriptExtractionFn(action: Action, type?: PlyType): Druid.ExtractionFn;
    expressionToJavaScriptExtractionFn(ex: Expression): Druid.ExtractionFn;
    expressionToDimensionInflater(expression: Expression, label: string): DimensionInflater;
    expressionToDimensionInflaterHaving(expression: Expression, label: string, havingFilter: Expression): DimensionInflaterHaving;
    splitToDruid(split: SplitAction): DruidSplit;
    getAccessTypeForAggregation(aggregationType: string): string;
    getAccessType(aggregations: Druid.Aggregation[], aggregationName: string): string;
    expressionToPostAggregation(ex: Expression, aggregations: Druid.Aggregation[], postAggregations: Druid.PostAggregation[]): Druid.PostAggregation;
    applyToPostAggregation(action: ApplyAction, aggregations: Druid.Aggregation[], postAggregations: Druid.PostAggregation[]): void;
    makeNativeAggregateFilter(filterExpression: Expression, aggregator: Druid.Aggregation): Druid.Aggregation;
    makeStandardAggregation(name: string, aggregateAction: Action): Druid.Aggregation;
    makeCountDistinctAggregation(name: string, action: CountDistinctAction, postAggregations: Druid.PostAggregation[]): Druid.Aggregation;
    makeCustomAggregation(name: string, action: CustomAggregateAction): Druid.Aggregation;
    makeQuantileAggregation(name: string, action: QuantileAction, postAggregations: Druid.PostAggregation[]): Druid.Aggregation;
    makeJavaScriptAggregation(name: string, aggregateAction: Action): Druid.Aggregation;
    applyToAggregation(action: ApplyAction, aggregations: Druid.Aggregation[], postAggregations: Druid.PostAggregation[]): void;
    getAggregationsAndPostAggregations(applies: ApplyAction[]): AggregationsAndPostAggregations;
    makeHavingComparison(agg: string, op: string, value: number): Druid.Having;
    inToHavingFilter(agg: string, range: NumberRange): Druid.Having;
    havingFilterToDruid(filter: Expression): Druid.Having;
    isMinMaxTimeApply(apply: ApplyAction): boolean;
    getTimeBoundaryQueryAndPostProcess(): QueryAndPostProcess<Druid.Query>;
    getQueryAndPostProcess(): QueryAndPostProcess<Druid.Query>;
    protected getIntrospectAttributesWithSegmentMetadata(): Q.Promise<Attributes>;
    protected getIntrospectAttributesWithGet(): Q.Promise<Attributes>;
    protected getIntrospectAttributes(): Q.Promise<Attributes>;
}
