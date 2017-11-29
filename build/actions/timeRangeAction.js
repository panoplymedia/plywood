var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { immutableEqual } from "immutable-class";
import { Timezone, Duration } from "chronoshift";
import { Action } from "./baseAction";
import { TimeRange } from "../datatypes/timeRange";
export var TimeRangeAction = (function (_super) {
    __extends(TimeRangeAction, _super);
    function TimeRangeAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.duration = parameters.duration;
        this.step = parameters.step || TimeRangeAction.DEFAULT_STEP;
        this.timezone = parameters.timezone;
        this._ensureAction("timeRange");
        if (!Duration.isDuration(this.duration)) {
            throw new Error("`duration` must be a Duration");
        }
    }
    TimeRangeAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        value.step = parameters.step;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeRangeAction(value);
    };
    TimeRangeAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        value.step = this.step;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeRangeAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        js.step = this.step;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeRangeAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            this.step === other.step &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeRangeAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString(), this.step.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeRangeAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeRangeAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME_RANGE';
    };
    TimeRangeAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME_RANGE'
        };
    };
    TimeRangeAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var step = this.step;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            var other = duration.shift(inV, timezone, step);
            if (step > 0) {
                return new TimeRange({ start: inV, end: other });
            }
            else {
                return new TimeRange({ start: other, end: inV });
            }
        };
    };
    TimeRangeAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeRangeAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error("implement me");
    };
    TimeRangeAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeRangeAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeRangeAction(value);
    };
    TimeRangeAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeRangeAction.DEFAULT_STEP = 1;
    return TimeRangeAction;
}(Action));
Action.register(TimeRangeAction);
