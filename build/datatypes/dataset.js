import * as Q from 'q';
import { isDate } from "chronoshift";
import { isInstanceOf, generalEqual, SimpleArray, NamedArray } from "immutable-class";
import { hasOwnProperty } from "../helper/utils";
import { AttributeInfo } from "./attributeInfo";
import { NumberRange } from "./numberRange";
import { Set } from "./set";
import { StringRange } from "./stringRange";
import { TimeRange } from "./timeRange";
import { valueFromJS, valueToJSInlineType, datumHasExternal } from "./common";
import { External } from "../external/baseExternal";
export function foldContext(d, c) {
    var newContext = Object.create(c);
    for (var k in d) {
        newContext[k] = d[k];
    }
    return newContext;
}
var directionFns = {
    ascending: function (a, b) {
        if (a == null) {
            return b == null ? 0 : -1;
        }
        else {
            if (a.compare)
                return a.compare(b);
            if (b == null)
                return 1;
        }
        return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
    },
    descending: function (a, b) {
        if (b == null) {
            return a == null ? 0 : -1;
        }
        else {
            if (b.compare)
                return b.compare(a);
            if (a == null)
                return 1;
        }
        return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
    }
};
function typePreference(type) {
    switch (type) {
        case 'TIME': return 0;
        case 'STRING': return 1;
        case 'DATASET': return 5;
        default: return 2;
    }
}
function uniqueColumns(columns) {
    var seen = {};
    var uniqueColumns = [];
    for (var _i = 0, columns_1 = columns; _i < columns_1.length; _i++) {
        var column = columns_1[_i];
        if (!seen[column.name]) {
            uniqueColumns.push(column);
            seen[column.name] = true;
        }
    }
    return uniqueColumns;
}
function flattenColumns(nestedColumns, prefixColumns) {
    var flatColumns = [];
    var i = 0;
    var prefixString = '';
    while (i < nestedColumns.length) {
        var nestedColumn = nestedColumns[i];
        if (nestedColumn.type === 'DATASET') {
            nestedColumns = nestedColumn.columns;
            if (prefixColumns)
                prefixString += nestedColumn.name + '.';
            i = 0;
        }
        else {
            flatColumns.push({
                name: prefixString + nestedColumn.name,
                type: nestedColumn.type
            });
            i++;
        }
    }
    return uniqueColumns(flatColumns);
}
function removeLineBreaks(v) {
    return v.replace(/(?:\r\n|\r|\n)/g, ' ');
}
var escapeFnCSV = function (v) {
    v = removeLineBreaks(v);
    if (v.indexOf('"') === -1 && v.indexOf(",") === -1)
        return v;
    return "\"" + v.replace(/"/g, '""') + "\"";
};
var escapeFnTSV = function (v) {
    return removeLineBreaks(v).replace(/\t/g, "").replace(/"/g, '""');
};
var typeOrder = {
    'NULL': 0,
    'TIME': 1,
    'TIME_RANGE': 2,
    'SET/TIME': 3,
    'SET/TIME_RANGE': 4,
    'STRING': 5,
    'SET/STRING': 6,
    'BOOLEAN': 7,
    'NUMBER': 8,
    'NUMBER_RANGE': 9,
    'SET/NUMBER': 10,
    'SET/NUMBER_RANGE': 11,
    'DATASET': 12
};
var defaultFormatter = {
    'NULL': function (v) { return 'NULL'; },
    'TIME': function (v) { return v.toISOString(); },
    'TIME_RANGE': function (v) { return '' + v; },
    'SET/TIME': function (v) { return '' + v; },
    'SET/TIME_RANGE': function (v) { return '' + v; },
    'STRING': function (v) { return '' + v; },
    'SET/STRING': function (v) { return '' + v; },
    'BOOLEAN': function (v) { return '' + v; },
    'NUMBER': function (v) { return '' + v; },
    'NUMBER_RANGE': function (v) { return '' + v; },
    'SET/NUMBER': function (v) { return '' + v; },
    'SET/NUMBER_RANGE': function (v) { return '' + v; },
    'DATASET': function (v) { return 'DATASET'; }
};
function isBoolean(b) {
    return b === true || b === false;
}
function isNumber(n) {
    return n !== null && !isNaN(Number(n));
}
function isString(str) {
    return typeof str === "string";
}
function getAttributeInfo(name, attributeValue) {
    if (attributeValue == null)
        return null;
    if (isDate(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'TIME' });
    }
    else if (isBoolean(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'BOOLEAN' });
    }
    else if (isNumber(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'NUMBER' });
    }
    else if (isString(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'STRING' });
    }
    else if (NumberRange.isNumberRange(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'NUMBER_RANGE' });
    }
    else if (StringRange.isStringRange(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'STRING_RANGE' });
    }
    else if (TimeRange.isTimeRange(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'TIME_RANGE' });
    }
    else if (Set.isSet(attributeValue)) {
        return new AttributeInfo({ name: name, type: attributeValue.getType() });
    }
    else if (Dataset.isDataset(attributeValue)) {
        return new AttributeInfo({ name: name, type: 'DATASET', datasetType: attributeValue.getFullType().datasetType });
    }
    else {
        throw new Error("Could not introspect");
    }
}
function datumFromJS(js) {
    if (typeof js !== 'object')
        throw new TypeError("datum must be an object");
    var datum = Object.create(null);
    for (var k in js) {
        if (!hasOwnProperty(js, k))
            continue;
        datum[k] = valueFromJS(js[k]);
    }
    return datum;
}
function datumToJS(datum) {
    var js = {};
    for (var k in datum) {
        var v = datum[k];
        if (v && v.suppress)
            continue;
        js[k] = valueToJSInlineType(v);
    }
    return js;
}
function joinDatums(datumA, datumB) {
    var newDatum = Object.create(null);
    for (var k in datumA) {
        newDatum[k] = datumA[k];
    }
    for (var k in datumB) {
        newDatum[k] = datumB[k];
    }
    return newDatum;
}
function copy(obj) {
    var newObj = {};
    var k;
    for (k in obj) {
        if (hasOwnProperty(obj, k))
            newObj[k] = obj[k];
    }
    return newObj;
}
var check;
export var Dataset = (function () {
    function Dataset(parameters) {
        this.attributes = null;
        this.keys = null;
        if (parameters.suppress === true)
            this.suppress = true;
        if (parameters.keys) {
            this.keys = parameters.keys;
        }
        var data = parameters.data;
        if (!Array.isArray(data)) {
            throw new TypeError("must have a `data` array");
        }
        this.data = data;
        var attributes = parameters.attributes;
        if (!attributes)
            attributes = Dataset.getAttributesFromData(data);
        var attributeOverrides = parameters.attributeOverrides;
        if (attributeOverrides) {
            attributes = AttributeInfo.override(attributes, attributeOverrides);
        }
        this.attributes = attributes;
    }
    Dataset.isDataset = function (candidate) {
        return isInstanceOf(candidate, Dataset);
    };
    Dataset.getAttributesFromData = function (data) {
        if (!data.length)
            return [];
        var attributeNamesToIntrospect = Object.keys(data[0]);
        var attributes = [];
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var datum = data_1[_i];
            var attributeNamesStillToIntrospect = [];
            for (var _a = 0, attributeNamesToIntrospect_1 = attributeNamesToIntrospect; _a < attributeNamesToIntrospect_1.length; _a++) {
                var attributeNameToIntrospect = attributeNamesToIntrospect_1[_a];
                var attributeInfo = getAttributeInfo(attributeNameToIntrospect, datum[attributeNameToIntrospect]);
                if (attributeInfo) {
                    attributes.push(attributeInfo);
                }
                else {
                    attributeNamesStillToIntrospect.push(attributeNameToIntrospect);
                }
            }
            attributeNamesToIntrospect = attributeNamesStillToIntrospect;
            if (!attributeNamesToIntrospect.length)
                break;
        }
        for (var _b = 0, attributeNamesToIntrospect_2 = attributeNamesToIntrospect; _b < attributeNamesToIntrospect_2.length; _b++) {
            var attributeName = attributeNamesToIntrospect_2[_b];
            attributes.push(new AttributeInfo({ name: attributeName, type: 'STRING' }));
        }
        attributes.sort(function (a, b) {
            var typeDiff = typeOrder[a.type] - typeOrder[b.type];
            if (typeDiff)
                return typeDiff;
            return a.name.localeCompare(b.name);
        });
        return attributes;
    };
    Dataset.parseJSON = function (text) {
        text = text.trim();
        var firstChar = text[0];
        if (firstChar[0] === '[') {
            try {
                return JSON.parse(text);
            }
            catch (e) {
                throw new Error("could not parse");
            }
        }
        else if (firstChar[0] === '{') {
            return text.split(/\r?\n/).map(function (line, i) {
                try {
                    return JSON.parse(line);
                }
                catch (e) {
                    throw new Error("problem in line: " + i + ": '" + line + "'");
                }
            });
        }
        else {
            throw new Error("Unsupported start, starts with '" + firstChar[0] + "'");
        }
    };
    Dataset.fromJS = function (parameters) {
        if (Array.isArray(parameters)) {
            parameters = { data: parameters };
        }
        if (!Array.isArray(parameters.data)) {
            throw new Error('must have data');
        }
        var value = {};
        if (hasOwnProperty(parameters, 'attributes')) {
            value.attributes = AttributeInfo.fromJSs(parameters.attributes);
        }
        else if (hasOwnProperty(parameters, 'attributeOverrides')) {
            value.attributeOverrides = AttributeInfo.fromJSs(parameters.attributeOverrides);
        }
        value.keys = parameters.keys;
        value.data = parameters.data.map(datumFromJS);
        return new Dataset(value);
    };
    Dataset.prototype.valueOf = function () {
        var value = {};
        if (this.suppress)
            value.suppress = true;
        if (this.attributes)
            value.attributes = this.attributes;
        if (this.keys)
            value.keys = this.keys;
        value.data = this.data;
        return value;
    };
    Dataset.prototype.toJS = function () {
        return this.data.map(datumToJS);
    };
    Dataset.prototype.toString = function () {
        return "Dataset(" + this.data.length + ")";
    };
    Dataset.prototype.toJSON = function () {
        return this.toJS();
    };
    Dataset.prototype.equals = function (other) {
        return Dataset.isDataset(other) &&
            this.data.length === other.data.length;
    };
    Dataset.prototype.hide = function () {
        var value = this.valueOf();
        value.suppress = true;
        return new Dataset(value);
    };
    Dataset.prototype.basis = function () {
        var data = this.data;
        return data.length === 1 && Object.keys(data[0]).length === 0;
    };
    Dataset.prototype.hasExternal = function () {
        if (!this.data.length)
            return false;
        return datumHasExternal(this.data[0]);
    };
    Dataset.prototype.getFullType = function () {
        var attributes = this.attributes;
        if (!attributes)
            throw new Error("dataset has not been introspected");
        var myDatasetType = {};
        for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
            var attribute = attributes_1[_i];
            var attrName = attribute.name;
            if (attribute.type === 'DATASET') {
                myDatasetType[attrName] = {
                    type: 'DATASET',
                    datasetType: attribute.datasetType
                };
            }
            else {
                myDatasetType[attrName] = {
                    type: attribute.type
                };
            }
        }
        return {
            type: 'DATASET',
            datasetType: myDatasetType
        };
    };
    Dataset.prototype.select = function (attrs) {
        var attributes = this.attributes;
        var newAttributes = [];
        var attrLookup = Object.create(null);
        for (var _i = 0, attrs_1 = attrs; _i < attrs_1.length; _i++) {
            var attr = attrs_1[_i];
            attrLookup[attr] = true;
            var existingAttribute = NamedArray.get(attributes, attr);
            if (existingAttribute)
                newAttributes.push(existingAttribute);
        }
        var data = this.data;
        var n = data.length;
        var newData = new Array(n);
        for (var i = 0; i < n; i++) {
            var datum = data[i];
            var newDatum = Object.create(null);
            for (var key in datum) {
                if (attrLookup[key]) {
                    newDatum[key] = datum[key];
                }
            }
            newData[i] = newDatum;
        }
        var value = this.valueOf();
        value.attributes = newAttributes;
        value.data = newData;
        return new Dataset(value);
    };
    Dataset.prototype.apply = function (name, exFn, type, context) {
        var data = this.data;
        var n = data.length;
        var newData = new Array(n);
        for (var i = 0; i < n; i++) {
            var datum = data[i];
            var newDatum = Object.create(null);
            for (var key in datum)
                newDatum[key] = datum[key];
            newDatum[name] = exFn(datum, context, i);
            newData[i] = newDatum;
        }
        var datasetType = null;
        if (type === 'DATASET' && newData[0] && newData[0][name]) {
            datasetType = newData[0][name].getFullType().datasetType;
        }
        var value = this.valueOf();
        value.attributes = NamedArray.overrideByName(value.attributes, new AttributeInfo({ name: name, type: type, datasetType: datasetType }));
        value.data = newData;
        return new Dataset(value);
    };
    Dataset.prototype.applyPromise = function (name, exFn, type, context) {
        var _this = this;
        var value = this.valueOf();
        var promises = value.data.map(function (datum) { return exFn(datum, context); });
        return Q.all(promises).then(function (values) {
            return _this.apply(name, (function (d, c, i) { return values[i]; }), type, context);
        });
    };
    Dataset.prototype.filter = function (exFn, context) {
        var value = this.valueOf();
        value.data = value.data.filter(function (datum) { return exFn(datum, context); });
        return new Dataset(value);
    };
    Dataset.prototype.sort = function (exFn, direction, context) {
        var value = this.valueOf();
        var directionFn = directionFns[direction];
        value.data = this.data.sort(function (a, b) {
            return directionFn(exFn(a, context), exFn(b, context));
        });
        return new Dataset(value);
    };
    Dataset.prototype.limit = function (limit) {
        var data = this.data;
        if (data.length <= limit)
            return this;
        var value = this.valueOf();
        value.data = data.slice(0, limit);
        return new Dataset(value);
    };
    Dataset.prototype.count = function () {
        return this.data.length;
    };
    Dataset.prototype.sum = function (exFn, context) {
        var data = this.data;
        var sum = 0;
        for (var _i = 0, data_2 = data; _i < data_2.length; _i++) {
            var datum = data_2[_i];
            sum += exFn(datum, context);
        }
        return sum;
    };
    Dataset.prototype.average = function (exFn, context) {
        var count = this.count();
        return count ? (this.sum(exFn, context) / count) : null;
    };
    Dataset.prototype.min = function (exFn, context) {
        var data = this.data;
        var min = Infinity;
        for (var _i = 0, data_3 = data; _i < data_3.length; _i++) {
            var datum = data_3[_i];
            var v = exFn(datum, context);
            if (v < min)
                min = v;
        }
        return min;
    };
    Dataset.prototype.max = function (exFn, context) {
        var data = this.data;
        var max = -Infinity;
        for (var _i = 0, data_4 = data; _i < data_4.length; _i++) {
            var datum = data_4[_i];
            var v = exFn(datum, context);
            if (max < v)
                max = v;
        }
        return max;
    };
    Dataset.prototype.countDistinct = function (exFn, context) {
        var data = this.data;
        var seen = Object.create(null);
        var count = 0;
        for (var _i = 0, data_5 = data; _i < data_5.length; _i++) {
            var datum = data_5[_i];
            var v = exFn(datum, context);
            if (!seen[v]) {
                seen[v] = 1;
                ++count;
            }
        }
        return count;
    };
    Dataset.prototype.quantile = function (exFn, quantile, context) {
        var data = this.data;
        var vs = [];
        for (var _i = 0, data_6 = data; _i < data_6.length; _i++) {
            var datum = data_6[_i];
            var v = exFn(datum, context);
            if (v != null)
                vs.push(v);
        }
        vs.sort(function (a, b) { return a - b; });
        var n = vs.length;
        if (quantile === 0)
            return vs[0];
        if (quantile === 1)
            return vs[n - 1];
        var rank = n * quantile - 1;
        if (rank === Math.floor(rank)) {
            return (vs[rank] + vs[rank + 1]) / 2;
        }
        else {
            return vs[Math.ceil(rank)];
        }
    };
    Dataset.prototype.split = function (splitFns, datasetName, context) {
        var _a = this, data = _a.data, attributes = _a.attributes;
        var keys = Object.keys(splitFns);
        var numberOfKeys = keys.length;
        var splitFnList = keys.map(function (k) { return splitFns[k]; });
        var splits = {};
        var datumGroups = {};
        var finalData = [];
        var finalDataset = [];
        function addDatum(datum, valueList) {
            var key = valueList.join(';_PLYw00d_;');
            if (hasOwnProperty(datumGroups, key)) {
                datumGroups[key].push(datum);
            }
            else {
                var newDatum = Object.create(null);
                for (var i = 0; i < numberOfKeys; i++) {
                    newDatum[keys[i]] = valueList[i];
                }
                finalDataset.push(datumGroups[key] = [datum]);
                splits[key] = newDatum;
                finalData.push(newDatum);
            }
        }
        for (var _i = 0, data_7 = data; _i < data_7.length; _i++) {
            var datum = data_7[_i];
            var valueList = splitFnList.map(function (splitFn) { return splitFn(datum, context); });
            if (Set.isSet(valueList[0])) {
                if (valueList.length > 1)
                    throw new Error('multi-dimensional set split is not implemented');
                var elements = valueList[0].elements;
                for (var _b = 0, elements_1 = elements; _b < elements_1.length; _b++) {
                    var element = elements_1[_b];
                    addDatum(datum, [element]);
                }
            }
            else {
                addDatum(datum, valueList);
            }
        }
        for (var i = 0; i < finalData.length; i++) {
            finalData[i][datasetName] = new Dataset({
                suppress: true,
                attributes: attributes,
                data: finalDataset[i]
            });
        }
        return new Dataset({
            keys: keys,
            data: finalData
        });
    };
    Dataset.prototype.introspect = function () {
        console.error('introspection is always done, `.introspect()` method never needs to be called');
    };
    Dataset.prototype.getExternals = function () {
        if (this.data.length === 0)
            return [];
        var datum = this.data[0];
        var externals = [];
        Object.keys(datum).forEach(function (applyName) {
            var applyValue = datum[applyName];
            if (applyValue instanceof Dataset) {
                externals.push.apply(externals, applyValue.getExternals());
            }
        });
        return External.deduplicateExternals(externals);
    };
    Dataset.prototype.join = function (other) {
        if (!other)
            return this;
        var thisKey = this.keys[0];
        if (!thisKey)
            throw new Error('join lhs must have a key (be a product of a split)');
        var otherKey = other.keys[0];
        if (!otherKey)
            throw new Error('join rhs must have a key (be a product of a split)');
        var thisData = this.data;
        var otherData = other.data;
        var k;
        var mapping = Object.create(null);
        for (var i = 0; i < thisData.length; i++) {
            var datum = thisData[i];
            k = String(thisKey ? datum[thisKey] : i);
            mapping[k] = [datum];
        }
        for (var i = 0; i < otherData.length; i++) {
            var datum = otherData[i];
            k = String(otherKey ? datum[otherKey] : i);
            if (!mapping[k])
                mapping[k] = [];
            mapping[k].push(datum);
        }
        var newData = [];
        for (var j in mapping) {
            var datums = mapping[j];
            if (datums.length === 1) {
                newData.push(datums[0]);
            }
            else {
                newData.push(joinDatums(datums[0], datums[1]));
            }
        }
        return new Dataset({ data: newData });
    };
    Dataset.prototype.findDatumByAttribute = function (attribute, value) {
        return SimpleArray.find(this.data, function (d) { return generalEqual(d[attribute], value); });
    };
    Dataset.prototype.getNestedColumns = function () {
        var nestedColumns = [];
        var attributes = this.attributes;
        var subDatasetAdded = false;
        for (var _i = 0, attributes_2 = attributes; _i < attributes_2.length; _i++) {
            var attribute = attributes_2[_i];
            var column = {
                name: attribute.name,
                type: attribute.type
            };
            if (attribute.type === 'DATASET') {
                var subDataset = this.data[0][attribute.name];
                if (!subDatasetAdded && Dataset.isDataset(subDataset)) {
                    subDatasetAdded = true;
                    column.columns = subDataset.getNestedColumns();
                    nestedColumns.push(column);
                }
            }
            else {
                nestedColumns.push(column);
            }
        }
        return nestedColumns;
    };
    Dataset.prototype.getColumns = function (options) {
        if (options === void 0) { options = {}; }
        var prefixColumns = options.prefixColumns;
        return flattenColumns(this.getNestedColumns(), prefixColumns);
    };
    Dataset.prototype._flattenHelper = function (nestedColumns, prefix, order, nestingName, parentName, nesting, context, flat) {
        var nestedColumnsLength = nestedColumns.length;
        if (!nestedColumnsLength)
            return;
        var data = this.data;
        var datasetColumn = nestedColumns.filter(function (nestedColumn) { return nestedColumn.type === 'DATASET'; })[0];
        for (var _i = 0, data_8 = data; _i < data_8.length; _i++) {
            var datum = data_8[_i];
            var flatDatum = context ? copy(context) : {};
            if (nestingName)
                flatDatum[nestingName] = nesting;
            if (parentName)
                flatDatum[parentName] = context;
            for (var _a = 0, nestedColumns_1 = nestedColumns; _a < nestedColumns_1.length; _a++) {
                var flattenedColumn = nestedColumns_1[_a];
                if (flattenedColumn.type === 'DATASET')
                    continue;
                var flatName = (prefix !== null ? prefix : '') + flattenedColumn.name;
                flatDatum[flatName] = datum[flattenedColumn.name];
            }
            if (datasetColumn) {
                var nextPrefix = null;
                if (prefix !== null)
                    nextPrefix = prefix + datasetColumn.name + '.';
                if (order === 'preorder')
                    flat.push(flatDatum);
                datum[datasetColumn.name]._flattenHelper(datasetColumn.columns, nextPrefix, order, nestingName, parentName, nesting + 1, flatDatum, flat);
                if (order === 'postorder')
                    flat.push(flatDatum);
            }
            if (!datasetColumn)
                flat.push(flatDatum);
        }
    };
    Dataset.prototype.flatten = function (options) {
        if (options === void 0) { options = {}; }
        var prefixColumns = options.prefixColumns;
        var order = options.order;
        var nestingName = options.nestingName;
        var parentName = options.parentName;
        var nestedColumns = this.getNestedColumns();
        var flatData = [];
        if (nestedColumns.length) {
            this._flattenHelper(nestedColumns, (prefixColumns ? '' : null), order, nestingName, parentName, 0, null, flatData);
        }
        return flatData;
    };
    Dataset.prototype.toTabular = function (tabulatorOptions) {
        var formatter = tabulatorOptions.formatter || {};
        var finalizer = tabulatorOptions.finalizer;
        var data = this.flatten(tabulatorOptions);
        var columns = this.getColumns(tabulatorOptions);
        var lines = [];
        lines.push(columns.map(function (c) { return c.name; }).join(tabulatorOptions.separator || ','));
        for (var i = 0; i < data.length; i++) {
            var datum = data[i];
            lines.push(columns.map(function (c) {
                var value = datum[c.name];
                var formatted = String((formatter[c.type] || defaultFormatter[c.type])(value));
                var finalized = formatted && finalizer ? finalizer(formatted) : formatted;
                return finalized;
            }).join(tabulatorOptions.separator || ','));
        }
        var lineBreak = tabulatorOptions.lineBreak || '\n';
        return lines.join(lineBreak) + (tabulatorOptions.finalLineBreak === 'include' && lines.length > 0 ? lineBreak : '');
    };
    Dataset.prototype.toCSV = function (tabulatorOptions) {
        if (tabulatorOptions === void 0) { tabulatorOptions = {}; }
        tabulatorOptions.finalizer = escapeFnCSV;
        tabulatorOptions.separator = tabulatorOptions.separator || ',';
        tabulatorOptions.lineBreak = tabulatorOptions.lineBreak || '\r\n';
        tabulatorOptions.finalLineBreak = tabulatorOptions.finalLineBreak || 'suppress';
        return this.toTabular(tabulatorOptions);
    };
    Dataset.prototype.toTSV = function (tabulatorOptions) {
        if (tabulatorOptions === void 0) { tabulatorOptions = {}; }
        tabulatorOptions.finalizer = escapeFnTSV;
        tabulatorOptions.separator = tabulatorOptions.separator || '\t';
        tabulatorOptions.lineBreak = tabulatorOptions.lineBreak || '\r\n';
        tabulatorOptions.finalLineBreak = tabulatorOptions.finalLineBreak || 'suppress';
        return this.toTabular(tabulatorOptions);
    };
    Dataset.type = 'DATASET';
    return Dataset;
}());
check = Dataset;