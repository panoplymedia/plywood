var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { Expression, r } from "../expressions/baseExpression";
import { unwrapSetType } from "../datatypes/common";
import { hasOwnProperty } from "../helper/utils";
import { immutableLookupsEqual } from "immutable-class";
import { isSetType } from "../datatypes/common";
export var SplitAction = (function (_super) {
    __extends(SplitAction, _super);
    function SplitAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var splits = parameters.splits;
        if (!splits)
            throw new Error('must have splits');
        this.splits = splits;
        this.keys = Object.keys(splits).sort();
        if (!this.keys.length)
            throw new Error('must have at least one split');
        this.dataName = parameters.dataName;
        this._ensureAction("split");
    }
    SplitAction.fromJS = function (parameters) {
        var value = {
            action: parameters.action
        };
        var splits;
        if (parameters.expression && parameters.name) {
            splits = (_a = {}, _a[parameters.name] = parameters.expression, _a);
        }
        else {
            splits = parameters.splits;
        }
        value.splits = Expression.expressionLookupFromJS(splits);
        value.dataName = parameters.dataName;
        return new SplitAction(value);
        var _a;
    };
    SplitAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.splits = this.splits;
        value.dataName = this.dataName;
        return value;
    };
    SplitAction.prototype.toJS = function () {
        var splits = this.splits;
        var js = _super.prototype.toJS.call(this);
        if (this.isMultiSplit()) {
            js.splits = Expression.expressionLookupToJS(splits);
        }
        else {
            for (var name in splits) {
                js.name = name;
                js.expression = splits[name].toJS();
            }
        }
        js.dataName = this.dataName;
        return js;
    };
    SplitAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            immutableLookupsEqual(this.splits, other.splits) &&
            this.dataName === other.dataName;
    };
    SplitAction.prototype._toStringParameters = function (expressionString) {
        if (this.isMultiSplit()) {
            var splits = this.splits;
            var splitStrings = [];
            for (var name in splits) {
                splitStrings.push(name + ": " + splits[name]);
            }
            return [splitStrings.join(', '), this.dataName];
        }
        else {
            return [this.firstSplitExpression().toString(), this.firstSplitName(), this.dataName];
        }
    };
    SplitAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    SplitAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    SplitAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        var newDatasetType = {};
        this.mapSplits(function (name, expression) {
            var fullType = expression._fillRefSubstitutions(typeContext, indexer, alterations);
            newDatasetType[name] = {
                type: unwrapSetType(fullType.type)
            };
        });
        newDatasetType[this.dataName] = typeContext;
        return {
            parent: typeContext.parent,
            type: 'DATASET',
            datasetType: newDatasetType,
            remote: false
        };
    };
    SplitAction.prototype.getFn = function (inputType, inputFn) {
        var dataName = this.dataName;
        var splitFns = this.mapSplitExpressions(function (ex) { return ex.getFn(); });
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.split(splitFns, dataName) : null;
        };
    };
    SplitAction.prototype.getSQL = function (inputType, inputSQL, dialect) {
        var groupBys = this.mapSplits(function (name, expression) { return expression.getSQL(dialect); });
        return "GROUP BY " + groupBys.join(', ');
    };
    SplitAction.prototype.getSelectSQL = function (dialect) {
        return this.mapSplits(function (name, expression) { return (expression.getSQL(dialect) + " AS " + dialect.escapeName(name)); });
    };
    SplitAction.prototype.getShortGroupBySQL = function () {
        return 'GROUP BY ' + Object.keys(this.splits).map(function (d, i) { return i + 1; }).join(', ');
    };
    SplitAction.prototype.expressionCount = function () {
        var count = 0;
        this.mapSplits(function (k, expression) {
            count += expression.expressionCount();
        });
        return count;
    };
    SplitAction.prototype.fullyDefined = function () {
        return false;
    };
    SplitAction.prototype.simplify = function () {
        if (this.simple)
            return this;
        var simpleSplits = this.mapSplitExpressions(function (ex) { return ex.simplify(); });
        var value = this.valueOf();
        value.splits = simpleSplits;
        value.simple = true;
        return new SplitAction(value);
    };
    SplitAction.prototype.getExpressions = function () {
        return this.mapSplits(function (name, ex) { return ex; });
    };
    SplitAction.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var nestDiffNext = nestDiff + 1;
        var hasChanged = false;
        var subSplits = this.mapSplitExpressions(function (ex) {
            var subExpression = ex._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiffNext);
            if (subExpression !== ex)
                hasChanged = true;
            return subExpression;
        });
        if (!hasChanged)
            return this;
        var value = this.valueOf();
        value.splits = subSplits;
        return new SplitAction(value);
    };
    SplitAction.prototype.isNester = function () {
        return true;
    };
    SplitAction.prototype.numSplits = function () {
        return this.keys.length;
    };
    SplitAction.prototype.isMultiSplit = function () {
        return this.numSplits() > 1;
    };
    SplitAction.prototype.mapSplits = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var res = [];
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            var v = fn(k, splits[k]);
            if (typeof v !== 'undefined')
                res.push(v);
        }
        return res;
    };
    SplitAction.prototype.mapSplitExpressions = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var ret = Object.create(null);
        for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
            var key = keys_2[_i];
            ret[key] = fn(splits[key], key);
        }
        return ret;
    };
    SplitAction.prototype.transformExpressions = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var newSplits = Object.create(null);
        var changed = false;
        for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
            var key = keys_3[_i];
            var ex = splits[key];
            var transformed = fn(ex, key);
            if (transformed !== ex)
                changed = true;
            newSplits[key] = transformed;
        }
        if (!changed)
            return this;
        var value = this.valueOf();
        value.splits = newSplits;
        return new SplitAction(value);
    };
    SplitAction.prototype.firstSplitName = function () {
        return this.keys[0];
    };
    SplitAction.prototype.firstSplitExpression = function () {
        return this.splits[this.firstSplitName()];
    };
    SplitAction.prototype.filterFromDatum = function (datum) {
        return Expression.and(this.mapSplits(function (name, expression) {
            if (isSetType(expression.type)) {
                return r(datum[name]).in(expression);
            }
            else {
                return expression.is(r(datum[name]));
            }
        })).simplify();
    };
    SplitAction.prototype.hasKey = function (key) {
        return hasOwnProperty(this.splits, key);
    };
    SplitAction.prototype.isLinear = function () {
        var _a = this, splits = _a.splits, keys = _a.keys;
        for (var _i = 0, keys_4 = keys; _i < keys_4.length; _i++) {
            var k = keys_4[_i];
            var split = splits[k];
            if (isSetType(split.type))
                return false;
        }
        return true;
    };
    SplitAction.prototype.maxBucketNumber = function () {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var num = 1;
        for (var _i = 0, keys_5 = keys; _i < keys_5.length; _i++) {
            var key = keys_5[_i];
            num *= splits[key].maxPossibleSplitValues();
        }
        return num;
    };
    SplitAction.prototype.isAggregate = function () {
        return true;
    };
    return SplitAction;
}(Action));
Action.register(SplitAction);