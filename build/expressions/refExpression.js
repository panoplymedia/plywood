var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { SimpleArray } from 'immutable-class';
import { Expression } from "./baseExpression";
import { hasOwnProperty, repeat } from "../helper/utils";
export var POSSIBLE_TYPES = {
    'NULL': 1,
    'BOOLEAN': 1,
    'NUMBER': 1,
    'TIME': 1,
    'STRING': 1,
    'NUMBER_RANGE': 1,
    'TIME_RANGE': 1,
    'SET': 1,
    'SET/NULL': 1,
    'SET/BOOLEAN': 1,
    'SET/NUMBER': 1,
    'SET/TIME': 1,
    'SET/STRING': 1,
    'SET/NUMBER_RANGE': 1,
    'SET/TIME_RANGE': 1,
    'DATASET': 1
};
var GENERATIONS_REGEXP = /^\^+/;
var TYPE_REGEXP = /:([A-Z\/_]+)$/;
export var RefExpression = (function (_super) {
    __extends(RefExpression, _super);
    function RefExpression(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureOp("ref");
        var name = parameters.name;
        if (typeof name !== 'string' || name.length === 0) {
            throw new TypeError("must have a nonempty `name`");
        }
        this.name = name;
        var nest = parameters.nest;
        if (typeof nest !== 'number') {
            throw new TypeError("must have nest");
        }
        if (nest < 0) {
            throw new Error("nest must be non-negative");
        }
        this.nest = nest;
        var myType = parameters.type;
        if (myType) {
            if (!RefExpression.validType(myType)) {
                throw new TypeError("unsupported type '" + myType + "'");
            }
            this.type = myType;
        }
        this.remote = Boolean(parameters.remote);
        this.simple = true;
        this.ignoreCase = parameters.ignoreCase;
    }
    RefExpression.fromJS = function (parameters) {
        var value;
        if (hasOwnProperty(parameters, 'nest')) {
            value = parameters;
        }
        else {
            value = {
                op: 'ref',
                nest: 0,
                name: parameters.name,
                type: parameters.type,
                ignoreCase: parameters.ignoreCase
            };
        }
        return new RefExpression(value);
    };
    RefExpression.parse = function (str) {
        var refValue = { op: 'ref' };
        var match;
        match = str.match(GENERATIONS_REGEXP);
        if (match) {
            var nest = match[0].length;
            refValue.nest = nest;
            str = str.substr(nest);
        }
        else {
            refValue.nest = 0;
        }
        match = str.match(TYPE_REGEXP);
        if (match) {
            refValue.type = match[1];
            str = str.substr(0, str.length - match[0].length);
        }
        if (str[0] === '{' && str[str.length - 1] === '}') {
            str = str.substr(1, str.length - 2);
        }
        refValue.name = str;
        return new RefExpression(refValue);
    };
    RefExpression.validType = function (typeName) {
        return hasOwnProperty(POSSIBLE_TYPES, typeName);
    };
    RefExpression.toJavaScriptSafeName = function (variableName) {
        if (!RefExpression.SIMPLE_NAME_REGEXP.test(variableName)) {
            variableName = variableName.replace(/\W/g, function (c) { return ("$" + c.charCodeAt(0)); });
        }
        return '_' + variableName;
    };
    RefExpression.findProperty = function (obj, key) {
        return hasOwnProperty(obj, key) ? key : null;
    };
    RefExpression.findPropertyCI = function (obj, key) {
        var lowerKey = key.toLowerCase();
        if (obj == null)
            return null;
        return SimpleArray.find(Object.keys(obj), function (v) { return v.toLowerCase() === lowerKey; });
    };
    RefExpression.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.name = this.name;
        value.nest = this.nest;
        if (this.type)
            value.type = this.type;
        if (this.remote)
            value.remote = true;
        if (this.ignoreCase)
            value.ignoreCase = true;
        return value;
    };
    RefExpression.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.name = this.name;
        if (this.nest)
            js.nest = this.nest;
        if (this.type)
            js.type = this.type;
        if (this.ignoreCase)
            js.ignoreCase = true;
        return js;
    };
    RefExpression.prototype.toString = function () {
        var _a = this, name = _a.name, nest = _a.nest, type = _a.type, ignoreCase = _a.ignoreCase;
        var str = name;
        if (!RefExpression.SIMPLE_NAME_REGEXP.test(name)) {
            str = '{' + str + '}';
        }
        if (nest) {
            str = repeat('^', nest) + str;
        }
        if (type) {
            str += ':' + type;
        }
        return (ignoreCase ? 'i$' : '$') + str;
    };
    RefExpression.prototype.getFn = function () {
        var _a = this, name = _a.name, nest = _a.nest, ignoreCase = _a.ignoreCase;
        var property = null;
        return function (d, c) {
            if (nest) {
                property = ignoreCase ? RefExpression.findPropertyCI(c, name) : name;
                return c[property];
            }
            else {
                property = ignoreCase ? RefExpression.findPropertyCI(d, name) : RefExpression.findProperty(d, name);
                return property != null ? d[property] : null;
            }
        };
    };
    RefExpression.prototype.getJS = function (datumVar) {
        var _a = this, name = _a.name, nest = _a.nest, ignoreCase = _a.ignoreCase;
        if (nest)
            throw new Error("can not call getJS on unresolved expression");
        if (ignoreCase)
            throw new Error("can not express ignore case as js expression");
        var expr;
        if (datumVar) {
            expr = datumVar.replace('[]', "[" + JSON.stringify(name) + "]");
        }
        else {
            expr = RefExpression.toJavaScriptSafeName(name);
        }
        if (this.type === 'NUMBER')
            expr = "(+" + expr + ")";
        return expr;
    };
    RefExpression.prototype.getSQL = function (dialect, minimal) {
        if (minimal === void 0) { minimal = false; }
        if (this.nest)
            throw new Error("can not call getSQL on unresolved expression: " + this);
        return dialect.escapeName(this.name);
    };
    RefExpression.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.name === other.name &&
            this.nest === other.nest &&
            this.remote === other.remote &&
            this.ignoreCase === other.ignoreCase;
    };
    RefExpression.prototype.isRemote = function () {
        return this.remote;
    };
    RefExpression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        var myIndex = indexer.index;
        indexer.index++;
        var _a = this, nest = _a.nest, ignoreCase = _a.ignoreCase, name = _a.name;
        var myTypeContext = typeContext;
        while (nest--) {
            myTypeContext = myTypeContext.parent;
            if (!myTypeContext)
                throw new Error('went too deep on ' + this.toString());
        }
        var myName = ignoreCase ? RefExpression.findPropertyCI(myTypeContext.datasetType, name) : name;
        if (myName == null)
            throw new Error('could not resolve ' + this.toString());
        var nestDiff = 0;
        while (myTypeContext && !hasOwnProperty(myTypeContext.datasetType, myName)) {
            myTypeContext = myTypeContext.parent;
            nestDiff++;
        }
        if (!myTypeContext) {
            throw new Error('could not resolve ' + this.toString());
        }
        var myFullType = myTypeContext.datasetType[myName];
        var myType = myFullType.type;
        var myRemote = Boolean(myFullType.remote);
        if (this.type && this.type !== myType) {
            throw new TypeError("type mismatch in " + this + " (has: " + this.type + " needs: " + myType + ")");
        }
        if (!this.type || nestDiff > 0 || this.remote !== myRemote || ignoreCase) {
            alterations[myIndex] = new RefExpression({
                name: myName,
                nest: this.nest + nestDiff,
                type: myType,
                remote: myRemote
            });
        }
        if (myType === 'DATASET') {
            return {
                parent: typeContext,
                type: 'DATASET',
                datasetType: myFullType.datasetType,
                remote: myFullType.remote
            };
        }
        return myFullType;
    };
    RefExpression.prototype.incrementNesting = function (by) {
        if (by === void 0) { by = 1; }
        var value = this.valueOf();
        value.nest = by + value.nest;
        return new RefExpression(value);
    };
    RefExpression.prototype._computeResolvedSimulate = function () {
        throw new Error('should never get here');
    };
    RefExpression.prototype._computeResolved = function () {
        throw new Error('should never get here');
    };
    RefExpression.prototype.maxPossibleSplitValues = function () {
        return this.type === 'BOOLEAN' ? 3 : Infinity;
    };
    RefExpression.prototype.upgradeToType = function (targetType) {
        var type = this.type;
        if (targetType === 'TIME' && (!type || type === 'STRING')) {
            return this.changeType(targetType);
        }
        return this;
    };
    RefExpression.prototype.toCaseInsensitive = function () {
        var value = this.valueOf();
        value.ignoreCase = true;
        return new RefExpression(value);
    };
    RefExpression.prototype.changeType = function (newType) {
        var value = this.valueOf();
        value.type = newType;
        return new RefExpression(value);
    };
    RefExpression.SIMPLE_NAME_REGEXP = /^([a-z_]\w*)$/i;
    return RefExpression;
}(Expression));
Expression.register(RefExpression);
