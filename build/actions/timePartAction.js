var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Timezone, WallTime } from "chronoshift";
import { Action } from "./baseAction";
import { immutableEqual } from "immutable-class";
var PART_TO_FUNCTION = {
    SECOND_OF_MINUTE: function (d) { return d.getSeconds(); },
    SECOND_OF_HOUR: function (d) { return d.getMinutes() * 60 + d.getSeconds(); },
    SECOND_OF_DAY: function (d) { return (d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_WEEK: function (d) { return ((d.getDay() * 24) + d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_MONTH: function (d) { return (((d.getDate() - 1) * 24) + d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_YEAR: null,
    MINUTE_OF_HOUR: function (d) { return d.getMinutes(); },
    MINUTE_OF_DAY: function (d) { return d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_WEEK: function (d) { return (d.getDay() * 24) + d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_MONTH: function (d) { return ((d.getDate() - 1) * 24) + d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_YEAR: null,
    HOUR_OF_DAY: function (d) { return d.getHours(); },
    HOUR_OF_WEEK: function (d) { return d.getDay() * 24 + d.getHours(); },
    HOUR_OF_MONTH: function (d) { return (d.getDate() - 1) * 24 + d.getHours(); },
    HOUR_OF_YEAR: null,
    DAY_OF_WEEK: function (d) { return d.getDay() || 7; },
    DAY_OF_MONTH: function (d) { return d.getDate(); },
    DAY_OF_YEAR: null,
    WEEK_OF_MONTH: null,
    WEEK_OF_YEAR: null,
    MONTH_OF_YEAR: function (d) { return d.getMonth(); },
    YEAR: function (d) { return d.getFullYear(); }
};
var PART_TO_MAX_VALUES = {
    SECOND_OF_MINUTE: 61,
    SECOND_OF_HOUR: 3601,
    SECOND_OF_DAY: 93601,
    SECOND_OF_WEEK: null,
    SECOND_OF_MONTH: null,
    SECOND_OF_YEAR: null,
    MINUTE_OF_HOUR: 60,
    MINUTE_OF_DAY: 26 * 60,
    MINUTE_OF_WEEK: null,
    MINUTE_OF_MONTH: null,
    MINUTE_OF_YEAR: null,
    HOUR_OF_DAY: 26,
    HOUR_OF_WEEK: null,
    HOUR_OF_MONTH: null,
    HOUR_OF_YEAR: null,
    DAY_OF_WEEK: 7,
    DAY_OF_MONTH: 31,
    DAY_OF_YEAR: 366,
    WEEK_OF_MONTH: 5,
    WEEK_OF_YEAR: 53,
    MONTH_OF_YEAR: 12,
    YEAR: null
};
export var TimePartAction = (function (_super) {
    __extends(TimePartAction, _super);
    function TimePartAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.part = parameters.part;
        this.timezone = parameters.timezone;
        this._ensureAction("timePart");
        if (typeof this.part !== 'string') {
            throw new Error("`part` must be a string");
        }
    }
    TimePartAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.part = parameters.part;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimePartAction(value);
    };
    TimePartAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.part = this.part;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimePartAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.part = this.part;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimePartAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.part === other.part &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimePartAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.part];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimePartAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimePartAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    TimePartAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER'
        };
    };
    TimePartAction.prototype._getFnHelper = function (inputType, inputFn) {
        var part = this.part;
        var timezone = this.getTimezone();
        var parter = PART_TO_FUNCTION[part];
        if (!parter)
            throw new Error("unsupported part '" + part + "'");
        return function (d, c) {
            var inV = inputFn(d, c);
            if (!inV)
                return null;
            inV = WallTime.UTCToWallTime(inV, timezone.toString());
            return parter(inV);
        };
    };
    TimePartAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimePartAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timePartExpression(inputSQL, this.part, this.getTimezone());
    };
    TimePartAction.prototype.maxPossibleSplitValues = function () {
        var maxValue = PART_TO_MAX_VALUES[this.part];
        if (!maxValue)
            return Infinity;
        return maxValue + 1;
    };
    TimePartAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimePartAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimePartAction(value);
    };
    TimePartAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    return TimePartAction;
}(Action));
Action.register(TimePartAction);
