var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var CountDistinctAction = (function (_super) {
    __extends(CountDistinctAction, _super);
    function CountDistinctAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("countDistinct");
    }
    CountDistinctAction.fromJS = function (parameters) {
        return new CountDistinctAction(Action.jsToValue(parameters));
    };
    CountDistinctAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CountDistinctAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CountDistinctAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    CountDistinctAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "COUNT(DISTINCT " + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL, 'NULL') + ")";
    };
    CountDistinctAction.prototype.isAggregate = function () {
        return true;
    };
    CountDistinctAction.prototype.isNester = function () {
        return true;
    };
    return CountDistinctAction;
}(Action));
Action.register(CountDistinctAction);
