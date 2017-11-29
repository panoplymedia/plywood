import * as Q from 'q';
import { Timezone } from "chronoshift";
import { isInstanceOf, immutableArraysEqual, immutableLookupsEqual, SimpleArray, NamedArray } from "immutable-class";
import { hasOwnProperty, nonEmptyLookup, safeAdd } from "../helper/utils";
import { $, Expression, RefExpression, ChainExpression, ExternalExpression } from "../expressions/index";
import { Dataset } from "../datatypes/dataset";
import { AttributeInfo } from "../datatypes/attributeInfo";
import { ApplyAction, FilterAction, LimitAction, SelectAction, SortAction, SplitAction } from "../actions/index";
import { NumberRange } from "../datatypes/numberRange";
import { unwrapSetType } from "../datatypes/common";
import { Set } from "../datatypes/set";
import { StringRange } from "../datatypes/stringRange";
import { TimeRange } from "../datatypes/timeRange";
import { promiseWhile } from "../helper/promiseWhile";
function nullMap(xs, fn) {
    if (!xs)
        return null;
    var res = [];
    for (var _i = 0, xs_1 = xs; _i < xs_1.length; _i++) {
        var x = xs_1[_i];
        var y = fn(x);
        if (y)
            res.push(y);
    }
    return res.length ? res : null;
}
function filterToAnds(filter) {
    if (filter.equals(Expression.TRUE))
        return [];
    return filter.getExpressionPattern('and') || [filter];
}
function filterDiff(strongerFilter, weakerFilter) {
    var strongerFilterAnds = filterToAnds(strongerFilter);
    var weakerFilterAnds = filterToAnds(weakerFilter);
    if (weakerFilterAnds.length > strongerFilterAnds.length)
        return null;
    for (var i = 0; i < weakerFilterAnds.length; i++) {
        if (!(weakerFilterAnds[i].equals(strongerFilterAnds[i])))
            return null;
    }
    return Expression.and(strongerFilterAnds.slice(weakerFilterAnds.length));
}
function getCommonFilter(filter1, filter2) {
    var filter1Ands = filterToAnds(filter1);
    var filter2Ands = filterToAnds(filter2);
    var minLength = Math.min(filter1Ands.length, filter2Ands.length);
    var commonExpressions = [];
    for (var i = 0; i < minLength; i++) {
        if (!filter1Ands[i].equals(filter2Ands[i]))
            break;
        commonExpressions.push(filter1Ands[i]);
    }
    return Expression.and(commonExpressions);
}
function mergeDerivedAttributes(derivedAttributes1, derivedAttributes2) {
    var derivedAttributes = Object.create(null);
    for (var k in derivedAttributes1) {
        derivedAttributes[k] = derivedAttributes1[k];
    }
    for (var k in derivedAttributes2) {
        if (hasOwnProperty(derivedAttributes, k) && !derivedAttributes[k].equals(derivedAttributes2[k])) {
            throw new Error("can not currently redefine conflicting " + k);
        }
        derivedAttributes[k] = derivedAttributes2[k];
    }
    return derivedAttributes;
}
function getSampleValue(valueType, ex) {
    switch (valueType) {
        case 'BOOLEAN':
            return true;
        case 'NUMBER':
            return 4;
        case 'NUMBER_RANGE':
            var numberBucketAction;
            if (ex instanceof ChainExpression && (numberBucketAction = ex.getSingleAction('numberBucket'))) {
                return new NumberRange({
                    start: numberBucketAction.offset,
                    end: numberBucketAction.offset + numberBucketAction.size
                });
            }
            else {
                return new NumberRange({ start: 0, end: 1 });
            }
        case 'TIME':
            return new Date('2015-03-14T00:00:00');
        case 'TIME_RANGE':
            var timeBucketAction;
            if (ex instanceof ChainExpression && (timeBucketAction = ex.getSingleAction('timeBucket'))) {
                var timezone = timeBucketAction.timezone || Timezone.UTC;
                var start = timeBucketAction.duration.floor(new Date('2015-03-14T00:00:00'), timezone);
                return new TimeRange({
                    start: start,
                    end: timeBucketAction.duration.shift(start, timezone, 1)
                });
            }
            else {
                return new TimeRange({ start: new Date('2015-03-14T00:00:00'), end: new Date('2015-03-15T00:00:00') });
            }
        case 'STRING':
            if (ex instanceof RefExpression) {
                return 'some_' + ex.name;
            }
            else {
                return 'something';
            }
        case 'SET/STRING':
            if (ex instanceof RefExpression) {
                return Set.fromJS([ex.name + '1']);
            }
            else {
                return Set.fromJS(['something']);
            }
        case 'STRING_RANGE':
            if (ex instanceof RefExpression) {
                return StringRange.fromJS({ start: 'some_' + ex.name, end: null });
            }
            else {
                return StringRange.fromJS({ start: 'something', end: null });
            }
        default:
            throw new Error("unsupported simulation on: " + valueType);
    }
}
function immutableAdd(obj, key, value) {
    var newObj = Object.create(null);
    for (var k in obj)
        newObj[k] = obj[k];
    newObj[key] = value;
    return newObj;
}
function findApplyByExpression(applies, expression) {
    for (var _i = 0, applies_1 = applies; _i < applies_1.length; _i++) {
        var apply = applies_1[_i];
        if (apply.expression.equals(expression))
            return apply;
    }
    return null;
}
export var External = (function () {
    function External(parameters, dummy) {
        if (dummy === void 0) { dummy = null; }
        this.attributes = null;
        this.attributeOverrides = null;
        this.rawAttributes = null;
        if (dummy !== dummyObject) {
            throw new TypeError("can not call `new External` directly use External.fromJS instead");
        }
        this.engine = parameters.engine;
        var version = null;
        if (parameters.version) {
            version = External.extractVersion(parameters.version);
            if (!version)
                throw new Error("invalid version " + parameters.version);
        }
        this.version = version;
        this.source = parameters.source;
        this.suppress = Boolean(parameters.suppress);
        this.rollup = Boolean(parameters.rollup);
        if (parameters.attributes) {
            this.attributes = parameters.attributes;
        }
        if (parameters.attributeOverrides) {
            this.attributeOverrides = parameters.attributeOverrides;
        }
        this.derivedAttributes = parameters.derivedAttributes || {};
        if (parameters.delegates) {
            this.delegates = parameters.delegates;
        }
        this.concealBuckets = parameters.concealBuckets;
        this.rawAttributes = parameters.rawAttributes;
        this.requester = parameters.requester;
        this.mode = parameters.mode || 'raw';
        this.filter = parameters.filter || Expression.TRUE;
        switch (this.mode) {
            case 'raw':
                this.select = parameters.select;
                this.sort = parameters.sort;
                this.limit = parameters.limit;
                break;
            case 'value':
                this.valueExpression = parameters.valueExpression;
                break;
            case 'total':
                this.applies = parameters.applies || [];
                break;
            case 'split':
                this.dataName = parameters.dataName;
                this.split = parameters.split;
                if (!this.split)
                    throw new Error('must have split action in split mode');
                this.applies = parameters.applies || [];
                this.sort = parameters.sort;
                this.limit = parameters.limit;
                this.havingFilter = parameters.havingFilter || Expression.TRUE;
                break;
        }
    }
    External.isExternal = function (candidate) {
        return isInstanceOf(candidate, External);
    };
    External.extractVersion = function (v) {
        if (!v)
            return null;
        var m = v.match(/^\d+\.\d+\.\d+(?:-[\w\-]+)?/);
        return m ? m[0] : null;
    };
    External.versionLessThan = function (va, vb) {
        var pa = va.split('-')[0].split('.');
        var pb = vb.split('-')[0].split('.');
        if (pa[0] !== pb[0])
            return pa[0] < pb[0];
        if (pa[1] !== pb[1])
            return pa[1] < pb[1];
        return pa[2] < pb[2];
    };
    External.deduplicateExternals = function (externals) {
        if (externals.length < 2)
            return externals;
        var uniqueExternals = [externals[0]];
        function addToUniqueExternals(external) {
            for (var _i = 0, uniqueExternals_1 = uniqueExternals; _i < uniqueExternals_1.length; _i++) {
                var uniqueExternal = uniqueExternals_1[_i];
                if (uniqueExternal.equalBase(external))
                    return;
            }
            uniqueExternals.push(external);
        }
        for (var i = 1; i < externals.length; i++)
            addToUniqueExternals(externals[i]);
        return uniqueExternals;
    };
    External.makeZeroDatum = function (applies) {
        var newDatum = Object.create(null);
        for (var _i = 0, applies_2 = applies; _i < applies_2.length; _i++) {
            var apply = applies_2[_i];
            var applyName = apply.name;
            if (applyName[0] === '_')
                continue;
            newDatum[applyName] = 0;
        }
        return newDatum;
    };
    External.normalizeAndAddApply = function (attributesAndApplies, apply) {
        var attributes = attributesAndApplies.attributes, applies = attributesAndApplies.applies;
        var expressions = Object.create(null);
        for (var _i = 0, applies_3 = applies; _i < applies_3.length; _i++) {
            var existingApply = applies_3[_i];
            expressions[existingApply.name] = existingApply.expression;
        }
        apply = apply.changeExpression(apply.expression.resolveWithExpressions(expressions, 'leave').simplify());
        return {
            attributes: NamedArray.overrideByName(attributes, new AttributeInfo({ name: apply.name, type: apply.expression.type })),
            applies: NamedArray.overrideByName(applies, apply)
        };
    };
    External.segregationAggregateApplies = function (applies) {
        var aggregateApplies = [];
        var postAggregateApplies = [];
        var nameIndex = 0;
        var appliesToSegregate = [];
        for (var _i = 0, applies_4 = applies; _i < applies_4.length; _i++) {
            var apply = applies_4[_i];
            var applyExpression = apply.expression;
            if (applyExpression instanceof ChainExpression) {
                var actions = applyExpression.actions;
                if (actions[actions.length - 1].isAggregate()) {
                    aggregateApplies.push(apply);
                    continue;
                }
            }
            appliesToSegregate.push(apply);
        }
        for (var _a = 0, appliesToSegregate_1 = appliesToSegregate; _a < appliesToSegregate_1.length; _a++) {
            var apply = appliesToSegregate_1[_a];
            var newExpression = apply.expression.substituteAction(function (action) {
                return action.isAggregate();
            }, function (preEx, action) {
                var aggregateChain = preEx.performAction(action);
                var existingApply = findApplyByExpression(aggregateApplies, aggregateChain);
                if (existingApply) {
                    return $(existingApply.name, existingApply.expression.type);
                }
                else {
                    var name = '!T_' + (nameIndex++);
                    aggregateApplies.push(new ApplyAction({
                        action: 'apply',
                        name: name,
                        expression: aggregateChain
                    }));
                    return $(name, aggregateChain.type);
                }
            });
            postAggregateApplies.push(apply.changeExpression(newExpression));
        }
        return {
            aggregateApplies: aggregateApplies,
            postAggregateApplies: postAggregateApplies
        };
    };
    External.getCommonFilterFromExternals = function (externals) {
        if (!externals.length)
            throw new Error('must have externals');
        var commonFilter = externals[0].filter;
        for (var i = 1; i < externals.length; i++) {
            commonFilter = getCommonFilter(commonFilter, externals[i].filter);
        }
        return commonFilter;
    };
    External.getMergedDerivedAttributesFromExternals = function (externals) {
        if (!externals.length)
            throw new Error('must have externals');
        var derivedAttributes = externals[0].derivedAttributes;
        for (var i = 1; i < externals.length; i++) {
            derivedAttributes = mergeDerivedAttributes(derivedAttributes, externals[i].derivedAttributes);
        }
        return derivedAttributes;
    };
    External.getSimpleInflater = function (splitExpression, label) {
        switch (splitExpression.type) {
            case 'BOOLEAN': return External.booleanInflaterFactory(label);
            case 'NUMBER': return External.numberInflaterFactory(label);
            case 'TIME': return External.timeInflaterFactory(label);
            default: return null;
        }
    };
    External.booleanInflaterFactory = function (label) {
        return function (d) {
            var v = '' + d[label];
            switch (v) {
                case 'null':
                    d[label] = null;
                    break;
                case '0':
                case 'false':
                    d[label] = false;
                    break;
                case '1':
                case 'true':
                    d[label] = true;
                    break;
                default:
                    throw new Error("got strange result from boolean: " + v);
            }
        };
    };
    External.timeRangeInflaterFactory = function (label, duration, timezone) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            var start = new Date(v);
            d[label] = new TimeRange({ start: start, end: duration.shift(start, timezone) });
        };
    };
    External.numberRangeInflaterFactory = function (label, rangeSize) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            var start = Number(v);
            d[label] = new NumberRange({
                start: start,
                end: safeAdd(start, rangeSize)
            });
        };
    };
    External.numberInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            d[label] = Number(v);
        };
    };
    External.timeInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            d[label] = new Date(v);
        };
    };
    External.setStringInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            if (typeof v === 'string')
                v = [v];
            d[label] = Set.fromJS({
                setType: 'STRING',
                elements: v
            });
        };
    };
    External.setCardinalityInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            d[label] = Array.isArray(v) ? v.length : 1;
        };
    };
    External.jsToValue = function (parameters, requester) {
        var value = {
            engine: parameters.engine,
            version: parameters.version,
            source: parameters.source,
            suppress: true,
            rollup: parameters.rollup,
            concealBuckets: Boolean(parameters.concealBuckets),
            requester: requester
        };
        if (parameters.attributes) {
            value.attributes = AttributeInfo.fromJSs(parameters.attributes);
        }
        if (parameters.attributeOverrides) {
            value.attributeOverrides = AttributeInfo.fromJSs(parameters.attributeOverrides);
        }
        if (parameters.derivedAttributes) {
            value.derivedAttributes = Expression.expressionLookupFromJS(parameters.derivedAttributes);
        }
        value.filter = parameters.filter ? Expression.fromJS(parameters.filter) : Expression.TRUE;
        return value;
    };
    External.register = function (ex, id) {
        if (id === void 0) { id = null; }
        if (!id)
            id = ex.name.replace('External', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        External.classMap[id] = ex;
    };
    External.getConstructorFor = function (engine) {
        var classFn = External.classMap[engine];
        if (!classFn)
            throw new Error("unsupported engine '" + engine + "'");
        return classFn;
    };
    External.fromJS = function (parameters, requester) {
        if (requester === void 0) { requester = null; }
        if (!hasOwnProperty(parameters, "engine")) {
            throw new Error("external `engine` must be defined");
        }
        var engine = parameters.engine;
        if (typeof engine !== "string")
            throw new Error("engine must be a string");
        var ClassFn = External.getConstructorFor(engine);
        if (!requester && hasOwnProperty(parameters, 'requester')) {
            console.warn("'requester' parameter should be passed as context (2nd argument)");
            requester = parameters.requester;
        }
        if (!parameters.source) {
            parameters.source = parameters.dataSource || parameters.table;
        }
        return ClassFn.fromJS(parameters, requester);
    };
    External.fromValue = function (parameters) {
        var engine = parameters.engine;
        var ClassFn = External.getConstructorFor(engine);
        return new ClassFn(parameters);
    };
    External.prototype._ensureEngine = function (engine) {
        if (!this.engine) {
            this.engine = engine;
            return;
        }
        if (this.engine !== engine) {
            throw new TypeError("incorrect engine '" + this.engine + "' (needs to be: '" + engine + "')");
        }
    };
    External.prototype._ensureMinVersion = function (minVersion) {
        if (this.version && External.versionLessThan(this.version, minVersion)) {
            throw new Error("only " + this.engine + " versions >= " + minVersion + " are supported");
        }
    };
    External.prototype.valueOf = function () {
        var value = {
            engine: this.engine,
            version: this.version,
            source: this.source,
            rollup: this.rollup,
            mode: this.mode
        };
        if (this.suppress)
            value.suppress = this.suppress;
        if (this.attributes)
            value.attributes = this.attributes;
        if (this.attributeOverrides)
            value.attributeOverrides = this.attributeOverrides;
        if (nonEmptyLookup(this.derivedAttributes))
            value.derivedAttributes = this.derivedAttributes;
        if (this.delegates)
            value.delegates = this.delegates;
        value.concealBuckets = this.concealBuckets;
        if (this.rawAttributes) {
            value.rawAttributes = this.rawAttributes;
        }
        if (this.requester) {
            value.requester = this.requester;
        }
        if (this.dataName) {
            value.dataName = this.dataName;
        }
        value.filter = this.filter;
        if (this.valueExpression) {
            value.valueExpression = this.valueExpression;
        }
        if (this.select) {
            value.select = this.select;
        }
        if (this.split) {
            value.split = this.split;
        }
        if (this.applies) {
            value.applies = this.applies;
        }
        if (this.sort) {
            value.sort = this.sort;
        }
        if (this.limit) {
            value.limit = this.limit;
        }
        if (this.havingFilter) {
            value.havingFilter = this.havingFilter;
        }
        return value;
    };
    External.prototype.toJS = function () {
        var js = {
            engine: this.engine,
            source: this.source
        };
        if (this.version)
            js.version = this.version;
        if (this.rollup)
            js.rollup = true;
        if (this.attributes)
            js.attributes = AttributeInfo.toJSs(this.attributes);
        if (this.attributeOverrides)
            js.attributeOverrides = AttributeInfo.toJSs(this.attributeOverrides);
        if (nonEmptyLookup(this.derivedAttributes))
            js.derivedAttributes = Expression.expressionLookupToJS(this.derivedAttributes);
        if (this.concealBuckets)
            js.concealBuckets = true;
        if (this.rawAttributes)
            js.rawAttributes = AttributeInfo.toJSs(this.rawAttributes);
        if (!this.filter.equals(Expression.TRUE)) {
            js.filter = this.filter.toJS();
        }
        return js;
    };
    External.prototype.toJSON = function () {
        return this.toJS();
    };
    External.prototype.toString = function () {
        var mode = this.mode;
        switch (mode) {
            case 'raw':
                return "ExternalRaw(" + this.filter + ")";
            case 'value':
                return "ExternalValue(" + this.valueExpression + ")";
            case 'total':
                return "ExternalTotal(" + this.applies.length + ")";
            case 'split':
                return "ExternalSplit(" + this.split + ", " + this.applies.length + ")";
            default:
                throw new Error("unknown mode: " + mode);
        }
    };
    External.prototype.equals = function (other) {
        return this.equalBase(other) &&
            immutableLookupsEqual(this.derivedAttributes, other.derivedAttributes) &&
            immutableArraysEqual(this.attributes, other.attributes) &&
            immutableArraysEqual(this.delegates, other.delegates) &&
            this.concealBuckets === other.concealBuckets &&
            Boolean(this.requester) === Boolean(other.requester);
    };
    External.prototype.equalBase = function (other) {
        return External.isExternal(other) &&
            this.engine === other.engine &&
            String(this.source) === String(other.source) &&
            this.version === other.version &&
            this.rollup === other.rollup &&
            this.mode === other.mode &&
            this.filter.equals(other.filter);
    };
    External.prototype.changeVersion = function (version) {
        var value = this.valueOf();
        value.version = version;
        return External.fromValue(value);
    };
    External.prototype.attachRequester = function (requester) {
        var value = this.valueOf();
        value.requester = requester;
        return External.fromValue(value);
    };
    External.prototype.versionBefore = function (neededVersion) {
        var version = this.version;
        return version && External.versionLessThan(version, neededVersion);
    };
    External.prototype.getAttributesInfo = function (attributeName) {
        var attributes = this.rawAttributes || this.attributes;
        return NamedArray.get(attributes, attributeName);
    };
    External.prototype.updateAttribute = function (newAttribute) {
        if (!this.attributes)
            return this;
        var value = this.valueOf();
        value.attributes = AttributeInfo.override(value.attributes, [newAttribute]);
        return External.fromValue(value);
    };
    External.prototype.show = function () {
        var value = this.valueOf();
        value.suppress = false;
        return External.fromValue(value);
    };
    External.prototype.hasAttribute = function (name) {
        var _a = this, attributes = _a.attributes, rawAttributes = _a.rawAttributes, derivedAttributes = _a.derivedAttributes;
        if (SimpleArray.find(rawAttributes || attributes, function (a) { return a.name === name; }))
            return true;
        return hasOwnProperty(derivedAttributes, name);
    };
    External.prototype.expressionDefined = function (ex) {
        return ex.definedInTypeContext(this.getFullType());
    };
    External.prototype.bucketsConcealed = function (ex) {
        var _this = this;
        return ex.every(function (ex, index, depth, nestDiff) {
            if (nestDiff)
                return true;
            if (ex instanceof RefExpression) {
                var refAttributeInfo = _this.getAttributesInfo(ex.name);
                if (refAttributeInfo && refAttributeInfo.makerAction) {
                    return refAttributeInfo.makerAction.alignsWith([]);
                }
            }
            else if (ex instanceof ChainExpression) {
                var refExpression = ex.expression;
                if (refExpression instanceof RefExpression) {
                    var ref = refExpression.name;
                    var refAttributeInfo = _this.getAttributesInfo(ref);
                    if (refAttributeInfo && refAttributeInfo.makerAction) {
                        return refAttributeInfo.makerAction.alignsWith(ex.actions);
                    }
                }
            }
            return null;
        });
    };
    External.prototype.canHandleFilter = function (ex) {
        throw new Error("must implement canHandleFilter");
    };
    External.prototype.canHandleTotal = function () {
        throw new Error("must implement canHandleTotal");
    };
    External.prototype.canHandleSplit = function (ex) {
        throw new Error("must implement canHandleSplit");
    };
    External.prototype.canHandleApply = function (ex) {
        throw new Error("must implement canHandleApply");
    };
    External.prototype.canHandleSort = function (sortAction) {
        throw new Error("must implement canHandleSort");
    };
    External.prototype.canHandleLimit = function (limitAction) {
        throw new Error("must implement canHandleLimit");
    };
    External.prototype.canHandleHavingFilter = function (ex) {
        throw new Error("must implement canHandleHavingFilter");
    };
    External.prototype.addDelegate = function (delegate) {
        var value = this.valueOf();
        if (!value.delegates)
            value.delegates = [];
        value.delegates = value.delegates.concat(delegate);
        return External.fromValue(value);
    };
    External.prototype.getBase = function () {
        var value = this.valueOf();
        value.suppress = true;
        value.mode = 'raw';
        value.dataName = null;
        if (this.mode !== 'raw')
            value.attributes = value.rawAttributes;
        value.rawAttributes = null;
        value.filter = null;
        value.applies = [];
        value.split = null;
        value.sort = null;
        value.limit = null;
        value.delegates = nullMap(value.delegates, function (e) { return e.getBase(); });
        return External.fromValue(value);
    };
    External.prototype.getRaw = function () {
        if (this.mode === 'raw')
            return this;
        var value = this.valueOf();
        value.suppress = true;
        value.mode = 'raw';
        value.dataName = null;
        if (this.mode !== 'raw')
            value.attributes = value.rawAttributes;
        value.rawAttributes = null;
        value.applies = [];
        value.split = null;
        value.sort = null;
        value.limit = null;
        value.delegates = nullMap(value.delegates, function (e) { return e.getRaw(); });
        return External.fromValue(value);
    };
    External.prototype.makeTotal = function (applies) {
        if (this.mode !== 'raw')
            return null;
        if (!this.canHandleTotal())
            return null;
        if (!applies.length)
            throw new Error('must have applies');
        var externals = [];
        for (var _i = 0, applies_5 = applies; _i < applies_5.length; _i++) {
            var apply = applies_5[_i];
            var applyExpression = apply.expression;
            if (applyExpression instanceof ExternalExpression) {
                externals.push(applyExpression.external);
            }
        }
        var commonFilter = External.getCommonFilterFromExternals(externals);
        var value = this.valueOf();
        value.mode = 'total';
        value.suppress = false;
        value.rawAttributes = value.attributes;
        value.derivedAttributes = External.getMergedDerivedAttributesFromExternals(externals);
        value.filter = commonFilter;
        value.attributes = [];
        value.applies = [];
        value.delegates = nullMap(value.delegates, function (e) { return e.makeTotal(applies); });
        var totalExternal = External.fromValue(value);
        for (var _a = 0, applies_6 = applies; _a < applies_6.length; _a++) {
            var apply = applies_6[_a];
            totalExternal = totalExternal._addApplyAction(apply);
            if (!totalExternal)
                return null;
        }
        return totalExternal;
    };
    External.prototype.addAction = function (action) {
        if (action instanceof FilterAction) {
            return this._addFilterAction(action);
        }
        if (action instanceof SelectAction) {
            return this._addSelectAction(action);
        }
        if (action instanceof SplitAction) {
            return this._addSplitAction(action);
        }
        if (action instanceof ApplyAction) {
            return this._addApplyAction(action);
        }
        if (action instanceof SortAction) {
            return this._addSortAction(action);
        }
        if (action instanceof LimitAction) {
            return this._addLimitAction(action);
        }
        if (action.isAggregate()) {
            return this._addAggregateAction(action);
        }
        return this._addPostAggregateAction(action);
    };
    External.prototype._addFilterAction = function (action) {
        return this.addFilter(action.expression);
    };
    External.prototype.addFilter = function (expression) {
        if (!expression.resolved())
            return null;
        if (!this.expressionDefined(expression))
            return null;
        var value = this.valueOf();
        switch (this.mode) {
            case 'raw':
                if (this.concealBuckets && !this.bucketsConcealed(expression))
                    return null;
                if (!this.canHandleFilter(expression))
                    return null;
                if (value.filter.equals(Expression.TRUE)) {
                    value.filter = expression;
                }
                else {
                    value.filter = value.filter.and(expression);
                }
                break;
            case 'split':
                if (!this.canHandleHavingFilter(expression))
                    return null;
                value.havingFilter = value.havingFilter.and(expression).simplify();
                break;
            default:
                return null;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e.addFilter(expression); });
        return External.fromValue(value);
    };
    External.prototype._addSelectAction = function (selectAction) {
        if (this.mode !== 'raw')
            return null;
        var datasetType = this.getFullType().datasetType;
        var attributes = selectAction.attributes;
        for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
            var attribute = attributes_1[_i];
            if (!datasetType[attribute])
                return null;
        }
        var value = this.valueOf();
        value.suppress = false;
        value.select = selectAction;
        value.delegates = nullMap(value.delegates, function (e) { return e._addSelectAction(selectAction); });
        return External.fromValue(value);
    };
    External.prototype._addSplitAction = function (splitAction) {
        if (this.mode !== 'raw')
            return null;
        var splitKeys = splitAction.keys;
        for (var _i = 0, splitKeys_1 = splitKeys; _i < splitKeys_1.length; _i++) {
            var splitKey = splitKeys_1[_i];
            var splitExpression = splitAction.splits[splitKey];
            if (!this.expressionDefined(splitExpression))
                return null;
            if (this.concealBuckets && !this.bucketsConcealed(splitExpression))
                return null;
            if (!this.canHandleSplit(splitExpression))
                return null;
        }
        var value = this.valueOf();
        value.suppress = false;
        value.mode = 'split';
        value.dataName = splitAction.dataName;
        value.split = splitAction;
        value.rawAttributes = value.attributes;
        value.attributes = splitAction.mapSplits(function (name, expression) { return new AttributeInfo({ name: name, type: unwrapSetType(expression.type) }); });
        value.delegates = nullMap(value.delegates, function (e) { return e._addSplitAction(splitAction); });
        return External.fromValue(value);
    };
    External.prototype._addApplyAction = function (action) {
        var expression = action.expression;
        if (expression.type === 'DATASET')
            return null;
        if (!expression.contained())
            return null;
        if (!this.expressionDefined(expression))
            return null;
        if (!this.canHandleApply(action.expression))
            return null;
        if (this.mode === 'raw') {
            var value = this.valueOf();
            value.derivedAttributes = immutableAdd(value.derivedAttributes, action.name, action.expression);
        }
        else {
            if (this.split && this.split.hasKey(action.name))
                return null;
            var actionExpression = action.expression;
            if (actionExpression instanceof ExternalExpression) {
                action = action.changeExpression(actionExpression.external.valueExpressionWithinFilter(this.filter));
            }
            var value = this.valueOf();
            var added = External.normalizeAndAddApply(value, action);
            value.applies = added.applies;
            value.attributes = added.attributes;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e._addApplyAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addSortAction = function (action) {
        if (this.limit)
            return null;
        if (!this.canHandleSort(action))
            return null;
        var value = this.valueOf();
        value.sort = action;
        value.delegates = nullMap(value.delegates, function (e) { return e._addSortAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addLimitAction = function (action) {
        if (!this.canHandleLimit(action))
            return null;
        var value = this.valueOf();
        value.suppress = false;
        if (!value.limit || action.limit < value.limit.limit) {
            value.limit = action;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e._addLimitAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addAggregateAction = function (action) {
        if (this.mode !== 'raw' || this.limit)
            return null;
        var actionExpression = action.expression;
        if (actionExpression && !this.expressionDefined(actionExpression))
            return null;
        var value = this.valueOf();
        value.mode = 'value';
        value.suppress = false;
        value.valueExpression = $(External.SEGMENT_NAME, 'DATASET').performAction(action);
        value.rawAttributes = value.attributes;
        value.attributes = null;
        value.delegates = nullMap(value.delegates, function (e) { return e._addAggregateAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addPostAggregateAction = function (action) {
        if (this.mode !== 'value')
            throw new Error('must be in value mode to call addPostAggregateAction');
        var actionExpression = action.expression;
        var commonFilter = this.filter;
        var newValueExpression;
        if (actionExpression instanceof ExternalExpression) {
            var otherExternal = actionExpression.external;
            if (!this.getBase().equals(otherExternal.getBase()))
                return null;
            var commonFilter = getCommonFilter(commonFilter, otherExternal.filter);
            var newAction = action.changeExpression(otherExternal.valueExpressionWithinFilter(commonFilter));
            newValueExpression = this.valueExpressionWithinFilter(commonFilter).performAction(newAction);
        }
        else if (!actionExpression || !actionExpression.hasExternal()) {
            newValueExpression = this.valueExpression.performAction(action);
        }
        else {
            return null;
        }
        var value = this.valueOf();
        value.valueExpression = newValueExpression;
        value.filter = commonFilter;
        value.delegates = nullMap(value.delegates, function (e) { return e._addPostAggregateAction(action); });
        return External.fromValue(value);
    };
    External.prototype.prePack = function (prefix, myAction) {
        if (this.mode !== 'value')
            throw new Error('must be in value mode to call prePack');
        var value = this.valueOf();
        value.valueExpression = prefix.performAction(myAction.changeExpression(value.valueExpression));
        value.delegates = nullMap(value.delegates, function (e) { return e.prePack(prefix, myAction); });
        return External.fromValue(value);
    };
    External.prototype.valueExpressionWithinFilter = function (withinFilter) {
        if (this.mode !== 'value')
            return null;
        var extraFilter = filterDiff(this.filter, withinFilter);
        if (!extraFilter)
            throw new Error('not within the segment');
        var ex = this.valueExpression;
        if (!extraFilter.equals(Expression.TRUE)) {
            ex = ex.substitute(function (ex) {
                if (ex instanceof RefExpression && ex.type === 'DATASET' && ex.name === External.SEGMENT_NAME) {
                    return ex.filter(extraFilter);
                }
                return null;
            });
        }
        return ex;
    };
    External.prototype.toValueApply = function () {
        if (this.mode !== 'value')
            return null;
        return new ApplyAction({
            name: External.VALUE_NAME,
            expression: this.valueExpression
        });
    };
    External.prototype.sortOnLabel = function () {
        var sort = this.sort;
        if (!sort)
            return false;
        var sortOn = sort.expression.name;
        if (!this.split || !this.split.hasKey(sortOn))
            return false;
        var applies = this.applies;
        for (var _i = 0, applies_7 = applies; _i < applies_7.length; _i++) {
            var apply = applies_7[_i];
            if (apply.name === sortOn)
                return false;
        }
        return true;
    };
    External.prototype.inlineDerivedAttributes = function (expression) {
        var derivedAttributes = this.derivedAttributes;
        return expression.substitute(function (refEx) {
            if (refEx instanceof RefExpression) {
                var refName = refEx.name;
                return hasOwnProperty(derivedAttributes, refName) ? derivedAttributes[refName] : null;
            }
            else {
                return null;
            }
        });
    };
    External.prototype.inlineDerivedAttributesInAggregate = function (expression) {
        var _this = this;
        var derivedAttributes = this.derivedAttributes;
        return expression.substituteAction(function (action) {
            if (!action.isAggregate())
                return false;
            return action.getFreeReferences().some(function (ref) { return hasOwnProperty(derivedAttributes, ref); });
        }, function (preEx, action) {
            return preEx.performAction(action.changeExpression(_this.inlineDerivedAttributes(action.expression)));
        });
    };
    External.prototype.switchToRollupCount = function (expression) {
        var _this = this;
        if (!this.rollup)
            return expression;
        var countRef = null;
        return expression.substituteAction(function (action) {
            return action.action === 'count';
        }, function (preEx) {
            if (!countRef)
                countRef = $(_this.getRollupCountName(), 'NUMBER');
            return preEx.sum(countRef);
        });
    };
    External.prototype.getRollupCountName = function () {
        var rawAttributes = this.rawAttributes;
        for (var _i = 0, rawAttributes_1 = rawAttributes; _i < rawAttributes_1.length; _i++) {
            var attribute = rawAttributes_1[_i];
            var makerAction = attribute.makerAction;
            if (makerAction && makerAction.action === 'count')
                return attribute.name;
        }
        throw new Error("could not find rollup count");
    };
    External.prototype.getQuerySplit = function () {
        var _this = this;
        return this.split.transformExpressions(function (ex) {
            return _this.inlineDerivedAttributes(ex);
        });
    };
    External.prototype.getQueryFilter = function () {
        return this.inlineDerivedAttributes(this.filter).simplify();
    };
    External.prototype.getSelectedAttributes = function () {
        var _a = this, select = _a.select, attributes = _a.attributes, derivedAttributes = _a.derivedAttributes;
        attributes = attributes.slice();
        for (var k in derivedAttributes) {
            attributes.push(new AttributeInfo({ name: k, type: derivedAttributes[k].type }));
        }
        if (!select)
            return attributes;
        var selectAttributes = select.attributes;
        return selectAttributes.map(function (s) { return NamedArray.findByName(attributes, s); });
    };
    External.prototype.addNextExternal = function (dataset) {
        var _this = this;
        var _a = this, mode = _a.mode, dataName = _a.dataName, split = _a.split;
        if (mode !== 'split')
            throw new Error('must be in split mode to addNextExternal');
        return dataset.apply(dataName, function (d) {
            return _this.getRaw().addFilter(split.filterFromDatum(d));
        }, 'DATASET', null);
    };
    External.prototype.getDelegate = function () {
        var _a = this, mode = _a.mode, delegates = _a.delegates;
        if (!delegates || !delegates.length || mode === 'raw')
            return null;
        return delegates[0];
    };
    External.prototype.simulateValue = function (lastNode, simulatedQueries, externalForNext) {
        if (externalForNext === void 0) { externalForNext = null; }
        var mode = this.mode;
        if (!externalForNext)
            externalForNext = this;
        var delegate = this.getDelegate();
        if (delegate) {
            return delegate.simulateValue(lastNode, simulatedQueries, externalForNext);
        }
        simulatedQueries.push(this.getQueryAndPostProcess().query);
        if (mode === 'value') {
            var valueExpression = this.valueExpression;
            return getSampleValue(valueExpression.type, valueExpression);
        }
        var datum = {};
        if (mode === 'raw') {
            var attributes = this.attributes;
            for (var _i = 0, attributes_2 = attributes; _i < attributes_2.length; _i++) {
                var attribute = attributes_2[_i];
                datum[attribute.name] = getSampleValue(attribute.type, null);
            }
        }
        else {
            if (mode === 'split') {
                this.split.mapSplits(function (name, expression) {
                    datum[name] = getSampleValue(unwrapSetType(expression.type), expression);
                });
            }
            var applies = this.applies;
            for (var _a = 0, applies_8 = applies; _a < applies_8.length; _a++) {
                var apply = applies_8[_a];
                datum[apply.name] = getSampleValue(apply.expression.type, apply.expression);
            }
        }
        var dataset = new Dataset({ data: [datum] });
        if (!lastNode && mode === 'split')
            dataset = externalForNext.addNextExternal(dataset);
        return dataset;
    };
    External.prototype.getQueryAndPostProcess = function () {
        throw new Error("can not call getQueryAndPostProcess directly");
    };
    External.prototype.queryValue = function (lastNode, externalForNext) {
        if (externalForNext === void 0) { externalForNext = null; }
        var _a = this, mode = _a.mode, requester = _a.requester;
        if (!externalForNext)
            externalForNext = this;
        var delegate = this.getDelegate();
        if (delegate) {
            return delegate.queryValue(lastNode, externalForNext);
        }
        if (!requester) {
            return Q.reject(new Error('must have a requester to make queries'));
        }
        try {
            var queryAndPostProcess = this.getQueryAndPostProcess();
        }
        catch (e) {
            return Q.reject(e);
        }
        var query = queryAndPostProcess.query, postProcess = queryAndPostProcess.postProcess, next = queryAndPostProcess.next;
        if (!query || typeof postProcess !== 'function') {
            return Q.reject(new Error('no query or postProcess'));
        }
        var finalResult;
        if (next) {
            var results = [];
            finalResult = promiseWhile(function () { return query; }, function () {
                return requester({ query: query })
                    .then(function (result) {
                    results.push(result);
                    query = next(query, result);
                });
            })
                .then(function () {
                return queryAndPostProcess.postProcess(results);
            });
        }
        else {
            finalResult = requester({ query: query })
                .then(queryAndPostProcess.postProcess);
        }
        if (!lastNode && mode === 'split') {
            finalResult = finalResult.then(externalForNext.addNextExternal.bind(externalForNext));
        }
        return finalResult;
    };
    External.prototype.needsIntrospect = function () {
        return !this.attributes;
    };
    External.prototype.introspect = function () {
        var _this = this;
        if (!this.requester) {
            return Q.reject(new Error('must have a requester to introspect'));
        }
        if (!this.version) {
            return this.constructor.getVersion(this.requester).then(function (version) {
                version = External.extractVersion(version);
                if (!version)
                    throw new Error('external version not found, please specify explicitly');
                return _this.changeVersion(version).introspect();
            });
        }
        return this.getIntrospectAttributes()
            .then(function (attributes) {
            var value = _this.valueOf();
            if (value.attributeOverrides) {
                attributes = AttributeInfo.override(attributes, value.attributeOverrides);
            }
            if (value.attributes) {
                attributes = AttributeInfo.override(value.attributes, attributes);
            }
            value.attributes = attributes;
            return External.fromValue(value);
        });
    };
    External.prototype.getRawDatasetType = function () {
        var _a = this, attributes = _a.attributes, rawAttributes = _a.rawAttributes, derivedAttributes = _a.derivedAttributes;
        if (!attributes)
            throw new Error("dataset has not been introspected");
        if (!rawAttributes)
            rawAttributes = attributes;
        var myDatasetType = {};
        for (var _i = 0, rawAttributes_2 = rawAttributes; _i < rawAttributes_2.length; _i++) {
            var rawAttribute = rawAttributes_2[_i];
            var attrName = rawAttribute.name;
            myDatasetType[attrName] = {
                type: rawAttribute.type
            };
        }
        for (var name in derivedAttributes) {
            myDatasetType[name] = {
                type: derivedAttributes[name].type
            };
        }
        return myDatasetType;
    };
    External.prototype.getFullType = function () {
        var _a = this, mode = _a.mode, attributes = _a.attributes;
        if (mode === 'value')
            throw new Error('not supported for value mode yet');
        var myDatasetType = this.getRawDatasetType();
        if (mode !== 'raw') {
            var splitDatasetType = {};
            splitDatasetType[this.dataName || External.SEGMENT_NAME] = {
                type: 'DATASET',
                datasetType: myDatasetType,
                remote: true
            };
            for (var _i = 0, attributes_3 = attributes; _i < attributes_3.length; _i++) {
                var attribute = attributes_3[_i];
                var attrName = attribute.name;
                splitDatasetType[attrName] = {
                    type: attribute.type
                };
            }
            myDatasetType = splitDatasetType;
        }
        return {
            type: 'DATASET',
            datasetType: myDatasetType,
            remote: true
        };
    };
    External.type = 'EXTERNAL';
    External.SEGMENT_NAME = '__SEGMENT__';
    External.VALUE_NAME = '__VALUE__';
    External.classMap = {};
    return External;
}());
