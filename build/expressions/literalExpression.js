var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import * as Q from 'q';
import { parseISODate } from "chronoshift";
import { isImmutableClass } from "immutable-class";
import { r, Expression } from "./baseExpression";
import { hasOwnProperty } from "../helper/utils";
import { Dataset, Set, TimeRange } from "../datatypes/index";
import { isSetType, valueFromJS, getValueType } from "../datatypes/common";
export var LiteralExpression = (function (_super) {
    __extends(LiteralExpression, _super);
    function LiteralExpression(parameters) {
        _super.call(this, parameters, dummyObject);
        var value = parameters.value;
        this.value = value;
        this._ensureOp("literal");
        if (typeof this.value === 'undefined') {
            throw new TypeError("must have a `value`");
        }
        this.type = getValueType(value);
        this.simple = true;
    }
    LiteralExpression.fromJS = function (parameters) {
        var value = {
            op: parameters.op,
            type: parameters.type
        };
        if (!hasOwnProperty(parameters, 'value'))
            throw new Error('literal expression must have value');
        var v = parameters.value;
        if (isImmutableClass(v)) {
            value.value = v;
        }
        else {
            value.value = valueFromJS(v, parameters.type);
        }
        return new LiteralExpression(value);
    };
    LiteralExpression.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.value = this.value;
        if (this.type)
            value.type = this.type;
        return value;
    };
    LiteralExpression.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        if (this.value && this.value.toJS) {
            js.value = this.value.toJS();
            js.type = isSetType(this.type) ? 'SET' : this.type;
        }
        else {
            js.value = this.value;
            if (this.type === 'TIME')
                js.type = 'TIME';
        }
        return js;
    };
    LiteralExpression.prototype.toString = function () {
        var value = this.value;
        if (value instanceof Dataset && value.basis()) {
            return 'ply()';
        }
        else if (this.type === 'STRING') {
            return JSON.stringify(value);
        }
        else {
            return String(value);
        }
    };
    LiteralExpression.prototype.getFn = function () {
        var value = this.value;
        return function () { return value; };
    };
    LiteralExpression.prototype.getJS = function (datumVar) {
        return JSON.stringify(this.value);
    };
    LiteralExpression.prototype.getSQL = function (dialect) {
        var value = this.value;
        if (value === null)
            return 'NULL';
        switch (this.type) {
            case 'STRING':
                return dialect.escapeLiteral(value);
            case 'BOOLEAN':
                return dialect.booleanToSQL(value);
            case 'NUMBER':
                return dialect.numberToSQL(value);
            case 'NUMBER_RANGE':
                return "" + dialect.numberToSQL(value.start);
            case 'TIME':
                return dialect.timeToSQL(value);
            case 'TIME_RANGE':
                return "" + dialect.timeToSQL(value.start);
            case 'STRING_RANGE':
                return dialect.escapeLiteral(value.start);
            case 'SET/STRING':
            case 'SET/NUMBER':
                return '(' + value.elements.map(function (v) { return typeof v === 'number' ? v : dialect.escapeLiteral(v); }).join(',') + ')';
            case 'SET/NUMBER_RANGE':
            case 'SET/TIME_RANGE':
                return 'FALSE';
            default:
                throw new Error("currently unsupported type: " + this.type);
        }
    };
    LiteralExpression.prototype.equals = function (other) {
        if (!_super.prototype.equals.call(this, other) || this.type !== other.type)
            return false;
        if (this.value) {
            if (this.value.equals) {
                return this.value.equals(other.value);
            }
            else if (this.value.toISOString && other.value.toISOString) {
                return this.value.valueOf() === other.value.valueOf();
            }
            else {
                return this.value === other.value;
            }
        }
        else {
            return this.value === other.value;
        }
    };
    LiteralExpression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        if (this.type === 'DATASET') {
            var newTypeContext = this.value.getFullType();
            newTypeContext.parent = typeContext;
            return newTypeContext;
        }
        else {
            return { type: this.type };
        }
    };
    LiteralExpression.prototype.getLiteralValue = function () {
        return this.value;
    };
    LiteralExpression.prototype._computeResolvedSimulate = function () {
        return this.value;
    };
    LiteralExpression.prototype._computeResolved = function () {
        return Q(this.value);
    };
    LiteralExpression.prototype.maxPossibleSplitValues = function () {
        var value = this.value;
        return Set.isSet(value) ? value.size() : 1;
    };
    LiteralExpression.prototype.bumpStringLiteralToTime = function () {
        if (this.type !== 'STRING')
            return this;
        var parse = parseISODate(this.value, Expression.defaultParserTimezone);
        if (!parse)
            throw new Error("could not parse '" + this.value + "' as time");
        return r(parse);
    };
    LiteralExpression.prototype.bumpStringLiteralToSetString = function () {
        if (this.type !== 'STRING')
            return this;
        return r(Set.fromJS([this.value]));
    };
    LiteralExpression.prototype.upgradeToType = function (targetType) {
        var _a = this, type = _a.type, value = _a.value;
        if (type === targetType || targetType !== 'TIME')
            return this;
        if (type === 'STRING') {
            var parse = parseISODate(value, Expression.defaultParserTimezone);
            return parse ? r(parse) : this;
        }
        else if (type === 'STRING_RANGE') {
            var parseStart = parseISODate(value.start, Expression.defaultParserTimezone);
            var parseEnd = parseISODate(value.end, Expression.defaultParserTimezone);
            if (parseStart || parseEnd) {
                return new LiteralExpression({
                    type: "TIME_RANGE",
                    value: TimeRange.fromJS({
                        start: parseStart, end: parseEnd, bounds: '[]'
                    })
                });
            }
        }
        return this;
    };
    return LiteralExpression;
}(Expression));
Expression.NULL = new LiteralExpression({ value: null });
Expression.ZERO = new LiteralExpression({ value: 0 });
Expression.ONE = new LiteralExpression({ value: 1 });
Expression.FALSE = new LiteralExpression({ value: false });
Expression.TRUE = new LiteralExpression({ value: true });
Expression.EMPTY_STRING = new LiteralExpression({ value: '' });
Expression.EMPTY_SET = new LiteralExpression({ value: Set.fromJS([]) });
Expression.register(LiteralExpression);