var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var MaxAction = (function (_super) {
    __extends(MaxAction, _super);
    function MaxAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("max");
        this._checkExpressionTypes('NUMBER', 'TIME');
    }
    MaxAction.fromJS = function (parameters) {
        return new MaxAction(Action.jsToValue(parameters));
    };
    MaxAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    MaxAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    MaxAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    MaxAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "MAX(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    MaxAction.prototype.isAggregate = function () {
        return true;
    };
    MaxAction.prototype.isNester = function () {
        return true;
    };
    return MaxAction;
}(Action));
Action.register(MaxAction);
