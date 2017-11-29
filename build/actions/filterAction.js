var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { Action } from "./baseAction";
import { Expression } from "../expressions/baseExpression";
import { RefExpression } from "../expressions/refExpression";
import { SplitAction } from "./splitAction";
import { SortAction } from "./sortAction";
import { ApplyAction } from "./applyAction";
export var FilterAction = (function (_super) {
    __extends(FilterAction, _super);
    function FilterAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        this._ensureAction("filter");
        this._checkExpressionTypes('BOOLEAN');
    }
    FilterAction.fromJS = function (parameters) {
        return new FilterAction({
            action: parameters.action,
            name: parameters.name,
            expression: Expression.fromJS(parameters.expression)
        });
    };
    FilterAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    FilterAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    FilterAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    FilterAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return inputSQL + " WHERE " + expressionSQL;
    };
    FilterAction.prototype.isNester = function () {
        return true;
    };
    FilterAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof FilterAction) {
            return new FilterAction({
                expression: prevAction.expression.and(this.expression)
            });
        }
        return null;
    };
    FilterAction.prototype._putBeforeLastAction = function (lastAction) {
        if (lastAction instanceof ApplyAction) {
            var freeReferences = this.getFreeReferences();
            return freeReferences.indexOf(lastAction.name) === -1 ? this : null;
        }
        if (lastAction instanceof SplitAction && lastAction.isLinear()) {
            var splits = lastAction.splits;
            return new FilterAction({
                expression: this.expression.substitute(function (ex) {
                    if (ex instanceof RefExpression && splits[ex.name])
                        return splits[ex.name];
                    return null;
                })
            });
        }
        if (lastAction instanceof SortAction) {
            return this;
        }
        return null;
    };
    return FilterAction;
}(Action));
Action.register(FilterAction);
