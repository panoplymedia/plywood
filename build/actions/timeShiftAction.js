var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Timezone, Duration } from "chronoshift";
import { Action } from "./baseAction";
import { immutableEqual } from "immutable-class";
export var TimeShiftAction = (function (_super) {
    __extends(TimeShiftAction, _super);
    function TimeShiftAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.duration = parameters.duration;
        this.step = parameters.step || TimeShiftAction.DEFAULT_STEP;
        this.timezone = parameters.timezone;
        this._ensureAction("timeShift");
        if (!Duration.isDuration(this.duration)) {
            throw new Error("`duration` must be a Duration");
        }
    }
    TimeShiftAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        value.step = parameters.step;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeShiftAction(value);
    };
    TimeShiftAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        value.step = this.step;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeShiftAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        js.step = this.step;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeShiftAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            this.step === other.step &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeShiftAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString(), this.step.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeShiftAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeShiftAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME';
    };
    TimeShiftAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME'
        };
    };
    TimeShiftAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var step = this.step;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return duration.shift(inV, timezone, step);
        };
    };
    TimeShiftAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeShiftAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeShiftExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeShiftAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof TimeShiftAction) {
            if (this.duration.equals(prevAction.duration) &&
                Boolean(this.timezone) === Boolean(prevAction.timezone) &&
                (!this.timezone || this.timezone.equals(prevAction.timezone))) {
                var value = this.valueOf();
                value.step += prevAction.step;
                return new TimeShiftAction(value);
            }
        }
        return null;
    };
    TimeShiftAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeShiftAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeShiftAction(value);
    };
    TimeShiftAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeShiftAction.DEFAULT_STEP = 1;
    return TimeShiftAction;
}(Action));
Action.register(TimeShiftAction);