var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var MinAction = (function (_super) {
    __extends(MinAction, _super);
    function MinAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("min");
        this._checkExpressionTypes('NUMBER', 'TIME');
    }
    MinAction.fromJS = function (parameters) {
        return new MinAction(Action.jsToValue(parameters));
    };
    MinAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    MinAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    MinAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    MinAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "MIN(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    MinAction.prototype.isAggregate = function () {
        return true;
    };
    MinAction.prototype.isNester = function () {
        return true;
    };
    return MinAction;
}(Action));
Action.register(MinAction);