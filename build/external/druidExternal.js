var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { isDate } from "chronoshift";
import { hasOwnProperty, dictEqual, nonEmptyLookup, shallowCopy, ExtendableError } from "../helper/utils";
import { $, Expression, ChainExpression, LiteralExpression, RefExpression } from "../expressions/index";
import { AbsoluteAction, CardinalityAction, CastAction, ContainsAction, CountAction, CustomTransformAction, ExtractAction, FallbackAction, FilterAction, InAction, IndexOfAction, IsAction, LengthAction, LookupAction, MatchAction, MaxAction, MinAction, NotAction, NumberBucketAction, OverlapAction, PowerAction, SubstrAction, SumAction, TimeBucketAction, TimeFloorAction, TimePartAction, TransformCaseAction } from "../actions/index";
import { AttributeInfo, UniqueAttributeInfo, HistogramAttributeInfo, ThetaAttributeInfo, Dataset, NumberRange, Range, TimeRange } from "../datatypes/index";
import { External } from "./baseExternal";
import { unwrapSetType } from "../datatypes/common";
var DUMMY_NAME = '!DUMMY';
var TIME_ATTRIBUTE = '__time';
var AGGREGATE_TO_DRUID = {
    count: "count",
    sum: "doubleSum",
    min: "doubleMin",
    max: "doubleMax"
};
var AGGREGATE_TO_FUNCTION = {
    sum: function (a, b) { return (a + "+" + b); },
    min: function (a, b) { return ("Math.min(" + a + "," + b + ")"); },
    max: function (a, b) { return ("Math.max(" + a + "," + b + ")"); }
};
var AGGREGATE_TO_ZERO = {
    sum: "0",
    min: "Infinity",
    max: "-Infinity"
};
export var InvalidResultError = (function (_super) {
    __extends(InvalidResultError, _super);
    function InvalidResultError(message, result) {
        _super.call(this, message);
        this.result = result;
    }
    return InvalidResultError;
}(ExtendableError));
function expressionNeedsAlphaNumericSort(ex) {
    var type = ex.type;
    return (type === 'NUMBER' || type === 'NUMBER_RANGE');
}
function customAggregationsEqual(customA, customB) {
    return JSON.stringify(customA) === JSON.stringify(customB);
}
function customTransformsEqual(customA, customB) {
    return JSON.stringify(customA) === JSON.stringify(customB);
}
export var DruidExternal = (function (_super) {
    __extends(DruidExternal, _super);
    function DruidExternal(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureEngine("druid");
        this._ensureMinVersion("0.8.0");
        this.timeAttribute = parameters.timeAttribute || TIME_ATTRIBUTE;
        this.customAggregations = parameters.customAggregations;
        this.customTransforms = parameters.customTransforms;
        this.allowEternity = parameters.allowEternity;
        this.allowSelectQueries = parameters.allowSelectQueries;
        var introspectionStrategy = parameters.introspectionStrategy || DruidExternal.DEFAULT_INTROSPECTION_STRATEGY;
        if (DruidExternal.VALID_INTROSPECTION_STRATEGIES.indexOf(introspectionStrategy) === -1) {
            throw new Error("invalid introspectionStrategy '" + introspectionStrategy + "'");
        }
        this.introspectionStrategy = introspectionStrategy;
        this.exactResultsOnly = parameters.exactResultsOnly;
        this.context = parameters.context;
    }
    DruidExternal.fromJS = function (parameters, requester) {
        if (typeof parameters.druidVersion === 'string') {
            parameters.version = parameters.druidVersion;
            console.warn("'druidVersion' parameter is deprecated, use 'version: " + parameters.version + "' instead");
        }
        var value = External.jsToValue(parameters, requester);
        value.timeAttribute = parameters.timeAttribute;
        value.customAggregations = parameters.customAggregations || {};
        value.customTransforms = parameters.customTransforms || {};
        value.allowEternity = Boolean(parameters.allowEternity);
        value.allowSelectQueries = Boolean(parameters.allowSelectQueries);
        value.introspectionStrategy = parameters.introspectionStrategy;
        value.exactResultsOnly = Boolean(parameters.exactResultsOnly);
        value.context = parameters.context;
        return new DruidExternal(value);
    };
    DruidExternal.getSourceList = function (requester) {
        return requester({ query: { queryType: 'sourceList' } })
            .then(function (sources) {
            if (!Array.isArray(sources))
                throw new InvalidResultError('invalid sources response', sources);
            return sources.sort();
        });
    };
    DruidExternal.getVersion = function (requester) {
        return requester({
            query: {
                queryType: 'status'
            }
        })
            .then(function (res) {
            if (!DruidExternal.correctStatusResult(res))
                throw new InvalidResultError('unexpected result from /status', res);
            return res.version;
        });
    };
    DruidExternal.cleanDatumInPlace = function (datum) {
        for (var k in datum) {
            if (k[0] === '!')
                delete datum[k];
        }
    };
    DruidExternal.correctTimeBoundaryResult = function (result) {
        return Array.isArray(result) && result.length === 1 && typeof result[0].result === 'object';
    };
    DruidExternal.correctTimeseriesResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].result === 'object');
    };
    DruidExternal.correctTopNResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || Array.isArray(result[0].result));
    };
    DruidExternal.correctGroupByResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].event === 'object');
    };
    DruidExternal.correctSelectResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].result === 'object');
    };
    DruidExternal.correctStatusResult = function (result) {
        return result && typeof result.version === 'string';
    };
    DruidExternal.timeBoundaryPostProcessFactory = function (applies) {
        return function (res) {
            if (!DruidExternal.correctTimeBoundaryResult(res))
                throw new InvalidResultError("unexpected result from Druid (timeBoundary)", res);
            var result = res[0].result;
            var datum = {};
            for (var _i = 0, applies_1 = applies; _i < applies_1.length; _i++) {
                var apply = applies_1[_i];
                var name_1 = apply.name;
                var aggregate = apply.expression.actions[0].action;
                if (typeof result === 'string') {
                    datum[name_1] = new Date(result);
                }
                else {
                    if (aggregate === 'max') {
                        datum[name_1] = new Date((result['maxIngestedEventTime'] || result['maxTime']));
                    }
                    else {
                        datum[name_1] = new Date((result['minTime']));
                    }
                }
            }
            return new Dataset({ data: [datum] });
        };
    };
    DruidExternal.valuePostProcess = function (res) {
        if (!DruidExternal.correctTimeseriesResult(res))
            throw new InvalidResultError("unexpected result from Druid (all / value)", res);
        if (!res.length)
            return 0;
        return res[0].result[External.VALUE_NAME];
    };
    DruidExternal.totalPostProcessFactory = function (applies) {
        return function (res) {
            if (!DruidExternal.correctTimeseriesResult(res))
                throw new InvalidResultError("unexpected result from Druid (all)", res);
            if (!res.length)
                return new Dataset({ data: [External.makeZeroDatum(applies)] });
            var datum = res[0].result;
            DruidExternal.cleanDatumInPlace(datum);
            return new Dataset({ data: [datum] });
        };
    };
    DruidExternal.wrapFunctionTryCatch = function (lines) {
        return 'function(s){try{\n' + lines.filter(Boolean).join('\n') + '\n}catch(e){return null;}}';
    };
    DruidExternal.timeseriesNormalizerFactory = function (timestampLabel) {
        if (timestampLabel === void 0) { timestampLabel = null; }
        return function (res) {
            if (!DruidExternal.correctTimeseriesResult(res))
                throw new InvalidResultError("unexpected result from Druid (timeseries)", res);
            return res.map(function (r) {
                var datum = r.result;
                DruidExternal.cleanDatumInPlace(datum);
                if (timestampLabel)
                    datum[timestampLabel] = r.timestamp;
                return datum;
            });
        };
    };
    DruidExternal.topNNormalizer = function (res) {
        if (!DruidExternal.correctTopNResult(res))
            throw new InvalidResultError("unexpected result from Druid (topN)", res);
        var data = res.length ? res[0].result : [];
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var d = data_1[_i];
            DruidExternal.cleanDatumInPlace(d);
        }
        return data;
    };
    DruidExternal.groupByNormalizerFactory = function (timestampLabel) {
        if (timestampLabel === void 0) { timestampLabel = null; }
        return function (res) {
            if (!DruidExternal.correctGroupByResult(res))
                throw new InvalidResultError("unexpected result from Druid (groupBy)", res);
            return res.map(function (r) {
                var datum = r.event;
                DruidExternal.cleanDatumInPlace(datum);
                if (timestampLabel)
                    datum[timestampLabel] = r.timestamp;
                return datum;
            });
        };
    };
    DruidExternal.selectNormalizerFactory = function (timestampLabel) {
        return function (results) {
            var data = [];
            for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
                var result = results_1[_i];
                if (!DruidExternal.correctSelectResult(result))
                    throw new InvalidResultError("unexpected result from Druid (select)", result);
                if (result.length === 0)
                    continue;
                var events = result[0].result.events;
                for (var _a = 0, events_1 = events; _a < events_1.length; _a++) {
                    var event = events_1[_a];
                    var datum = event.event;
                    if (timestampLabel != null) {
                        datum[timestampLabel] = datum['timestamp'];
                    }
                    delete datum['timestamp'];
                    DruidExternal.cleanDatumInPlace(datum);
                    data.push(datum);
                }
            }
            return data;
        };
    };
    DruidExternal.postProcessFactory = function (normalizer, inflaters, attributes) {
        return function (res) {
            var data = normalizer(res);
            var n = data.length;
            for (var _i = 0, inflaters_1 = inflaters; _i < inflaters_1.length; _i++) {
                var inflater = inflaters_1[_i];
                for (var i = 0; i < n; i++) {
                    inflater(data[i], i, data);
                }
            }
            return new Dataset({ data: data, attributes: attributes });
        };
    };
    DruidExternal.selectNextFactory = function (limit, descending) {
        var resultsSoFar = 0;
        return function (prevQuery, prevResult) {
            if (!DruidExternal.correctSelectResult(prevResult))
                throw new InvalidResultError("unexpected result from Druid (select / partial)", prevResult);
            if (prevResult.length === 0)
                return null;
            var _a = prevResult[0].result, pagingIdentifiers = _a.pagingIdentifiers, events = _a.events;
            if (events.length < prevQuery.pagingSpec.threshold)
                return null;
            resultsSoFar += events.length;
            if (resultsSoFar >= limit)
                return null;
            var pagingIdentifiers = DruidExternal.movePagingIdentifiers(pagingIdentifiers, descending ? -1 : 1);
            prevQuery.pagingSpec.pagingIdentifiers = pagingIdentifiers;
            prevQuery.pagingSpec.threshold = Math.min(limit - resultsSoFar, DruidExternal.SELECT_MAX_LIMIT);
            return prevQuery;
        };
    };
    DruidExternal.generateMakerAction = function (aggregation) {
        if (!aggregation)
            return null;
        var type = aggregation.type, fieldName = aggregation.fieldName;
        if (type === 'longSum' && fieldName === 'count') {
            return new CountAction({});
        }
        if (!fieldName) {
            var fieldNames = aggregation.fieldNames;
            if (!Array.isArray(fieldNames) || fieldNames.length !== 1)
                return null;
            fieldName = fieldNames[0];
        }
        var expression = $(fieldName);
        switch (type) {
            case "count":
                return new CountAction({});
            case "doubleSum":
            case "longSum":
                return new SumAction({ expression: expression });
            case "javascript":
                var fnAggregate = aggregation.fnAggregate, fnCombine = aggregation.fnCombine;
                if (fnAggregate !== fnCombine || fnCombine.indexOf('+') === -1)
                    return null;
                return new SumAction({ expression: expression });
            case "doubleMin":
            case "longMin":
                return new MinAction({ expression: expression });
            case "doubleMax":
            case "longMax":
                return new MaxAction({ expression: expression });
            default:
                return null;
        }
    };
    DruidExternal.segmentMetadataPostProcessFactory = function (timeAttribute) {
        return function (res) {
            var res0 = res[0];
            if (!res0 || !res0.columns)
                throw new InvalidResultError('malformed segmentMetadata response', res);
            var columns = res0.columns;
            var aggregators = res0.aggregators || {};
            var foundTime = false;
            var attributes = [];
            for (var name in columns) {
                if (!hasOwnProperty(columns, name))
                    continue;
                var columnData = columns[name];
                if (columnData.errorMessage || columnData.size < 0)
                    continue;
                if (name === TIME_ATTRIBUTE) {
                    attributes.push(new AttributeInfo({ name: timeAttribute, type: 'TIME' }));
                    foundTime = true;
                }
                else {
                    if (name === timeAttribute)
                        continue;
                    switch (columnData.type) {
                        case 'FLOAT':
                        case 'LONG':
                            attributes.push(new AttributeInfo({
                                name: name,
                                type: 'NUMBER',
                                unsplitable: true,
                                makerAction: DruidExternal.generateMakerAction(aggregators[name])
                            }));
                            break;
                        case 'STRING':
                            attributes.push(new AttributeInfo({
                                name: name,
                                type: columnData.hasMultipleValues ? 'SET/STRING' : 'STRING'
                            }));
                            break;
                        case 'hyperUnique':
                            attributes.push(new UniqueAttributeInfo({ name: name }));
                            break;
                        case 'approximateHistogram':
                            attributes.push(new HistogramAttributeInfo({ name: name }));
                            break;
                        case 'thetaSketch':
                            attributes.push(new ThetaAttributeInfo({ name: name }));
                            break;
                    }
                }
            }
            if (!foundTime)
                throw new Error("no valid " + TIME_ATTRIBUTE + " in segmentMetadata response");
            return attributes;
        };
    };
    DruidExternal.introspectPostProcessFactory = function (timeAttribute) {
        return function (res) {
            if (!Array.isArray(res.dimensions) || !Array.isArray(res.metrics)) {
                throw new InvalidResultError('malformed GET introspect response', res);
            }
            var attributes = [
                new AttributeInfo({ name: timeAttribute, type: 'TIME' })
            ];
            res.dimensions.forEach(function (dimension) {
                if (dimension === timeAttribute)
                    return;
                attributes.push(new AttributeInfo({ name: dimension, type: 'STRING' }));
            });
            res.metrics.forEach(function (metric) {
                if (metric === timeAttribute)
                    return;
                attributes.push(new AttributeInfo({ name: metric, type: 'NUMBER', unsplitable: true }));
            });
            return attributes;
        };
    };
    DruidExternal.movePagingIdentifiers = function (pagingIdentifiers, increment) {
        var newPagingIdentifiers = {};
        for (var key in pagingIdentifiers) {
            if (!hasOwnProperty(pagingIdentifiers, key))
                continue;
            newPagingIdentifiers[key] = pagingIdentifiers[key] + increment;
        }
        return newPagingIdentifiers;
    };
    DruidExternal.timePartToExtraction = function (part, timezone) {
        var format = DruidExternal.TIME_PART_TO_FORMAT[part];
        if (format) {
            return {
                "format": format,
                "locale": "en-US",
                "timeZone": timezone.toString(),
                "type": "timeFormat"
            };
        }
        else {
            var expr = DruidExternal.TIME_PART_TO_EXPR[part];
            if (!expr)
                throw new Error("can not part on " + part);
            return {
                type: 'javascript',
                'function': DruidExternal.wrapFunctionTryCatch([
                    'var d = new org.joda.time.DateTime(s);',
                    timezone.isUTC() ? null : "d = d.withZone(org.joda.time.DateTimeZone.forID(" + JSON.stringify(timezone) + "));",
                    ("d = " + expr + ";"),
                    'return d;'
                ])
            };
        }
    };
    DruidExternal.timeFloorToExtraction = function (duration, timezone) {
        var singleSpan = duration.getSingleSpan();
        var spanValue = duration.getSingleSpanValue();
        if (spanValue === 1 && DruidExternal.SPAN_TO_FLOOR_FORMAT[singleSpan]) {
            return {
                "format": DruidExternal.SPAN_TO_FLOOR_FORMAT[singleSpan],
                "locale": "en-US",
                "timeZone": timezone.toString(),
                "type": "timeFormat"
            };
        }
        else {
            var prop = DruidExternal.SPAN_TO_PROPERTY[singleSpan];
            if (!prop)
                throw new Error("can not floor on " + duration);
            return {
                type: 'javascript',
                'function': DruidExternal.wrapFunctionTryCatch([
                    'var d = new org.joda.time.DateTime(s);',
                    timezone.isUTC() ? null : "d = d.withZone(org.joda.time.DateTimeZone.forID(" + JSON.stringify(timezone) + "));",
                    ("d = d." + prop + "().roundFloorCopy();"),
                    ("d = d." + prop + "().setCopy(Math.floor(d." + prop + "().get() / " + spanValue + ") * " + spanValue + ");"),
                    'return d;'
                ])
            };
        }
    };
    DruidExternal.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.timeAttribute = this.timeAttribute;
        value.customAggregations = this.customAggregations;
        value.customTransforms = this.customTransforms;
        value.allowEternity = this.allowEternity;
        value.allowSelectQueries = this.allowSelectQueries;
        value.introspectionStrategy = this.introspectionStrategy;
        value.exactResultsOnly = this.exactResultsOnly;
        value.context = this.context;
        return value;
    };
    DruidExternal.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        if (this.timeAttribute !== TIME_ATTRIBUTE)
            js.timeAttribute = this.timeAttribute;
        if (nonEmptyLookup(this.customAggregations))
            js.customAggregations = this.customAggregations;
        if (nonEmptyLookup(this.customTransforms))
            js.customTransforms = this.customTransforms;
        if (this.allowEternity)
            js.allowEternity = true;
        if (this.allowSelectQueries)
            js.allowSelectQueries = true;
        if (this.introspectionStrategy !== DruidExternal.DEFAULT_INTROSPECTION_STRATEGY)
            js.introspectionStrategy = this.introspectionStrategy;
        if (this.exactResultsOnly)
            js.exactResultsOnly = true;
        if (this.context)
            js.context = this.context;
        return js;
    };
    DruidExternal.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.timeAttribute === other.timeAttribute &&
            customAggregationsEqual(this.customAggregations, other.customAggregations) &&
            customTransformsEqual(this.customTransforms, other.customTransforms) &&
            this.allowEternity === other.allowEternity &&
            this.allowSelectQueries === other.allowSelectQueries &&
            this.introspectionStrategy === other.introspectionStrategy &&
            this.exactResultsOnly === other.exactResultsOnly &&
            dictEqual(this.context, other.context);
    };
    DruidExternal.prototype.getSingleReferenceAttributeInfo = function (ex) {
        var freeReferences = ex.getFreeReferences();
        if (freeReferences.length !== 1)
            throw new Error("can not translate multi reference expression " + ex + " to Druid");
        var referenceName = freeReferences[0];
        return this.getAttributesInfo(referenceName);
    };
    DruidExternal.prototype.canHandleFilter = function (ex) {
        return !(ex instanceof ChainExpression &&
            ex.actions.some(function (a) { return a.action === 'cardinality'; }));
    };
    DruidExternal.prototype.canHandleTotal = function () {
        return true;
    };
    DruidExternal.prototype.canHandleSplit = function (ex) {
        return true;
    };
    DruidExternal.prototype.canHandleApply = function (ex) {
        return true;
    };
    DruidExternal.prototype.canHandleSort = function (sortAction) {
        if (this.isTimeseries()) {
            if (sortAction.direction !== 'ascending')
                return false;
            return sortAction.refName() === this.split.firstSplitName();
        }
        else if (this.mode === 'raw') {
            if (sortAction.refName() !== this.timeAttribute)
                return false;
            if (this.versionBefore('0.9.0'))
                return sortAction.direction === 'ascending';
            return true;
        }
        else {
            return true;
        }
    };
    DruidExternal.prototype.canHandleLimit = function (limitAction) {
        return !this.isTimeseries();
    };
    DruidExternal.prototype.canHandleHavingFilter = function (ex) {
        return !this.limit;
    };
    DruidExternal.prototype.isTimeseries = function () {
        var split = this.split;
        if (!split || split.isMultiSplit())
            return false;
        var splitExpression = split.firstSplitExpression();
        if (this.isTimeRef(splitExpression))
            return true;
        if (splitExpression instanceof ChainExpression) {
            var actions = splitExpression.actions;
            if (actions.length !== 1)
                return false;
            var action = actions[0].action;
            return action === 'timeBucket' || action === 'timeFloor';
        }
        return false;
    };
    DruidExternal.prototype.getDruidDataSource = function () {
        var source = this.source;
        if (Array.isArray(source)) {
            return {
                type: "union",
                dataSources: source
            };
        }
        else {
            return source;
        }
    };
    DruidExternal.prototype.getDimensionNameForAttribureInfo = function (attributeInfo) {
        return attributeInfo.name === this.timeAttribute ? TIME_ATTRIBUTE : attributeInfo.name;
    };
    DruidExternal.prototype.checkFilterExtractability = function (attributeInfo) {
        if (this.versionBefore('0.9.2') && attributeInfo.name === this.timeAttribute) {
            throw new Error('can not do secondary filtering on primary time dimension (https://github.com/druid-io/druid/issues/2816)');
        }
    };
    DruidExternal.prototype.makeJavaScriptFilter = function (ex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        this.checkFilterExtractability(attributeInfo);
        return {
            type: "javascript",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            "function": ex.getJSFn('d')
        };
    };
    DruidExternal.prototype.makeExtractionFilter = function (ex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        return {
            type: "extraction",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            extractionFn: extractionFn,
            value: "true"
        };
    };
    DruidExternal.prototype.makeSelectorFilter = function (ex, value) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        if (attributeInfo.unsplitable) {
            throw new Error("can not convert " + ex + " = " + value + " to filter because it references an un-filterable metric '" + attributeInfo.name + "' which is most likely rolled up.");
        }
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        if (Range.isRange(value))
            value = value.start;
        var druidFilter = {
            type: "selector",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            value: attributeInfo.serialize(value)
        };
        if (extractionFn) {
            druidFilter.extractionFn = extractionFn;
            if (this.versionBefore('0.9.1'))
                druidFilter.type = "extraction";
            if (this.versionBefore('0.9.0') && druidFilter.value === null)
                druidFilter.value = '';
        }
        return druidFilter;
    };
    DruidExternal.prototype.makeInFilter = function (ex, valueSet) {
        var _this = this;
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var elements = valueSet.elements;
        if (elements.length < 2 ||
            (this.versionBefore('0.9.1') && extractionFn) ||
            this.versionBefore('0.9.0')) {
            var fields = elements.map(function (value) {
                return _this.makeSelectorFilter(ex, value);
            });
            return fields.length === 1 ? fields[0] : { type: "or", fields: fields };
        }
        var inFilter = {
            type: 'in',
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            values: elements.map(function (value) { return attributeInfo.serialize(value); })
        };
        if (extractionFn)
            inFilter.extractionFn = extractionFn;
        return inFilter;
    };
    DruidExternal.prototype.makeBoundFilter = function (ex, range) {
        var r0 = range.start;
        var r1 = range.end;
        var bounds = range.bounds;
        if (this.versionBefore('0.9.0') || r0 < 0 || r1 < 0) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        if (ex instanceof ChainExpression && (ex.getSingleAction() instanceof IndexOfAction || ex.popAction() instanceof IndexOfAction)) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (this.versionBefore('0.9.1') && extractionFn) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var boundFilter = {
            type: "bound",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo)
        };
        if (extractionFn)
            boundFilter.extractionFn = extractionFn;
        if (NumberRange.isNumberRange(range))
            boundFilter.alphaNumeric = true;
        if (r0 != null) {
            boundFilter.lower = isDate(r0) ? r0.toISOString() : r0;
            if (bounds[0] === '(')
                boundFilter.lowerStrict = true;
        }
        if (r1 != null) {
            boundFilter.upper = isDate(r1) ? r1.toISOString() : r1;
            if (bounds[1] === ')')
                boundFilter.upperStrict = true;
        }
        return boundFilter;
    };
    DruidExternal.prototype.makeRegexFilter = function (ex, regex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (this.versionBefore('0.9.1') && extractionFn) {
            return this.makeExtractionFilter(ex.match(regex));
        }
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var regexFilter = {
            type: "regex",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            pattern: regex
        };
        if (extractionFn)
            regexFilter.extractionFn = extractionFn;
        return regexFilter;
    };
    DruidExternal.prototype.makeContainsFilter = function (lhs, rhs, compare) {
        if (rhs instanceof LiteralExpression) {
            var attributeInfo = this.getSingleReferenceAttributeInfo(lhs);
            var extractionFn = this.expressionToExtractionFn(lhs);
            if (extractionFn)
                this.checkFilterExtractability(attributeInfo);
            if (this.versionBefore('0.9.0')) {
                if (compare === ContainsAction.IGNORE_CASE) {
                    return {
                        type: "search",
                        dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
                        query: {
                            type: "insensitive_contains",
                            value: rhs.value
                        }
                    };
                }
                else {
                    return this.makeJavaScriptFilter(lhs.contains(rhs, compare));
                }
            }
            if (this.versionBefore('0.9.1') && extractionFn) {
                return this.makeExtractionFilter(lhs.contains(rhs, compare));
            }
            var searchFilter = {
                type: "search",
                dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
                query: {
                    type: "contains",
                    value: rhs.value,
                    caseSensitive: compare === ContainsAction.NORMAL
                }
            };
            if (extractionFn)
                searchFilter.extractionFn = extractionFn;
            return searchFilter;
        }
        else {
            return this.makeJavaScriptFilter(lhs.contains(rhs, compare));
        }
    };
    DruidExternal.prototype.timelessFilterToDruid = function (filter, aggregatorFilter) {
        var _this = this;
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter instanceof RefExpression) {
            filter = filter.is(true);
        }
        if (filter instanceof LiteralExpression) {
            if (filter.value === true) {
                return null;
            }
            else {
                throw new Error("should never get here");
            }
        }
        else if (filter instanceof ChainExpression) {
            var pattern;
            if (pattern = filter.getExpressionPattern('and')) {
                return {
                    type: 'and',
                    fields: pattern.map(function (p) { return _this.timelessFilterToDruid(p, aggregatorFilter); })
                };
            }
            if (pattern = filter.getExpressionPattern('or')) {
                return {
                    type: 'or',
                    fields: pattern.map(function (p) { return _this.timelessFilterToDruid(p, aggregatorFilter); })
                };
            }
            var filterAction = filter.lastAction();
            var rhs = filterAction.expression;
            var lhs = filter.popAction();
            if (filterAction instanceof NotAction) {
                return {
                    type: 'not',
                    field: this.timelessFilterToDruid(lhs, aggregatorFilter)
                };
            }
            if (lhs instanceof LiteralExpression) {
                if (filterAction.action !== 'in')
                    throw new Error("can not convert " + filter + " to Druid filter");
                return this.makeSelectorFilter(rhs, lhs.value);
            }
            if (filterAction instanceof IsAction) {
                if (rhs instanceof LiteralExpression) {
                    return this.makeSelectorFilter(lhs, rhs.value);
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid filter");
                }
            }
            var freeReferences = filter.getFreeReferences();
            if (freeReferences.length !== 1)
                throw new Error("can not convert multi reference filter " + filter + " to Druid filter");
            var referenceName = freeReferences[0];
            var attributeInfo = this.getAttributesInfo(referenceName);
            if (attributeInfo.unsplitable) {
                throw new Error("can not convert " + filter + " to filter because it references an un-filterable metric '" + referenceName + "' which is most likely rolled up.");
            }
            if (filterAction instanceof InAction || filterAction instanceof OverlapAction) {
                if (rhs instanceof LiteralExpression) {
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/STRING' || rhsType === 'SET/NUMBER' || rhsType === 'SET/NULL') {
                        return this.makeInFilter(lhs, rhs.value);
                    }
                    else if (rhsType === 'NUMBER_RANGE' || rhsType === 'TIME_RANGE' || rhsType === 'STRING_RANGE') {
                        return this.makeBoundFilter(lhs, rhs.value);
                    }
                    else if (rhsType === 'SET/NUMBER_RANGE' || rhsType === 'SET/TIME_RANGE') {
                        var elements = rhs.value.elements;
                        var fields = elements.map(function (range) {
                            return _this.makeBoundFilter(lhs, range);
                        });
                        return fields.length === 1 ? fields[0] : { type: "or", fields: fields };
                    }
                    else {
                        throw new Error("not supported IN rhs type " + rhsType);
                    }
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid filter");
                }
            }
            if (aggregatorFilter) {
                if (this.versionBefore('0.8.2'))
                    throw new Error("can not express aggregate filter " + filter + " in druid < 0.8.2");
                if (this.versionBefore('0.9.1'))
                    return this.makeExtractionFilter(filter);
            }
            if (filterAction instanceof MatchAction) {
                return this.makeRegexFilter(lhs, filterAction.regexp);
            }
            if (filterAction instanceof ContainsAction) {
                return this.makeContainsFilter(lhs, rhs, filterAction.compare);
            }
        }
        throw new Error("could not convert filter " + filter + " to Druid filter");
    };
    DruidExternal.prototype.timeFilterToIntervals = function (filter) {
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter instanceof LiteralExpression) {
            if (!filter.value)
                return DruidExternal.FALSE_INTERVAL;
            if (!this.allowEternity)
                throw new Error('must filter on time unless the allowEternity flag is set');
            return DruidExternal.TRUE_INTERVAL;
        }
        else if (filter instanceof ChainExpression) {
            var lhs = filter.expression;
            var actions = filter.actions;
            if (actions.length !== 1)
                throw new Error("can not convert " + filter + " to Druid interval");
            var filterAction = actions[0];
            var rhs = filterAction.expression;
            if (filterAction instanceof IsAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    return TimeRange.intervalFromDate(rhs.value);
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid interval");
                }
            }
            else if (filterAction instanceof InAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    var timeRanges;
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/TIME_RANGE') {
                        timeRanges = rhs.value.elements;
                    }
                    else if (rhsType === 'TIME_RANGE') {
                        timeRanges = [rhs.value];
                    }
                    else {
                        throw new Error("not supported " + rhsType + " for time filtering");
                    }
                    var intervals = timeRanges.map(function (timeRange) { return timeRange.toInterval(); });
                    return intervals.length === 1 ? intervals[0] : intervals;
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid interval");
                }
            }
            else {
                throw new Error("can not convert " + filter + " to Druid interval");
            }
        }
        else {
            throw new Error("can not convert " + filter + " to Druid interval");
        }
    };
    DruidExternal.prototype.filterToDruid = function (filter) {
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter.equals(Expression.FALSE)) {
            return {
                intervals: DruidExternal.FALSE_INTERVAL,
                filter: null
            };
        }
        else {
            var timeAttribute_1 = this.timeAttribute;
            var _a = filter.extractFromAnd(function (ex) {
                if (ex instanceof ChainExpression) {
                    var op = ex.expression;
                    var actions = ex.actions;
                    if (op instanceof RefExpression) {
                        if (!(op.name === timeAttribute_1 && actions.length === 1))
                            return false;
                        var action = actions[0].action;
                        return action === 'is' || action === 'in';
                    }
                }
                return false;
            }), extract = _a.extract, rest = _a.rest;
            return {
                intervals: this.timeFilterToIntervals(extract),
                filter: this.timelessFilterToDruid(rest, false)
            };
        }
    };
    DruidExternal.prototype.isTimeRef = function (ex) {
        return ex instanceof RefExpression && ex.name === this.timeAttribute;
    };
    DruidExternal.prototype.splitExpressionToGranularityInflater = function (splitExpression, label) {
        if (this.isTimeRef(splitExpression)) {
            return {
                granularity: 'none',
                inflater: External.timeInflaterFactory(label)
            };
        }
        else if (splitExpression instanceof ChainExpression) {
            var splitActions = splitExpression.actions;
            if (this.isTimeRef(splitExpression.expression) && splitActions.length === 1) {
                var action = splitActions[0];
                if (action instanceof TimeBucketAction || action instanceof TimeFloorAction) {
                    var duration = action.duration;
                    var timezone = action.getTimezone();
                    return {
                        granularity: {
                            type: "period",
                            period: duration.toString(),
                            timeZone: timezone.toString()
                        },
                        inflater: action.action === 'timeBucket' ?
                            External.timeRangeInflaterFactory(label, duration, timezone) :
                            External.timeInflaterFactory(label)
                    };
                }
            }
        }
        return null;
    };
    DruidExternal.prototype.expressionToExtractionFn = function (expression) {
        var extractionFns = [];
        this._expressionToExtractionFns(expression, extractionFns);
        switch (extractionFns.length) {
            case 0: return null;
            case 1: return extractionFns[0];
            default:
                if (extractionFns.every(function (extractionFn) { return extractionFn.type === 'javascript'; })) {
                    return this.expressionToJavaScriptExtractionFn(expression);
                }
                if (this.versionBefore('0.9.0')) {
                    try {
                        return this.expressionToJavaScriptExtractionFn(expression);
                    }
                    catch (e) {
                        throw new Error("can not convert " + expression + " to filter in Druid < 0.9.0");
                    }
                }
                return { type: 'cascade', extractionFns: extractionFns };
        }
    };
    DruidExternal.prototype._expressionToExtractionFns = function (expression, extractionFns) {
        var freeReferences = expression.getFreeReferences();
        if (freeReferences.length !== 1) {
            throw new Error("must have 1 reference (has " + freeReferences.length + "): " + expression);
        }
        if (expression instanceof RefExpression) {
            this._processRefExtractionFn(expression, extractionFns);
            return;
        }
        if (expression instanceof ChainExpression) {
            var lead = expression.expression;
            var actions = expression.actions;
            var i = 0;
            var curAction = actions[0];
            var concatPrefix = [];
            if (curAction.action === 'concat') {
                concatPrefix.push(lead);
                while (curAction && curAction.action === 'concat') {
                    concatPrefix.push(curAction.expression);
                    curAction = actions[++i];
                }
                this._processConcatExtractionFn(concatPrefix, extractionFns);
            }
            else if (curAction.action === 'customTransform') {
                extractionFns.push(this.customTransformToExtractionFn(curAction));
                return;
            }
            else if (lead.type === 'NUMBER' && (expression.type === 'NUMBER' || expression.type === 'NUMBER_RANGE')) {
                extractionFns.push(this.expressionToJavaScriptExtractionFn(expression));
                return;
            }
            else if (!lead.isOp('ref')) {
                throw new Error("can not convert complex: " + lead);
            }
            var type = expression.expression.type;
            while (curAction) {
                var nextAction = actions[i + 1];
                var extractionFn;
                if (nextAction instanceof FallbackAction) {
                    extractionFn = this.actionToExtractionFn(curAction, nextAction);
                    i++;
                }
                else if (curAction instanceof CastAction && curAction.outputType === 'STRING' && !nextAction) {
                    break;
                }
                else {
                    extractionFn = this.actionToExtractionFn(curAction, null, type);
                }
                type = curAction.getOutputType(type);
                extractionFns.push(extractionFn);
                curAction = actions[++i];
            }
        }
    };
    DruidExternal.prototype._processRefExtractionFn = function (ref, extractionFns) {
        var attributeInfo = this.getAttributesInfo(ref.name);
        if (ref.type === 'BOOLEAN') {
            extractionFns.push({
                type: "lookup",
                lookup: {
                    type: "map",
                    map: {
                        "0": "false",
                        "1": "true",
                        "false": "false",
                        "true": "true"
                    }
                }
            });
            return;
        }
    };
    DruidExternal.prototype.actionToExtractionFn = function (action, fallbackAction, expressionType) {
        if (action.action === 'extract' || action.action === 'lookup') {
            var retainMissingValue = false;
            var replaceMissingValueWith = null;
            if (fallbackAction) {
                var fallbackExpression = fallbackAction.expression;
                if (fallbackExpression.isOp("ref")) {
                    retainMissingValue = true;
                }
                else if (fallbackExpression.isOp("literal")) {
                    replaceMissingValueWith = fallbackExpression.getLiteralValue();
                }
                else {
                    throw new Error("unsupported fallback expression: " + fallbackExpression);
                }
            }
            if (action instanceof ExtractAction) {
                if (this.versionBefore('0.9.0') && (retainMissingValue === false || replaceMissingValueWith !== null)) {
                    return this.actionToJavaScriptExtractionFn(action);
                }
                var regexExtractionFn = {
                    type: "regex",
                    expr: action.regexp
                };
                if (!retainMissingValue) {
                    regexExtractionFn.replaceMissingValue = true;
                }
                if (replaceMissingValueWith !== null) {
                    regexExtractionFn.replaceMissingValueWith = replaceMissingValueWith;
                }
                return regexExtractionFn;
            }
            if (action instanceof LookupAction) {
                var lookupExtractionFn = {
                    type: "registeredLookup",
                    lookup: action.lookup
                };
                if (this.versionBefore('0.9.1') || /-legacy-lookups/.test(this.version)) {
                    lookupExtractionFn = {
                        type: "lookup",
                        lookup: {
                            type: "namespace",
                            "namespace": action.lookup
                        }
                    };
                }
                if (retainMissingValue) {
                    lookupExtractionFn.retainMissingValue = true;
                }
                if (replaceMissingValueWith !== null) {
                    lookupExtractionFn.replaceMissingValueWith = replaceMissingValueWith;
                }
                return lookupExtractionFn;
            }
        }
        if (fallbackAction) {
            throw new Error("unsupported fallback after " + action.action + " action");
        }
        if (action.getOutputType(null) === 'BOOLEAN') {
            return this.actionToJavaScriptExtractionFn(action);
        }
        if (action instanceof SubstrAction) {
            if (this.versionBefore('0.9.0'))
                return this.actionToJavaScriptExtractionFn(action);
            return {
                type: "substring",
                index: action.position,
                length: action.length
            };
        }
        if (action instanceof TimeBucketAction || action instanceof TimeFloorAction) {
            return DruidExternal.timeFloorToExtraction(action.duration, action.getTimezone());
        }
        if (action instanceof TimePartAction) {
            return DruidExternal.timePartToExtraction(action.part, action.getTimezone());
        }
        if (action instanceof CustomTransformAction) {
            return this.customTransformToExtractionFn(action);
        }
        if (action instanceof TransformCaseAction) {
            var transformType = DruidExternal.caseToDruid[action.transformType];
            if (!transformType)
                throw new Error("unsupported case transformation '" + transformType + "'");
            return {
                type: transformType
            };
        }
        if (action instanceof NumberBucketAction) {
            return this.actionToJavaScriptExtractionFn(action);
        }
        if (action instanceof AbsoluteAction ||
            action instanceof PowerAction ||
            action instanceof LengthAction ||
            action instanceof CardinalityAction ||
            action instanceof CastAction ||
            action instanceof IndexOfAction) {
            return this.actionToJavaScriptExtractionFn(action, expressionType);
        }
        if (action instanceof FallbackAction && action.expression.isOp('literal')) {
            return {
                type: "lookup",
                retainMissingValue: true,
                lookup: {
                    type: "map",
                    map: {
                        "": action.getLiteralValue()
                    }
                }
            };
        }
        throw new Error("can not covert " + action + " to extractionFn");
    };
    DruidExternal.prototype._processConcatExtractionFn = function (pattern, extractionFns) {
        var _this = this;
        if (this.versionBefore('0.9.1')) {
            extractionFns.push({
                type: "javascript",
                'function': Expression.concat(pattern).getJSFn('d'),
                injective: true
            });
            return;
        }
        var format = pattern.map(function (ex) {
            if (ex instanceof LiteralExpression) {
                return ex.value.replace(/%/g, '\\%');
            }
            if (!ex.isOp('ref')) {
                _this._expressionToExtractionFns(ex, extractionFns);
            }
            return '%s';
        }).join('');
        extractionFns.push({
            type: 'stringFormat',
            format: format,
            nullHandling: 'returnNull'
        });
    };
    DruidExternal.prototype.customTransformToExtractionFn = function (action) {
        var custom = action.custom;
        var customExtractionFn = this.customTransforms[custom];
        if (!customExtractionFn)
            throw new Error("could not find extraction function: '" + custom + "'");
        var extractionFn = customExtractionFn.extractionFn;
        if (typeof extractionFn.type !== 'string')
            throw new Error("must have type in custom extraction fn '" + custom + "'");
        try {
            JSON.parse(JSON.stringify(customExtractionFn));
        }
        catch (e) {
            throw new Error("must have JSON extraction Fn '" + custom + "'");
        }
        return extractionFn;
    };
    DruidExternal.prototype.actionToJavaScriptExtractionFn = function (action, type) {
        return this.expressionToJavaScriptExtractionFn($('x', type).performAction(action));
    };
    DruidExternal.prototype.expressionToJavaScriptExtractionFn = function (ex) {
        return {
            type: "javascript",
            'function': ex.getJSFn('d')
        };
    };
    DruidExternal.prototype.expressionToDimensionInflater = function (expression, label) {
        var freeReferences = expression.getFreeReferences();
        if (freeReferences.length !== 1) {
            throw new Error("must have 1 reference (has " + freeReferences.length + "): " + expression);
        }
        var referenceName = freeReferences[0];
        var attributeInfo = this.getAttributesInfo(referenceName);
        if (attributeInfo.unsplitable) {
            throw new Error("can not convert " + expression + " to split because it references an un-splitable metric '" + referenceName + "' which is most likely rolled up.");
        }
        var extractionFn = this.expressionToExtractionFn(expression);
        var simpleInflater = External.getSimpleInflater(expression, label);
        var dimension = {
            type: "default",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            outputName: label
        };
        if (extractionFn) {
            dimension.type = "extraction";
            dimension.extractionFn = extractionFn;
        }
        if (expression instanceof RefExpression) {
            return {
                dimension: dimension,
                inflater: simpleInflater
            };
        }
        if (expression instanceof ChainExpression) {
            var splitAction = expression.lastAction();
            if (splitAction instanceof TimeBucketAction) {
                return {
                    dimension: dimension,
                    inflater: External.timeRangeInflaterFactory(label, splitAction.duration, splitAction.getTimezone())
                };
            }
            if (splitAction instanceof TimePartAction) {
                return {
                    dimension: dimension,
                    inflater: simpleInflater
                };
            }
            if (splitAction instanceof NumberBucketAction) {
                return {
                    dimension: dimension,
                    inflater: External.numberRangeInflaterFactory(label, splitAction.size)
                };
            }
            if (splitAction instanceof CardinalityAction) {
                return {
                    dimension: dimension,
                    inflater: External.setCardinalityInflaterFactory(label)
                };
            }
        }
        var effectiveType = unwrapSetType(expression.type);
        if (simpleInflater || effectiveType === 'STRING') {
            return {
                dimension: dimension,
                inflater: simpleInflater
            };
        }
        throw new Error("could not convert " + expression + " to a Druid dimension");
    };
    DruidExternal.prototype.expressionToDimensionInflaterHaving = function (expression, label, havingFilter) {
        var dimensionInflater = this.expressionToDimensionInflater(expression, label);
        dimensionInflater.having = havingFilter;
        if (expression.type !== 'SET/STRING')
            return dimensionInflater;
        var _a = havingFilter.extractFromAnd(function (hf) {
            if (hf instanceof ChainExpression) {
                var hfExpression = hf.expression;
                var hfActions = hf.actions;
                if (hfExpression instanceof RefExpression && hfExpression.name === label && hfActions.length === 1) {
                    var hfAction = hfActions[0];
                    var hfActionName = hfAction.action;
                    if (hfActionName === 'match')
                        return true;
                    if (hfActionName === 'is' || hfActionName === 'in')
                        return hfAction.expression instanceof LiteralExpression;
                }
            }
            return false;
        }), extract = _a.extract, rest = _a.rest;
        if (extract.equals(Expression.TRUE))
            return dimensionInflater;
        var firstAction = extract.actions[0];
        if (firstAction instanceof MatchAction) {
            return {
                dimension: {
                    type: "regexFiltered",
                    delegate: dimensionInflater.dimension,
                    pattern: firstAction.regexp
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        else if (firstAction instanceof IsAction) {
            return {
                dimension: {
                    type: "listFiltered",
                    delegate: dimensionInflater.dimension,
                    values: [firstAction.expression.getLiteralValue()]
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        else if (firstAction instanceof InAction) {
            return {
                dimension: {
                    type: "listFiltered",
                    delegate: dimensionInflater.dimension,
                    values: firstAction.expression.getLiteralValue().elements
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        return dimensionInflater;
    };
    DruidExternal.prototype.splitToDruid = function (split) {
        var _this = this;
        var leftoverHavingFilter = this.havingFilter;
        if (split.isMultiSplit()) {
            var timestampLabel = null;
            var granularity = null;
            var dimensions = [];
            var inflaters = [];
            split.mapSplits(function (name, expression) {
                if (!granularity && !_this.limit && !_this.sort) {
                    var granularityInflater = _this.splitExpressionToGranularityInflater(expression, name);
                    if (granularityInflater) {
                        timestampLabel = name;
                        granularity = granularityInflater.granularity;
                        inflaters.push(granularityInflater.inflater);
                        return;
                    }
                }
                var _a = _this.expressionToDimensionInflaterHaving(expression, name, leftoverHavingFilter), dimension = _a.dimension, inflater = _a.inflater, having = _a.having;
                leftoverHavingFilter = having;
                dimensions.push(dimension);
                if (inflater) {
                    inflaters.push(inflater);
                }
            });
            return {
                queryType: 'groupBy',
                dimensions: dimensions,
                timestampLabel: timestampLabel,
                granularity: granularity || 'all',
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.groupByNormalizerFactory(timestampLabel), inflaters, null)
            };
        }
        var splitExpression = split.firstSplitExpression();
        var label = split.firstSplitName();
        var granularityInflater = this.splitExpressionToGranularityInflater(splitExpression, label);
        if (granularityInflater) {
            return {
                queryType: 'timeseries',
                granularity: granularityInflater.granularity,
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.timeseriesNormalizerFactory(label), [granularityInflater.inflater], null)
            };
        }
        var dimensionInflater = this.expressionToDimensionInflaterHaving(splitExpression, label, leftoverHavingFilter);
        leftoverHavingFilter = dimensionInflater.having;
        var inflaters = [dimensionInflater.inflater].filter(Boolean);
        if (leftoverHavingFilter.equals(Expression.TRUE) &&
            (this.limit || split.maxBucketNumber() < 1000) &&
            !this.exactResultsOnly) {
            return {
                queryType: 'topN',
                dimension: dimensionInflater.dimension,
                granularity: 'all',
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.topNNormalizer, inflaters, null)
            };
        }
        return {
            queryType: 'groupBy',
            dimensions: [dimensionInflater.dimension],
            granularity: 'all',
            leftoverHavingFilter: leftoverHavingFilter,
            postProcess: DruidExternal.postProcessFactory(DruidExternal.groupByNormalizerFactory(), inflaters, null)
        };
    };
    DruidExternal.prototype.getAccessTypeForAggregation = function (aggregationType) {
        if (aggregationType === 'hyperUnique' || aggregationType === 'cardinality')
            return 'hyperUniqueCardinality';
        var customAggregations = this.customAggregations;
        for (var customName in customAggregations) {
            if (!hasOwnProperty(customAggregations, customName))
                continue;
            var customAggregation = customAggregations[customName];
            if (customAggregation.aggregation.type === aggregationType) {
                return customAggregation.accessType || 'fieldAccess';
            }
        }
        return 'fieldAccess';
    };
    DruidExternal.prototype.getAccessType = function (aggregations, aggregationName) {
        for (var _i = 0, aggregations_1 = aggregations; _i < aggregations_1.length; _i++) {
            var aggregation = aggregations_1[_i];
            if (aggregation.name === aggregationName) {
                var aggregationType = aggregation.type;
                if (aggregationType === 'filtered')
                    aggregationType = aggregation.aggregator.type;
                return this.getAccessTypeForAggregation(aggregationType);
            }
        }
        return 'fieldAccess';
    };
    DruidExternal.prototype.expressionToPostAggregation = function (ex, aggregations, postAggregations) {
        var _this = this;
        if (ex instanceof RefExpression) {
            var refName = ex.name;
            return {
                type: this.getAccessType(aggregations, refName),
                fieldName: refName
            };
        }
        else if (ex instanceof LiteralExpression) {
            if (ex.type !== 'NUMBER')
                throw new Error("must be a NUMBER type");
            return {
                type: 'constant',
                value: ex.value
            };
        }
        else if (ex instanceof ChainExpression) {
            var lastAction = ex.lastAction();
            if (lastAction instanceof AbsoluteAction ||
                lastAction instanceof PowerAction ||
                lastAction instanceof FallbackAction ||
                lastAction instanceof CastAction ||
                lastAction instanceof IndexOfAction ||
                lastAction instanceof TransformCaseAction) {
                var fieldNameRefs = ex.getFreeReferences();
                var fieldNames = fieldNameRefs.map(function (fieldNameRef) {
                    var accessType = _this.getAccessType(aggregations, fieldNameRef);
                    if (accessType === 'fieldAccess')
                        return fieldNameRef;
                    var fieldNameRefTemp = '!F_' + fieldNameRef;
                    postAggregations.push({
                        name: fieldNameRefTemp,
                        type: accessType,
                        fieldName: fieldNameRef
                    });
                    return fieldNameRefTemp;
                });
                return {
                    type: 'javascript',
                    fieldNames: fieldNames,
                    'function': "function(" + fieldNameRefs.map(RefExpression.toJavaScriptSafeName) + ") { return " + ex.getJS(null) + "; }"
                };
            }
            var pattern;
            if (pattern = ex.getExpressionPattern('add')) {
                return {
                    type: 'arithmetic',
                    fn: '+',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('subtract')) {
                return {
                    type: 'arithmetic',
                    fn: '-',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('multiply')) {
                return {
                    type: 'arithmetic',
                    fn: '*',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('divide')) {
                return {
                    type: 'arithmetic',
                    fn: '/',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            throw new Error("can not convert chain to post agg: " + ex);
        }
        else {
            throw new Error("can not convert expression to post agg: " + ex);
        }
    };
    DruidExternal.prototype.applyToPostAggregation = function (action, aggregations, postAggregations) {
        var postAgg = this.expressionToPostAggregation(action.expression, aggregations, postAggregations);
        postAgg.name = action.name;
        postAggregations.push(postAgg);
    };
    DruidExternal.prototype.makeNativeAggregateFilter = function (filterExpression, aggregator) {
        return {
            type: "filtered",
            name: aggregator.name,
            filter: this.timelessFilterToDruid(filterExpression, true),
            aggregator: aggregator
        };
    };
    DruidExternal.prototype.makeStandardAggregation = function (name, aggregateAction) {
        var fn = aggregateAction.action;
        var aggregateExpression = aggregateAction.expression;
        var aggregation = {
            name: name,
            type: AGGREGATE_TO_DRUID[fn]
        };
        if (fn !== 'count') {
            if (aggregateExpression instanceof RefExpression) {
                var refName = aggregateExpression.name;
                var attributeInfo = this.getAttributesInfo(refName);
                if (attributeInfo.unsplitable) {
                    aggregation.fieldName = refName;
                }
                else {
                    return this.makeJavaScriptAggregation(name, aggregateAction);
                }
            }
            else {
                return this.makeJavaScriptAggregation(name, aggregateAction);
            }
        }
        return aggregation;
    };
    DruidExternal.prototype.makeCountDistinctAggregation = function (name, action, postAggregations) {
        if (this.exactResultsOnly) {
            throw new Error("approximate query not allowed");
        }
        var attribute = action.expression;
        if (attribute instanceof RefExpression) {
            var attributeName = attribute.name;
        }
        else {
            throw new Error("can not compute countDistinct on derived attribute: " + attribute);
        }
        var attributeInfo = this.getAttributesInfo(attributeName);
        if (attributeInfo instanceof UniqueAttributeInfo) {
            return {
                name: name,
                type: "hyperUnique",
                fieldName: attributeName
            };
        }
        else if (attributeInfo instanceof ThetaAttributeInfo) {
            var tempName = '!Theta_' + name;
            postAggregations.push({
                type: "thetaSketchEstimate",
                name: name,
                field: { type: 'fieldAccess', fieldName: tempName }
            });
            return {
                name: tempName,
                type: "thetaSketch",
                fieldName: attributeName
            };
        }
        else {
            return {
                name: name,
                type: "cardinality",
                fieldNames: [attributeName],
                byRow: true
            };
        }
    };
    DruidExternal.prototype.makeCustomAggregation = function (name, action) {
        var customAggregationName = action.custom;
        var customAggregation = this.customAggregations[customAggregationName];
        if (!customAggregation)
            throw new Error("could not find '" + customAggregationName + "'");
        var aggregationObj = customAggregation.aggregation;
        if (typeof aggregationObj.type !== 'string')
            throw new Error("must have type in custom aggregation '" + customAggregationName + "'");
        try {
            aggregationObj = JSON.parse(JSON.stringify(aggregationObj));
        }
        catch (e) {
            throw new Error("must have JSON custom aggregation '" + customAggregationName + "'");
        }
        aggregationObj.name = name;
        return aggregationObj;
    };
    DruidExternal.prototype.makeQuantileAggregation = function (name, action, postAggregations) {
        if (this.exactResultsOnly) {
            throw new Error("approximate query not allowed");
        }
        var attribute = action.expression;
        if (attribute instanceof RefExpression) {
            var attributeName = attribute.name;
        }
        else {
            throw new Error("can not compute countDistinct on derived attribute: " + attribute);
        }
        var histogramAggregationName = "!H_" + name;
        var aggregation = {
            name: histogramAggregationName,
            type: "approxHistogramFold",
            fieldName: attributeName
        };
        postAggregations.push({
            name: name,
            type: "quantile",
            fieldName: histogramAggregationName,
            probability: action.quantile
        });
        return aggregation;
    };
    DruidExternal.prototype.makeJavaScriptAggregation = function (name, aggregateAction) {
        var aggregateActionType = aggregateAction.action;
        var aggregateExpression = aggregateAction.expression;
        var aggregateFunction = AGGREGATE_TO_FUNCTION[aggregateActionType];
        if (!aggregateFunction)
            throw new Error("Can not convert " + aggregateActionType + " to JS");
        var zero = AGGREGATE_TO_ZERO[aggregateActionType];
        var fieldNames = aggregateExpression.getFreeReferences();
        var simpleFieldNames = fieldNames.map(RefExpression.toJavaScriptSafeName);
        return {
            name: name,
            type: "javascript",
            fieldNames: fieldNames,
            fnAggregate: "function($$," + simpleFieldNames.join(',') + ") { return " + aggregateFunction('$$', aggregateExpression.getJS(null)) + "; }",
            fnCombine: "function(a,b) { return " + aggregateFunction('a', 'b') + "; }",
            fnReset: "function() { return " + zero + "; }"
        };
    };
    DruidExternal.prototype.applyToAggregation = function (action, aggregations, postAggregations) {
        var applyExpression = action.expression;
        if (applyExpression.op !== 'chain')
            throw new Error("can not convert apply: " + applyExpression);
        var actions = applyExpression.actions;
        var filterExpression = null;
        var aggregateAction = null;
        if (actions.length === 1) {
            aggregateAction = actions[0];
        }
        else if (actions.length === 2) {
            var filterAction = actions[0];
            if (filterAction instanceof FilterAction) {
                filterExpression = filterAction.expression;
            }
            else {
                throw new Error("first action not a filter in: " + applyExpression);
            }
            aggregateAction = actions[1];
        }
        else {
            throw new Error("can not convert strange apply: " + applyExpression);
        }
        var aggregation;
        switch (aggregateAction.action) {
            case "count":
            case "sum":
            case "min":
            case "max":
                aggregation = this.makeStandardAggregation(action.name, aggregateAction);
                break;
            case "countDistinct":
                aggregation = this.makeCountDistinctAggregation(action.name, aggregateAction, postAggregations);
                break;
            case "quantile":
                aggregation = this.makeQuantileAggregation(action.name, aggregateAction, postAggregations);
                break;
            case "customAggregate":
                aggregation = this.makeCustomAggregation(action.name, aggregateAction);
                break;
            default:
                throw new Error("unsupported aggregate action " + aggregateAction.action);
        }
        if (filterExpression) {
            aggregation = this.makeNativeAggregateFilter(filterExpression, aggregation);
        }
        aggregations.push(aggregation);
    };
    DruidExternal.prototype.getAggregationsAndPostAggregations = function (applies) {
        var _this = this;
        var _a = External.segregationAggregateApplies(applies.map(function (apply) {
            var expression = apply.expression;
            expression = _this.switchToRollupCount(_this.inlineDerivedAttributesInAggregate(expression).decomposeAverage()).distribute();
            return apply.changeExpression(expression);
        })), aggregateApplies = _a.aggregateApplies, postAggregateApplies = _a.postAggregateApplies;
        var aggregations = [];
        var postAggregations = [];
        for (var _i = 0, aggregateApplies_1 = aggregateApplies; _i < aggregateApplies_1.length; _i++) {
            var aggregateApply = aggregateApplies_1[_i];
            this.applyToAggregation(aggregateApply, aggregations, postAggregations);
        }
        for (var _b = 0, postAggregateApplies_1 = postAggregateApplies; _b < postAggregateApplies_1.length; _b++) {
            var postAggregateApply = postAggregateApplies_1[_b];
            this.applyToPostAggregation(postAggregateApply, aggregations, postAggregations);
        }
        return {
            aggregations: aggregations,
            postAggregations: postAggregations
        };
    };
    DruidExternal.prototype.makeHavingComparison = function (agg, op, value) {
        switch (op) {
            case '<':
                return { type: "lessThan", aggregation: agg, value: value };
            case '>':
                return { type: "greaterThan", aggregation: agg, value: value };
            case '<=':
                return { type: 'not', havingSpec: { type: "greaterThan", aggregation: agg, value: value } };
            case '>=':
                return { type: 'not', havingSpec: { type: "lessThan", aggregation: agg, value: value } };
            default:
                throw new Error("unknown op: " + op);
        }
    };
    DruidExternal.prototype.inToHavingFilter = function (agg, range) {
        var havingSpecs = [];
        if (range.start !== null) {
            havingSpecs.push(this.makeHavingComparison(agg, (range.bounds[0] === '[' ? '>=' : '>'), range.start));
        }
        if (range.end !== null) {
            havingSpecs.push(this.makeHavingComparison(agg, (range.bounds[1] === ']' ? '<=' : '<'), range.end));
        }
        return havingSpecs.length === 1 ? havingSpecs[0] : { type: 'and', havingSpecs: havingSpecs };
    };
    DruidExternal.prototype.havingFilterToDruid = function (filter) {
        var _this = this;
        if (filter instanceof LiteralExpression) {
            if (filter.value === true) {
                return null;
            }
            else {
                throw new Error("should never get here");
            }
        }
        else if (filter instanceof ChainExpression) {
            var pattern;
            if (pattern = filter.getExpressionPattern('and')) {
                return {
                    type: 'and',
                    havingSpecs: pattern.map(this.havingFilterToDruid, this)
                };
            }
            if (pattern = filter.getExpressionPattern('or')) {
                return {
                    type: 'or',
                    havingSpecs: pattern.map(this.havingFilterToDruid, this)
                };
            }
            if (filter.lastAction() instanceof NotAction) {
                return this.havingFilterToDruid(filter.popAction());
            }
            var lhs = filter.expression;
            var actions = filter.actions;
            if (actions.length !== 1)
                throw new Error("can not convert " + filter + " to Druid interval");
            var filterAction = actions[0];
            var rhs = filterAction.expression;
            if (filterAction instanceof IsAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    return {
                        type: "equalTo",
                        aggregation: lhs.name,
                        value: rhs.value
                    };
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid having filter");
                }
            }
            else if (filterAction instanceof InAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/STRING') {
                        return {
                            type: "or",
                            havingSpecs: rhs.value.elements.map(function (value) {
                                return {
                                    type: "equalTo",
                                    aggregation: lhs.name,
                                    value: value
                                };
                            })
                        };
                    }
                    else if (rhsType === 'SET/NUMBER_RANGE') {
                        return {
                            type: "or",
                            havingSpecs: rhs.value.elements.map(function (value) {
                                return _this.inToHavingFilter(lhs.name, value);
                            }, this)
                        };
                    }
                    else if (rhsType === 'NUMBER_RANGE') {
                        return this.inToHavingFilter(lhs.name, rhs.value);
                    }
                    else if (rhsType === 'TIME_RANGE') {
                        throw new Error("can not compute having filter on time");
                    }
                    else {
                        throw new Error("not supported " + rhsType);
                    }
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid having filter");
                }
            }
        }
        throw new Error("could not convert filter " + filter + " to Druid having filter");
    };
    DruidExternal.prototype.isMinMaxTimeApply = function (apply) {
        var applyExpression = apply.expression;
        if (applyExpression instanceof ChainExpression) {
            var actions = applyExpression.actions;
            if (actions.length !== 1)
                return false;
            var minMaxAction = actions[0];
            return (minMaxAction.action === "min" || minMaxAction.action === "max") &&
                this.isTimeRef(minMaxAction.expression);
        }
        else {
            return false;
        }
    };
    DruidExternal.prototype.getTimeBoundaryQueryAndPostProcess = function () {
        var _a = this, applies = _a.applies, context = _a.context;
        var druidQuery = {
            queryType: "timeBoundary",
            dataSource: this.getDruidDataSource()
        };
        if (context) {
            druidQuery.context = context;
        }
        if (applies.length === 1) {
            var loneApplyExpression = applies[0].expression;
            druidQuery.bound = loneApplyExpression.actions[0].action + "Time";
        }
        return {
            query: druidQuery,
            postProcess: DruidExternal.timeBoundaryPostProcessFactory(applies)
        };
    };
    DruidExternal.prototype.getQueryAndPostProcess = function () {
        var _this = this;
        var _a = this, mode = _a.mode, applies = _a.applies, sort = _a.sort, limit = _a.limit, context = _a.context;
        if (applies && applies.length && applies.every(this.isMinMaxTimeApply, this)) {
            return this.getTimeBoundaryQueryAndPostProcess();
        }
        var druidQuery = {
            queryType: 'timeseries',
            dataSource: this.getDruidDataSource(),
            intervals: null,
            granularity: 'all'
        };
        if (context) {
            druidQuery.context = shallowCopy(context);
        }
        var filterAndIntervals = this.filterToDruid(this.getQueryFilter());
        druidQuery.intervals = filterAndIntervals.intervals;
        if (filterAndIntervals.filter) {
            druidQuery.filter = filterAndIntervals.filter;
        }
        switch (mode) {
            case 'raw':
                if (!this.allowSelectQueries) {
                    throw new Error("to issues 'select' queries allowSelectQueries flag must be set");
                }
                var selectDimensions = [];
                var selectMetrics = [];
                var inflaters = [];
                var timeAttribute = this.timeAttribute;
                var derivedAttributes = this.derivedAttributes;
                var selectedTimeAttribute = null;
                var selectedAttributes = this.getSelectedAttributes();
                selectedAttributes.forEach(function (attribute) {
                    var name = attribute.name, type = attribute.type, unsplitable = attribute.unsplitable;
                    if (name === timeAttribute) {
                        selectedTimeAttribute = name;
                    }
                    else {
                        if (unsplitable) {
                            selectMetrics.push(name);
                        }
                        else {
                            var derivedAttribute = derivedAttributes[name];
                            if (derivedAttribute) {
                                if (_this.versionBefore('0.9.1')) {
                                    throw new Error("can not have derived attributes in Druid select in " + _this.version + ", upgrade to 0.9.1");
                                }
                                var dimensionInflater = _this.expressionToDimensionInflater(derivedAttribute, name);
                                selectDimensions.push(dimensionInflater.dimension);
                                if (dimensionInflater.inflater)
                                    inflaters.push(dimensionInflater.inflater);
                                return;
                            }
                            else {
                                selectDimensions.push(name);
                            }
                        }
                    }
                    switch (type) {
                        case 'BOOLEAN':
                            inflaters.push(External.booleanInflaterFactory(name));
                            break;
                        case 'NUMBER':
                            inflaters.push(External.numberInflaterFactory(name));
                            break;
                        case 'TIME':
                            inflaters.push(External.timeInflaterFactory(name));
                            break;
                        case 'SET/STRING':
                            inflaters.push(External.setStringInflaterFactory(name));
                            break;
                    }
                });
                if (!selectDimensions.length)
                    selectDimensions.push(DUMMY_NAME);
                if (!selectMetrics.length)
                    selectMetrics.push(DUMMY_NAME);
                var resultLimit = limit ? limit.limit : Infinity;
                druidQuery.queryType = 'select';
                druidQuery.dimensions = selectDimensions;
                druidQuery.metrics = selectMetrics;
                druidQuery.pagingSpec = {
                    "pagingIdentifiers": {},
                    "threshold": Math.min(resultLimit, DruidExternal.SELECT_INIT_LIMIT)
                };
                var descending = sort && sort.direction === 'descending';
                if (descending) {
                    druidQuery.descending = true;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.postProcessFactory(DruidExternal.selectNormalizerFactory(selectedTimeAttribute), inflaters, selectedAttributes),
                    next: DruidExternal.selectNextFactory(resultLimit, descending)
                };
            case 'value':
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations([this.toValueApply()]);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.valuePostProcess
                };
            case 'total':
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations(this.applies);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.totalPostProcessFactory(applies)
                };
            case 'split':
                var split = this.getQuerySplit();
                var splitSpec = this.splitToDruid(split);
                druidQuery.queryType = splitSpec.queryType;
                druidQuery.granularity = splitSpec.granularity;
                if (splitSpec.dimension)
                    druidQuery.dimension = splitSpec.dimension;
                if (splitSpec.dimensions)
                    druidQuery.dimensions = splitSpec.dimensions;
                var leftoverHavingFilter = splitSpec.leftoverHavingFilter;
                var postProcess = splitSpec.postProcess;
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations(applies);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                else {
                    druidQuery.aggregations = [{ name: DUMMY_NAME, type: "count" }];
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                switch (druidQuery.queryType) {
                    case 'timeseries':
                        if (sort && (sort.direction !== 'ascending' || !split.hasKey(sort.refName()))) {
                            throw new Error('can not sort within timeseries query');
                        }
                        if (limit) {
                            throw new Error('can not limit within timeseries query');
                        }
                        if (!druidQuery.context || !hasOwnProperty(druidQuery.context, 'skipEmptyBuckets')) {
                            druidQuery.context = druidQuery.context || {};
                            druidQuery.context.skipEmptyBuckets = "true";
                        }
                        break;
                    case 'topN':
                        var metric;
                        if (sort) {
                            var inverted;
                            if (this.sortOnLabel()) {
                                if (expressionNeedsAlphaNumericSort(split.firstSplitExpression())) {
                                    metric = { type: 'alphaNumeric' };
                                }
                                else {
                                    metric = { type: 'lexicographic' };
                                }
                                inverted = sort.direction === 'descending';
                            }
                            else {
                                metric = sort.refName();
                                inverted = sort.direction === 'ascending';
                            }
                            if (inverted) {
                                metric = { type: "inverted", metric: metric };
                            }
                        }
                        else {
                            metric = { type: 'lexicographic' };
                        }
                        druidQuery.metric = metric;
                        druidQuery.threshold = limit ? limit.limit : 1000;
                        break;
                    case 'groupBy':
                        var orderByColumn = null;
                        if (sort) {
                            var col = sort.refName();
                            orderByColumn = {
                                dimension: col,
                                direction: sort.direction
                            };
                            if (this.sortOnLabel()) {
                                if (expressionNeedsAlphaNumericSort(split.splits[col])) {
                                    orderByColumn.dimensionOrder = 'alphanumeric';
                                }
                            }
                        }
                        else {
                            var timestampLabel = splitSpec.timestampLabel;
                            var splitKeys = split.keys.filter(function (k) { return k !== timestampLabel; });
                            if (!splitKeys.length)
                                throw new Error('could not find order by column for group by');
                            var splitKey = splitKeys[0];
                            var keyExpression = split.splits[splitKey];
                            orderByColumn = {
                                dimension: splitKey
                            };
                            if (expressionNeedsAlphaNumericSort(keyExpression)) {
                                orderByColumn.dimensionOrder = 'alphanumeric';
                            }
                        }
                        druidQuery.limitSpec = {
                            type: "default",
                            columns: [orderByColumn || split.firstSplitName()]
                        };
                        if (limit) {
                            druidQuery.limitSpec.limit = limit.limit;
                        }
                        if (!leftoverHavingFilter.equals(Expression.TRUE)) {
                            druidQuery.having = this.havingFilterToDruid(leftoverHavingFilter);
                        }
                        break;
                }
                return {
                    query: druidQuery,
                    postProcess: postProcess
                };
            default:
                throw new Error("can not get query for: " + this.mode);
        }
    };
    DruidExternal.prototype.getIntrospectAttributesWithSegmentMetadata = function () {
        var _a = this, requester = _a.requester, timeAttribute = _a.timeAttribute, context = _a.context;
        var query = {
            queryType: 'segmentMetadata',
            dataSource: this.getDruidDataSource(),
            merge: true,
            analysisTypes: ['aggregators'],
            lenientAggregatorMerge: true
        };
        if (context) {
            query.context = context;
        }
        if (this.versionBefore('0.9.0')) {
            query.analysisTypes = [];
            delete query.lenientAggregatorMerge;
        }
        if (this.versionBefore('0.9.2') && query.dataSource.type === 'union') {
            query.dataSource = query.dataSource.dataSources[0];
        }
        return requester({ query: query }).then(DruidExternal.segmentMetadataPostProcessFactory(timeAttribute));
    };
    DruidExternal.prototype.getIntrospectAttributesWithGet = function () {
        var _a = this, requester = _a.requester, timeAttribute = _a.timeAttribute;
        return requester({
            query: {
                queryType: 'introspect',
                dataSource: this.getDruidDataSource()
            }
        })
            .then(DruidExternal.introspectPostProcessFactory(timeAttribute));
    };
    DruidExternal.prototype.getIntrospectAttributes = function () {
        var _this = this;
        switch (this.introspectionStrategy) {
            case 'segment-metadata-fallback':
                return this.getIntrospectAttributesWithSegmentMetadata()
                    .catch(function (err) {
                    if (err.message.indexOf("querySegmentSpec can't be null") === -1)
                        throw err;
                    return _this.getIntrospectAttributesWithGet();
                });
            case 'segment-metadata-only':
                return this.getIntrospectAttributesWithSegmentMetadata();
            case 'datasource-get':
                return this.getIntrospectAttributesWithGet();
            default:
                throw new Error('invalid introspectionStrategy');
        }
    };
    DruidExternal.type = 'DATASET';
    DruidExternal.TRUE_INTERVAL = "1000/3000";
    DruidExternal.FALSE_INTERVAL = "1000/1001";
    DruidExternal.VALID_INTROSPECTION_STRATEGIES = ['segment-metadata-fallback', 'segment-metadata-only', 'datasource-get'];
    DruidExternal.DEFAULT_INTROSPECTION_STRATEGY = 'segment-metadata-fallback';
    DruidExternal.SELECT_INIT_LIMIT = 50;
    DruidExternal.SELECT_MAX_LIMIT = 10000;
    DruidExternal.TIME_PART_TO_FORMAT = {
        SECOND_OF_MINUTE: "s",
        MINUTE_OF_HOUR: "m",
        HOUR_OF_DAY: "H",
        DAY_OF_WEEK: "e",
        DAY_OF_MONTH: "d",
        DAY_OF_YEAR: "D",
        WEEK_OF_YEAR: "w",
        MONTH_OF_YEAR: "M",
        YEAR: "Y"
    };
    DruidExternal.TIME_PART_TO_EXPR = {
        SECOND_OF_MINUTE: "d.getSecondOfMinute()",
        SECOND_OF_HOUR: "d.getSecondOfHour()",
        SECOND_OF_DAY: "d.getSecondOfDay()",
        SECOND_OF_WEEK: "d.getDayOfWeek()*86400 + d.getSecondOfMinute()",
        SECOND_OF_MONTH: "d.getDayOfMonth()*86400 + d.getSecondOfHour()",
        SECOND_OF_YEAR: "d.getDayOfYear()*86400 + d.getSecondOfDay()",
        MINUTE_OF_HOUR: "d.getMinuteOfHour()",
        MINUTE_OF_DAY: "d.getMinuteOfDay()",
        MINUTE_OF_WEEK: "d.getDayOfWeek()*1440 + d.getMinuteOfDay()",
        MINUTE_OF_MONTH: "d.getDayOfMonth()*1440 + d.getMinuteOfDay()",
        MINUTE_OF_YEAR: "d.getDayOfYear()*1440 + d.getMinuteOfDay()",
        HOUR_OF_DAY: "d.getHourOfDay()",
        HOUR_OF_WEEK: "d.getDayOfWeek()*24 + d.getHourOfDay()",
        HOUR_OF_MONTH: "d.getDayOfMonth()*24 + d.getHourOfDay()",
        HOUR_OF_YEAR: "d.getDayOfYear()*24 + d.getHourOfDay()",
        DAY_OF_WEEK: "d.getDayOfWeek()",
        DAY_OF_MONTH: "d.getDayOfMonth()",
        DAY_OF_YEAR: "d.getDayOfYear()",
        WEEK_OF_YEAR: "d.getWeekOfWeekyear()",
        MONTH_OF_YEAR: "d.getMonthOfYear()",
        YEAR: "d.getYearOfEra()"
    };
    DruidExternal.SPAN_TO_FLOOR_FORMAT = {
        second: "yyyy-MM-dd'T'HH:mm:ss'Z",
        minute: "yyyy-MM-dd'T'HH:mm'Z",
        hour: "yyyy-MM-dd'T'HH':00Z",
        day: "yyyy-MM-dd'Z",
        month: "yyyy-MM'-01Z",
        year: "yyyy'-01-01Z"
    };
    DruidExternal.SPAN_TO_PROPERTY = {
        second: 'secondOfMinute',
        minute: 'minuteOfHour',
        hour: 'hourOfDay',
        day: 'dayOfMonth',
        week: 'weekOfWeekyear',
        month: 'monthOfYear',
        year: 'yearOfEra'
    };
    DruidExternal.caseToDruid = {
        upperCase: 'upper',
        lowerCase: 'lower'
    };
    return DruidExternal;
}(External));
External.register(DruidExternal);
