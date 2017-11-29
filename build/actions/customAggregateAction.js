var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var CustomAggregateAction = (function (_super) {
    __extends(CustomAggregateAction, _super);
    function CustomAggregateAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.custom = parameters.custom;
        this._ensureAction("customAggregate");
    }
    CustomAggregateAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.custom = parameters.custom;
        if (value.action === 'custom')
            value.action = 'customAggregate';
        return new CustomAggregateAction(value);
    };
    CustomAggregateAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.custom = this.custom;
        return value;
    };
    CustomAggregateAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.custom = this.custom;
        return js;
    };
    CustomAggregateAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.custom === other.custom;
    };
    CustomAggregateAction.prototype._toStringParameters = function (expressionString) {
        return [this.custom];
    };
    CustomAggregateAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CustomAggregateAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CustomAggregateAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        return {
            type: 'NUMBER'
        };
    };
    CustomAggregateAction.prototype.getFn = function (inputType, inputFn) {
        throw new Error('can not getFn on custom action');
    };
    CustomAggregateAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('custom action not implemented');
    };
    CustomAggregateAction.prototype.isAggregate = function () {
        return true;
    };
    return CustomAggregateAction;
}(Action));
Action.register(CustomAggregateAction);
