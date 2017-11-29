var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Timezone, Duration } from "chronoshift";
import { Action } from "./baseAction";
import { InAction } from "./inAction";
import { TimeRange } from "../datatypes/timeRange";
import { OverlapAction } from "./overlapAction";
import { TimeBucketAction } from "./timeBucketAction";
import { immutableEqual } from "immutable-class";
import { Set } from "../datatypes/set";
export var TimeFloorAction = (function (_super) {
    __extends(TimeFloorAction, _super);
    function TimeFloorAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var duration = parameters.duration;
        this.duration = duration;
        this.timezone = parameters.timezone;
        this._ensureAction("timeFloor");
        if (!Duration.isDuration(duration)) {
            throw new Error("`duration` must be a Duration");
        }
        if (!duration.isFloorable()) {
            throw new Error("duration '" + duration.toString() + "' is not floorable");
        }
    }
    TimeFloorAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeFloorAction(value);
    };
    TimeFloorAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeFloorAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeFloorAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeFloorAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeFloorAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeFloorAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME';
    };
    TimeFloorAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME'
        };
    };
    TimeFloorAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return duration.floor(inV, timezone);
        };
    };
    TimeFloorAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeFloorAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeFloorExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeFloorAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction.equals(this)) {
            return this;
        }
        return null;
    };
    TimeFloorAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeFloorAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeFloorAction(value);
    };
    TimeFloorAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeFloorAction.prototype.alignsWith = function (actions) {
        if (!actions.length)
            return false;
        var action = actions[0];
        var _a = this, timezone = _a.timezone, duration = _a.duration;
        if (!timezone)
            return false;
        if (action instanceof TimeFloorAction || action instanceof TimeBucketAction) {
            return timezone.equals(action.timezone) && action.duration.dividesBy(duration);
        }
        if (action instanceof InAction || action instanceof OverlapAction) {
            var literal = action.getLiteralValue();
            if (TimeRange.isTimeRange(literal)) {
                return literal.isAligned(duration, timezone);
            }
            else if (Set.isSet(literal)) {
                if (literal.setType !== 'TIME_RANGE')
                    return false;
                return literal.elements.every(function (e) {
                    return e.isAligned(duration, timezone);
                });
            }
        }
        return false;
    };
    return TimeFloorAction;
}(Action));
Action.register(TimeFloorAction);
