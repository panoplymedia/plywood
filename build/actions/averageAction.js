var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var AverageAction = (function (_super) {
    __extends(AverageAction, _super);
    function AverageAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("average");
        this._checkExpressionTypes('NUMBER');
    }
    AverageAction.fromJS = function (parameters) {
        return new AverageAction(Action.jsToValue(parameters));
    };
    AverageAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    AverageAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    AverageAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    AverageAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "AVG(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    AverageAction.prototype.isAggregate = function () {
        return true;
    };
    AverageAction.prototype.isNester = function () {
        return true;
    };
    return AverageAction;
}(Action));
Action.register(AverageAction);
