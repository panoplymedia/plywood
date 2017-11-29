var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { Expression } from "../expressions/baseExpression";
export var IndexOfAction = (function (_super) {
    __extends(IndexOfAction, _super);
    function IndexOfAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("indexOf");
        this._checkExpressionTypes('STRING');
    }
    IndexOfAction.fromJS = function (parameters) {
        return new IndexOfAction(Action.jsToValue(parameters));
    };
    IndexOfAction.prototype.getNecessaryInputTypes = function () {
        return 'STRING';
    };
    IndexOfAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    IndexOfAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    IndexOfAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return inV.indexOf(expressionFn(d, c));
        };
    };
    IndexOfAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return Expression.jsNullSafetyBinary(inputJS, expressionJS, (function (a, b) { return (a + ".indexOf(" + b + ")"); }), inputJS[0] === '"', expressionJS[0] === '"');
    };
    IndexOfAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.indexOfExpression(inputSQL, expressionSQL);
    };
    return IndexOfAction;
}(Action));
Action.register(IndexOfAction);
