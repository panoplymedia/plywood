var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
export var CountAction = (function (_super) {
    __extends(CountAction, _super);
    function CountAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("count");
        this._checkNoExpression();
    }
    CountAction.fromJS = function (parameters) {
        return new CountAction(Action.jsToValue(parameters));
    };
    CountAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CountAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CountAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER'
        };
    };
    CountAction.prototype.getFn = function (inputType, inputFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.count() : 0;
        };
    };
    CountAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return inputSQL.indexOf(' WHERE ') === -1 ? "COUNT(*)" : "SUM(" + dialect.aggregateFilterIfNeeded(inputSQL, '1') + ")";
    };
    CountAction.prototype.isAggregate = function () {
        return true;
    };
    return CountAction;
}(Action));
Action.register(CountAction);
