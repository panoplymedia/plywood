var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Set } from "../datatypes/set";
import { Action } from "./baseAction";
import { Expression } from "../expressions/baseExpression";
import { arraysEqual } from "../helper/utils";
function mergeOr(ex1, ex2) {
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
    var firstActionExpression1 = ex1Actions[0].expression;
    var firstActionExpression2 = ex2Actions[0].expression;
    if (!firstActionExpression1 || !firstActionExpression2 || !firstActionExpression1.isOp('literal') || !firstActionExpression2.isOp('literal'))
        return null;
    var intersect = Set.generalUnion(firstActionExpression1.getLiteralValue(), firstActionExpression2.getLiteralValue());
    if (intersect === null)
        return null;
    return Expression.inOrIs(ex1.expression, intersect);
}
export var OrAction = (function (_super) {
    __extends(OrAction, _super);
    function OrAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("or");
    }
    OrAction.fromJS = function (parameters) {
        return new OrAction(Action.jsToValue(parameters));
    };
    OrAction.prototype.getNecessaryInputTypes = function () {
        return 'BOOLEAN';
    };
    OrAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    OrAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    OrAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) || expressionFn(d, c);
        };
    };
    OrAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "||" + expressionJS + ")";
    };
    OrAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + " OR " + expressionSQL + ")";
    };
    OrAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.FALSE);
    };
    OrAction.prototype._nukeExpression = function () {
        if (this.expression.equals(Expression.TRUE))
            return Expression.TRUE;
        return null;
    };
    OrAction.prototype._distributeAction = function () {
        return this.expression.actionize(this.action);
    };
    OrAction.prototype._performOnLiteral = function (literalExpression) {
        if (literalExpression.equals(Expression.FALSE)) {
            return this.expression;
        }
        if (literalExpression.equals(Expression.TRUE)) {
            return Expression.TRUE;
        }
        return null;
    };
    OrAction.prototype._performOnSimpleChain = function (chainExpression) {
        var expression = this.expression;
        var orExpressions = chainExpression.getExpressionPattern('or');
        if (orExpressions) {
            for (var i = 0; i < orExpressions.length; i++) {
                var orExpression = orExpressions[i];
                var mergedExpression = mergeOr(orExpression, expression);
                if (mergedExpression) {
                    orExpressions[i] = mergedExpression;
                    return Expression.or(orExpressions).simplify();
                }
            }
        }
        return mergeOr(chainExpression, expression);
    };
    return OrAction;
}(Action));
Action.register(OrAction);
