import * as Q from 'q';
import { Timezone, Duration, parseISODate } from "chronoshift";
import { isInstanceOf, isImmutableClass, SimpleArray } from "immutable-class";
import { LiteralExpression } from "./literalExpression";
import { ChainExpression } from "./chainExpression";
import { RefExpression } from "./refExpression";
import { ExternalExpression } from "./externalExpression";
import { Action, AbsoluteAction, ApplyAction, AverageAction, CardinalityAction, CastAction, ContainsAction, CountAction, CountDistinctAction, CustomAggregateAction, CustomTransformAction, ExtractAction, FallbackAction, FilterAction, GreaterThanAction, GreaterThanOrEqualAction, InAction, IndexOfAction, IsAction, JoinAction, LengthAction, LessThanAction, LessThanOrEqualAction, LimitAction, LookupAction, MatchAction, MaxAction, MinAction, NotAction, NumberBucketAction, OverlapAction, QuantileAction, SelectAction, SortAction, SplitAction, SubstrAction, SumAction, TimeBucketAction, TimeFloorAction, TimePartAction, TimeRangeAction, TimeShiftAction, TransformCaseAction } from "../actions/index";
import { hasOwnProperty, repeat, emptyLookup, deduplicateSort } from "../helper/utils";
import { Dataset, NumberRange, Range, Set, StringRange, TimeRange } from "../datatypes/index";
import { isSetType, datumHasExternal, getFullTypeFromDatum, introspectDatum } from "../datatypes/common";
import { External } from "../external/baseExternal";
function getDataName(ex) {
    if (ex instanceof RefExpression) {
        return ex.name;
    }
    else if (ex instanceof ChainExpression) {
        return getDataName(ex.expression);
    }
    else {
        return null;
    }
}
function getValue(param) {
    if (param instanceof LiteralExpression)
        return param.value;
    return param;
}
function getString(param) {
    if (typeof param === 'string')
        return param;
    if (param instanceof LiteralExpression && param.type === 'STRING') {
        return param.value;
    }
    if (param instanceof RefExpression && param.nest === 0) {
        return param.name;
    }
    throw new Error('could not extract a string out of ' + String(param));
}
function getNumber(param) {
    if (typeof param === 'number')
        return param;
    if (param instanceof LiteralExpression && param.type === 'NUMBER') {
        return param.value;
    }
    throw new Error('could not extract a number out of ' + String(param));
}
export function ply(dataset) {
    if (!dataset)
        dataset = new Dataset({ data: [{}] });
    return r(dataset);
}
export function $(name, nest, type) {
    if (typeof name !== 'string')
        throw new TypeError('$() argument must be a string');
    if (typeof nest === 'string') {
        type = nest;
        nest = 0;
    }
    return new RefExpression({
        name: name,
        nest: nest != null ? nest : 0,
        type: type
    });
}
export function i$(name, nest, type) {
    if (typeof name !== 'string')
        throw new TypeError('$() argument must be a string');
    if (typeof nest === 'string') {
        type = nest;
        nest = 0;
    }
    return new RefExpression({
        name: name,
        nest: nest != null ? nest : 0,
        type: type,
        ignoreCase: true
    });
}
export function r(value) {
    if (External.isExternal(value))
        throw new TypeError('r can not accept externals');
    if (Array.isArray(value))
        value = Set.fromJS(value);
    return LiteralExpression.fromJS({ op: 'literal', value: value });
}
export function toJS(thing) {
    return (thing && typeof thing.toJS === 'function') ? thing.toJS() : thing;
}
function chainVia(op, expressions, zero) {
    var n = expressions.length;
    if (!n)
        return zero;
    var acc = expressions[0];
    if (!Expression.isExpression(acc))
        acc = Expression.fromJSLoose(acc);
    for (var i = 1; i < n; i++)
        acc = acc[op](expressions[i]);
    return acc;
}
export var Expression = (function () {
    function Expression(parameters, dummy) {
        if (dummy === void 0) { dummy = null; }
        this.op = parameters.op;
        if (dummy !== dummyObject) {
            throw new TypeError("can not call `new Expression` directly use Expression.fromJS instead");
        }
        if (parameters.simple)
            this.simple = true;
    }
    Expression.isExpression = function (candidate) {
        return isInstanceOf(candidate, Expression);
    };
    Expression.expressionLookupFromJS = function (expressionJSs) {
        var expressions = Object.create(null);
        for (var name in expressionJSs) {
            if (!hasOwnProperty(expressionJSs, name))
                continue;
            expressions[name] = Expression.fromJSLoose(expressionJSs[name]);
        }
        return expressions;
    };
    Expression.expressionLookupToJS = function (expressions) {
        var expressionsJSs = {};
        for (var name in expressions) {
            if (!hasOwnProperty(expressions, name))
                continue;
            expressionsJSs[name] = expressions[name].toJS();
        }
        return expressionsJSs;
    };
    Expression.parse = function (str, timezone) {
        if (str[0] === '{' && str[str.length - 1] === '}') {
            return Expression.fromJS(JSON.parse(str));
        }
        var original = Expression.defaultParserTimezone;
        if (timezone)
            Expression.defaultParserTimezone = timezone;
        try {
            return Expression.expressionParser.parse(str);
        }
        catch (e) {
            throw new Error("Expression parse error: " + e.message + " on '" + str + "'");
        }
        finally {
            Expression.defaultParserTimezone = original;
        }
    };
    Expression.parseSQL = function (str, timezone) {
        var original = Expression.defaultParserTimezone;
        if (timezone)
            Expression.defaultParserTimezone = timezone;
        try {
            return Expression.plyqlParser.parse(str);
        }
        catch (e) {
            throw new Error("SQL parse error: " + e.message + " on '" + str + "'");
        }
        finally {
            Expression.defaultParserTimezone = original;
        }
    };
    Expression.fromJSLoose = function (param) {
        var expressionJS;
        switch (typeof param) {
            case 'undefined':
                throw new Error('must have an expression');
            case 'object':
                if (param === null) {
                    return Expression.NULL;
                }
                else if (Expression.isExpression(param)) {
                    return param;
                }
                else if (isImmutableClass(param)) {
                    if (param.constructor.type) {
                        expressionJS = { op: 'literal', value: param };
                    }
                    else {
                        throw new Error("unknown object");
                    }
                }
                else if (param.op) {
                    expressionJS = param;
                }
                else if (param.toISOString) {
                    expressionJS = { op: 'literal', value: new Date(param) };
                }
                else if (Array.isArray(param)) {
                    expressionJS = { op: 'literal', value: Set.fromJS(param) };
                }
                else if (hasOwnProperty(param, 'start') && hasOwnProperty(param, 'end')) {
                    expressionJS = { op: 'literal', value: Range.fromJS(param) };
                }
                else {
                    throw new Error('unknown parameter');
                }
                break;
            case 'number':
            case 'boolean':
                expressionJS = { op: 'literal', value: param };
                break;
            case 'string':
                return Expression.parse(param);
            default:
                throw new Error("unrecognizable expression");
        }
        return Expression.fromJS(expressionJS);
    };
    Expression.inOrIs = function (lhs, value) {
        var literal = new LiteralExpression({
            op: 'literal',
            value: value
        });
        var literalType = literal.type;
        var returnExpression = null;
        if (literalType === 'NUMBER_RANGE' || literalType === 'TIME_RANGE' || literalType === 'STRING_RANGE' || isSetType(literalType)) {
            returnExpression = lhs.in(literal);
        }
        else {
            returnExpression = lhs.is(literal);
        }
        return returnExpression.simplify();
    };
    Expression.jsNullSafetyUnary = function (inputJS, ifNotNull) {
        return "(_=" + inputJS + ",(_==null?null:" + ifNotNull('_') + "))";
    };
    Expression.jsNullSafetyBinary = function (lhs, rhs, combine, lhsCantBeNull, rhsCantBeNull) {
        if (lhsCantBeNull) {
            if (rhsCantBeNull) {
                return "(" + combine(lhs, rhs) + ")";
            }
            else {
                return "(_=" + rhs + ",(_==null)?null:(" + combine(lhs, '_') + "))";
            }
        }
        else {
            if (rhsCantBeNull) {
                return "(_=" + lhs + ",(_==null)?null:(" + combine('_', rhs) + "))";
            }
            else {
                return "(_=" + rhs + ",_2=" + lhs + ",(_==null||_2==null)?null:(" + combine('_', '_2') + ")";
            }
        }
    };
    Expression.and = function (expressions) {
        return chainVia('and', expressions, Expression.TRUE);
    };
    Expression.or = function (expressions) {
        return chainVia('or', expressions, Expression.FALSE);
    };
    Expression.add = function (expressions) {
        return chainVia('add', expressions, Expression.ZERO);
    };
    Expression.subtract = function (expressions) {
        return chainVia('subtract', expressions, Expression.ZERO);
    };
    Expression.multiply = function (expressions) {
        return chainVia('multiply', expressions, Expression.ONE);
    };
    Expression.power = function (expressions) {
        return chainVia('power', expressions, Expression.ZERO);
    };
    Expression.concat = function (expressions) {
        return chainVia('concat', expressions, Expression.EMPTY_STRING);
    };
    Expression.register = function (ex) {
        var op = ex.name.replace('Expression', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        Expression.classMap[op] = ex;
    };
    Expression.fromJS = function (expressionJS) {
        if (!hasOwnProperty(expressionJS, "op")) {
            throw new Error("op must be defined");
        }
        var op = expressionJS.op;
        if (typeof op !== "string") {
            throw new Error("op must be a string");
        }
        var ClassFn = Expression.classMap[op];
        if (!ClassFn) {
            throw new Error("unsupported expression op '" + op + "'");
        }
        return ClassFn.fromJS(expressionJS);
    };
    Expression.prototype._ensureOp = function (op) {
        if (!this.op) {
            this.op = op;
            return;
        }
        if (this.op !== op) {
            throw new TypeError("incorrect expression op '" + this.op + "' (needs to be: '" + op + "')");
        }
    };
    Expression.prototype.valueOf = function () {
        var value = { op: this.op };
        if (this.simple)
            value.simple = true;
        return value;
    };
    Expression.prototype.toJS = function () {
        return {
            op: this.op
        };
    };
    Expression.prototype.toJSON = function () {
        return this.toJS();
    };
    Expression.prototype.toString = function (indent) {
        return 'BaseExpression';
    };
    Expression.prototype.equals = function (other) {
        return Expression.isExpression(other) &&
            this.op === other.op &&
            this.type === other.type;
    };
    Expression.prototype.canHaveType = function (wantedType) {
        var type = this.type;
        if (!type)
            return true;
        if (wantedType === 'SET') {
            return isSetType(type);
        }
        else {
            return type === wantedType;
        }
    };
    Expression.prototype.expressionCount = function () {
        return 1;
    };
    Expression.prototype.isOp = function (op) {
        return this.op === op;
    };
    Expression.prototype.containsOp = function (op) {
        return this.some(function (ex) { return ex.isOp(op) || null; });
    };
    Expression.prototype.hasExternal = function () {
        return this.some(function (ex) {
            if (ex instanceof ExternalExpression)
                return true;
            if (ex instanceof RefExpression)
                return ex.isRemote();
            return null;
        });
    };
    Expression.prototype.getBaseExternals = function () {
        var externals = [];
        this.forEach(function (ex) {
            if (ex instanceof ExternalExpression)
                externals.push(ex.external.getBase());
        });
        return External.deduplicateExternals(externals);
    };
    Expression.prototype.getRawExternals = function () {
        var externals = [];
        this.forEach(function (ex) {
            if (ex instanceof ExternalExpression)
                externals.push(ex.external.getRaw());
        });
        return External.deduplicateExternals(externals);
    };
    Expression.prototype.getFreeReferences = function () {
        var freeReferences = [];
        this.forEach(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression && nestDiff <= ex.nest) {
                freeReferences.push(repeat('^', ex.nest - nestDiff) + ex.name);
            }
        });
        return deduplicateSort(freeReferences);
    };
    Expression.prototype.getFreeReferenceIndexes = function () {
        var freeReferenceIndexes = [];
        this.forEach(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression && nestDiff <= ex.nest) {
                freeReferenceIndexes.push(index);
            }
        });
        return freeReferenceIndexes;
    };
    Expression.prototype.incrementNesting = function (by) {
        if (by === void 0) { by = 1; }
        var freeReferenceIndexes = this.getFreeReferenceIndexes();
        if (freeReferenceIndexes.length === 0)
            return this;
        return this.substitute(function (ex, index) {
            if (ex instanceof RefExpression && freeReferenceIndexes.indexOf(index) !== -1) {
                return ex.incrementNesting(by);
            }
            return null;
        });
    };
    Expression.prototype.simplify = function () {
        return this;
    };
    Expression.prototype.every = function (iter, thisArg) {
        return this._everyHelper(iter, thisArg, { index: 0 }, 0, 0);
    };
    Expression.prototype._everyHelper = function (iter, thisArg, indexer, depth, nestDiff) {
        var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
        if (pass != null) {
            return pass;
        }
        else {
            indexer.index++;
        }
        return true;
    };
    Expression.prototype.some = function (iter, thisArg) {
        var _this = this;
        return !this.every(function (ex, index, depth, nestDiff) {
            var v = iter.call(_this, ex, index, depth, nestDiff);
            return (v == null) ? null : !v;
        }, thisArg);
    };
    Expression.prototype.forEach = function (iter, thisArg) {
        var _this = this;
        this.every(function (ex, index, depth, nestDiff) {
            iter.call(_this, ex, index, depth, nestDiff);
            return null;
        }, thisArg);
    };
    Expression.prototype.substitute = function (substitutionFn, thisArg) {
        return this._substituteHelper(substitutionFn, thisArg, { index: 0 }, 0, 0);
    };
    Expression.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
        if (sub) {
            indexer.index += this.expressionCount();
            return sub;
        }
        else {
            indexer.index++;
        }
        return this;
    };
    Expression.prototype.substituteAction = function (actionMatchFn, actionSubstitutionFn, options, thisArg) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return this.substitute(function (ex) {
            if (ex instanceof ChainExpression) {
                var actions = ex.actions;
                for (var i = 0; i < actions.length; i++) {
                    var action = actions[i];
                    if (actionMatchFn.call(_this, action)) {
                        var newEx = actionSubstitutionFn.call(_this, ex.headActions(i), action);
                        for (var j = i + 1; j < actions.length; j++)
                            newEx = newEx.performAction(actions[j]);
                        if (options.onceInChain)
                            return newEx;
                        return newEx.substituteAction(actionMatchFn, actionSubstitutionFn, options, _this);
                    }
                }
            }
            return null;
        }, thisArg);
    };
    Expression.prototype.getJSFn = function (datumVar) {
        if (datumVar === void 0) { datumVar = 'd[]'; }
        var type = this.type;
        var jsEx = this.getJS(datumVar);
        var body;
        if (type === 'NUMBER' || type === 'NUMBER_RANGE' || type === 'TIME') {
            body = "_=" + jsEx + ";return isNaN(_)?null:_";
        }
        else {
            body = "return " + jsEx + ";";
        }
        return "function(" + datumVar.replace('[]', '') + "){var _,_2;" + body + "}";
    };
    Expression.prototype.extractFromAnd = function (matchFn) {
        if (this.type !== 'BOOLEAN')
            return null;
        if (matchFn(this)) {
            return {
                extract: this,
                rest: Expression.TRUE
            };
        }
        else {
            return {
                extract: Expression.TRUE,
                rest: this
            };
        }
    };
    Expression.prototype.breakdownByDataset = function (tempNamePrefix) {
        var nameIndex = 0;
        var singleDatasetActions = [];
        var externals = this.getBaseExternals();
        if (externals.length < 2) {
            throw new Error('not a multiple dataset expression');
        }
        var combine = this.substitute(function (ex) {
            var externals = ex.getBaseExternals();
            if (externals.length !== 1)
                return null;
            var existingApply = SimpleArray.find(singleDatasetActions, function (apply) { return apply.expression.equals(ex); });
            var tempName;
            if (existingApply) {
                tempName = existingApply.name;
            }
            else {
                tempName = tempNamePrefix + (nameIndex++);
                singleDatasetActions.push(new ApplyAction({
                    action: 'apply',
                    name: tempName,
                    expression: ex
                }));
            }
            return new RefExpression({
                op: 'ref',
                name: tempName,
                nest: 0
            });
        });
        return {
            combineExpression: combine,
            singleDatasetActions: singleDatasetActions
        };
    };
    Expression.prototype.actionize = function (containingAction) {
        return null;
    };
    Expression.prototype.getExpressionPattern = function (actionType) {
        var actions = this.actionize(actionType);
        return actions ? actions.map(function (action) { return action.expression; }) : null;
    };
    Expression.prototype.firstAction = function () {
        return null;
    };
    Expression.prototype.lastAction = function () {
        return null;
    };
    Expression.prototype.headActions = function (n) {
        return this;
    };
    Expression.prototype.popAction = function () {
        return null;
    };
    Expression.prototype.getLiteralValue = function () {
        return null;
    };
    Expression.prototype.bumpStringLiteralToTime = function () {
        return this;
    };
    Expression.prototype.bumpStringLiteralToSetString = function () {
        return this;
    };
    Expression.prototype.upgradeToType = function (targetType) {
        return this;
    };
    Expression.prototype.performAction = function (action, markSimple) {
        return this.performActions([action], markSimple);
    };
    Expression.prototype.performActions = function (actions, markSimple) {
        if (!actions.length)
            return this;
        return new ChainExpression({
            expression: this,
            actions: actions,
            simple: Boolean(markSimple)
        });
    };
    Expression.prototype._performMultiAction = function (action, exs) {
        if (!exs.length)
            throw new Error(action + " action must have at least one argument");
        var ret = this;
        for (var _i = 0, exs_1 = exs; _i < exs_1.length; _i++) {
            var ex = exs_1[_i];
            if (!Expression.isExpression(ex))
                ex = Expression.fromJSLoose(ex);
            var ActionConstructor = Action.classMap[action];
            ret = ret.performAction(new ActionConstructor({ expression: ex }));
        }
        return ret;
    };
    Expression.prototype.add = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('add', exs);
    };
    Expression.prototype.subtract = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('subtract', exs);
    };
    Expression.prototype.negate = function () {
        return Expression.ZERO.subtract(this);
    };
    Expression.prototype.multiply = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('multiply', exs);
    };
    Expression.prototype.divide = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('divide', exs);
    };
    Expression.prototype.reciprocate = function () {
        return Expression.ONE.divide(this);
    };
    Expression.prototype.sqrt = function () {
        return this.power(0.5);
    };
    Expression.prototype.power = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('power', exs);
    };
    Expression.prototype.fallback = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new FallbackAction({ expression: ex }));
    };
    Expression.prototype.is = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new IsAction({ expression: ex }));
    };
    Expression.prototype.isnt = function (ex) {
        return this.is(ex).not();
    };
    Expression.prototype.lessThan = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new LessThanAction({ expression: ex }));
    };
    Expression.prototype.lessThanOrEqual = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new LessThanOrEqualAction({ expression: ex }));
    };
    Expression.prototype.greaterThan = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new GreaterThanAction({ expression: ex }));
    };
    Expression.prototype.greaterThanOrEqual = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new GreaterThanOrEqualAction({ expression: ex }));
    };
    Expression.prototype.contains = function (ex, compare) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        if (compare)
            compare = getString(compare);
        return this.performAction(new ContainsAction({ expression: ex, compare: compare }));
    };
    Expression.prototype.match = function (re) {
        return this.performAction(new MatchAction({ regexp: getString(re) }));
    };
    Expression.prototype.in = function (ex, snd) {
        if (arguments.length === 2) {
            ex = getValue(ex);
            snd = getValue(snd);
            if (typeof ex === 'string') {
                var parse = parseISODate(ex, Expression.defaultParserTimezone);
                if (parse)
                    ex = parse;
            }
            if (typeof snd === 'string') {
                var parse = parseISODate(snd, Expression.defaultParserTimezone);
                if (parse)
                    snd = parse;
            }
            if (typeof ex === 'number' && typeof snd === 'number') {
                ex = new NumberRange({ start: ex, end: snd });
            }
            else if (ex.toISOString && snd.toISOString) {
                ex = new TimeRange({ start: ex, end: snd });
            }
            else if (typeof ex === 'string' && typeof snd === 'string') {
                ex = new StringRange({ start: ex, end: snd });
            }
            else {
                throw new Error('uninterpretable IN parameters');
            }
        }
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new InAction({ expression: ex }));
    };
    Expression.prototype.overlap = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.bumpStringLiteralToSetString().performAction(new OverlapAction({ expression: ex.bumpStringLiteralToSetString() }));
    };
    Expression.prototype.not = function () {
        return this.performAction(new NotAction({}));
    };
    Expression.prototype.and = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('and', exs);
    };
    Expression.prototype.or = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('or', exs);
    };
    Expression.prototype.substr = function (position, length) {
        return this.performAction(new SubstrAction({ position: getNumber(position), length: getNumber(length) }));
    };
    Expression.prototype.extract = function (re) {
        return this.performAction(new ExtractAction({ regexp: getString(re) }));
    };
    Expression.prototype.concat = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('concat', exs);
    };
    Expression.prototype.lookup = function (lookup) {
        return this.performAction(new LookupAction({ lookup: getString(lookup) }));
    };
    Expression.prototype.indexOf = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new IndexOfAction({ expression: ex }));
    };
    Expression.prototype.transformCase = function (transformType) {
        return this.performAction(new TransformCaseAction({ transformType: getString(transformType) }));
    };
    Expression.prototype.customTransform = function (custom, outputType) {
        if (!custom)
            throw new Error("Must provide an extraction function name for custom transform");
        var outputType = outputType !== undefined ? getString(outputType) : null;
        return this.performAction(new CustomTransformAction({ custom: getString(custom), outputType: outputType }));
    };
    Expression.prototype.numberBucket = function (size, offset) {
        if (offset === void 0) { offset = 0; }
        return this.performAction(new NumberBucketAction({ size: getNumber(size), offset: getNumber(offset) }));
    };
    Expression.prototype.absolute = function () {
        return this.performAction(new AbsoluteAction({}));
    };
    Expression.prototype.length = function () {
        return this.performAction(new LengthAction({}));
    };
    Expression.prototype.timeBucket = function (duration, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeBucketAction({ duration: duration, timezone: timezone }));
    };
    Expression.prototype.timeFloor = function (duration, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeFloorAction({ duration: duration, timezone: timezone }));
    };
    Expression.prototype.timeShift = function (duration, step, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeShiftAction({ duration: duration, step: getNumber(step), timezone: timezone }));
    };
    Expression.prototype.timeRange = function (duration, step, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeRangeAction({ duration: duration, step: getNumber(step), timezone: timezone }));
    };
    Expression.prototype.timePart = function (part, timezone) {
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimePartAction({ part: getString(part), timezone: timezone }));
    };
    Expression.prototype.cast = function (outputType) {
        return this.performAction(new CastAction({ outputType: getString(outputType) }));
    };
    Expression.prototype.cardinality = function () {
        return this.performAction(new CardinalityAction({}));
    };
    Expression.prototype.filter = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new FilterAction({ expression: ex }));
    };
    Expression.prototype.split = function (splits, name, dataName) {
        if (arguments.length === 3 ||
            (arguments.length === 2 && splits && (typeof splits === 'string' || typeof splits.op === 'string'))) {
            name = getString(name);
            var realSplits = Object.create(null);
            realSplits[name] = splits;
            splits = realSplits;
        }
        else {
            dataName = name;
        }
        var parsedSplits = Object.create(null);
        for (var k in splits) {
            if (!hasOwnProperty(splits, k))
                continue;
            var ex = splits[k];
            parsedSplits[k] = Expression.isExpression(ex) ? ex : Expression.fromJSLoose(ex);
        }
        dataName = dataName ? getString(dataName) : getDataName(this);
        if (!dataName)
            throw new Error("could not guess data name in `split`, please provide one explicitly");
        return this.performAction(new SplitAction({ splits: parsedSplits, dataName: dataName }));
    };
    Expression.prototype.apply = function (name, ex) {
        if (arguments.length < 2)
            throw new Error('invalid arguments to .apply, did you forget to specify a name?');
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new ApplyAction({ name: getString(name), expression: ex }));
    };
    Expression.prototype.sort = function (ex, direction) {
        if (direction === void 0) { direction = 'ascending'; }
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new SortAction({ expression: ex, direction: getString(direction) }));
    };
    Expression.prototype.limit = function (limit) {
        return this.performAction(new LimitAction({ limit: getNumber(limit) }));
    };
    Expression.prototype.select = function () {
        var attributes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            attributes[_i - 0] = arguments[_i];
        }
        attributes = attributes.map(getString);
        return this.performAction(new SelectAction({ attributes: attributes }));
    };
    Expression.prototype.count = function () {
        if (arguments.length)
            throw new Error('.count() should not have arguments, did you want to .filter().count()?');
        return this.performAction(new CountAction({}));
    };
    Expression.prototype.sum = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new SumAction({ expression: ex }));
    };
    Expression.prototype.min = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new MinAction({ expression: ex }));
    };
    Expression.prototype.max = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new MaxAction({ expression: ex }));
    };
    Expression.prototype.average = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new AverageAction({ expression: ex }));
    };
    Expression.prototype.countDistinct = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new CountDistinctAction({ expression: ex }));
    };
    Expression.prototype.quantile = function (ex, quantile) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new QuantileAction({ expression: ex, quantile: getNumber(quantile) }));
    };
    Expression.prototype.custom = function (custom) {
        return this.performAction(new CustomAggregateAction({ custom: getString(custom) }));
    };
    Expression.prototype.customAggregate = function (custom) {
        return this.performAction(new CustomAggregateAction({ custom: getString(custom) }));
    };
    Expression.prototype.join = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new JoinAction({ expression: ex }));
    };
    Expression.prototype.defineEnvironment = function (environment) {
        if (!environment.timezone)
            environment = { timezone: Timezone.UTC };
        if (typeof environment.timezone === 'string')
            environment = { timezone: Timezone.fromJS(environment.timezone) };
        return this.substituteAction(function (action) { return action.needsEnvironment(); }, function (preEx, action) { return preEx.performAction(action.defineEnvironment(environment)); });
    };
    Expression.prototype.referenceCheck = function (context) {
        return this.referenceCheckInTypeContext(getFullTypeFromDatum(context));
    };
    Expression.prototype.definedInTypeContext = function (typeContext) {
        try {
            var alterations = {};
            this._fillRefSubstitutions(typeContext, { index: 0 }, alterations);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    Expression.prototype.referenceCheckInTypeContext = function (typeContext) {
        var alterations = {};
        this._fillRefSubstitutions(typeContext, { index: 0 }, alterations);
        if (emptyLookup(alterations))
            return this;
        return this.substitute(function (ex, index) { return alterations[index] || null; });
    };
    Expression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        return typeContext;
    };
    Expression.prototype.resolve = function (context, ifNotFound) {
        if (ifNotFound === void 0) { ifNotFound = 'throw'; }
        var expressions = Object.create(null);
        for (var k in context) {
            if (!hasOwnProperty(context, k))
                continue;
            var value = context[k];
            expressions[k] = External.isExternal(value) ?
                new ExternalExpression({ external: value }) :
                new LiteralExpression({ value: value });
        }
        return this.resolveWithExpressions(expressions, ifNotFound);
    };
    Expression.prototype.resolveWithExpressions = function (expressions, ifNotFound) {
        if (ifNotFound === void 0) { ifNotFound = 'throw'; }
        return this.substitute(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression) {
                var nest = ex.nest, ignoreCase = ex.ignoreCase, name = ex.name;
                if (nestDiff === nest) {
                    var foundExpression = null;
                    var valueFound = false;
                    var property = ignoreCase ? RefExpression.findPropertyCI(expressions, name) : RefExpression.findProperty(expressions, name);
                    if (property != null) {
                        foundExpression = expressions[property];
                        valueFound = true;
                    }
                    else {
                        valueFound = false;
                    }
                    if (valueFound) {
                        return foundExpression;
                    }
                    else if (ifNotFound === 'throw') {
                        throw new Error("could not resolve " + ex + " because is was not in the context");
                    }
                    else if (ifNotFound === 'null') {
                        return Expression.NULL;
                    }
                    else if (ifNotFound === 'leave') {
                        return ex;
                    }
                }
                else if (nestDiff < nest) {
                    throw new Error("went too deep during resolve on: " + ex);
                }
            }
            return null;
        });
    };
    Expression.prototype.resolved = function () {
        return this.every(function (ex) {
            return (ex instanceof RefExpression) ? ex.nest === 0 : null;
        });
    };
    Expression.prototype.contained = function () {
        return this.every(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression) {
                var nest = ex.nest;
                return nestDiff >= nest;
            }
            return null;
        });
    };
    Expression.prototype.decomposeAverage = function (countEx) {
        return this.substituteAction(function (action) {
            return action.action === 'average';
        }, function (preEx, action) {
            var expression = action.expression;
            return preEx.sum(expression).divide(countEx ? preEx.sum(countEx) : preEx.count());
        });
    };
    Expression.prototype.distribute = function () {
        return this.substituteAction(function (action) {
            return action.canDistribute();
        }, function (preEx, action) {
            var distributed = action.distribute(preEx);
            if (!distributed)
                throw new Error('distribute returned null');
            return distributed;
        });
    };
    Expression.prototype._initialPrepare = function (context, environment) {
        return this.defineEnvironment(environment)
            .referenceCheck(context)
            .resolve(context)
            .simplify();
    };
    Expression.prototype.simulate = function (context, environment) {
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        var readyExpression = this._initialPrepare(context, environment);
        if (readyExpression instanceof ExternalExpression) {
            readyExpression = readyExpression.unsuppress();
        }
        return readyExpression._computeResolvedSimulate(true, []);
    };
    Expression.prototype.simulateQueryPlan = function (context, environment) {
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        if (!datumHasExternal(context) && !this.hasExternal())
            return [];
        var readyExpression = this._initialPrepare(context, environment);
        if (readyExpression instanceof ExternalExpression) {
            readyExpression = readyExpression.unsuppress();
        }
        var simulatedQueries = [];
        readyExpression._computeResolvedSimulate(true, simulatedQueries);
        return simulatedQueries;
    };
    Expression.prototype.compute = function (context, environment) {
        var _this = this;
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        if (!datumHasExternal(context) && !this.hasExternal()) {
            return Q.fcall(function () {
                var referenceChecked = _this.defineEnvironment(environment).referenceCheck(context);
                return referenceChecked.getFn()(context, null);
            });
        }
        return introspectDatum(context)
            .then(function (introspectedContext) {
            var readyExpression = _this._initialPrepare(introspectedContext, environment);
            if (readyExpression instanceof ExternalExpression) {
                readyExpression = readyExpression.unsuppress();
            }
            return readyExpression._computeResolved(true);
        });
    };
    Expression.defaultParserTimezone = Timezone.UTC;
    Expression.classMap = {};
    return Expression;
}());
