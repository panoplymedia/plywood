var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { isInstanceOf, NamedArray } from "immutable-class";
import { hasOwnProperty } from "../helper/utils";
import { Action } from "../actions/baseAction";
import { RefExpression } from "../expressions/refExpression";
var check;
export var AttributeInfo = (function () {
    function AttributeInfo(parameters) {
        this.special = parameters.special;
        if (typeof parameters.name !== "string") {
            throw new Error("name must be a string");
        }
        this.name = parameters.name;
        if (hasOwnProperty(parameters, 'type') && !RefExpression.validType(parameters.type)) {
            throw new Error("invalid type: " + parameters.type);
        }
        this.type = parameters.type;
        this.datasetType = parameters.datasetType;
        this.unsplitable = Boolean(parameters.unsplitable);
        this.makerAction = parameters.makerAction;
    }
    AttributeInfo.isAttributeInfo = function (candidate) {
        return isInstanceOf(candidate, AttributeInfo);
    };
    AttributeInfo.jsToValue = function (parameters) {
        var value = {
            special: parameters.special,
            name: parameters.name
        };
        if (parameters.type)
            value.type = parameters.type;
        if (parameters.datasetType)
            value.datasetType = parameters.datasetType;
        if (parameters.unsplitable)
            value.unsplitable = true;
        if (parameters.makerAction)
            value.makerAction = Action.fromJS(parameters.makerAction);
        return value;
    };
    AttributeInfo.register = function (ex) {
        var op = ex.name.replace('AttributeInfo', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        AttributeInfo.classMap[op] = ex;
    };
    AttributeInfo.fromJS = function (parameters) {
        if (typeof parameters !== "object") {
            throw new Error("unrecognizable attributeMeta");
        }
        if (!hasOwnProperty(parameters, 'special')) {
            return new AttributeInfo(AttributeInfo.jsToValue(parameters));
        }
        if (parameters.special === 'range') {
            throw new Error("'range' attribute info is no longer supported, you should apply the .extract('^\\d+') function instead");
        }
        var Class = AttributeInfo.classMap[parameters.special];
        if (!Class) {
            throw new Error("unsupported special attributeInfo '" + parameters.special + "'");
        }
        return Class.fromJS(parameters);
    };
    AttributeInfo.fromJSs = function (attributeJSs) {
        if (!Array.isArray(attributeJSs)) {
            if (attributeJSs && typeof attributeJSs === 'object') {
                var newAttributeJSs = [];
                for (var attributeName in attributeJSs) {
                    if (!hasOwnProperty(attributeJSs, attributeName))
                        continue;
                    var attributeJS = attributeJSs[attributeName];
                    attributeJS['name'] = attributeName;
                    newAttributeJSs.push(attributeJS);
                }
                console.warn('attributes now needs to be passed as an array like so: ' + JSON.stringify(newAttributeJSs, null, 2));
                attributeJSs = newAttributeJSs;
            }
            else {
                throw new TypeError("invalid attributeJSs");
            }
        }
        return attributeJSs.map(function (attributeJS) { return AttributeInfo.fromJS(attributeJS); });
    };
    AttributeInfo.toJSs = function (attributes) {
        return attributes.map(function (attribute) { return attribute.toJS(); });
    };
    AttributeInfo.override = function (attributes, attributeOverrides) {
        return NamedArray.overridesByName(attributes, attributeOverrides);
    };
    AttributeInfo.prototype._ensureSpecial = function (special) {
        if (!this.special) {
            this.special = special;
            return;
        }
        if (this.special !== special) {
            throw new TypeError("incorrect attributeInfo special '" + this.special + "' (needs to be: '" + special + "')");
        }
    };
    AttributeInfo.prototype._ensureType = function (myType) {
        if (!this.type) {
            this.type = myType;
            return;
        }
        if (this.type !== myType) {
            throw new TypeError("incorrect attributeInfo type '" + this.type + "' (needs to be: '" + myType + "')");
        }
    };
    AttributeInfo.prototype.toString = function () {
        var special = this.special ? "[" + this.special + "]" : '';
        return this.name + "::" + this.type + special;
    };
    AttributeInfo.prototype.valueOf = function () {
        return {
            name: this.name,
            type: this.type,
            unsplitable: this.unsplitable,
            special: this.special,
            datasetType: this.datasetType,
            makerAction: this.makerAction
        };
    };
    AttributeInfo.prototype.toJS = function () {
        var js = {
            name: this.name,
            type: this.type
        };
        if (this.unsplitable)
            js.unsplitable = true;
        if (this.special)
            js.special = this.special;
        if (this.datasetType)
            js.datasetType = this.datasetType;
        if (this.makerAction)
            js.makerAction = this.makerAction.toJS();
        return js;
    };
    AttributeInfo.prototype.toJSON = function () {
        return this.toJS();
    };
    AttributeInfo.prototype.equals = function (other) {
        return AttributeInfo.isAttributeInfo(other) &&
            this.special === other.special &&
            this.name === other.name &&
            this.type === other.type &&
            this.unsplitable === other.unsplitable &&
            Boolean(this.makerAction) === Boolean(other.makerAction) &&
            (!this.makerAction || this.makerAction.equals(other.makerAction));
    };
    AttributeInfo.prototype.serialize = function (value) {
        return value;
    };
    AttributeInfo.prototype.change = function (propertyName, newValue) {
        var v = this.valueOf();
        if (!v.hasOwnProperty(propertyName)) {
            throw new Error("Unknown property : " + propertyName);
        }
        v[propertyName] = newValue;
        return new AttributeInfo(v);
    };
    AttributeInfo.classMap = {};
    return AttributeInfo;
}());
check = AttributeInfo;
export var UniqueAttributeInfo = (function (_super) {
    __extends(UniqueAttributeInfo, _super);
    function UniqueAttributeInfo(parameters) {
        _super.call(this, parameters);
        this._ensureSpecial("unique");
        this._ensureType('STRING');
    }
    UniqueAttributeInfo.fromJS = function (parameters) {
        return new UniqueAttributeInfo(AttributeInfo.jsToValue(parameters));
    };
    UniqueAttributeInfo.prototype.serialize = function (value) {
        throw new Error("can not serialize an approximate unique value");
    };
    return UniqueAttributeInfo;
}(AttributeInfo));
AttributeInfo.register(UniqueAttributeInfo);
export var ThetaAttributeInfo = (function (_super) {
    __extends(ThetaAttributeInfo, _super);
    function ThetaAttributeInfo(parameters) {
        _super.call(this, parameters);
        this._ensureSpecial("theta");
        this._ensureType('STRING');
    }
    ThetaAttributeInfo.fromJS = function (parameters) {
        return new ThetaAttributeInfo(AttributeInfo.jsToValue(parameters));
    };
    ThetaAttributeInfo.prototype.serialize = function (value) {
        throw new Error("can not serialize a theta value");
    };
    return ThetaAttributeInfo;
}(AttributeInfo));
AttributeInfo.register(ThetaAttributeInfo);
export var HistogramAttributeInfo = (function (_super) {
    __extends(HistogramAttributeInfo, _super);
    function HistogramAttributeInfo(parameters) {
        _super.call(this, parameters);
        this._ensureSpecial("histogram");
        this._ensureType('NUMBER');
    }
    HistogramAttributeInfo.fromJS = function (parameters) {
        return new HistogramAttributeInfo(AttributeInfo.jsToValue(parameters));
    };
    HistogramAttributeInfo.prototype.serialize = function (value) {
        throw new Error("can not serialize a histogram value");
    };
    return HistogramAttributeInfo;
}(AttributeInfo));
AttributeInfo.register(HistogramAttributeInfo);