var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var REGEXP_SPECIAL = "\\^$.|?*+()[{";
import { Action } from "./baseAction";
export var MatchAction = (function (_super) {
    __extends(MatchAction, _super);
    function MatchAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.regexp = parameters.regexp;
        this._ensureAction("match");
    }
    MatchAction.likeToRegExp = function (like, escapeChar) {
        if (escapeChar === void 0) { escapeChar = '\\'; }
        var regExp = ['^'];
        for (var i = 0; i < like.length; i++) {
            var char = like[i];
            if (char === escapeChar) {
                var nextChar = like[i + 1];
                if (!nextChar)
                    throw new Error("invalid LIKE string '" + like + "'");
                char = nextChar;
                i++;
            }
            else if (char === '%') {
                regExp.push('.*');
                continue;
            }
            else if (char === '_') {
                regExp.push('.');
                continue;
            }
            if (REGEXP_SPECIAL.indexOf(char) !== -1) {
                regExp.push('\\');
            }
            regExp.push(char);
        }
        regExp.push('$');
        return regExp.join('');
    };
    MatchAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.regexp = parameters.regexp;
        return new MatchAction(value);
    };
    MatchAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.regexp = this.regexp;
        return value;
    };
    MatchAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.regexp = this.regexp;
        return js;
    };
    MatchAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.regexp === other.regexp;
    };
    MatchAction.prototype._toStringParameters = function (expressionString) {
        return [this.regexp];
    };
    MatchAction.prototype.getNecessaryInputTypes = function () {
        return this._stringTransformInputType;
    };
    MatchAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    MatchAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'BOOLEAN'
        };
    };
    MatchAction.prototype._getFnHelper = function (inputType, inputFn) {
        var re = new RegExp(this.regexp);
        return function (d, c) {
            var inV = inputFn(d, c);
            if (!inV)
                return null;
            if (inV === null)
                return null;
            return re.test(inV);
        };
    };
    MatchAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "/" + this.regexp + "/.test(" + inputJS + ")";
    };
    MatchAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.regexpExpression(inputSQL, this.regexp);
    };
    return MatchAction;
}(Action));
Action.register(MatchAction);