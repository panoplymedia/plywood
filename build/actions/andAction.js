var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { Expression } from "../expressions/baseExpression";
import { arraysEqual } from "../helper/utils";
import { Set } from "../datatypes/set";
var IS_OR_IN_ACTION = {
    'is': true,
    'in': true
};
function mergeAnd(ex1, ex2) {
    if (ex1.equals(ex2))
        return ex1;
    if (!ex1.isOp('chain') ||
        !ex2.isOp('chain') ||
        !ex1.expression.isOp('ref') ||
        !ex2.expression.isOp('ref') ||
        !arraysEqual(ex1.getFreeReferences(), ex2.getFreeReferences()))
        return null;
    var ex1Actions = ex1.actions;
    var ex2Actions = ex2.actions;
    if (ex1Actions.length !== 1 || ex2Actions.length !== 1)
        return null;
    var ex1Action = ex1Actions[0];
    var ex2Action = ex2Actions[0];
    if (!IS_OR_IN_ACTION[ex1Action.action] || !IS_OR_IN_ACTION[ex2Action.action])
        return null;
    var firstActionExpression1 = ex1Action.expression;
    var firstActionExpression2 = ex2Action.expression;
    if (!firstActionExpression1 || !firstActionExpression2 || !firstActionExpression1.isOp('literal') || !firstActionExpression2.isOp('literal'))
        return null;
    var intersect = Set.generalIntersect(firstActionExpression1.getLiteralValue(), firstActionExpression2.getLiteralValue());
    if (intersect === null)
        return null;
    return Expression.inOrIs(ex1.expression, intersect);
}
export var AndAction = (function (_super) {
    __extends(AndAction, _super);
    function AndAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("and");
    }
    AndAction.fromJS = function (parameters) {
        return new AndAction(Action.jsToValue(parameters));
    };
    AndAction.prototype.getNecessaryInputTypes = function () {
        return 'BOOLEAN';
    };
    AndAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    AndAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    AndAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) { return inputFn(d, c) && expressionFn(d, c); };
    };
    AndAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "&&" + expressionJS + ")";
    };
    AndAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + " AND " + expressionSQL + ")";
    };
    AndAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.TRUE);
    };
    AndAction.prototype._nukeExpression = function () {
        if (this.expression.equals(Expression.FALSE))
            return Expression.FALSE;
        return null;
    };
    AndAction.prototype._distributeAction = function () {
        return this.expression.actionize(this.action);
    };
    AndAction.prototype._performOnLiteral = function (literalExpression) {
        if (literalExpression.equals(Expression.TRUE)) {
            return this.expression;
        }
        if (literalExpression.equals(Expression.FALSE)) {
            return Expression.FALSE;
        }
        return null;
    };
    AndAction.prototype._performOnSimpleChain = function (chainExpression) {
        var expression = this.expression;
        var andExpressions = chainExpression.getExpressionPattern('and');
        if (andExpressions) {
            for (var i = 0; i < andExpressions.length; i++) {
                var andExpression = andExpressions[i];
                var mergedExpression = mergeAnd(andExpression, expression);
                if (mergedExpression) {
                    andExpressions[i] = mergedExpression;
                    return Expression.and(andExpressions).simplify();
                }
            }
        }
        return mergeAnd(chainExpression, expression);
    };
    return AndAction;
}(Action));
Action.register(AndAction);
