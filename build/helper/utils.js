var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var objectHasOwnProperty = Object.prototype.hasOwnProperty;
export function hasOwnProperty(obj, key) {
    return objectHasOwnProperty.call(obj, key);
}
export function repeat(str, times) {
    return new Array(times + 1).join(str);
}
export function arraysEqual(a, b) {
    if (a === b)
        return true;
    var length = a.length;
    if (length !== b.length)
        return false;
    for (var i = 0; i < length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
export function dictEqual(dictA, dictB) {
    if (dictA === dictB)
        return true;
    if (!dictA !== !dictB)
        return false;
    var keys = Object.keys(dictA);
    if (keys.length !== Object.keys(dictB).length)
        return false;
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        if (dictA[key] !== dictB[key])
            return false;
    }
    return true;
}
export function shallowCopy(thing) {
    var newThing = {};
    for (var k in thing) {
        if (hasOwnProperty(thing, k))
            newThing[k] = thing[k];
    }
    return newThing;
}
export function deduplicateSort(a) {
    a = a.sort();
    var newA = [];
    var last = null;
    for (var _i = 0, a_1 = a; _i < a_1.length; _i++) {
        var v = a_1[_i];
        if (v !== last)
            newA.push(v);
        last = v;
    }
    return newA;
}
export function mapLookup(thing, fn) {
    var newThing = Object.create(null);
    for (var k in thing) {
        if (hasOwnProperty(thing, k))
            newThing[k] = fn(thing[k]);
    }
    return newThing;
}
export function emptyLookup(lookup) {
    for (var k in lookup) {
        if (hasOwnProperty(lookup, k))
            return false;
    }
    return true;
}
export function nonEmptyLookup(lookup) {
    return !emptyLookup(lookup);
}
export function safeAdd(num, delta) {
    var stringDelta = String(delta);
    var dotIndex = stringDelta.indexOf(".");
    if (dotIndex === -1 || stringDelta.length === 18) {
        return num + delta;
    }
    else {
        var scale = Math.pow(10, stringDelta.length - dotIndex - 1);
        return (num * scale + delta * scale) / scale;
    }
}
export function continuousFloorExpression(variable, floorFn, size, offset) {
    var expr = variable;
    if (offset !== 0) {
        expr = expr + " - " + offset;
    }
    if (offset !== 0 && size !== 1) {
        expr = "(" + expr + ")";
    }
    if (size !== 1) {
        expr = expr + " / " + size;
    }
    expr = floorFn + "(" + expr + ")";
    if (size !== 1) {
        expr = expr + " * " + size;
    }
    if (offset !== 0) {
        expr = expr + " + " + offset;
    }
    return expr;
}
export var ExtendableError = (function (_super) {
    __extends(ExtendableError, _super);
    function ExtendableError(message) {
        _super.call(this, message);
        this.name = this.constructor.name;
        this.message = message;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
        else {
            this.stack = (new Error(message)).stack;
        }
    }
    return ExtendableError;
}(Error));
