var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { r, Expression } from "../expressions/baseExpression";
export var ConcatAction = (function (_super) {
    __extends(ConcatAction, _super);
    function ConcatAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("concat");
        this._checkExpressionTypes('STRING');
    }
    ConcatAction.fromJS = function (parameters) {
        return new ConcatAction(Action.jsToValue(parameters));
    };
    ConcatAction.prototype.getNecessaryInputTypes = function () {
        return this._stringTransformInputType;
    };
    ConcatAction.prototype.getOutputType = function (inputType) {
        return this._stringTransformOutputType(inputType);
    };
    ConcatAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    ConcatAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            var exV = expressionFn(d, c);
            if (exV === null)
                return null;
            return '' + inV + exV;
        };
    };
    ConcatAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return Expression.jsNullSafetyBinary(inputJS, expressionJS, (function (a, b) { return (a + "+" + b); }), inputJS[0] === '"', expressionJS[0] === '"');
    };
    ConcatAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.concatExpression(inputSQL, expressionSQL);
    };
    ConcatAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.EMPTY_STRING);
    };
    ConcatAction.prototype._performOnLiteral = function (literalExpression) {
        if (literalExpression.equals(Expression.EMPTY_STRING)) {
            return this.expression;
        }
        return null;
    };
    ConcatAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof ConcatAction) {
            var prevValue = prevAction.expression.getLiteralValue();
            var myValue = this.expression.getLiteralValue();
            if (typeof prevValue === 'string' && typeof myValue === 'string') {
                return new ConcatAction({
                    expression: r(prevValue + myValue)
                });
            }
        }
        return null;
    };
    return ConcatAction;
}(Action));
Action.register(ConcatAction);