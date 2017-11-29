var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { Expression } from "../expressions/baseExpression";
import { hasOwnProperty, continuousFloorExpression } from "../helper/utils";
import { NumberRange } from "../datatypes/numberRange";
export var NumberBucketAction = (function (_super) {
    __extends(NumberBucketAction, _super);
    function NumberBucketAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.size = parameters.size;
        this.offset = parameters.offset;
        this._ensureAction("numberBucket");
    }
    NumberBucketAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.size = parameters.size;
        value.offset = hasOwnProperty(parameters, 'offset') ? parameters.offset : 0;
        return new NumberBucketAction(value);
    };
    NumberBucketAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.size = this.size;
        value.offset = this.offset;
        return value;
    };
    NumberBucketAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.size = this.size;
        if (this.offset)
            js.offset = this.offset;
        return js;
    };
    NumberBucketAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.size === other.size &&
            this.offset === other.offset;
    };
    NumberBucketAction.prototype._toStringParameters = function (expressionString) {
        var params = [String(this.size)];
        if (this.offset)
            params.push(String(this.offset));
        return params;
    };
    NumberBucketAction.prototype.getNecessaryInputTypes = function () {
        return ['NUMBER', 'NUMBER_RANGE'];
    };
    NumberBucketAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER_RANGE';
    };
    NumberBucketAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER_RANGE'
        };
    };
    NumberBucketAction.prototype._getFnHelper = function (inputType, inputFn) {
        var size = this.size;
        var offset = this.offset;
        return function (d, c) {
            var num = inputFn(d, c);
            if (num === null)
                return null;
            return NumberRange.numberBucket(num, size, offset);
        };
    };
    NumberBucketAction.prototype._getJSHelper = function (inputType, inputJS) {
        var _this = this;
        return Expression.jsNullSafetyUnary(inputJS, function (n) { return continuousFloorExpression(n, "Math.floor", _this.size, _this.offset); });
    };
    NumberBucketAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return continuousFloorExpression(inputSQL, "FLOOR", this.size, this.offset);
    };
    return NumberBucketAction;
}(Action));
Action.register(NumberBucketAction);
