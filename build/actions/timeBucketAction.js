var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Timezone, Duration } from "chronoshift";
import { Action } from "./baseAction";
import { TimeRange } from "../datatypes/timeRange";
import { immutableEqual } from "immutable-class";
export var TimeBucketAction = (function (_super) {
    __extends(TimeBucketAction, _super);
    function TimeBucketAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var duration = parameters.duration;
        this.duration = duration;
        this.timezone = parameters.timezone;
        this._ensureAction("timeBucket");
        if (!Duration.isDuration(duration)) {
            throw new Error("`duration` must be a Duration");
        }
        if (!duration.isFloorable()) {
            throw new Error("duration '" + duration.toString() + "' is not floorable");
        }
    }
    TimeBucketAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeBucketAction(value);
    };
    TimeBucketAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeBucketAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeBucketAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeBucketAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeBucketAction.prototype.getNecessaryInputTypes = function () {
        return ['TIME', 'TIME_RANGE'];
    };
    TimeBucketAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME_RANGE';
    };
    TimeBucketAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME_RANGE'
        };
    };
    TimeBucketAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return TimeRange.timeBucket(inV, duration, timezone);
        };
    };
    TimeBucketAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeBucketAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeBucketExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeBucketAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeBucketAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeBucketAction(value);
    };
    TimeBucketAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    return TimeBucketAction;
}(Action));
Action.register(TimeBucketAction);
