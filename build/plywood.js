'use strict';

var Q = require('q');

var immutableClass = require('immutable-class');
var isInstanceOf = immutableClass.isInstanceOf;
var generalEqual = immutableClass.generalEqual;
var isImmutableClass = immutableClass.isImmutableClass;
var immutableEqual = immutableClass.immutableEqual;
var immutableArraysEqual = immutableClass.immutableArraysEqual;
var immutableLookupsEqual = immutableClass.immutableLookupsEqual;
var SimpleArray = immutableClass.SimpleArray;
var NamedArray = immutableClass.NamedArray;

var Chronoshift = require('chronoshift');
var Timezone = Chronoshift.Timezone;
var Duration = Chronoshift.Duration;
var WallTime = Chronoshift.WallTime;
var isDate = Chronoshift.isDate;
var parseISODate = Chronoshift.parseISODate;

var dummyObject = {};

var version = exports.version = '0.12.8';
var verboseRequesterFactory = exports.verboseRequesterFactory = function(parameters) {
    var requester = parameters.requester;
    var printLine = parameters.printLine || (function (line) {
        console['log'](line);
    });
    var preQuery = parameters.preQuery || (function (query, queryNumber) {
        printLine("vvvvvvvvvvvvvvvvvvvvvvvvvv");
        printLine("Sending query " + queryNumber + ":");
        printLine(JSON.stringify(query, null, 2));
        printLine("^^^^^^^^^^^^^^^^^^^^^^^^^^");
    });
    var onSuccess = parameters.onSuccess || (function (data, time, query, queryNumber) {
        printLine("vvvvvvvvvvvvvvvvvvvvvvvvvv");
        printLine("Got result from query " + queryNumber + ": (in " + time + "ms)");
        printLine(JSON.stringify(data, null, 2));
        printLine("^^^^^^^^^^^^^^^^^^^^^^^^^^");
    });
    var onError = parameters.onError || (function (error, time, query, queryNumber) {
        printLine("vvvvvvvvvvvvvvvvvvvvvvvvvv");
        printLine("Got error in query " + queryNumber + ": " + error.message + " (in " + time + "ms)");
        printLine("^^^^^^^^^^^^^^^^^^^^^^^^^^");
    });
    var queryNumber = 0;
    return function (request) {
        queryNumber++;
        var myQueryNumber = queryNumber;
        preQuery(request.query, myQueryNumber);
        var startTime = Date.now();
        return requester(request)
            .then(function (data) {
            onSuccess(data, Date.now() - startTime, request.query, myQueryNumber);
            return data;
        }, function (error) {
            onError(error, Date.now() - startTime, request.query, myQueryNumber);
            throw error;
        });
    };
}

var retryRequesterFactory = exports.retryRequesterFactory = function(parameters) {
    var requester = parameters.requester;
    var delay = parameters.delay || 500;
    var retry = parameters.retry || 3;
    var retryOnTimeout = Boolean(parameters.retryOnTimeout);
    if (typeof delay !== "number")
        throw new TypeError("delay should be a number");
    if (typeof retry !== "number")
        throw new TypeError("retry should be a number");
    return function (request) {
        var tries = 1;
        function handleError(err) {
            if (tries > retry)
                throw err;
            tries++;
            if (err.message === "timeout" && !retryOnTimeout)
                throw err;
            return Q.delay(delay).then(function () { return requester(request); }).catch(handleError);
        }
        return requester(request).catch(handleError);
    };
}

var concurrentLimitRequesterFactory = exports.concurrentLimitRequesterFactory = function(parameters) {
    var requester = parameters.requester;
    var concurrentLimit = parameters.concurrentLimit || 5;
    if (typeof concurrentLimit !== "number")
        throw new TypeError("concurrentLimit should be a number");
    var requestQueue = [];
    var outstandingRequests = 0;
    function requestFinished() {
        outstandingRequests--;
        if (!(requestQueue.length && outstandingRequests < concurrentLimit))
            return;
        var queueItem = requestQueue.shift();
        var deferred = queueItem.deferred;
        outstandingRequests++;
        requester(queueItem.request)
            .then(deferred.resolve, deferred.reject)
            .fin(requestFinished);
    }
    return function (request) {
        if (outstandingRequests < concurrentLimit) {
            outstandingRequests++;
            return requester(request).fin(requestFinished);
        }
        else {
            var deferred = Q.defer();
            requestQueue.push({
                request: request,
                deferred: deferred
            });
            return deferred.promise;
        }
    };
}

var promiseWhile = exports.promiseWhile = function(condition, action) {
    var loop = function () {
        if (!condition())
            return Q(null);
        return Q(action()).then(loop);
    };
    return Q(null).then(loop);
}
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var objectHasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwnProperty = exports.hasOwnProperty = function(obj, key) {
    return objectHasOwnProperty.call(obj, key);
}
var repeat = exports.repeat = function(str, times) {
    return new Array(times + 1).join(str);
}
var arraysEqual = exports.arraysEqual = function(a, b) {
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
var dictEqual = exports.dictEqual = function(dictA, dictB) {
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
var shallowCopy = exports.shallowCopy = function(thing) {
    var newThing = {};
    for (var k in thing) {
        if (hasOwnProperty(thing, k))
            newThing[k] = thing[k];
    }
    return newThing;
}
var deduplicateSort = exports.deduplicateSort = function(a) {
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
var mapLookup = exports.mapLookup = function(thing, fn) {
    var newThing = Object.create(null);
    for (var k in thing) {
        if (hasOwnProperty(thing, k))
            newThing[k] = fn(thing[k]);
    }
    return newThing;
}
var emptyLookup = exports.emptyLookup = function(lookup) {
    for (var k in lookup) {
        if (hasOwnProperty(lookup, k))
            return false;
    }
    return true;
}
var nonEmptyLookup = exports.nonEmptyLookup = function(lookup) {
    return !emptyLookup(lookup);
}
var safeAdd = exports.safeAdd = function(num, delta) {
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
var continuousFloorExpression = exports.continuousFloorExpression = function(variable, floorFn, size, offset) {
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
var ExtendableError = exports.ExtendableError = (function (_super) {
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
var SQLDialect = exports.SQLDialect = (function () {
    function SQLDialect() {
    }
    SQLDialect.prototype.constantGroupBy = function () {
        return "GROUP BY ''";
    };
    SQLDialect.prototype.escapeName = function (name) {
        name = name.replace(/"/g, '""');
        return '"' + name + '"';
    };
    SQLDialect.prototype.escapeLiteral = function (name) {
        if (name === null)
            return 'NULL';
        name = name.replace(/'/g, "''");
        return "'" + name + "'";
    };
    SQLDialect.prototype.booleanToSQL = function (bool) {
        return ('' + bool).toUpperCase();
    };
    SQLDialect.prototype.numberOrTimeToSQL = function (x) {
        if (x === null)
            return 'NULL';
        if (x.toISOString) {
            return this.timeToSQL(x);
        }
        else {
            return this.numberToSQL(x);
        }
    };
    SQLDialect.prototype.numberToSQL = function (num) {
        if (num === null)
            return 'NULL';
        return '' + num;
    };
    SQLDialect.prototype.dateToSQLDateString = function (date) {
        return date.toISOString()
            .replace('T', ' ')
            .replace('Z', '')
            .replace(/\.000$/, '')
            .replace(/ 00:00:00$/, '');
    };
    SQLDialect.prototype.aggregateFilterIfNeeded = function (inputSQL, expressionSQL, zeroSQL) {
        if (zeroSQL === void 0) { zeroSQL = '0'; }
        var whereIndex = inputSQL.indexOf(' WHERE ');
        if (whereIndex === -1)
            return expressionSQL;
        var filterSQL = inputSQL.substr(whereIndex + 7);
        return this.conditionalExpression(filterSQL, expressionSQL, zeroSQL);
    };
    SQLDialect.prototype.conditionalExpression = function (condition, thenPart, elsePart) {
        return "IF(" + condition + "," + thenPart + "," + elsePart + ")";
    };
    SQLDialect.prototype.concatExpression = function (a, b) {
        throw new Error('must implement');
    };
    SQLDialect.prototype.containsExpression = function (a, b) {
        throw new Error('must implement');
    };
    SQLDialect.prototype.isNotDistinctFromExpression = function (a, b) {
        if (a === 'NULL')
            return b + " IS NULL";
        if (b === 'NULL')
            return a + " IS NULL";
        return "(" + a + " IS NOT DISTINCT FROM " + b + ")";
    };
    SQLDialect.prototype.inExpression = function (operand, start, end, bounds) {
        if (start === end && bounds === '[]')
            return operand + "=" + start;
        var startSQL = null;
        if (start !== 'NULL') {
            startSQL = start + (bounds[0] === '[' ? '<=' : '<') + operand;
        }
        var endSQL = null;
        if (end !== 'NULL') {
            endSQL = operand + (bounds[1] === ']' ? '<=' : '<') + end;
        }
        if (startSQL) {
            return endSQL ? "(" + startSQL + " AND " + endSQL + ")" : startSQL;
        }
        else {
            return endSQL ? endSQL : 'TRUE';
        }
    };
    return SQLDialect;
}());
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var MySQLDialect = exports.MySQLDialect = (function (_super) {
    __extends(MySQLDialect, _super);
    function MySQLDialect() {
        _super.call(this);
    }
    MySQLDialect.prototype.escapeName = function (name) {
        name = name.replace(/`/g, '``');
        return '`' + name + '`';
    };
    MySQLDialect.prototype.escapeLiteral = function (name) {
        if (name === null)
            return 'NULL';
        return JSON.stringify(name);
    };
    MySQLDialect.prototype.timeToSQL = function (date) {
        if (!date)
            return 'NULL';
        return "TIMESTAMP('" + this.dateToSQLDateString(date) + "')";
    };
    MySQLDialect.prototype.concatExpression = function (a, b) {
        return "CONCAT(" + a + "," + b + ")";
    };
    MySQLDialect.prototype.containsExpression = function (a, b) {
        return "LOCATE(" + a + "," + b + ")>0";
    };
    MySQLDialect.prototype.lengthExpression = function (a) {
        return "CHAR_LENGTH(" + a + ")";
    };
    MySQLDialect.prototype.isNotDistinctFromExpression = function (a, b) {
        return "(" + a + "<=>" + b + ")";
    };
    MySQLDialect.prototype.regexpExpression = function (expression, regexp) {
        return "(" + expression + " REGEXP '" + regexp + "')";
    };
    MySQLDialect.prototype.castExpression = function (inputType, operand, cast) {
        var castFunction = MySQLDialect.CAST_TO_FUNCTION[cast][inputType];
        if (!castFunction)
            throw new Error("unsupported cast from " + inputType + " to " + cast + " in MySQL dialect");
        return castFunction.replace(/\$\$/g, operand);
    };
    MySQLDialect.prototype.utcToWalltime = function (operand, timezone) {
        if (timezone.isUTC())
            return operand;
        return "CONVERT_TZ(" + operand + ",'+0:00','" + timezone + "')";
    };
    MySQLDialect.prototype.walltimeToUTC = function (operand, timezone) {
        if (timezone.isUTC())
            return operand;
        return "CONVERT_TZ(" + operand + ",'" + timezone + "','+0:00')";
    };
    MySQLDialect.prototype.timeFloorExpression = function (operand, duration, timezone) {
        var bucketFormat = MySQLDialect.TIME_BUCKETING[duration.toString()];
        if (!bucketFormat)
            throw new Error("unsupported duration '" + duration + "'");
        return this.walltimeToUTC("DATE_FORMAT(" + this.utcToWalltime(operand, timezone) + ",'" + bucketFormat + "')", timezone);
    };
    MySQLDialect.prototype.timeBucketExpression = function (operand, duration, timezone) {
        return this.timeFloorExpression(operand, duration, timezone);
    };
    MySQLDialect.prototype.timePartExpression = function (operand, part, timezone) {
        var timePartFunction = MySQLDialect.TIME_PART_TO_FUNCTION[part];
        if (!timePartFunction)
            throw new Error("unsupported part " + part + " in MySQL dialect");
        return timePartFunction.replace(/\$\$/g, this.utcToWalltime(operand, timezone));
    };
    MySQLDialect.prototype.timeShiftExpression = function (operand, duration, timezone) {
        var sqlFn = "DATE_ADD(";
        var spans = duration.valueOf();
        if (spans.week) {
            return sqlFn + operand + ", INTERVAL " + String(spans.week) + ' WEEK)';
        }
        if (spans.year || spans.month) {
            var expr = String(spans.year || 0) + "-" + String(spans.month || 0);
            operand = sqlFn + operand + ", INTERVAL '" + expr + "' YEAR_MONTH)";
        }
        if (spans.day || spans.hour || spans.minute || spans.second) {
            var expr = String(spans.day || 0) + " " + [spans.hour || 0, spans.minute || 0, spans.second || 0].join(':');
            operand = sqlFn + operand + ", INTERVAL '" + expr + "' DAY_SECOND)";
        }
        return operand;
    };
    MySQLDialect.prototype.extractExpression = function (operand, regexp) {
        throw new Error('MySQL must implement extractExpression (https://github.com/mysqludf/lib_mysqludf_preg)');
    };
    MySQLDialect.prototype.indexOfExpression = function (str, substr) {
        return "LOCATE(" + substr + ", " + str + ") - 1";
    };
    MySQLDialect.TIME_BUCKETING = {
        "PT1S": "%Y-%m-%d %H:%i:%SZ",
        "PT1M": "%Y-%m-%d %H:%i:00Z",
        "PT1H": "%Y-%m-%d %H:00:00Z",
        "P1D": "%Y-%m-%d 00:00:00Z",
        "P1M": "%Y-%m-01 00:00:00Z",
        "P1Y": "%Y-01-01 00:00:00Z"
    };
    MySQLDialect.TIME_PART_TO_FUNCTION = {
        SECOND_OF_MINUTE: 'SECOND($$)',
        SECOND_OF_HOUR: '(MINUTE($$)*60+SECOND($$))',
        SECOND_OF_DAY: '((HOUR($$)*60+MINUTE($$))*60+SECOND($$))',
        SECOND_OF_WEEK: '(((WEEKDAY($$)*24)+HOUR($$)*60+MINUTE($$))*60+SECOND($$))',
        SECOND_OF_MONTH: '((((DAYOFMONTH($$)-1)*24)+HOUR($$)*60+MINUTE($$))*60+SECOND($$))',
        SECOND_OF_YEAR: '((((DAYOFYEAR($$)-1)*24)+HOUR($$)*60+MINUTE($$))*60+SECOND($$))',
        MINUTE_OF_HOUR: 'MINUTE($$)',
        MINUTE_OF_DAY: 'HOUR($$)*60+MINUTE($$)',
        MINUTE_OF_WEEK: '(WEEKDAY($$)*24)+HOUR($$)*60+MINUTE($$)',
        MINUTE_OF_MONTH: '((DAYOFMONTH($$)-1)*24)+HOUR($$)*60+MINUTE($$)',
        MINUTE_OF_YEAR: '((DAYOFYEAR($$)-1)*24)+HOUR($$)*60+MINUTE($$)',
        HOUR_OF_DAY: 'HOUR($$)',
        HOUR_OF_WEEK: '(WEEKDAY($$)*24+HOUR($$))',
        HOUR_OF_MONTH: '((DAYOFMONTH($$)-1)*24+HOUR($$))',
        HOUR_OF_YEAR: '((DAYOFYEAR($$)-1)*24+HOUR($$))',
        DAY_OF_WEEK: '(WEEKDAY($$)+1)',
        DAY_OF_MONTH: 'DAYOFMONTH($$)',
        DAY_OF_YEAR: 'DAYOFYEAR($$)',
        WEEK_OF_MONTH: null,
        WEEK_OF_YEAR: 'WEEK($$)',
        MONTH_OF_YEAR: 'MONTH($$)',
        YEAR: 'YEAR($$)'
    };
    MySQLDialect.CAST_TO_FUNCTION = {
        TIME: {
            NUMBER: 'FROM_UNIXTIME($$ / 1000)'
        },
        NUMBER: {
            TIME: 'UNIX_TIMESTAMP($$) * 1000',
            STRING: 'CAST($$ AS SIGNED)'
        },
        STRING: {
            NUMBER: 'CAST($$ AS CHAR)'
        }
    };
    return MySQLDialect;
}(SQLDialect));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var PostgresDialect = exports.PostgresDialect = (function (_super) {
    __extends(PostgresDialect, _super);
    function PostgresDialect() {
        _super.call(this);
    }
    PostgresDialect.prototype.constantGroupBy = function () {
        return "GROUP BY ''=''";
    };
    PostgresDialect.prototype.timeToSQL = function (date) {
        if (!date)
            return 'NULL';
        return "TIMESTAMP '" + this.dateToSQLDateString(date) + "'";
    };
    PostgresDialect.prototype.conditionalExpression = function (condition, thenPart, elsePart) {
        return "(CASE WHEN " + condition + " THEN " + thenPart + " ELSE " + elsePart + " END)";
    };
    PostgresDialect.prototype.concatExpression = function (a, b) {
        return "(" + a + "||" + b + ")";
    };
    PostgresDialect.prototype.containsExpression = function (a, b) {
        return "POSITION(" + a + " IN " + b + ")>0";
    };
    PostgresDialect.prototype.lengthExpression = function (a) {
        return "LENGTH(" + a + ")";
    };
    PostgresDialect.prototype.regexpExpression = function (expression, regexp) {
        return "(" + expression + " ~ '" + regexp + "')";
    };
    PostgresDialect.prototype.castExpression = function (inputType, operand, cast) {
        var castFunction = PostgresDialect.CAST_TO_FUNCTION[cast][inputType];
        if (!castFunction)
            throw new Error("unsupported cast from " + inputType + " to " + cast + " in Postgres dialect");
        return castFunction.replace(/\$\$/g, operand);
    };
    PostgresDialect.prototype.utcToWalltime = function (operand, timezone) {
        if (timezone.isUTC())
            return operand;
        return "(" + operand + " AT TIME ZONE 'UTC' AT TIME ZONE '" + timezone + "')";
    };
    PostgresDialect.prototype.walltimeToUTC = function (operand, timezone) {
        if (timezone.isUTC())
            return operand;
        return "(" + operand + " AT TIME ZONE '" + timezone + "' AT TIME ZONE 'UTC')";
    };
    PostgresDialect.prototype.timeFloorExpression = function (operand, duration, timezone) {
        var bucketFormat = PostgresDialect.TIME_BUCKETING[duration.toString()];
        if (!bucketFormat)
            throw new Error("unsupported duration '" + duration + "'");
        return this.walltimeToUTC("DATE_TRUNC('" + bucketFormat + "'," + this.utcToWalltime(operand, timezone) + ")", timezone);
    };
    PostgresDialect.prototype.timeBucketExpression = function (operand, duration, timezone) {
        return this.timeFloorExpression(operand, duration, timezone);
    };
    PostgresDialect.prototype.timePartExpression = function (operand, part, timezone) {
        var timePartFunction = PostgresDialect.TIME_PART_TO_FUNCTION[part];
        if (!timePartFunction)
            throw new Error("unsupported part " + part + " in Postgres dialect");
        return timePartFunction.replace(/\$\$/g, this.utcToWalltime(operand, timezone));
    };
    PostgresDialect.prototype.timeShiftExpression = function (operand, duration, timezone) {
        var sqlFn = "DATE_ADD(";
        var spans = duration.valueOf();
        if (spans.week) {
            return sqlFn + operand + ", INTERVAL " + String(spans.week) + ' WEEK)';
        }
        if (spans.year || spans.month) {
            var expr = String(spans.year || 0) + "-" + String(spans.month || 0);
            operand = sqlFn + operand + ", INTERVAL '" + expr + "' YEAR_MONTH)";
        }
        if (spans.day || spans.hour || spans.minute || spans.second) {
            var expr = String(spans.day || 0) + " " + [spans.hour || 0, spans.minute || 0, spans.second || 0].join(':');
            operand = sqlFn + operand + ", INTERVAL '" + expr + "' DAY_SECOND)";
        }
        return operand;
    };
    PostgresDialect.prototype.extractExpression = function (operand, regexp) {
        return "(SELECT (REGEXP_MATCHES(" + operand + ", '" + regexp + "'))[1])";
    };
    PostgresDialect.prototype.indexOfExpression = function (str, substr) {
        return "POSITION(" + substr + " IN " + str + ") - 1";
    };
    PostgresDialect.TIME_BUCKETING = {
        "PT1S": "second",
        "PT1M": "minute",
        "PT1H": "hour",
        "P1D": "day",
        "P1W": "week",
        "P1M": "month",
        "P3M": "quarter",
        "P1Y": "year"
    };
    PostgresDialect.TIME_PART_TO_FUNCTION = {
        SECOND_OF_MINUTE: "DATE_PART('second',$$)",
        SECOND_OF_HOUR: "(DATE_PART('minute',$$)*60+DATE_PART('second',$$))",
        SECOND_OF_DAY: "((DATE_PART('hour',$$)*60+DATE_PART('minute',$$))*60+DATE_PART('second',$$))",
        SECOND_OF_WEEK: "((((CAST((DATE_PART('dow',$$)+6) AS int)%7)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$))*60+DATE_PART('second',$$))",
        SECOND_OF_MONTH: "((((DATE_PART('day',$$)-1)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$))*60+DATE_PART('second',$$))",
        SECOND_OF_YEAR: "((((DATE_PART('doy',$$)-1)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$))*60+DATE_PART('second',$$))",
        MINUTE_OF_HOUR: "DATE_PART('minute',$$)",
        MINUTE_OF_DAY: "DATE_PART('hour',$$)*60+DATE_PART('minute',$$)",
        MINUTE_OF_WEEK: "((CAST((DATE_PART('dow',$$)+6) AS int)%7)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$)",
        MINUTE_OF_MONTH: "((DATE_PART('day',$$)-1)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$)",
        MINUTE_OF_YEAR: "((DATE_PART('doy',$$)-1)*24)+DATE_PART('hour',$$)*60+DATE_PART('minute',$$)",
        HOUR_OF_DAY: "DATE_PART('hour',$$)",
        HOUR_OF_WEEK: "((CAST((DATE_PART('dow',$$)+6) AS int)%7)*24+DATE_PART('hour',$$))",
        HOUR_OF_MONTH: "((DATE_PART('day',$$)-1)*24+DATE_PART('hour',$$))",
        HOUR_OF_YEAR: "((DATE_PART('doy',$$)-1)*24+DATE_PART('hour',$$))",
        DAY_OF_WEEK: "(CAST((DATE_PART('dow',$$)+6) AS int)%7)+1",
        DAY_OF_MONTH: "DATE_PART('day',$$)",
        DAY_OF_YEAR: "DATE_PART('doy',$$)",
        WEEK_OF_MONTH: null,
        WEEK_OF_YEAR: "DATE_PART('week',$$)",
        MONTH_OF_YEAR: "DATE_PART('month',$$)",
        YEAR: "DATE_PART('year',$$)"
    };
    PostgresDialect.CAST_TO_FUNCTION = {
        TIME: {
            NUMBER: 'TO_TIMESTAMP($$::double precision / 1000)'
        },
        NUMBER: {
            TIME: "EXTRACT(EPOCH FROM $$) * 1000",
            STRING: "$$::float"
        },
        STRING: {
            NUMBER: "$$::text"
        }
    };
    return PostgresDialect;
}(SQLDialect));










var getValueType = exports.getValueType = function(value) {
    var typeofValue = typeof value;
    if (typeofValue === 'object') {
        if (value === null) {
            return 'NULL';
        }
        else if (isDate(value)) {
            return 'TIME';
        }
        else if (hasOwnProperty(value, 'start') && hasOwnProperty(value, 'end')) {
            if (isDate(value.start) || isDate(value.end))
                return 'TIME_RANGE';
            if (typeof value.start === 'number' || typeof value.end === 'number')
                return 'NUMBER_RANGE';
            if (typeof value.start === 'string' || typeof value.end === 'string')
                return 'STRING_RANGE';
            throw new Error("unrecognizable range");
        }
        else {
            var ctrType = value.constructor.type;
            if (!ctrType) {
                if (Expression.isExpression(value)) {
                    throw new Error("expression used as datum value " + value);
                }
                else {
                    throw new Error("can not have an object without a type: " + JSON.stringify(value));
                }
            }
            if (ctrType === 'SET')
                ctrType += '/' + value.setType;
            return ctrType;
        }
    }
    else {
        if (typeofValue !== 'boolean' && typeofValue !== 'number' && typeofValue !== 'string') {
            throw new TypeError('unsupported JS type ' + typeofValue);
        }
        return typeofValue.toUpperCase();
    }
}
var getFullType = exports.getFullType = function(value) {
    var myType = getValueType(value);
    return myType === 'DATASET' ? value.getFullType() : { type: myType };
}
var getFullTypeFromDatum = exports.getFullTypeFromDatum = function(datum) {
    var datasetType = {};
    for (var k in datum) {
        if (!hasOwnProperty(datum, k))
            continue;
        datasetType[k] = getFullType(datum[k]);
    }
    return {
        type: 'DATASET',
        datasetType: datasetType
    };
}
var valueFromJS = exports.valueFromJS = function(v, typeOverride) {
    if (typeOverride === void 0) { typeOverride = null; }
    if (v == null) {
        return null;
    }
    else if (Array.isArray(v)) {
        if (v.length && typeof v[0] !== 'object') {
            return Set.fromJS(v);
        }
        else {
            return Dataset.fromJS(v);
        }
    }
    else if (typeof v === 'object') {
        switch (typeOverride || v.type) {
            case 'NUMBER':
                var n = Number(v.value);
                if (isNaN(n))
                    throw new Error("bad number value '" + v.value + "'");
                return n;
            case 'NUMBER_RANGE':
                return NumberRange.fromJS(v);
            case 'STRING_RANGE':
                return StringRange.fromJS(v);
            case 'TIME':
                return typeOverride ? v : new Date(v.value);
            case 'TIME_RANGE':
                return TimeRange.fromJS(v);
            case 'SET':
                return Set.fromJS(v);
            default:
                if (v.toISOString) {
                    return v;
                }
                else {
                    throw new Error('can not have an object without a `type` as a datum value');
                }
        }
    }
    else if (typeof v === 'string' && typeOverride === 'TIME') {
        return new Date(v);
    }
    return v;
}
var valueToJS = exports.valueToJS = function(v) {
    if (v == null) {
        return null;
    }
    else {
        var typeofV = typeof v;
        if (typeofV === 'object') {
            if (v.toISOString) {
                return v;
            }
            else {
                return v.toJS();
            }
        }
        else if (typeofV === 'number' && !isFinite(v)) {
            return String(v);
        }
    }
    return v;
}
var valueToJSInlineType = exports.valueToJSInlineType = function(v) {
    if (v == null) {
        return null;
    }
    else {
        var typeofV = typeof v;
        if (typeofV === 'object') {
            if (v.toISOString) {
                return { type: 'TIME', value: v };
            }
            else {
                var js = v.toJS();
                if (!Array.isArray(js)) {
                    js.type = v.constructor.type;
                }
                return js;
            }
        }
        else if (typeofV === 'number' && !isFinite(v)) {
            return { type: 'NUMBER', value: String(v) };
        }
    }
    return v;
}
var datumHasExternal = exports.datumHasExternal = function(datum) {
    for (var name in datum) {
        var value = datum[name];
        if (value instanceof External)
            return true;
        if (value instanceof Dataset && value.hasExternal())
            return true;
    }
    return false;
}
var introspectDatum = exports.introspectDatum = function(datum) {
    var promises = [];
    var newDatum = Object.create(null);
    Object.keys(datum)
        .forEach(function (name) {
        var v = datum[name];
        if (v instanceof External && v.needsIntrospect()) {
            promises.push(v.introspect().then(function (introspectedExternal) {
                newDatum[name] = introspectedExternal;
            }));
        }
        else {
            newDatum[name] = v;
        }
    });
    return Q.all(promises).then(function () { return newDatum; });
}
var isSetType = exports.isSetType = function(type) {
    return type && type.indexOf('SET/') === 0;
}
var wrapSetType = exports.wrapSetType = function(type) {
    return isSetType(type) ? type : ('SET/' + type);
}
var unwrapSetType = exports.unwrapSetType = function(type) {
    if (!type)
        return null;
    return isSetType(type) ? type.substr(4) : type;
}
var getAllSetTypes = exports.getAllSetTypes = function() {
    return [
        'SET/STRING',
        'SET/STRING_RANGE',
        'SET/NUMBER',
        'SET/NUMBER_RANGE',
        'SET/TIME',
        'SET/TIME_RANGE'
    ];
}
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var check;
var AttributeInfo = exports.AttributeInfo = (function () {
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
var UniqueAttributeInfo = exports.UniqueAttributeInfo = (function (_super) {
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
var ThetaAttributeInfo = exports.ThetaAttributeInfo = (function (_super) {
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
var HistogramAttributeInfo = exports.HistogramAttributeInfo = (function (_super) {
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

var BOUNDS_REG_EXP = /^[\[(][\])]$/;
var Range = exports.Range = (function () {
    function Range(start, end, bounds) {
        if (bounds) {
            if (!BOUNDS_REG_EXP.test(bounds)) {
                throw new Error("invalid bounds " + bounds);
            }
        }
        else {
            bounds = Range.DEFAULT_BOUNDS;
        }
        if (start !== null && end !== null && this._endpointEqual(start, end)) {
            if (bounds !== '[]') {
                start = end = this._zeroEndpoint();
            }
            if (bounds === '(]' || bounds === '()')
                this.bounds = '[)';
        }
        else {
            if (start !== null && end !== null && end < start) {
                throw new Error('must have start <= end');
            }
            if (start === null && bounds[0] === '[') {
                bounds = '(' + bounds[1];
            }
            if (end === null && bounds[1] === ']') {
                bounds = bounds[0] + ')';
            }
        }
        this.start = start;
        this.end = end;
        this.bounds = bounds;
    }
    Range.isRange = function (candidate) {
        return isInstanceOf(candidate, Range);
    };
    Range.register = function (ctr) {
        var rangeName = ctr.name.replace('Range', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        Range.classMap[rangeName] = ctr;
    };
    Range.fromJS = function (parameters) {
        var ctr;
        if (typeof parameters.start === 'number' || typeof parameters.end === 'number') {
            ctr = 'number';
        }
        else if (typeof parameters.start === 'string' || typeof parameters.end === 'string') {
            ctr = 'string';
        }
        else {
            ctr = 'time';
        }
        return Range.classMap[ctr].fromJS(parameters);
    };
    Range.prototype._zeroEndpoint = function () {
        return 0;
    };
    Range.prototype._endpointEqual = function (a, b) {
        return a === b;
    };
    Range.prototype._endpointToString = function (a) {
        return String(a);
    };
    Range.prototype._equalsHelper = function (other) {
        return Boolean(other) &&
            this.bounds === other.bounds &&
            this._endpointEqual(this.start, other.start) &&
            this._endpointEqual(this.end, other.end);
    };
    Range.prototype.toString = function () {
        var bounds = this.bounds;
        return bounds[0] + this._endpointToString(this.start) + ',' + this._endpointToString(this.end) + bounds[1];
    };
    Range.prototype.compare = function (other) {
        var myStart = this.start;
        var otherStart = other.start;
        return myStart < otherStart ? -1 : (otherStart < myStart ? 1 : 0);
    };
    Range.prototype.openStart = function () {
        return this.bounds[0] === '(';
    };
    Range.prototype.openEnd = function () {
        return this.bounds[1] === ')';
    };
    Range.prototype.empty = function () {
        return this._endpointEqual(this.start, this.end) && this.bounds === '[)';
    };
    Range.prototype.degenerate = function () {
        return this._endpointEqual(this.start, this.end) && this.bounds === '[]';
    };
    Range.prototype.contains = function (val) {
        if (val === null)
            return false;
        var start = this.start;
        var end = this.end;
        var bounds = this.bounds;
        if (bounds[0] === '[') {
            if (val < start)
                return false;
        }
        else {
            if (start !== null && val <= start)
                return false;
        }
        if (bounds[1] === ']') {
            if (end < val)
                return false;
        }
        else {
            if (end !== null && end <= val)
                return false;
        }
        return true;
    };
    Range.prototype.intersects = function (other) {
        return this.contains(other.start) || this.contains(other.end)
            || other.contains(this.start) || other.contains(this.end)
            || this._equalsHelper(other);
    };
    Range.prototype.adjacent = function (other) {
        return (this._endpointEqual(this.end, other.start) && this.openEnd() !== other.openStart())
            || (this._endpointEqual(this.start, other.end) && this.openStart() !== other.openEnd());
    };
    Range.prototype.mergeable = function (other) {
        return this.intersects(other) || this.adjacent(other);
    };
    Range.prototype.union = function (other) {
        if (!this.mergeable(other))
            return null;
        return this.extend(other);
    };
    Range.prototype.extent = function () {
        return this;
    };
    Range.prototype.extend = function (other) {
        var thisStart = this.start;
        var thisEnd = this.end;
        var otherStart = other.start;
        var otherEnd = other.end;
        var start;
        var startBound;
        if (thisStart === null || otherStart === null) {
            start = null;
            startBound = '(';
        }
        else if (thisStart < otherStart) {
            start = thisStart;
            startBound = this.bounds[0];
        }
        else {
            start = otherStart;
            startBound = other.bounds[0];
        }
        var end;
        var endBound;
        if (thisEnd === null || otherEnd === null) {
            end = null;
            endBound = ')';
        }
        else if (thisEnd < otherEnd) {
            end = otherEnd;
            endBound = other.bounds[1];
        }
        else {
            end = thisEnd;
            endBound = this.bounds[1];
        }
        return new this.constructor({ start: start, end: end, bounds: startBound + endBound });
    };
    Range.prototype.intersect = function (other) {
        if (!this.mergeable(other))
            return null;
        var thisStart = this.start;
        var thisEnd = this.end;
        var otherStart = other.start;
        var otherEnd = other.end;
        var start;
        var startBound;
        if (thisStart === null || otherStart === null) {
            if (otherStart === null) {
                start = thisStart;
                startBound = this.bounds[0];
            }
            else {
                start = otherStart;
                startBound = other.bounds[0];
            }
        }
        else if (otherStart < thisStart) {
            start = thisStart;
            startBound = this.bounds[0];
        }
        else {
            start = otherStart;
            startBound = other.bounds[0];
        }
        var end;
        var endBound;
        if (thisEnd === null || otherEnd === null) {
            if (thisEnd == null) {
                end = otherEnd;
                endBound = other.bounds[1];
            }
            else {
                end = thisEnd;
                endBound = this.bounds[1];
            }
        }
        else if (otherEnd < thisEnd) {
            end = otherEnd;
            endBound = other.bounds[1];
        }
        else {
            end = thisEnd;
            endBound = this.bounds[1];
        }
        return new this.constructor({ start: start, end: end, bounds: startBound + endBound });
    };
    Range.DEFAULT_BOUNDS = '[)';
    Range.classMap = {};
    return Range;
}());
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


function finiteOrNull(n) {
    return (isNaN(n) || isFinite(n)) ? n : null;
}
var check;
var NumberRange = exports.NumberRange = (function (_super) {
    __extends(NumberRange, _super);
    function NumberRange(parameters) {
        if (isNaN(parameters.start))
            throw new TypeError('`start` must be a number');
        if (isNaN(parameters.end))
            throw new TypeError('`end` must be a number');
        _super.call(this, parameters.start, parameters.end, parameters.bounds);
    }
    NumberRange.isNumberRange = function (candidate) {
        return isInstanceOf(candidate, NumberRange);
    };
    NumberRange.numberBucket = function (num, size, offset) {
        var start = Math.floor((num - offset) / size) * size + offset;
        return new NumberRange({
            start: start,
            end: start + size,
            bounds: Range.DEFAULT_BOUNDS
        });
    };
    NumberRange.fromNumber = function (n) {
        return new NumberRange({ start: n, end: n, bounds: '[]' });
    };
    NumberRange.fromJS = function (parameters) {
        if (typeof parameters !== "object") {
            throw new Error("unrecognizable numberRange");
        }
        var start = parameters.start;
        var end = parameters.end;
        return new NumberRange({
            start: start === null ? null : finiteOrNull(Number(start)),
            end: end === null ? null : finiteOrNull(Number(end)),
            bounds: parameters.bounds
        });
    };
    NumberRange.prototype.valueOf = function () {
        return {
            start: this.start,
            end: this.end,
            bounds: this.bounds
        };
    };
    NumberRange.prototype.toJS = function () {
        var js = {
            start: this.start,
            end: this.end
        };
        if (this.bounds !== Range.DEFAULT_BOUNDS)
            js.bounds = this.bounds;
        return js;
    };
    NumberRange.prototype.toJSON = function () {
        return this.toJS();
    };
    NumberRange.prototype.equals = function (other) {
        return NumberRange.isNumberRange(other) && this._equalsHelper(other);
    };
    NumberRange.prototype.midpoint = function () {
        return (this.start + this.end) / 2;
    };
    NumberRange.type = 'NUMBER_RANGE';
    return NumberRange;
}(Range));
check = NumberRange;
Range.register(NumberRange);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




function toDate(date, name) {
    if (date === null)
        return null;
    if (typeof date === "undefined")
        throw new TypeError("timeRange must have a " + name);
    if (typeof date === 'string' || typeof date === 'number')
        date = parseISODate(date, Expression.defaultParserTimezone);
    if (!date.getDay)
        throw new TypeError("timeRange must have a " + name + " that is a Date");
    return date;
}
var START_OF_TIME = "1000";
var END_OF_TIME = "3000";
function dateToIntervalPart(date) {
    return date.toISOString()
        .replace('.000Z', 'Z')
        .replace(':00Z', 'Z')
        .replace(':00Z', 'Z');
}
var check;
var TimeRange = exports.TimeRange = (function (_super) {
    __extends(TimeRange, _super);
    function TimeRange(parameters) {
        _super.call(this, parameters.start, parameters.end, parameters.bounds);
    }
    TimeRange.isTimeRange = function (candidate) {
        return isInstanceOf(candidate, TimeRange);
    };
    TimeRange.intervalFromDate = function (date) {
        return dateToIntervalPart(date) + '/' + dateToIntervalPart(new Date(date.valueOf() + 1));
    };
    TimeRange.timeBucket = function (date, duration, timezone) {
        if (!date)
            return null;
        var start = duration.floor(date, timezone);
        return new TimeRange({
            start: start,
            end: duration.shift(start, timezone, 1),
            bounds: Range.DEFAULT_BOUNDS
        });
    };
    TimeRange.fromTime = function (t) {
        return new TimeRange({ start: t, end: t, bounds: '[]' });
    };
    TimeRange.fromJS = function (parameters) {
        if (typeof parameters !== "object") {
            throw new Error("unrecognizable timeRange");
        }
        return new TimeRange({
            start: toDate(parameters.start, 'start'),
            end: toDate(parameters.end, 'end'),
            bounds: parameters.bounds
        });
    };
    TimeRange.prototype._zeroEndpoint = function () {
        return new Date(0);
    };
    TimeRange.prototype._endpointEqual = function (a, b) {
        if (a === null) {
            return b === null;
        }
        else {
            return b !== null && a.valueOf() === b.valueOf();
        }
    };
    TimeRange.prototype._endpointToString = function (a) {
        if (!a)
            return 'null';
        return a.toISOString();
    };
    TimeRange.prototype.valueOf = function () {
        return {
            start: this.start,
            end: this.end,
            bounds: this.bounds
        };
    };
    TimeRange.prototype.toJS = function () {
        var js = {
            start: this.start,
            end: this.end
        };
        if (this.bounds !== Range.DEFAULT_BOUNDS)
            js.bounds = this.bounds;
        return js;
    };
    TimeRange.prototype.toJSON = function () {
        return this.toJS();
    };
    TimeRange.prototype.equals = function (other) {
        return TimeRange.isTimeRange(other) && this._equalsHelper(other);
    };
    TimeRange.prototype.toInterval = function () {
        var _a = this, start = _a.start, end = _a.end, bounds = _a.bounds;
        var interval = [START_OF_TIME, END_OF_TIME];
        if (start) {
            if (bounds[0] === '(')
                start = new Date(start.valueOf() + 1);
            interval[0] = dateToIntervalPart(start);
        }
        if (end) {
            if (bounds[1] === ']')
                end = new Date(end.valueOf() + 1);
            interval[1] = dateToIntervalPart(end);
        }
        return interval.join("/");
    };
    TimeRange.prototype.midpoint = function () {
        return new Date((this.start.valueOf() + this.end.valueOf()) / 2);
    };
    TimeRange.prototype.isAligned = function (duration, timezone) {
        var _a = this, start = _a.start, end = _a.end;
        return (!start || duration.isAligned(start, timezone)) && (!end || duration.isAligned(end, timezone));
    };
    TimeRange.type = 'TIME_RANGE';
    return TimeRange;
}(Range));
check = TimeRange;
Range.register(TimeRange);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var check;
var StringRange = exports.StringRange = (function (_super) {
    __extends(StringRange, _super);
    function StringRange(parameters) {
        var start = parameters.start, end = parameters.end;
        if (typeof start !== 'string' && start !== null)
            throw new TypeError('`start` must be a string');
        if (typeof end !== 'string' && end !== null)
            throw new TypeError('`end` must be a string');
        _super.call(this, start, end, parameters.bounds);
    }
    StringRange.isStringRange = function (candidate) {
        return isInstanceOf(candidate, StringRange);
    };
    StringRange.fromString = function (s) {
        return new StringRange({ start: s, end: s, bounds: '[]' });
    };
    StringRange.fromJS = function (parameters) {
        if (typeof parameters !== "object") {
            throw new Error("unrecognizable StringRange");
        }
        var start = parameters.start;
        var end = parameters.end;
        var bounds = parameters.bounds;
        return new StringRange({
            start: start, end: end, bounds: bounds
        });
    };
    StringRange.prototype.valueOf = function () {
        return {
            start: this.start,
            end: this.end,
            bounds: this.bounds
        };
    };
    StringRange.prototype.toJS = function () {
        var js = {
            start: this.start,
            end: this.end
        };
        if (this.bounds !== Range.DEFAULT_BOUNDS)
            js.bounds = this.bounds;
        return js;
    };
    StringRange.prototype.toJSON = function () {
        return this.toJS();
    };
    StringRange.prototype.equals = function (other) {
        return StringRange.isStringRange(other) && this._equalsHelper(other);
    };
    StringRange.prototype.midpoint = function () {
        throw new Error("midpoint not supported in string range");
    };
    StringRange.prototype._zeroEndpoint = function () {
        return "";
    };
    StringRange.type = 'STRING_RANGE';
    return StringRange;
}(Range));
check = StringRange;
Range.register(StringRange);







function dateString(date) {
    return date.toISOString();
}
function arrayFromJS(xs, setType) {
    return xs.map(function (x) { return valueFromJS(x, setType); });
}
function unifyElements(elements) {
    var newElements = Object.create(null);
    for (var _i = 0, elements_1 = elements; _i < elements_1.length; _i++) {
        var accumulator = elements_1[_i];
        var newElementsKeys = Object.keys(newElements);
        for (var _a = 0, newElementsKeys_1 = newElementsKeys; _a < newElementsKeys_1.length; _a++) {
            var newElementsKey = newElementsKeys_1[_a];
            var newElement = newElements[newElementsKey];
            var unionElement = accumulator.union(newElement);
            if (unionElement) {
                accumulator = unionElement;
                delete newElements[newElementsKey];
            }
        }
        newElements[accumulator.toString()] = accumulator;
    }
    return Object.keys(newElements).map(function (k) { return newElements[k]; });
}
function intersectElements(elements1, elements2) {
    var newElements = [];
    for (var _i = 0, elements1_1 = elements1; _i < elements1_1.length; _i++) {
        var element1 = elements1_1[_i];
        for (var _a = 0, elements2_1 = elements2; _a < elements2_1.length; _a++) {
            var element2 = elements2_1[_a];
            var intersect = element1.intersect(element2);
            if (intersect)
                newElements.push(intersect);
        }
    }
    return newElements;
}
var typeUpgrades = {
    'NUMBER': 'NUMBER_RANGE',
    'TIME': 'TIME_RANGE',
    'STRING': 'STRING_RANGE'
};
var check;
var Set = exports.Set = (function () {
    function Set(parameters) {
        var setType = parameters.setType;
        this.setType = setType;
        var keyFn = setType === 'TIME' ? dateString : String;
        this.keyFn = keyFn;
        var elements = parameters.elements;
        var newElements = null;
        var hash = Object.create(null);
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var key = keyFn(element);
            if (hash[key]) {
                if (!newElements)
                    newElements = elements.slice(0, i);
            }
            else {
                hash[key] = element;
                if (newElements)
                    newElements.push(element);
            }
        }
        if (newElements) {
            elements = newElements;
        }
        if (setType === 'NUMBER_RANGE' || setType === 'TIME_RANGE' || setType === 'STRING_RANGE') {
            elements = unifyElements(elements);
        }
        this.elements = elements;
        this.hash = hash;
    }
    Set.isSet = function (candidate) {
        return isInstanceOf(candidate, Set);
    };
    Set.convertToSet = function (thing) {
        var thingType = getValueType(thing);
        if (isSetType(thingType))
            return thing;
        return Set.fromJS({ setType: thingType, elements: [thing] });
    };
    Set.generalUnion = function (a, b) {
        var aSet = Set.convertToSet(a);
        var bSet = Set.convertToSet(b);
        var aSetType = aSet.setType;
        var bSetType = bSet.setType;
        if (typeUpgrades[aSetType] === bSetType) {
            aSet = aSet.upgradeType();
        }
        else if (typeUpgrades[bSetType] === aSetType) {
            bSet = bSet.upgradeType();
        }
        else if (aSetType !== bSetType) {
            return null;
        }
        return aSet.union(bSet).simplify();
    };
    Set.generalIntersect = function (a, b) {
        var aSet = Set.convertToSet(a);
        var bSet = Set.convertToSet(b);
        var aSetType = aSet.setType;
        var bSetType = bSet.setType;
        if (typeUpgrades[aSetType] === bSetType) {
            aSet = aSet.upgradeType();
        }
        else if (typeUpgrades[bSetType] === aSetType) {
            bSet = bSet.upgradeType();
        }
        else if (aSetType !== bSetType) {
            return null;
        }
        return aSet.intersect(bSet).simplify();
    };
    Set.fromJS = function (parameters) {
        if (Array.isArray(parameters)) {
            parameters = { elements: parameters };
        }
        if (typeof parameters !== "object") {
            throw new Error("unrecognizable set");
        }
        var setType = parameters.setType;
        var elements = parameters.elements;
        if (!setType) {
            setType = getValueType(elements.length ? elements[0] : null);
        }
        return new Set({
            setType: setType,
            elements: arrayFromJS(elements, setType)
        });
    };
    Set.prototype.valueOf = function () {
        return {
            setType: this.setType,
            elements: this.elements
        };
    };
    Set.prototype.toJS = function () {
        return {
            setType: this.setType,
            elements: this.elements.map(valueToJS)
        };
    };
    Set.prototype.toJSON = function () {
        return this.toJS();
    };
    Set.prototype.toString = function () {
        if (this.setType === "NULL")
            return "null";
        return "" + this.elements.map(String).join(", ");
    };
    Set.prototype.equals = function (other) {
        return Set.isSet(other) &&
            this.setType === other.setType &&
            this.elements.length === other.elements.length &&
            this.elements.slice().sort().join('') === other.elements.slice().sort().join('');
    };
    Set.prototype.cardinality = function () {
        return this.size();
    };
    Set.prototype.size = function () {
        return this.elements.length;
    };
    Set.prototype.empty = function () {
        return this.elements.length === 0;
    };
    Set.prototype.simplify = function () {
        var simpleSet = this.downgradeType();
        var simpleSetElements = simpleSet.elements;
        return simpleSetElements.length === 1 ? simpleSetElements[0] : simpleSet;
    };
    Set.prototype.getType = function () {
        return 'SET/' + this.setType;
    };
    Set.prototype.upgradeType = function () {
        if (this.setType === 'NUMBER') {
            return Set.fromJS({
                setType: 'NUMBER_RANGE',
                elements: this.elements.map(NumberRange.fromNumber)
            });
        }
        else if (this.setType === 'TIME') {
            return Set.fromJS({
                setType: 'TIME_RANGE',
                elements: this.elements.map(TimeRange.fromTime)
            });
        }
        else if (this.setType === 'STRING') {
            return Set.fromJS({
                setType: 'STRING_RANGE',
                elements: this.elements.map(StringRange.fromString)
            });
        }
        else {
            return this;
        }
    };
    Set.prototype.downgradeType = function () {
        if (this.setType === 'NUMBER_RANGE' || this.setType === 'TIME_RANGE' || this.setType === 'STRING_RANGE') {
            var elements = this.elements;
            var simpleElements = [];
            for (var _i = 0, elements_2 = elements; _i < elements_2.length; _i++) {
                var element = elements_2[_i];
                if (element.degenerate()) {
                    simpleElements.push(element.start);
                }
                else {
                    return this;
                }
            }
            return Set.fromJS(simpleElements);
        }
        else {
            return this;
        }
    };
    Set.prototype.extent = function () {
        var setType = this.setType;
        if (hasOwnProperty(typeUpgrades, setType)) {
            return this.upgradeType().extent();
        }
        if (setType !== 'NUMBER_RANGE' && setType !== 'TIME_RANGE' && setType !== 'STRING_RANGE')
            return null;
        var elements = this.elements;
        var extent = elements[0] || null;
        for (var i = 1; i < elements.length; i++) {
            extent = extent.extend(elements[i]);
        }
        return extent;
    };
    Set.prototype.union = function (other) {
        if (this.empty())
            return other;
        if (other.empty())
            return this;
        if (this.setType !== other.setType) {
            throw new TypeError("can not union sets of different types");
        }
        var newElements = this.elements.slice();
        var otherElements = other.elements;
        for (var _i = 0, otherElements_1 = otherElements; _i < otherElements_1.length; _i++) {
            var el = otherElements_1[_i];
            if (this.contains(el))
                continue;
            newElements.push(el);
        }
        return new Set({
            setType: this.setType,
            elements: newElements
        });
    };
    Set.prototype.intersect = function (other) {
        if (this.empty() || other.empty())
            return Set.EMPTY;
        var setType = this.setType;
        if (this.setType !== other.setType) {
            throw new TypeError("can not intersect sets of different types");
        }
        var thisElements = this.elements;
        var newElements;
        if (setType === 'NUMBER_RANGE' || setType === 'TIME_RANGE' || setType === 'STRING_RANGE') {
            var otherElements = other.elements;
            newElements = intersectElements(thisElements, otherElements);
        }
        else {
            newElements = [];
            for (var _i = 0, thisElements_1 = thisElements; _i < thisElements_1.length; _i++) {
                var el = thisElements_1[_i];
                if (!other.contains(el))
                    continue;
                newElements.push(el);
            }
        }
        return new Set({
            setType: this.setType,
            elements: newElements
        });
    };
    Set.prototype.overlap = function (other) {
        if (this.empty() || other.empty())
            return false;
        if (this.setType !== other.setType) {
            throw new TypeError("can determine overlap sets of different types");
        }
        var thisElements = this.elements;
        for (var _i = 0, thisElements_2 = thisElements; _i < thisElements_2.length; _i++) {
            var el = thisElements_2[_i];
            if (!other.contains(el))
                continue;
            return true;
        }
        return false;
    };
    Set.prototype.contains = function (value) {
        var setType = this.setType;
        if ((setType === 'NUMBER_RANGE' && typeof value === 'number')
            || (setType === 'TIME_RANGE' && isDate(value))
            || (setType === 'STRING_RANGE' && typeof value === 'string')) {
            return this.containsWithin(value);
        }
        return hasOwnProperty(this.hash, this.keyFn(value));
    };
    Set.prototype.containsWithin = function (value) {
        var elements = this.elements;
        for (var k in elements) {
            if (!hasOwnProperty(elements, k))
                continue;
            if (elements[k].contains(value))
                return true;
        }
        return false;
    };
    Set.prototype.add = function (value) {
        var setType = this.setType;
        var valueType = getValueType(value);
        if (setType === 'NULL')
            setType = valueType;
        if (valueType !== 'NULL' && setType !== valueType)
            throw new Error('value type must match');
        if (this.contains(value))
            return this;
        return new Set({
            setType: setType,
            elements: this.elements.concat([value])
        });
    };
    Set.prototype.remove = function (value) {
        if (!this.contains(value))
            return this;
        var keyFn = this.keyFn;
        var key = keyFn(value);
        return new Set({
            setType: this.setType,
            elements: this.elements.filter(function (element) { return keyFn(element) !== key; })
        });
    };
    Set.prototype.toggle = function (value) {
        return this.contains(value) ? this.remove(value) : this.add(value);
    };
    Set.type = 'SET';
    return Set;
}());
check = Set;
Set.EMPTY = Set.fromJS([]);











var foldContext = exports.foldContext = function(d, c) {
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
var Dataset = exports.Dataset = (function () {
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














function nullMap(xs, fn) {
    if (!xs)
        return null;
    var res = [];
    for (var _i = 0, xs_1 = xs; _i < xs_1.length; _i++) {
        var x = xs_1[_i];
        var y = fn(x);
        if (y)
            res.push(y);
    }
    return res.length ? res : null;
}
function filterToAnds(filter) {
    if (filter.equals(Expression.TRUE))
        return [];
    return filter.getExpressionPattern('and') || [filter];
}
function filterDiff(strongerFilter, weakerFilter) {
    var strongerFilterAnds = filterToAnds(strongerFilter);
    var weakerFilterAnds = filterToAnds(weakerFilter);
    if (weakerFilterAnds.length > strongerFilterAnds.length)
        return null;
    for (var i = 0; i < weakerFilterAnds.length; i++) {
        if (!(weakerFilterAnds[i].equals(strongerFilterAnds[i])))
            return null;
    }
    return Expression.and(strongerFilterAnds.slice(weakerFilterAnds.length));
}
function getCommonFilter(filter1, filter2) {
    var filter1Ands = filterToAnds(filter1);
    var filter2Ands = filterToAnds(filter2);
    var minLength = Math.min(filter1Ands.length, filter2Ands.length);
    var commonExpressions = [];
    for (var i = 0; i < minLength; i++) {
        if (!filter1Ands[i].equals(filter2Ands[i]))
            break;
        commonExpressions.push(filter1Ands[i]);
    }
    return Expression.and(commonExpressions);
}
function mergeDerivedAttributes(derivedAttributes1, derivedAttributes2) {
    var derivedAttributes = Object.create(null);
    for (var k in derivedAttributes1) {
        derivedAttributes[k] = derivedAttributes1[k];
    }
    for (var k in derivedAttributes2) {
        if (hasOwnProperty(derivedAttributes, k) && !derivedAttributes[k].equals(derivedAttributes2[k])) {
            throw new Error("can not currently redefine conflicting " + k);
        }
        derivedAttributes[k] = derivedAttributes2[k];
    }
    return derivedAttributes;
}
function getSampleValue(valueType, ex) {
    switch (valueType) {
        case 'BOOLEAN':
            return true;
        case 'NUMBER':
            return 4;
        case 'NUMBER_RANGE':
            var numberBucketAction;
            if (ex instanceof ChainExpression && (numberBucketAction = ex.getSingleAction('numberBucket'))) {
                return new NumberRange({
                    start: numberBucketAction.offset,
                    end: numberBucketAction.offset + numberBucketAction.size
                });
            }
            else {
                return new NumberRange({ start: 0, end: 1 });
            }
        case 'TIME':
            return new Date('2015-03-14T00:00:00');
        case 'TIME_RANGE':
            var timeBucketAction;
            if (ex instanceof ChainExpression && (timeBucketAction = ex.getSingleAction('timeBucket'))) {
                var timezone = timeBucketAction.timezone || Timezone.UTC;
                var start = timeBucketAction.duration.floor(new Date('2015-03-14T00:00:00'), timezone);
                return new TimeRange({
                    start: start,
                    end: timeBucketAction.duration.shift(start, timezone, 1)
                });
            }
            else {
                return new TimeRange({ start: new Date('2015-03-14T00:00:00'), end: new Date('2015-03-15T00:00:00') });
            }
        case 'STRING':
            if (ex instanceof RefExpression) {
                return 'some_' + ex.name;
            }
            else {
                return 'something';
            }
        case 'SET/STRING':
            if (ex instanceof RefExpression) {
                return Set.fromJS([ex.name + '1']);
            }
            else {
                return Set.fromJS(['something']);
            }
        case 'STRING_RANGE':
            if (ex instanceof RefExpression) {
                return StringRange.fromJS({ start: 'some_' + ex.name, end: null });
            }
            else {
                return StringRange.fromJS({ start: 'something', end: null });
            }
        default:
            throw new Error("unsupported simulation on: " + valueType);
    }
}
function immutableAdd(obj, key, value) {
    var newObj = Object.create(null);
    for (var k in obj)
        newObj[k] = obj[k];
    newObj[key] = value;
    return newObj;
}
function findApplyByExpression(applies, expression) {
    for (var _i = 0, applies_1 = applies; _i < applies_1.length; _i++) {
        var apply = applies_1[_i];
        if (apply.expression.equals(expression))
            return apply;
    }
    return null;
}
var External = exports.External = (function () {
    function External(parameters, dummy) {
        if (dummy === void 0) { dummy = null; }
        this.attributes = null;
        this.attributeOverrides = null;
        this.rawAttributes = null;
        if (dummy !== dummyObject) {
            throw new TypeError("can not call `new External` directly use External.fromJS instead");
        }
        this.engine = parameters.engine;
        var version = null;
        if (parameters.version) {
            version = External.extractVersion(parameters.version);
            if (!version)
                throw new Error("invalid version " + parameters.version);
        }
        this.version = version;
        this.source = parameters.source;
        this.suppress = Boolean(parameters.suppress);
        this.rollup = Boolean(parameters.rollup);
        if (parameters.attributes) {
            this.attributes = parameters.attributes;
        }
        if (parameters.attributeOverrides) {
            this.attributeOverrides = parameters.attributeOverrides;
        }
        this.derivedAttributes = parameters.derivedAttributes || {};
        if (parameters.delegates) {
            this.delegates = parameters.delegates;
        }
        this.concealBuckets = parameters.concealBuckets;
        this.rawAttributes = parameters.rawAttributes;
        this.requester = parameters.requester;
        this.mode = parameters.mode || 'raw';
        this.filter = parameters.filter || Expression.TRUE;
        switch (this.mode) {
            case 'raw':
                this.select = parameters.select;
                this.sort = parameters.sort;
                this.limit = parameters.limit;
                break;
            case 'value':
                this.valueExpression = parameters.valueExpression;
                break;
            case 'total':
                this.applies = parameters.applies || [];
                break;
            case 'split':
                this.dataName = parameters.dataName;
                this.split = parameters.split;
                if (!this.split)
                    throw new Error('must have split action in split mode');
                this.applies = parameters.applies || [];
                this.sort = parameters.sort;
                this.limit = parameters.limit;
                this.havingFilter = parameters.havingFilter || Expression.TRUE;
                break;
        }
    }
    External.isExternal = function (candidate) {
        return isInstanceOf(candidate, External);
    };
    External.extractVersion = function (v) {
        if (!v)
            return null;
        var m = v.match(/^\d+\.\d+\.\d+(?:-[\w\-]+)?/);
        return m ? m[0] : null;
    };
    External.versionLessThan = function (va, vb) {
        var pa = va.split('-')[0].split('.');
        var pb = vb.split('-')[0].split('.');
        if (pa[0] !== pb[0])
            return pa[0] < pb[0];
        if (pa[1] !== pb[1])
            return pa[1] < pb[1];
        return pa[2] < pb[2];
    };
    External.deduplicateExternals = function (externals) {
        if (externals.length < 2)
            return externals;
        var uniqueExternals = [externals[0]];
        function addToUniqueExternals(external) {
            for (var _i = 0, uniqueExternals_1 = uniqueExternals; _i < uniqueExternals_1.length; _i++) {
                var uniqueExternal = uniqueExternals_1[_i];
                if (uniqueExternal.equalBase(external))
                    return;
            }
            uniqueExternals.push(external);
        }
        for (var i = 1; i < externals.length; i++)
            addToUniqueExternals(externals[i]);
        return uniqueExternals;
    };
    External.makeZeroDatum = function (applies) {
        var newDatum = Object.create(null);
        for (var _i = 0, applies_2 = applies; _i < applies_2.length; _i++) {
            var apply = applies_2[_i];
            var applyName = apply.name;
            if (applyName[0] === '_')
                continue;
            newDatum[applyName] = 0;
        }
        return newDatum;
    };
    External.normalizeAndAddApply = function (attributesAndApplies, apply) {
        var attributes = attributesAndApplies.attributes, applies = attributesAndApplies.applies;
        var expressions = Object.create(null);
        for (var _i = 0, applies_3 = applies; _i < applies_3.length; _i++) {
            var existingApply = applies_3[_i];
            expressions[existingApply.name] = existingApply.expression;
        }
        apply = apply.changeExpression(apply.expression.resolveWithExpressions(expressions, 'leave').simplify());
        return {
            attributes: NamedArray.overrideByName(attributes, new AttributeInfo({ name: apply.name, type: apply.expression.type })),
            applies: NamedArray.overrideByName(applies, apply)
        };
    };
    External.segregationAggregateApplies = function (applies) {
        var aggregateApplies = [];
        var postAggregateApplies = [];
        var nameIndex = 0;
        var appliesToSegregate = [];
        for (var _i = 0, applies_4 = applies; _i < applies_4.length; _i++) {
            var apply = applies_4[_i];
            var applyExpression = apply.expression;
            if (applyExpression instanceof ChainExpression) {
                var actions = applyExpression.actions;
                if (actions[actions.length - 1].isAggregate()) {
                    aggregateApplies.push(apply);
                    continue;
                }
            }
            appliesToSegregate.push(apply);
        }
        for (var _a = 0, appliesToSegregate_1 = appliesToSegregate; _a < appliesToSegregate_1.length; _a++) {
            var apply = appliesToSegregate_1[_a];
            var newExpression = apply.expression.substituteAction(function (action) {
                return action.isAggregate();
            }, function (preEx, action) {
                var aggregateChain = preEx.performAction(action);
                var existingApply = findApplyByExpression(aggregateApplies, aggregateChain);
                if (existingApply) {
                    return $(existingApply.name, existingApply.expression.type);
                }
                else {
                    var name = '!T_' + (nameIndex++);
                    aggregateApplies.push(new ApplyAction({
                        action: 'apply',
                        name: name,
                        expression: aggregateChain
                    }));
                    return $(name, aggregateChain.type);
                }
            });
            postAggregateApplies.push(apply.changeExpression(newExpression));
        }
        return {
            aggregateApplies: aggregateApplies,
            postAggregateApplies: postAggregateApplies
        };
    };
    External.getCommonFilterFromExternals = function (externals) {
        if (!externals.length)
            throw new Error('must have externals');
        var commonFilter = externals[0].filter;
        for (var i = 1; i < externals.length; i++) {
            commonFilter = getCommonFilter(commonFilter, externals[i].filter);
        }
        return commonFilter;
    };
    External.getMergedDerivedAttributesFromExternals = function (externals) {
        if (!externals.length)
            throw new Error('must have externals');
        var derivedAttributes = externals[0].derivedAttributes;
        for (var i = 1; i < externals.length; i++) {
            derivedAttributes = mergeDerivedAttributes(derivedAttributes, externals[i].derivedAttributes);
        }
        return derivedAttributes;
    };
    External.getSimpleInflater = function (splitExpression, label) {
        switch (splitExpression.type) {
            case 'BOOLEAN': return External.booleanInflaterFactory(label);
            case 'NUMBER': return External.numberInflaterFactory(label);
            case 'TIME': return External.timeInflaterFactory(label);
            default: return null;
        }
    };
    External.booleanInflaterFactory = function (label) {
        return function (d) {
            var v = '' + d[label];
            switch (v) {
                case 'null':
                    d[label] = null;
                    break;
                case '0':
                case 'false':
                    d[label] = false;
                    break;
                case '1':
                case 'true':
                    d[label] = true;
                    break;
                default:
                    throw new Error("got strange result from boolean: " + v);
            }
        };
    };
    External.timeRangeInflaterFactory = function (label, duration, timezone) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            var start = new Date(v);
            d[label] = new TimeRange({ start: start, end: duration.shift(start, timezone) });
        };
    };
    External.numberRangeInflaterFactory = function (label, rangeSize) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            var start = Number(v);
            d[label] = new NumberRange({
                start: start,
                end: safeAdd(start, rangeSize)
            });
        };
    };
    External.numberInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            d[label] = Number(v);
        };
    };
    External.timeInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            d[label] = new Date(v);
        };
    };
    External.setStringInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            if ('' + v === "null") {
                d[label] = null;
                return;
            }
            if (typeof v === 'string')
                v = [v];
            d[label] = Set.fromJS({
                setType: 'STRING',
                elements: v
            });
        };
    };
    External.setCardinalityInflaterFactory = function (label) {
        return function (d) {
            var v = d[label];
            d[label] = Array.isArray(v) ? v.length : 1;
        };
    };
    External.jsToValue = function (parameters, requester) {
        var value = {
            engine: parameters.engine,
            version: parameters.version,
            source: parameters.source,
            suppress: true,
            rollup: parameters.rollup,
            concealBuckets: Boolean(parameters.concealBuckets),
            requester: requester
        };
        if (parameters.attributes) {
            value.attributes = AttributeInfo.fromJSs(parameters.attributes);
        }
        if (parameters.attributeOverrides) {
            value.attributeOverrides = AttributeInfo.fromJSs(parameters.attributeOverrides);
        }
        if (parameters.derivedAttributes) {
            value.derivedAttributes = Expression.expressionLookupFromJS(parameters.derivedAttributes);
        }
        value.filter = parameters.filter ? Expression.fromJS(parameters.filter) : Expression.TRUE;
        return value;
    };
    External.register = function (ex, id) {
        if (id === void 0) { id = null; }
        if (!id)
            id = ex.name.replace('External', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        External.classMap[id] = ex;
    };
    External.getConstructorFor = function (engine) {
        var classFn = External.classMap[engine];
        if (!classFn)
            throw new Error("unsupported engine '" + engine + "'");
        return classFn;
    };
    External.fromJS = function (parameters, requester) {
        if (requester === void 0) { requester = null; }
        if (!hasOwnProperty(parameters, "engine")) {
            throw new Error("external `engine` must be defined");
        }
        var engine = parameters.engine;
        if (typeof engine !== "string")
            throw new Error("engine must be a string");
        var ClassFn = External.getConstructorFor(engine);
        if (!requester && hasOwnProperty(parameters, 'requester')) {
            console.warn("'requester' parameter should be passed as context (2nd argument)");
            requester = parameters.requester;
        }
        if (!parameters.source) {
            parameters.source = parameters.dataSource || parameters.table;
        }
        return ClassFn.fromJS(parameters, requester);
    };
    External.fromValue = function (parameters) {
        var engine = parameters.engine;
        var ClassFn = External.getConstructorFor(engine);
        return new ClassFn(parameters);
    };
    External.prototype._ensureEngine = function (engine) {
        if (!this.engine) {
            this.engine = engine;
            return;
        }
        if (this.engine !== engine) {
            throw new TypeError("incorrect engine '" + this.engine + "' (needs to be: '" + engine + "')");
        }
    };
    External.prototype._ensureMinVersion = function (minVersion) {
        if (this.version && External.versionLessThan(this.version, minVersion)) {
            throw new Error("only " + this.engine + " versions >= " + minVersion + " are supported");
        }
    };
    External.prototype.valueOf = function () {
        var value = {
            engine: this.engine,
            version: this.version,
            source: this.source,
            rollup: this.rollup,
            mode: this.mode
        };
        if (this.suppress)
            value.suppress = this.suppress;
        if (this.attributes)
            value.attributes = this.attributes;
        if (this.attributeOverrides)
            value.attributeOverrides = this.attributeOverrides;
        if (nonEmptyLookup(this.derivedAttributes))
            value.derivedAttributes = this.derivedAttributes;
        if (this.delegates)
            value.delegates = this.delegates;
        value.concealBuckets = this.concealBuckets;
        if (this.rawAttributes) {
            value.rawAttributes = this.rawAttributes;
        }
        if (this.requester) {
            value.requester = this.requester;
        }
        if (this.dataName) {
            value.dataName = this.dataName;
        }
        value.filter = this.filter;
        if (this.valueExpression) {
            value.valueExpression = this.valueExpression;
        }
        if (this.select) {
            value.select = this.select;
        }
        if (this.split) {
            value.split = this.split;
        }
        if (this.applies) {
            value.applies = this.applies;
        }
        if (this.sort) {
            value.sort = this.sort;
        }
        if (this.limit) {
            value.limit = this.limit;
        }
        if (this.havingFilter) {
            value.havingFilter = this.havingFilter;
        }
        return value;
    };
    External.prototype.toJS = function () {
        var js = {
            engine: this.engine,
            source: this.source
        };
        if (this.version)
            js.version = this.version;
        if (this.rollup)
            js.rollup = true;
        if (this.attributes)
            js.attributes = AttributeInfo.toJSs(this.attributes);
        if (this.attributeOverrides)
            js.attributeOverrides = AttributeInfo.toJSs(this.attributeOverrides);
        if (nonEmptyLookup(this.derivedAttributes))
            js.derivedAttributes = Expression.expressionLookupToJS(this.derivedAttributes);
        if (this.concealBuckets)
            js.concealBuckets = true;
        if (this.rawAttributes)
            js.rawAttributes = AttributeInfo.toJSs(this.rawAttributes);
        if (!this.filter.equals(Expression.TRUE)) {
            js.filter = this.filter.toJS();
        }
        return js;
    };
    External.prototype.toJSON = function () {
        return this.toJS();
    };
    External.prototype.toString = function () {
        var mode = this.mode;
        switch (mode) {
            case 'raw':
                return "ExternalRaw(" + this.filter + ")";
            case 'value':
                return "ExternalValue(" + this.valueExpression + ")";
            case 'total':
                return "ExternalTotal(" + this.applies.length + ")";
            case 'split':
                return "ExternalSplit(" + this.split + ", " + this.applies.length + ")";
            default:
                throw new Error("unknown mode: " + mode);
        }
    };
    External.prototype.equals = function (other) {
        return this.equalBase(other) &&
            immutableLookupsEqual(this.derivedAttributes, other.derivedAttributes) &&
            immutableArraysEqual(this.attributes, other.attributes) &&
            immutableArraysEqual(this.delegates, other.delegates) &&
            this.concealBuckets === other.concealBuckets &&
            Boolean(this.requester) === Boolean(other.requester);
    };
    External.prototype.equalBase = function (other) {
        return External.isExternal(other) &&
            this.engine === other.engine &&
            String(this.source) === String(other.source) &&
            this.version === other.version &&
            this.rollup === other.rollup &&
            this.mode === other.mode &&
            this.filter.equals(other.filter);
    };
    External.prototype.changeVersion = function (version) {
        var value = this.valueOf();
        value.version = version;
        return External.fromValue(value);
    };
    External.prototype.attachRequester = function (requester) {
        var value = this.valueOf();
        value.requester = requester;
        return External.fromValue(value);
    };
    External.prototype.versionBefore = function (neededVersion) {
        var version = this.version;
        return version && External.versionLessThan(version, neededVersion);
    };
    External.prototype.getAttributesInfo = function (attributeName) {
        var attributes = this.rawAttributes || this.attributes;
        return NamedArray.get(attributes, attributeName);
    };
    External.prototype.updateAttribute = function (newAttribute) {
        if (!this.attributes)
            return this;
        var value = this.valueOf();
        value.attributes = AttributeInfo.override(value.attributes, [newAttribute]);
        return External.fromValue(value);
    };
    External.prototype.show = function () {
        var value = this.valueOf();
        value.suppress = false;
        return External.fromValue(value);
    };
    External.prototype.hasAttribute = function (name) {
        var _a = this, attributes = _a.attributes, rawAttributes = _a.rawAttributes, derivedAttributes = _a.derivedAttributes;
        if (SimpleArray.find(rawAttributes || attributes, function (a) { return a.name === name; }))
            return true;
        return hasOwnProperty(derivedAttributes, name);
    };
    External.prototype.expressionDefined = function (ex) {
        return ex.definedInTypeContext(this.getFullType());
    };
    External.prototype.bucketsConcealed = function (ex) {
        var _this = this;
        return ex.every(function (ex, index, depth, nestDiff) {
            if (nestDiff)
                return true;
            if (ex instanceof RefExpression) {
                var refAttributeInfo = _this.getAttributesInfo(ex.name);
                if (refAttributeInfo && refAttributeInfo.makerAction) {
                    return refAttributeInfo.makerAction.alignsWith([]);
                }
            }
            else if (ex instanceof ChainExpression) {
                var refExpression = ex.expression;
                if (refExpression instanceof RefExpression) {
                    var ref = refExpression.name;
                    var refAttributeInfo = _this.getAttributesInfo(ref);
                    if (refAttributeInfo && refAttributeInfo.makerAction) {
                        return refAttributeInfo.makerAction.alignsWith(ex.actions);
                    }
                }
            }
            return null;
        });
    };
    External.prototype.canHandleFilter = function (ex) {
        throw new Error("must implement canHandleFilter");
    };
    External.prototype.canHandleTotal = function () {
        throw new Error("must implement canHandleTotal");
    };
    External.prototype.canHandleSplit = function (ex) {
        throw new Error("must implement canHandleSplit");
    };
    External.prototype.canHandleApply = function (ex) {
        throw new Error("must implement canHandleApply");
    };
    External.prototype.canHandleSort = function (sortAction) {
        throw new Error("must implement canHandleSort");
    };
    External.prototype.canHandleLimit = function (limitAction) {
        throw new Error("must implement canHandleLimit");
    };
    External.prototype.canHandleHavingFilter = function (ex) {
        throw new Error("must implement canHandleHavingFilter");
    };
    External.prototype.addDelegate = function (delegate) {
        var value = this.valueOf();
        if (!value.delegates)
            value.delegates = [];
        value.delegates = value.delegates.concat(delegate);
        return External.fromValue(value);
    };
    External.prototype.getBase = function () {
        var value = this.valueOf();
        value.suppress = true;
        value.mode = 'raw';
        value.dataName = null;
        if (this.mode !== 'raw')
            value.attributes = value.rawAttributes;
        value.rawAttributes = null;
        value.filter = null;
        value.applies = [];
        value.split = null;
        value.sort = null;
        value.limit = null;
        value.delegates = nullMap(value.delegates, function (e) { return e.getBase(); });
        return External.fromValue(value);
    };
    External.prototype.getRaw = function () {
        if (this.mode === 'raw')
            return this;
        var value = this.valueOf();
        value.suppress = true;
        value.mode = 'raw';
        value.dataName = null;
        if (this.mode !== 'raw')
            value.attributes = value.rawAttributes;
        value.rawAttributes = null;
        value.applies = [];
        value.split = null;
        value.sort = null;
        value.limit = null;
        value.delegates = nullMap(value.delegates, function (e) { return e.getRaw(); });
        return External.fromValue(value);
    };
    External.prototype.makeTotal = function (applies) {
        if (this.mode !== 'raw')
            return null;
        if (!this.canHandleTotal())
            return null;
        if (!applies.length)
            throw new Error('must have applies');
        var externals = [];
        for (var _i = 0, applies_5 = applies; _i < applies_5.length; _i++) {
            var apply = applies_5[_i];
            var applyExpression = apply.expression;
            if (applyExpression instanceof ExternalExpression) {
                externals.push(applyExpression.external);
            }
        }
        var commonFilter = External.getCommonFilterFromExternals(externals);
        var value = this.valueOf();
        value.mode = 'total';
        value.suppress = false;
        value.rawAttributes = value.attributes;
        value.derivedAttributes = External.getMergedDerivedAttributesFromExternals(externals);
        value.filter = commonFilter;
        value.attributes = [];
        value.applies = [];
        value.delegates = nullMap(value.delegates, function (e) { return e.makeTotal(applies); });
        var totalExternal = External.fromValue(value);
        for (var _a = 0, applies_6 = applies; _a < applies_6.length; _a++) {
            var apply = applies_6[_a];
            totalExternal = totalExternal._addApplyAction(apply);
            if (!totalExternal)
                return null;
        }
        return totalExternal;
    };
    External.prototype.addAction = function (action) {
        if (action instanceof FilterAction) {
            return this._addFilterAction(action);
        }
        if (action instanceof SelectAction) {
            return this._addSelectAction(action);
        }
        if (action instanceof SplitAction) {
            return this._addSplitAction(action);
        }
        if (action instanceof ApplyAction) {
            return this._addApplyAction(action);
        }
        if (action instanceof SortAction) {
            return this._addSortAction(action);
        }
        if (action instanceof LimitAction) {
            return this._addLimitAction(action);
        }
        if (action.isAggregate()) {
            return this._addAggregateAction(action);
        }
        return this._addPostAggregateAction(action);
    };
    External.prototype._addFilterAction = function (action) {
        return this.addFilter(action.expression);
    };
    External.prototype.addFilter = function (expression) {
        if (!expression.resolved())
            return null;
        if (!this.expressionDefined(expression))
            return null;
        var value = this.valueOf();
        switch (this.mode) {
            case 'raw':
                if (this.concealBuckets && !this.bucketsConcealed(expression))
                    return null;
                if (!this.canHandleFilter(expression))
                    return null;
                if (value.filter.equals(Expression.TRUE)) {
                    value.filter = expression;
                }
                else {
                    value.filter = value.filter.and(expression);
                }
                break;
            case 'split':
                if (!this.canHandleHavingFilter(expression))
                    return null;
                value.havingFilter = value.havingFilter.and(expression).simplify();
                break;
            default:
                return null;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e.addFilter(expression); });
        return External.fromValue(value);
    };
    External.prototype._addSelectAction = function (selectAction) {
        if (this.mode !== 'raw')
            return null;
        var datasetType = this.getFullType().datasetType;
        var attributes = selectAction.attributes;
        for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
            var attribute = attributes_1[_i];
            if (!datasetType[attribute])
                return null;
        }
        var value = this.valueOf();
        value.suppress = false;
        value.select = selectAction;
        value.delegates = nullMap(value.delegates, function (e) { return e._addSelectAction(selectAction); });
        return External.fromValue(value);
    };
    External.prototype._addSplitAction = function (splitAction) {
        if (this.mode !== 'raw')
            return null;
        var splitKeys = splitAction.keys;
        for (var _i = 0, splitKeys_1 = splitKeys; _i < splitKeys_1.length; _i++) {
            var splitKey = splitKeys_1[_i];
            var splitExpression = splitAction.splits[splitKey];
            if (!this.expressionDefined(splitExpression))
                return null;
            if (this.concealBuckets && !this.bucketsConcealed(splitExpression))
                return null;
            if (!this.canHandleSplit(splitExpression))
                return null;
        }
        var value = this.valueOf();
        value.suppress = false;
        value.mode = 'split';
        value.dataName = splitAction.dataName;
        value.split = splitAction;
        value.rawAttributes = value.attributes;
        value.attributes = splitAction.mapSplits(function (name, expression) { return new AttributeInfo({ name: name, type: unwrapSetType(expression.type) }); });
        value.delegates = nullMap(value.delegates, function (e) { return e._addSplitAction(splitAction); });
        return External.fromValue(value);
    };
    External.prototype._addApplyAction = function (action) {
        var expression = action.expression;
        if (expression.type === 'DATASET')
            return null;
        if (!expression.contained())
            return null;
        if (!this.expressionDefined(expression))
            return null;
        if (!this.canHandleApply(action.expression))
            return null;
        if (this.mode === 'raw') {
            var value = this.valueOf();
            value.derivedAttributes = immutableAdd(value.derivedAttributes, action.name, action.expression);
        }
        else {
            if (this.split && this.split.hasKey(action.name))
                return null;
            var actionExpression = action.expression;
            if (actionExpression instanceof ExternalExpression) {
                action = action.changeExpression(actionExpression.external.valueExpressionWithinFilter(this.filter));
            }
            var value = this.valueOf();
            var added = External.normalizeAndAddApply(value, action);
            value.applies = added.applies;
            value.attributes = added.attributes;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e._addApplyAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addSortAction = function (action) {
        if (this.limit)
            return null;
        if (!this.canHandleSort(action))
            return null;
        var value = this.valueOf();
        value.sort = action;
        value.delegates = nullMap(value.delegates, function (e) { return e._addSortAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addLimitAction = function (action) {
        if (!this.canHandleLimit(action))
            return null;
        var value = this.valueOf();
        value.suppress = false;
        if (!value.limit || action.limit < value.limit.limit) {
            value.limit = action;
        }
        value.delegates = nullMap(value.delegates, function (e) { return e._addLimitAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addAggregateAction = function (action) {
        if (this.mode !== 'raw' || this.limit)
            return null;
        var actionExpression = action.expression;
        if (actionExpression && !this.expressionDefined(actionExpression))
            return null;
        var value = this.valueOf();
        value.mode = 'value';
        value.suppress = false;
        value.valueExpression = $(External.SEGMENT_NAME, 'DATASET').performAction(action);
        value.rawAttributes = value.attributes;
        value.attributes = null;
        value.delegates = nullMap(value.delegates, function (e) { return e._addAggregateAction(action); });
        return External.fromValue(value);
    };
    External.prototype._addPostAggregateAction = function (action) {
        if (this.mode !== 'value')
            throw new Error('must be in value mode to call addPostAggregateAction');
        var actionExpression = action.expression;
        var commonFilter = this.filter;
        var newValueExpression;
        if (actionExpression instanceof ExternalExpression) {
            var otherExternal = actionExpression.external;
            if (!this.getBase().equals(otherExternal.getBase()))
                return null;
            var commonFilter = getCommonFilter(commonFilter, otherExternal.filter);
            var newAction = action.changeExpression(otherExternal.valueExpressionWithinFilter(commonFilter));
            newValueExpression = this.valueExpressionWithinFilter(commonFilter).performAction(newAction);
        }
        else if (!actionExpression || !actionExpression.hasExternal()) {
            newValueExpression = this.valueExpression.performAction(action);
        }
        else {
            return null;
        }
        var value = this.valueOf();
        value.valueExpression = newValueExpression;
        value.filter = commonFilter;
        value.delegates = nullMap(value.delegates, function (e) { return e._addPostAggregateAction(action); });
        return External.fromValue(value);
    };
    External.prototype.prePack = function (prefix, myAction) {
        if (this.mode !== 'value')
            throw new Error('must be in value mode to call prePack');
        var value = this.valueOf();
        value.valueExpression = prefix.performAction(myAction.changeExpression(value.valueExpression));
        value.delegates = nullMap(value.delegates, function (e) { return e.prePack(prefix, myAction); });
        return External.fromValue(value);
    };
    External.prototype.valueExpressionWithinFilter = function (withinFilter) {
        if (this.mode !== 'value')
            return null;
        var extraFilter = filterDiff(this.filter, withinFilter);
        if (!extraFilter)
            throw new Error('not within the segment');
        var ex = this.valueExpression;
        if (!extraFilter.equals(Expression.TRUE)) {
            ex = ex.substitute(function (ex) {
                if (ex instanceof RefExpression && ex.type === 'DATASET' && ex.name === External.SEGMENT_NAME) {
                    return ex.filter(extraFilter);
                }
                return null;
            });
        }
        return ex;
    };
    External.prototype.toValueApply = function () {
        if (this.mode !== 'value')
            return null;
        return new ApplyAction({
            name: External.VALUE_NAME,
            expression: this.valueExpression
        });
    };
    External.prototype.sortOnLabel = function () {
        var sort = this.sort;
        if (!sort)
            return false;
        var sortOn = sort.expression.name;
        if (!this.split || !this.split.hasKey(sortOn))
            return false;
        var applies = this.applies;
        for (var _i = 0, applies_7 = applies; _i < applies_7.length; _i++) {
            var apply = applies_7[_i];
            if (apply.name === sortOn)
                return false;
        }
        return true;
    };
    External.prototype.inlineDerivedAttributes = function (expression) {
        var derivedAttributes = this.derivedAttributes;
        return expression.substitute(function (refEx) {
            if (refEx instanceof RefExpression) {
                var refName = refEx.name;
                return hasOwnProperty(derivedAttributes, refName) ? derivedAttributes[refName] : null;
            }
            else {
                return null;
            }
        });
    };
    External.prototype.inlineDerivedAttributesInAggregate = function (expression) {
        var _this = this;
        var derivedAttributes = this.derivedAttributes;
        return expression.substituteAction(function (action) {
            if (!action.isAggregate())
                return false;
            return action.getFreeReferences().some(function (ref) { return hasOwnProperty(derivedAttributes, ref); });
        }, function (preEx, action) {
            return preEx.performAction(action.changeExpression(_this.inlineDerivedAttributes(action.expression)));
        });
    };
    External.prototype.switchToRollupCount = function (expression) {
        var _this = this;
        if (!this.rollup)
            return expression;
        var countRef = null;
        return expression.substituteAction(function (action) {
            return action.action === 'count';
        }, function (preEx) {
            if (!countRef)
                countRef = $(_this.getRollupCountName(), 'NUMBER');
            return preEx.sum(countRef);
        });
    };
    External.prototype.getRollupCountName = function () {
        var rawAttributes = this.rawAttributes;
        for (var _i = 0, rawAttributes_1 = rawAttributes; _i < rawAttributes_1.length; _i++) {
            var attribute = rawAttributes_1[_i];
            var makerAction = attribute.makerAction;
            if (makerAction && makerAction.action === 'count')
                return attribute.name;
        }
        throw new Error("could not find rollup count");
    };
    External.prototype.getQuerySplit = function () {
        var _this = this;
        return this.split.transformExpressions(function (ex) {
            return _this.inlineDerivedAttributes(ex);
        });
    };
    External.prototype.getQueryFilter = function () {
        return this.inlineDerivedAttributes(this.filter).simplify();
    };
    External.prototype.getSelectedAttributes = function () {
        var _a = this, select = _a.select, attributes = _a.attributes, derivedAttributes = _a.derivedAttributes;
        attributes = attributes.slice();
        for (var k in derivedAttributes) {
            attributes.push(new AttributeInfo({ name: k, type: derivedAttributes[k].type }));
        }
        if (!select)
            return attributes;
        var selectAttributes = select.attributes;
        return selectAttributes.map(function (s) { return NamedArray.findByName(attributes, s); });
    };
    External.prototype.addNextExternal = function (dataset) {
        var _this = this;
        var _a = this, mode = _a.mode, dataName = _a.dataName, split = _a.split;
        if (mode !== 'split')
            throw new Error('must be in split mode to addNextExternal');
        return dataset.apply(dataName, function (d) {
            return _this.getRaw().addFilter(split.filterFromDatum(d));
        }, 'DATASET', null);
    };
    External.prototype.getDelegate = function () {
        var _a = this, mode = _a.mode, delegates = _a.delegates;
        if (!delegates || !delegates.length || mode === 'raw')
            return null;
        return delegates[0];
    };
    External.prototype.simulateValue = function (lastNode, simulatedQueries, externalForNext) {
        if (externalForNext === void 0) { externalForNext = null; }
        var mode = this.mode;
        if (!externalForNext)
            externalForNext = this;
        var delegate = this.getDelegate();
        if (delegate) {
            return delegate.simulateValue(lastNode, simulatedQueries, externalForNext);
        }
        simulatedQueries.push(this.getQueryAndPostProcess().query);
        if (mode === 'value') {
            var valueExpression = this.valueExpression;
            return getSampleValue(valueExpression.type, valueExpression);
        }
        var datum = {};
        if (mode === 'raw') {
            var attributes = this.attributes;
            for (var _i = 0, attributes_2 = attributes; _i < attributes_2.length; _i++) {
                var attribute = attributes_2[_i];
                datum[attribute.name] = getSampleValue(attribute.type, null);
            }
        }
        else {
            if (mode === 'split') {
                this.split.mapSplits(function (name, expression) {
                    datum[name] = getSampleValue(unwrapSetType(expression.type), expression);
                });
            }
            var applies = this.applies;
            for (var _a = 0, applies_8 = applies; _a < applies_8.length; _a++) {
                var apply = applies_8[_a];
                datum[apply.name] = getSampleValue(apply.expression.type, apply.expression);
            }
        }
        var dataset = new Dataset({ data: [datum] });
        if (!lastNode && mode === 'split')
            dataset = externalForNext.addNextExternal(dataset);
        return dataset;
    };
    External.prototype.getQueryAndPostProcess = function () {
        throw new Error("can not call getQueryAndPostProcess directly");
    };
    External.prototype.queryValue = function (lastNode, externalForNext) {
        if (externalForNext === void 0) { externalForNext = null; }
        var _a = this, mode = _a.mode, requester = _a.requester;
        if (!externalForNext)
            externalForNext = this;
        var delegate = this.getDelegate();
        if (delegate) {
            return delegate.queryValue(lastNode, externalForNext);
        }
        if (!requester) {
            return Q.reject(new Error('must have a requester to make queries'));
        }
        try {
            var queryAndPostProcess = this.getQueryAndPostProcess();
        }
        catch (e) {
            return Q.reject(e);
        }
        var query = queryAndPostProcess.query, postProcess = queryAndPostProcess.postProcess, next = queryAndPostProcess.next;
        if (!query || typeof postProcess !== 'function') {
            return Q.reject(new Error('no query or postProcess'));
        }
        var finalResult;
        if (next) {
            var results = [];
            finalResult = promiseWhile(function () { return query; }, function () {
                return requester({ query: query })
                    .then(function (result) {
                    results.push(result);
                    query = next(query, result);
                });
            })
                .then(function () {
                return queryAndPostProcess.postProcess(results);
            });
        }
        else {
            finalResult = requester({ query: query })
                .then(queryAndPostProcess.postProcess);
        }
        if (!lastNode && mode === 'split') {
            finalResult = finalResult.then(externalForNext.addNextExternal.bind(externalForNext));
        }
        return finalResult;
    };
    External.prototype.needsIntrospect = function () {
        return !this.attributes;
    };
    External.prototype.introspect = function () {
        var _this = this;
        if (!this.requester) {
            return Q.reject(new Error('must have a requester to introspect'));
        }
        if (!this.version) {
            return this.constructor.getVersion(this.requester).then(function (version) {
                version = External.extractVersion(version);
                if (!version)
                    throw new Error('external version not found, please specify explicitly');
                return _this.changeVersion(version).introspect();
            });
        }
        return this.getIntrospectAttributes()
            .then(function (attributes) {
            var value = _this.valueOf();
            if (value.attributeOverrides) {
                attributes = AttributeInfo.override(attributes, value.attributeOverrides);
            }
            if (value.attributes) {
                attributes = AttributeInfo.override(value.attributes, attributes);
            }
            value.attributes = attributes;
            return External.fromValue(value);
        });
    };
    External.prototype.getRawDatasetType = function () {
        var _a = this, attributes = _a.attributes, rawAttributes = _a.rawAttributes, derivedAttributes = _a.derivedAttributes;
        if (!attributes)
            throw new Error("dataset has not been introspected");
        if (!rawAttributes)
            rawAttributes = attributes;
        var myDatasetType = {};
        for (var _i = 0, rawAttributes_2 = rawAttributes; _i < rawAttributes_2.length; _i++) {
            var rawAttribute = rawAttributes_2[_i];
            var attrName = rawAttribute.name;
            myDatasetType[attrName] = {
                type: rawAttribute.type
            };
        }
        for (var name in derivedAttributes) {
            myDatasetType[name] = {
                type: derivedAttributes[name].type
            };
        }
        return myDatasetType;
    };
    External.prototype.getFullType = function () {
        var _a = this, mode = _a.mode, attributes = _a.attributes;
        if (mode === 'value')
            throw new Error('not supported for value mode yet');
        var myDatasetType = this.getRawDatasetType();
        if (mode !== 'raw') {
            var splitDatasetType = {};
            splitDatasetType[this.dataName || External.SEGMENT_NAME] = {
                type: 'DATASET',
                datasetType: myDatasetType,
                remote: true
            };
            for (var _i = 0, attributes_3 = attributes; _i < attributes_3.length; _i++) {
                var attribute = attributes_3[_i];
                var attrName = attribute.name;
                splitDatasetType[attrName] = {
                    type: attribute.type
                };
            }
            myDatasetType = splitDatasetType;
        }
        return {
            type: 'DATASET',
            datasetType: myDatasetType,
            remote: true
        };
    };
    External.type = 'EXTERNAL';
    External.SEGMENT_NAME = '__SEGMENT__';
    External.VALUE_NAME = '__VALUE__';
    External.classMap = {};
    return External;
}());
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};







var DUMMY_NAME = '!DUMMY';
var TIME_ATTRIBUTE = '__time';
var AGGREGATE_TO_DRUID = {
    count: "count",
    sum: "doubleSum",
    min: "doubleMin",
    max: "doubleMax"
};
var AGGREGATE_TO_FUNCTION = {
    sum: function (a, b) { return (a + "+" + b); },
    min: function (a, b) { return ("Math.min(" + a + "," + b + ")"); },
    max: function (a, b) { return ("Math.max(" + a + "," + b + ")"); }
};
var AGGREGATE_TO_ZERO = {
    sum: "0",
    min: "Infinity",
    max: "-Infinity"
};
var InvalidResultError = exports.InvalidResultError = (function (_super) {
    __extends(InvalidResultError, _super);
    function InvalidResultError(message, result) {
        _super.call(this, message);
        this.result = result;
    }
    return InvalidResultError;
}(ExtendableError));
function expressionNeedsAlphaNumericSort(ex) {
    var type = ex.type;
    return (type === 'NUMBER' || type === 'NUMBER_RANGE');
}
function customAggregationsEqual(customA, customB) {
    return JSON.stringify(customA) === JSON.stringify(customB);
}
function customTransformsEqual(customA, customB) {
    return JSON.stringify(customA) === JSON.stringify(customB);
}
var DruidExternal = exports.DruidExternal = (function (_super) {
    __extends(DruidExternal, _super);
    function DruidExternal(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureEngine("druid");
        this._ensureMinVersion("0.8.0");
        this.timeAttribute = parameters.timeAttribute || TIME_ATTRIBUTE;
        this.customAggregations = parameters.customAggregations;
        this.customTransforms = parameters.customTransforms;
        this.allowEternity = parameters.allowEternity;
        this.allowSelectQueries = parameters.allowSelectQueries;
        var introspectionStrategy = parameters.introspectionStrategy || DruidExternal.DEFAULT_INTROSPECTION_STRATEGY;
        if (DruidExternal.VALID_INTROSPECTION_STRATEGIES.indexOf(introspectionStrategy) === -1) {
            throw new Error("invalid introspectionStrategy '" + introspectionStrategy + "'");
        }
        this.introspectionStrategy = introspectionStrategy;
        this.exactResultsOnly = parameters.exactResultsOnly;
        this.context = parameters.context;
    }
    DruidExternal.fromJS = function (parameters, requester) {
        if (typeof parameters.druidVersion === 'string') {
            parameters.version = parameters.druidVersion;
            console.warn("'druidVersion' parameter is deprecated, use 'version: " + parameters.version + "' instead");
        }
        var value = External.jsToValue(parameters, requester);
        value.timeAttribute = parameters.timeAttribute;
        value.customAggregations = parameters.customAggregations || {};
        value.customTransforms = parameters.customTransforms || {};
        value.allowEternity = Boolean(parameters.allowEternity);
        value.allowSelectQueries = Boolean(parameters.allowSelectQueries);
        value.introspectionStrategy = parameters.introspectionStrategy;
        value.exactResultsOnly = Boolean(parameters.exactResultsOnly);
        value.context = parameters.context;
        return new DruidExternal(value);
    };
    DruidExternal.getSourceList = function (requester) {
        return requester({ query: { queryType: 'sourceList' } })
            .then(function (sources) {
            if (!Array.isArray(sources))
                throw new InvalidResultError('invalid sources response', sources);
            return sources.sort();
        });
    };
    DruidExternal.getVersion = function (requester) {
        return requester({
            query: {
                queryType: 'status'
            }
        })
            .then(function (res) {
            if (!DruidExternal.correctStatusResult(res))
                throw new InvalidResultError('unexpected result from /status', res);
            return res.version;
        });
    };
    DruidExternal.cleanDatumInPlace = function (datum) {
        for (var k in datum) {
            if (k[0] === '!')
                delete datum[k];
        }
    };
    DruidExternal.correctTimeBoundaryResult = function (result) {
        return Array.isArray(result) && result.length === 1 && typeof result[0].result === 'object';
    };
    DruidExternal.correctTimeseriesResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].result === 'object');
    };
    DruidExternal.correctTopNResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || Array.isArray(result[0].result));
    };
    DruidExternal.correctGroupByResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].event === 'object');
    };
    DruidExternal.correctSelectResult = function (result) {
        return Array.isArray(result) && (result.length === 0 || typeof result[0].result === 'object');
    };
    DruidExternal.correctStatusResult = function (result) {
        return result && typeof result.version === 'string';
    };
    DruidExternal.timeBoundaryPostProcessFactory = function (applies) {
        return function (res) {
            if (!DruidExternal.correctTimeBoundaryResult(res))
                throw new InvalidResultError("unexpected result from Druid (timeBoundary)", res);
            var result = res[0].result;
            var datum = {};
            for (var _i = 0, applies_1 = applies; _i < applies_1.length; _i++) {
                var apply = applies_1[_i];
                var name_1 = apply.name;
                var aggregate = apply.expression.actions[0].action;
                if (typeof result === 'string') {
                    datum[name_1] = new Date(result);
                }
                else {
                    if (aggregate === 'max') {
                        datum[name_1] = new Date((result['maxIngestedEventTime'] || result['maxTime']));
                    }
                    else {
                        datum[name_1] = new Date((result['minTime']));
                    }
                }
            }
            return new Dataset({ data: [datum] });
        };
    };
    DruidExternal.valuePostProcess = function (res) {
        if (!DruidExternal.correctTimeseriesResult(res))
            throw new InvalidResultError("unexpected result from Druid (all / value)", res);
        if (!res.length)
            return 0;
        return res[0].result[External.VALUE_NAME];
    };
    DruidExternal.totalPostProcessFactory = function (applies) {
        return function (res) {
            if (!DruidExternal.correctTimeseriesResult(res))
                throw new InvalidResultError("unexpected result from Druid (all)", res);
            if (!res.length)
                return new Dataset({ data: [External.makeZeroDatum(applies)] });
            var datum = res[0].result;
            DruidExternal.cleanDatumInPlace(datum);
            return new Dataset({ data: [datum] });
        };
    };
    DruidExternal.wrapFunctionTryCatch = function (lines) {
        return 'function(s){try{\n' + lines.filter(Boolean).join('\n') + '\n}catch(e){return null;}}';
    };
    DruidExternal.timeseriesNormalizerFactory = function (timestampLabel) {
        if (timestampLabel === void 0) { timestampLabel = null; }
        return function (res) {
            if (!DruidExternal.correctTimeseriesResult(res))
                throw new InvalidResultError("unexpected result from Druid (timeseries)", res);
            return res.map(function (r) {
                var datum = r.result;
                DruidExternal.cleanDatumInPlace(datum);
                if (timestampLabel)
                    datum[timestampLabel] = r.timestamp;
                return datum;
            });
        };
    };
    DruidExternal.topNNormalizer = function (res) {
        if (!DruidExternal.correctTopNResult(res))
            throw new InvalidResultError("unexpected result from Druid (topN)", res);
        var data = res.length ? res[0].result : [];
        for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
            var d = data_1[_i];
            DruidExternal.cleanDatumInPlace(d);
        }
        return data;
    };
    DruidExternal.groupByNormalizerFactory = function (timestampLabel) {
        if (timestampLabel === void 0) { timestampLabel = null; }
        return function (res) {
            if (!DruidExternal.correctGroupByResult(res))
                throw new InvalidResultError("unexpected result from Druid (groupBy)", res);
            return res.map(function (r) {
                var datum = r.event;
                DruidExternal.cleanDatumInPlace(datum);
                if (timestampLabel)
                    datum[timestampLabel] = r.timestamp;
                return datum;
            });
        };
    };
    DruidExternal.selectNormalizerFactory = function (timestampLabel) {
        return function (results) {
            var data = [];
            for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
                var result = results_1[_i];
                if (!DruidExternal.correctSelectResult(result))
                    throw new InvalidResultError("unexpected result from Druid (select)", result);
                if (result.length === 0)
                    continue;
                var events = result[0].result.events;
                for (var _a = 0, events_1 = events; _a < events_1.length; _a++) {
                    var event = events_1[_a];
                    var datum = event.event;
                    if (timestampLabel != null) {
                        datum[timestampLabel] = datum['timestamp'];
                    }
                    delete datum['timestamp'];
                    DruidExternal.cleanDatumInPlace(datum);
                    data.push(datum);
                }
            }
            return data;
        };
    };
    DruidExternal.postProcessFactory = function (normalizer, inflaters, attributes) {
        return function (res) {
            var data = normalizer(res);
            var n = data.length;
            for (var _i = 0, inflaters_1 = inflaters; _i < inflaters_1.length; _i++) {
                var inflater = inflaters_1[_i];
                for (var i = 0; i < n; i++) {
                    inflater(data[i], i, data);
                }
            }
            return new Dataset({ data: data, attributes: attributes });
        };
    };
    DruidExternal.selectNextFactory = function (limit, descending) {
        var resultsSoFar = 0;
        return function (prevQuery, prevResult) {
            if (!DruidExternal.correctSelectResult(prevResult))
                throw new InvalidResultError("unexpected result from Druid (select / partial)", prevResult);
            if (prevResult.length === 0)
                return null;
            var _a = prevResult[0].result, pagingIdentifiers = _a.pagingIdentifiers, events = _a.events;
            if (events.length < prevQuery.pagingSpec.threshold)
                return null;
            resultsSoFar += events.length;
            if (resultsSoFar >= limit)
                return null;
            var pagingIdentifiers = DruidExternal.movePagingIdentifiers(pagingIdentifiers, descending ? -1 : 1);
            prevQuery.pagingSpec.pagingIdentifiers = pagingIdentifiers;
            prevQuery.pagingSpec.threshold = Math.min(limit - resultsSoFar, DruidExternal.SELECT_MAX_LIMIT);
            return prevQuery;
        };
    };
    DruidExternal.generateMakerAction = function (aggregation) {
        if (!aggregation)
            return null;
        var type = aggregation.type, fieldName = aggregation.fieldName;
        if (type === 'longSum' && fieldName === 'count') {
            return new CountAction({});
        }
        if (!fieldName) {
            var fieldNames = aggregation.fieldNames;
            if (!Array.isArray(fieldNames) || fieldNames.length !== 1)
                return null;
            fieldName = fieldNames[0];
        }
        var expression = $(fieldName);
        switch (type) {
            case "count":
                return new CountAction({});
            case "doubleSum":
            case "longSum":
                return new SumAction({ expression: expression });
            case "javascript":
                var fnAggregate = aggregation.fnAggregate, fnCombine = aggregation.fnCombine;
                if (fnAggregate !== fnCombine || fnCombine.indexOf('+') === -1)
                    return null;
                return new SumAction({ expression: expression });
            case "doubleMin":
            case "longMin":
                return new MinAction({ expression: expression });
            case "doubleMax":
            case "longMax":
                return new MaxAction({ expression: expression });
            default:
                return null;
        }
    };
    DruidExternal.segmentMetadataPostProcessFactory = function (timeAttribute) {
        return function (res) {
            var res0 = res[0];
            if (!res0 || !res0.columns)
                throw new InvalidResultError('malformed segmentMetadata response', res);
            var columns = res0.columns;
            var aggregators = res0.aggregators || {};
            var foundTime = false;
            var attributes = [];
            for (var name in columns) {
                if (!hasOwnProperty(columns, name))
                    continue;
                var columnData = columns[name];
                if (columnData.errorMessage || columnData.size < 0)
                    continue;
                if (name === TIME_ATTRIBUTE) {
                    attributes.push(new AttributeInfo({ name: timeAttribute, type: 'TIME' }));
                    foundTime = true;
                }
                else {
                    if (name === timeAttribute)
                        continue;
                    switch (columnData.type) {
                        case 'FLOAT':
                        case 'LONG':
                            attributes.push(new AttributeInfo({
                                name: name,
                                type: 'NUMBER',
                                unsplitable: true,
                                makerAction: DruidExternal.generateMakerAction(aggregators[name])
                            }));
                            break;
                        case 'STRING':
                            attributes.push(new AttributeInfo({
                                name: name,
                                type: columnData.hasMultipleValues ? 'SET/STRING' : 'STRING'
                            }));
                            break;
                        case 'hyperUnique':
                            attributes.push(new UniqueAttributeInfo({ name: name }));
                            break;
                        case 'approximateHistogram':
                            attributes.push(new HistogramAttributeInfo({ name: name }));
                            break;
                        case 'thetaSketch':
                            attributes.push(new ThetaAttributeInfo({ name: name }));
                            break;
                    }
                }
            }
            if (!foundTime)
                throw new Error("no valid " + TIME_ATTRIBUTE + " in segmentMetadata response");
            return attributes;
        };
    };
    DruidExternal.introspectPostProcessFactory = function (timeAttribute) {
        return function (res) {
            if (!Array.isArray(res.dimensions) || !Array.isArray(res.metrics)) {
                throw new InvalidResultError('malformed GET introspect response', res);
            }
            var attributes = [
                new AttributeInfo({ name: timeAttribute, type: 'TIME' })
            ];
            res.dimensions.forEach(function (dimension) {
                if (dimension === timeAttribute)
                    return;
                attributes.push(new AttributeInfo({ name: dimension, type: 'STRING' }));
            });
            res.metrics.forEach(function (metric) {
                if (metric === timeAttribute)
                    return;
                attributes.push(new AttributeInfo({ name: metric, type: 'NUMBER', unsplitable: true }));
            });
            return attributes;
        };
    };
    DruidExternal.movePagingIdentifiers = function (pagingIdentifiers, increment) {
        var newPagingIdentifiers = {};
        for (var key in pagingIdentifiers) {
            if (!hasOwnProperty(pagingIdentifiers, key))
                continue;
            newPagingIdentifiers[key] = pagingIdentifiers[key] + increment;
        }
        return newPagingIdentifiers;
    };
    DruidExternal.timePartToExtraction = function (part, timezone) {
        var format = DruidExternal.TIME_PART_TO_FORMAT[part];
        if (format) {
            return {
                "format": format,
                "locale": "en-US",
                "timeZone": timezone.toString(),
                "type": "timeFormat"
            };
        }
        else {
            var expr = DruidExternal.TIME_PART_TO_EXPR[part];
            if (!expr)
                throw new Error("can not part on " + part);
            return {
                type: 'javascript',
                'function': DruidExternal.wrapFunctionTryCatch([
                    'var d = new org.joda.time.DateTime(s);',
                    timezone.isUTC() ? null : "d = d.withZone(org.joda.time.DateTimeZone.forID(" + JSON.stringify(timezone) + "));",
                    ("d = " + expr + ";"),
                    'return d;'
                ])
            };
        }
    };
    DruidExternal.timeFloorToExtraction = function (duration, timezone) {
        var singleSpan = duration.getSingleSpan();
        var spanValue = duration.getSingleSpanValue();
        if (spanValue === 1 && DruidExternal.SPAN_TO_FLOOR_FORMAT[singleSpan]) {
            return {
                "format": DruidExternal.SPAN_TO_FLOOR_FORMAT[singleSpan],
                "locale": "en-US",
                "timeZone": timezone.toString(),
                "type": "timeFormat"
            };
        }
        else {
            var prop = DruidExternal.SPAN_TO_PROPERTY[singleSpan];
            if (!prop)
                throw new Error("can not floor on " + duration);
            return {
                type: 'javascript',
                'function': DruidExternal.wrapFunctionTryCatch([
                    'var d = new org.joda.time.DateTime(s);',
                    timezone.isUTC() ? null : "d = d.withZone(org.joda.time.DateTimeZone.forID(" + JSON.stringify(timezone) + "));",
                    ("d = d." + prop + "().roundFloorCopy();"),
                    ("d = d." + prop + "().setCopy(Math.floor(d." + prop + "().get() / " + spanValue + ") * " + spanValue + ");"),
                    'return d;'
                ])
            };
        }
    };
    DruidExternal.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.timeAttribute = this.timeAttribute;
        value.customAggregations = this.customAggregations;
        value.customTransforms = this.customTransforms;
        value.allowEternity = this.allowEternity;
        value.allowSelectQueries = this.allowSelectQueries;
        value.introspectionStrategy = this.introspectionStrategy;
        value.exactResultsOnly = this.exactResultsOnly;
        value.context = this.context;
        return value;
    };
    DruidExternal.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        if (this.timeAttribute !== TIME_ATTRIBUTE)
            js.timeAttribute = this.timeAttribute;
        if (nonEmptyLookup(this.customAggregations))
            js.customAggregations = this.customAggregations;
        if (nonEmptyLookup(this.customTransforms))
            js.customTransforms = this.customTransforms;
        if (this.allowEternity)
            js.allowEternity = true;
        if (this.allowSelectQueries)
            js.allowSelectQueries = true;
        if (this.introspectionStrategy !== DruidExternal.DEFAULT_INTROSPECTION_STRATEGY)
            js.introspectionStrategy = this.introspectionStrategy;
        if (this.exactResultsOnly)
            js.exactResultsOnly = true;
        if (this.context)
            js.context = this.context;
        return js;
    };
    DruidExternal.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.timeAttribute === other.timeAttribute &&
            customAggregationsEqual(this.customAggregations, other.customAggregations) &&
            customTransformsEqual(this.customTransforms, other.customTransforms) &&
            this.allowEternity === other.allowEternity &&
            this.allowSelectQueries === other.allowSelectQueries &&
            this.introspectionStrategy === other.introspectionStrategy &&
            this.exactResultsOnly === other.exactResultsOnly &&
            dictEqual(this.context, other.context);
    };
    DruidExternal.prototype.getSingleReferenceAttributeInfo = function (ex) {
        var freeReferences = ex.getFreeReferences();
        if (freeReferences.length !== 1)
            throw new Error("can not translate multi reference expression " + ex + " to Druid");
        var referenceName = freeReferences[0];
        return this.getAttributesInfo(referenceName);
    };
    DruidExternal.prototype.canHandleFilter = function (ex) {
        return !(ex instanceof ChainExpression &&
            ex.actions.some(function (a) { return a.action === 'cardinality'; }));
    };
    DruidExternal.prototype.canHandleTotal = function () {
        return true;
    };
    DruidExternal.prototype.canHandleSplit = function (ex) {
        return true;
    };
    DruidExternal.prototype.canHandleApply = function (ex) {
        return true;
    };
    DruidExternal.prototype.canHandleSort = function (sortAction) {
        if (this.isTimeseries()) {
            if (sortAction.direction !== 'ascending')
                return false;
            return sortAction.refName() === this.split.firstSplitName();
        }
        else if (this.mode === 'raw') {
            if (sortAction.refName() !== this.timeAttribute)
                return false;
            if (this.versionBefore('0.9.0'))
                return sortAction.direction === 'ascending';
            return true;
        }
        else {
            return true;
        }
    };
    DruidExternal.prototype.canHandleLimit = function (limitAction) {
        return !this.isTimeseries();
    };
    DruidExternal.prototype.canHandleHavingFilter = function (ex) {
        return !this.limit;
    };
    DruidExternal.prototype.isTimeseries = function () {
        var split = this.split;
        if (!split || split.isMultiSplit())
            return false;
        var splitExpression = split.firstSplitExpression();
        if (this.isTimeRef(splitExpression))
            return true;
        if (splitExpression instanceof ChainExpression) {
            var actions = splitExpression.actions;
            if (actions.length !== 1)
                return false;
            var action = actions[0].action;
            return action === 'timeBucket' || action === 'timeFloor';
        }
        return false;
    };
    DruidExternal.prototype.getDruidDataSource = function () {
        var source = this.source;
        if (Array.isArray(source)) {
            return {
                type: "union",
                dataSources: source
            };
        }
        else {
            return source;
        }
    };
    DruidExternal.prototype.getDimensionNameForAttribureInfo = function (attributeInfo) {
        return attributeInfo.name === this.timeAttribute ? TIME_ATTRIBUTE : attributeInfo.name;
    };
    DruidExternal.prototype.checkFilterExtractability = function (attributeInfo) {
        if (this.versionBefore('0.9.2') && attributeInfo.name === this.timeAttribute) {
            throw new Error('can not do secondary filtering on primary time dimension (https://github.com/druid-io/druid/issues/2816)');
        }
    };
    DruidExternal.prototype.makeJavaScriptFilter = function (ex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        this.checkFilterExtractability(attributeInfo);
        return {
            type: "javascript",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            "function": ex.getJSFn('d')
        };
    };
    DruidExternal.prototype.makeExtractionFilter = function (ex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        return {
            type: "extraction",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            extractionFn: extractionFn,
            value: "true"
        };
    };
    DruidExternal.prototype.makeSelectorFilter = function (ex, value) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        if (attributeInfo.unsplitable) {
            throw new Error("can not convert " + ex + " = " + value + " to filter because it references an un-filterable metric '" + attributeInfo.name + "' which is most likely rolled up.");
        }
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        if (Range.isRange(value))
            value = value.start;
        var druidFilter = {
            type: "selector",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            value: attributeInfo.serialize(value)
        };
        if (extractionFn) {
            druidFilter.extractionFn = extractionFn;
            if (this.versionBefore('0.9.1'))
                druidFilter.type = "extraction";
            if (this.versionBefore('0.9.0') && druidFilter.value === null)
                druidFilter.value = '';
        }
        return druidFilter;
    };
    DruidExternal.prototype.makeInFilter = function (ex, valueSet) {
        var _this = this;
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var elements = valueSet.elements;
        if (elements.length < 2 ||
            (this.versionBefore('0.9.1') && extractionFn) ||
            this.versionBefore('0.9.0')) {
            var fields = elements.map(function (value) {
                return _this.makeSelectorFilter(ex, value);
            });
            return fields.length === 1 ? fields[0] : { type: "or", fields: fields };
        }
        var inFilter = {
            type: 'in',
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            values: elements.map(function (value) { return attributeInfo.serialize(value); })
        };
        if (extractionFn)
            inFilter.extractionFn = extractionFn;
        return inFilter;
    };
    DruidExternal.prototype.makeBoundFilter = function (ex, range) {
        var r0 = range.start;
        var r1 = range.end;
        var bounds = range.bounds;
        if (this.versionBefore('0.9.0') || r0 < 0 || r1 < 0) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        if (ex instanceof ChainExpression && (ex.getSingleAction() instanceof IndexOfAction || ex.popAction() instanceof IndexOfAction)) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (this.versionBefore('0.9.1') && extractionFn) {
            return this.makeJavaScriptFilter(ex.in(range));
        }
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var boundFilter = {
            type: "bound",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo)
        };
        if (extractionFn)
            boundFilter.extractionFn = extractionFn;
        if (NumberRange.isNumberRange(range))
            boundFilter.alphaNumeric = true;
        if (r0 != null) {
            boundFilter.lower = isDate(r0) ? r0.toISOString() : r0;
            if (bounds[0] === '(')
                boundFilter.lowerStrict = true;
        }
        if (r1 != null) {
            boundFilter.upper = isDate(r1) ? r1.toISOString() : r1;
            if (bounds[1] === ')')
                boundFilter.upperStrict = true;
        }
        return boundFilter;
    };
    DruidExternal.prototype.makeRegexFilter = function (ex, regex) {
        var attributeInfo = this.getSingleReferenceAttributeInfo(ex);
        var extractionFn = this.expressionToExtractionFn(ex);
        if (this.versionBefore('0.9.1') && extractionFn) {
            return this.makeExtractionFilter(ex.match(regex));
        }
        if (extractionFn)
            this.checkFilterExtractability(attributeInfo);
        var regexFilter = {
            type: "regex",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            pattern: regex
        };
        if (extractionFn)
            regexFilter.extractionFn = extractionFn;
        return regexFilter;
    };
    DruidExternal.prototype.makeContainsFilter = function (lhs, rhs, compare) {
        if (rhs instanceof LiteralExpression) {
            var attributeInfo = this.getSingleReferenceAttributeInfo(lhs);
            var extractionFn = this.expressionToExtractionFn(lhs);
            if (extractionFn)
                this.checkFilterExtractability(attributeInfo);
            if (this.versionBefore('0.9.0')) {
                if (compare === ContainsAction.IGNORE_CASE) {
                    return {
                        type: "search",
                        dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
                        query: {
                            type: "insensitive_contains",
                            value: rhs.value
                        }
                    };
                }
                else {
                    return this.makeJavaScriptFilter(lhs.contains(rhs, compare));
                }
            }
            if (this.versionBefore('0.9.1') && extractionFn) {
                return this.makeExtractionFilter(lhs.contains(rhs, compare));
            }
            var searchFilter = {
                type: "search",
                dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
                query: {
                    type: "contains",
                    value: rhs.value,
                    caseSensitive: compare === ContainsAction.NORMAL
                }
            };
            if (extractionFn)
                searchFilter.extractionFn = extractionFn;
            return searchFilter;
        }
        else {
            return this.makeJavaScriptFilter(lhs.contains(rhs, compare));
        }
    };
    DruidExternal.prototype.timelessFilterToDruid = function (filter, aggregatorFilter) {
        var _this = this;
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter instanceof RefExpression) {
            filter = filter.is(true);
        }
        if (filter instanceof LiteralExpression) {
            if (filter.value === true) {
                return null;
            }
            else {
                throw new Error("should never get here");
            }
        }
        else if (filter instanceof ChainExpression) {
            var pattern;
            if (pattern = filter.getExpressionPattern('and')) {
                return {
                    type: 'and',
                    fields: pattern.map(function (p) { return _this.timelessFilterToDruid(p, aggregatorFilter); })
                };
            }
            if (pattern = filter.getExpressionPattern('or')) {
                return {
                    type: 'or',
                    fields: pattern.map(function (p) { return _this.timelessFilterToDruid(p, aggregatorFilter); })
                };
            }
            var filterAction = filter.lastAction();
            var rhs = filterAction.expression;
            var lhs = filter.popAction();
            if (filterAction instanceof NotAction) {
                return {
                    type: 'not',
                    field: this.timelessFilterToDruid(lhs, aggregatorFilter)
                };
            }
            if (lhs instanceof LiteralExpression) {
                if (filterAction.action !== 'in')
                    throw new Error("can not convert " + filter + " to Druid filter");
                return this.makeSelectorFilter(rhs, lhs.value);
            }
            if (filterAction instanceof IsAction) {
                if (rhs instanceof LiteralExpression) {
                    return this.makeSelectorFilter(lhs, rhs.value);
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid filter");
                }
            }
            var freeReferences = filter.getFreeReferences();
            if (freeReferences.length !== 1)
                throw new Error("can not convert multi reference filter " + filter + " to Druid filter");
            var referenceName = freeReferences[0];
            var attributeInfo = this.getAttributesInfo(referenceName);
            if (attributeInfo.unsplitable) {
                throw new Error("can not convert " + filter + " to filter because it references an un-filterable metric '" + referenceName + "' which is most likely rolled up.");
            }
            if (filterAction instanceof InAction || filterAction instanceof OverlapAction) {
                if (rhs instanceof LiteralExpression) {
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/STRING' || rhsType === 'SET/NUMBER' || rhsType === 'SET/NULL') {
                        return this.makeInFilter(lhs, rhs.value);
                    }
                    else if (rhsType === 'NUMBER_RANGE' || rhsType === 'TIME_RANGE' || rhsType === 'STRING_RANGE') {
                        return this.makeBoundFilter(lhs, rhs.value);
                    }
                    else if (rhsType === 'SET/NUMBER_RANGE' || rhsType === 'SET/TIME_RANGE') {
                        var elements = rhs.value.elements;
                        var fields = elements.map(function (range) {
                            return _this.makeBoundFilter(lhs, range);
                        });
                        return fields.length === 1 ? fields[0] : { type: "or", fields: fields };
                    }
                    else {
                        throw new Error("not supported IN rhs type " + rhsType);
                    }
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid filter");
                }
            }
            if (aggregatorFilter) {
                if (this.versionBefore('0.8.2'))
                    throw new Error("can not express aggregate filter " + filter + " in druid < 0.8.2");
                if (this.versionBefore('0.9.1'))
                    return this.makeExtractionFilter(filter);
            }
            if (filterAction instanceof MatchAction) {
                return this.makeRegexFilter(lhs, filterAction.regexp);
            }
            if (filterAction instanceof ContainsAction) {
                return this.makeContainsFilter(lhs, rhs, filterAction.compare);
            }
        }
        throw new Error("could not convert filter " + filter + " to Druid filter");
    };
    DruidExternal.prototype.timeFilterToIntervals = function (filter) {
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter instanceof LiteralExpression) {
            if (!filter.value)
                return DruidExternal.FALSE_INTERVAL;
            if (!this.allowEternity)
                throw new Error('must filter on time unless the allowEternity flag is set');
            return DruidExternal.TRUE_INTERVAL;
        }
        else if (filter instanceof ChainExpression) {
            var lhs = filter.expression;
            var actions = filter.actions;
            if (actions.length !== 1)
                throw new Error("can not convert " + filter + " to Druid interval");
            var filterAction = actions[0];
            var rhs = filterAction.expression;
            if (filterAction instanceof IsAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    return TimeRange.intervalFromDate(rhs.value);
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid interval");
                }
            }
            else if (filterAction instanceof InAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    var timeRanges;
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/TIME_RANGE') {
                        timeRanges = rhs.value.elements;
                    }
                    else if (rhsType === 'TIME_RANGE') {
                        timeRanges = [rhs.value];
                    }
                    else {
                        throw new Error("not supported " + rhsType + " for time filtering");
                    }
                    var intervals = timeRanges.map(function (timeRange) { return timeRange.toInterval(); });
                    return intervals.length === 1 ? intervals[0] : intervals;
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid interval");
                }
            }
            else {
                throw new Error("can not convert " + filter + " to Druid interval");
            }
        }
        else {
            throw new Error("can not convert " + filter + " to Druid interval");
        }
    };
    DruidExternal.prototype.filterToDruid = function (filter) {
        if (filter.type !== 'BOOLEAN')
            throw new Error("must be a BOOLEAN filter");
        if (filter.equals(Expression.FALSE)) {
            return {
                intervals: DruidExternal.FALSE_INTERVAL,
                filter: null
            };
        }
        else {
            var timeAttribute_1 = this.timeAttribute;
            var _a = filter.extractFromAnd(function (ex) {
                if (ex instanceof ChainExpression) {
                    var op = ex.expression;
                    var actions = ex.actions;
                    if (op instanceof RefExpression) {
                        if (!(op.name === timeAttribute_1 && actions.length === 1))
                            return false;
                        var action = actions[0].action;
                        return action === 'is' || action === 'in';
                    }
                }
                return false;
            }), extract = _a.extract, rest = _a.rest;
            return {
                intervals: this.timeFilterToIntervals(extract),
                filter: this.timelessFilterToDruid(rest, false)
            };
        }
    };
    DruidExternal.prototype.isTimeRef = function (ex) {
        return ex instanceof RefExpression && ex.name === this.timeAttribute;
    };
    DruidExternal.prototype.splitExpressionToGranularityInflater = function (splitExpression, label) {
        if (this.isTimeRef(splitExpression)) {
            return {
                granularity: 'none',
                inflater: External.timeInflaterFactory(label)
            };
        }
        else if (splitExpression instanceof ChainExpression) {
            var splitActions = splitExpression.actions;
            if (this.isTimeRef(splitExpression.expression) && splitActions.length === 1) {
                var action = splitActions[0];
                if (action instanceof TimeBucketAction || action instanceof TimeFloorAction) {
                    var duration = action.duration;
                    var timezone = action.getTimezone();
                    return {
                        granularity: {
                            type: "period",
                            period: duration.toString(),
                            timeZone: timezone.toString()
                        },
                        inflater: action.action === 'timeBucket' ?
                            External.timeRangeInflaterFactory(label, duration, timezone) :
                            External.timeInflaterFactory(label)
                    };
                }
            }
        }
        return null;
    };
    DruidExternal.prototype.expressionToExtractionFn = function (expression) {
        var extractionFns = [];
        this._expressionToExtractionFns(expression, extractionFns);
        switch (extractionFns.length) {
            case 0: return null;
            case 1: return extractionFns[0];
            default:
                if (extractionFns.every(function (extractionFn) { return extractionFn.type === 'javascript'; })) {
                    return this.expressionToJavaScriptExtractionFn(expression);
                }
                if (this.versionBefore('0.9.0')) {
                    try {
                        return this.expressionToJavaScriptExtractionFn(expression);
                    }
                    catch (e) {
                        throw new Error("can not convert " + expression + " to filter in Druid < 0.9.0");
                    }
                }
                return { type: 'cascade', extractionFns: extractionFns };
        }
    };
    DruidExternal.prototype._expressionToExtractionFns = function (expression, extractionFns) {
        var freeReferences = expression.getFreeReferences();
        if (freeReferences.length !== 1) {
            throw new Error("must have 1 reference (has " + freeReferences.length + "): " + expression);
        }
        if (expression instanceof RefExpression) {
            this._processRefExtractionFn(expression, extractionFns);
            return;
        }
        if (expression instanceof ChainExpression) {
            var lead = expression.expression;
            var actions = expression.actions;
            var i = 0;
            var curAction = actions[0];
            var concatPrefix = [];
            if (curAction.action === 'concat') {
                concatPrefix.push(lead);
                while (curAction && curAction.action === 'concat') {
                    concatPrefix.push(curAction.expression);
                    curAction = actions[++i];
                }
                this._processConcatExtractionFn(concatPrefix, extractionFns);
            }
            else if (curAction.action === 'customTransform') {
                extractionFns.push(this.customTransformToExtractionFn(curAction));
                return;
            }
            else if (lead.type === 'NUMBER' && (expression.type === 'NUMBER' || expression.type === 'NUMBER_RANGE')) {
                extractionFns.push(this.expressionToJavaScriptExtractionFn(expression));
                return;
            }
            else if (!lead.isOp('ref')) {
                throw new Error("can not convert complex: " + lead);
            }
            var type = expression.expression.type;
            while (curAction) {
                var nextAction = actions[i + 1];
                var extractionFn;
                if (nextAction instanceof FallbackAction) {
                    extractionFn = this.actionToExtractionFn(curAction, nextAction);
                    i++;
                }
                else if (curAction instanceof CastAction && curAction.outputType === 'STRING' && !nextAction) {
                    break;
                }
                else {
                    extractionFn = this.actionToExtractionFn(curAction, null, type);
                }
                type = curAction.getOutputType(type);
                extractionFns.push(extractionFn);
                curAction = actions[++i];
            }
        }
    };
    DruidExternal.prototype._processRefExtractionFn = function (ref, extractionFns) {
        var attributeInfo = this.getAttributesInfo(ref.name);
        if (ref.type === 'BOOLEAN') {
            extractionFns.push({
                type: "lookup",
                lookup: {
                    type: "map",
                    map: {
                        "0": "false",
                        "1": "true",
                        "false": "false",
                        "true": "true"
                    }
                }
            });
            return;
        }
    };
    DruidExternal.prototype.actionToExtractionFn = function (action, fallbackAction, expressionType) {
        if (action.action === 'extract' || action.action === 'lookup') {
            var retainMissingValue = false;
            var replaceMissingValueWith = null;
            if (fallbackAction) {
                var fallbackExpression = fallbackAction.expression;
                if (fallbackExpression.isOp("ref")) {
                    retainMissingValue = true;
                }
                else if (fallbackExpression.isOp("literal")) {
                    replaceMissingValueWith = fallbackExpression.getLiteralValue();
                }
                else {
                    throw new Error("unsupported fallback expression: " + fallbackExpression);
                }
            }
            if (action instanceof ExtractAction) {
                if (this.versionBefore('0.9.0') && (retainMissingValue === false || replaceMissingValueWith !== null)) {
                    return this.actionToJavaScriptExtractionFn(action);
                }
                var regexExtractionFn = {
                    type: "regex",
                    expr: action.regexp
                };
                if (!retainMissingValue) {
                    regexExtractionFn.replaceMissingValue = true;
                }
                if (replaceMissingValueWith !== null) {
                    regexExtractionFn.replaceMissingValueWith = replaceMissingValueWith;
                }
                return regexExtractionFn;
            }
            if (action instanceof LookupAction) {
                var lookupExtractionFn = {
                    type: "registeredLookup",
                    lookup: action.lookup
                };
                if (this.versionBefore('0.9.1') || /-legacy-lookups/.test(this.version)) {
                    lookupExtractionFn = {
                        type: "lookup",
                        lookup: {
                            type: "namespace",
                            "namespace": action.lookup
                        }
                    };
                }
                if (retainMissingValue) {
                    lookupExtractionFn.retainMissingValue = true;
                }
                if (replaceMissingValueWith !== null) {
                    lookupExtractionFn.replaceMissingValueWith = replaceMissingValueWith;
                }
                return lookupExtractionFn;
            }
        }
        if (fallbackAction) {
            throw new Error("unsupported fallback after " + action.action + " action");
        }
        if (action.getOutputType(null) === 'BOOLEAN') {
            return this.actionToJavaScriptExtractionFn(action);
        }
        if (action instanceof SubstrAction) {
            if (this.versionBefore('0.9.0'))
                return this.actionToJavaScriptExtractionFn(action);
            return {
                type: "substring",
                index: action.position,
                length: action.length
            };
        }
        if (action instanceof TimeBucketAction || action instanceof TimeFloorAction) {
            return DruidExternal.timeFloorToExtraction(action.duration, action.getTimezone());
        }
        if (action instanceof TimePartAction) {
            return DruidExternal.timePartToExtraction(action.part, action.getTimezone());
        }
        if (action instanceof CustomTransformAction) {
            return this.customTransformToExtractionFn(action);
        }
        if (action instanceof TransformCaseAction) {
            var transformType = DruidExternal.caseToDruid[action.transformType];
            if (!transformType)
                throw new Error("unsupported case transformation '" + transformType + "'");
            return {
                type: transformType
            };
        }
        if (action instanceof NumberBucketAction) {
            return this.actionToJavaScriptExtractionFn(action);
        }
        if (action instanceof AbsoluteAction ||
            action instanceof PowerAction ||
            action instanceof LengthAction ||
            action instanceof CardinalityAction ||
            action instanceof CastAction ||
            action instanceof IndexOfAction) {
            return this.actionToJavaScriptExtractionFn(action, expressionType);
        }
        if (action instanceof FallbackAction && action.expression.isOp('literal')) {
            return {
                type: "lookup",
                retainMissingValue: true,
                lookup: {
                    type: "map",
                    map: {
                        "": action.getLiteralValue()
                    }
                }
            };
        }
        throw new Error("can not covert " + action + " to extractionFn");
    };
    DruidExternal.prototype._processConcatExtractionFn = function (pattern, extractionFns) {
        var _this = this;
        if (this.versionBefore('0.9.1')) {
            extractionFns.push({
                type: "javascript",
                'function': Expression.concat(pattern).getJSFn('d'),
                injective: true
            });
            return;
        }
        var format = pattern.map(function (ex) {
            if (ex instanceof LiteralExpression) {
                return ex.value.replace(/%/g, '\\%');
            }
            if (!ex.isOp('ref')) {
                _this._expressionToExtractionFns(ex, extractionFns);
            }
            return '%s';
        }).join('');
        extractionFns.push({
            type: 'stringFormat',
            format: format,
            nullHandling: 'returnNull'
        });
    };
    DruidExternal.prototype.customTransformToExtractionFn = function (action) {
        var custom = action.custom;
        var customExtractionFn = this.customTransforms[custom];
        if (!customExtractionFn)
            throw new Error("could not find extraction function: '" + custom + "'");
        var extractionFn = customExtractionFn.extractionFn;
        if (typeof extractionFn.type !== 'string')
            throw new Error("must have type in custom extraction fn '" + custom + "'");
        try {
            JSON.parse(JSON.stringify(customExtractionFn));
        }
        catch (e) {
            throw new Error("must have JSON extraction Fn '" + custom + "'");
        }
        return extractionFn;
    };
    DruidExternal.prototype.actionToJavaScriptExtractionFn = function (action, type) {
        return this.expressionToJavaScriptExtractionFn($('x', type).performAction(action));
    };
    DruidExternal.prototype.expressionToJavaScriptExtractionFn = function (ex) {
        return {
            type: "javascript",
            'function': ex.getJSFn('d')
        };
    };
    DruidExternal.prototype.expressionToDimensionInflater = function (expression, label) {
        var freeReferences = expression.getFreeReferences();
        if (freeReferences.length !== 1) {
            throw new Error("must have 1 reference (has " + freeReferences.length + "): " + expression);
        }
        var referenceName = freeReferences[0];
        var attributeInfo = this.getAttributesInfo(referenceName);
        if (attributeInfo.unsplitable) {
            throw new Error("can not convert " + expression + " to split because it references an un-splitable metric '" + referenceName + "' which is most likely rolled up.");
        }
        var extractionFn = this.expressionToExtractionFn(expression);
        var simpleInflater = External.getSimpleInflater(expression, label);
        var dimension = {
            type: "default",
            dimension: this.getDimensionNameForAttribureInfo(attributeInfo),
            outputName: label
        };
        if (extractionFn) {
            dimension.type = "extraction";
            dimension.extractionFn = extractionFn;
        }
        if (expression instanceof RefExpression) {
            return {
                dimension: dimension,
                inflater: simpleInflater
            };
        }
        if (expression instanceof ChainExpression) {
            var splitAction = expression.lastAction();
            if (splitAction instanceof TimeBucketAction) {
                return {
                    dimension: dimension,
                    inflater: External.timeRangeInflaterFactory(label, splitAction.duration, splitAction.getTimezone())
                };
            }
            if (splitAction instanceof TimePartAction) {
                return {
                    dimension: dimension,
                    inflater: simpleInflater
                };
            }
            if (splitAction instanceof NumberBucketAction) {
                return {
                    dimension: dimension,
                    inflater: External.numberRangeInflaterFactory(label, splitAction.size)
                };
            }
            if (splitAction instanceof CardinalityAction) {
                return {
                    dimension: dimension,
                    inflater: External.setCardinalityInflaterFactory(label)
                };
            }
        }
        var effectiveType = unwrapSetType(expression.type);
        if (simpleInflater || effectiveType === 'STRING') {
            return {
                dimension: dimension,
                inflater: simpleInflater
            };
        }
        throw new Error("could not convert " + expression + " to a Druid dimension");
    };
    DruidExternal.prototype.expressionToDimensionInflaterHaving = function (expression, label, havingFilter) {
        var dimensionInflater = this.expressionToDimensionInflater(expression, label);
        dimensionInflater.having = havingFilter;
        if (expression.type !== 'SET/STRING')
            return dimensionInflater;
        var _a = havingFilter.extractFromAnd(function (hf) {
            if (hf instanceof ChainExpression) {
                var hfExpression = hf.expression;
                var hfActions = hf.actions;
                if (hfExpression instanceof RefExpression && hfExpression.name === label && hfActions.length === 1) {
                    var hfAction = hfActions[0];
                    var hfActionName = hfAction.action;
                    if (hfActionName === 'match')
                        return true;
                    if (hfActionName === 'is' || hfActionName === 'in')
                        return hfAction.expression instanceof LiteralExpression;
                }
            }
            return false;
        }), extract = _a.extract, rest = _a.rest;
        if (extract.equals(Expression.TRUE))
            return dimensionInflater;
        var firstAction = extract.actions[0];
        if (firstAction instanceof MatchAction) {
            return {
                dimension: {
                    type: "regexFiltered",
                    delegate: dimensionInflater.dimension,
                    pattern: firstAction.regexp
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        else if (firstAction instanceof IsAction) {
            return {
                dimension: {
                    type: "listFiltered",
                    delegate: dimensionInflater.dimension,
                    values: [firstAction.expression.getLiteralValue()]
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        else if (firstAction instanceof InAction) {
            return {
                dimension: {
                    type: "listFiltered",
                    delegate: dimensionInflater.dimension,
                    values: firstAction.expression.getLiteralValue().elements
                },
                inflater: dimensionInflater.inflater,
                having: rest
            };
        }
        return dimensionInflater;
    };
    DruidExternal.prototype.splitToDruid = function (split) {
        var _this = this;
        var leftoverHavingFilter = this.havingFilter;
        if (split.isMultiSplit()) {
            var timestampLabel = null;
            var granularity = null;
            var dimensions = [];
            var inflaters = [];
            split.mapSplits(function (name, expression) {
                if (!granularity && !_this.limit && !_this.sort) {
                    var granularityInflater = _this.splitExpressionToGranularityInflater(expression, name);
                    if (granularityInflater) {
                        timestampLabel = name;
                        granularity = granularityInflater.granularity;
                        inflaters.push(granularityInflater.inflater);
                        return;
                    }
                }
                var _a = _this.expressionToDimensionInflaterHaving(expression, name, leftoverHavingFilter), dimension = _a.dimension, inflater = _a.inflater, having = _a.having;
                leftoverHavingFilter = having;
                dimensions.push(dimension);
                if (inflater) {
                    inflaters.push(inflater);
                }
            });
            return {
                queryType: 'groupBy',
                dimensions: dimensions,
                timestampLabel: timestampLabel,
                granularity: granularity || 'all',
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.groupByNormalizerFactory(timestampLabel), inflaters, null)
            };
        }
        var splitExpression = split.firstSplitExpression();
        var label = split.firstSplitName();
        var granularityInflater = this.splitExpressionToGranularityInflater(splitExpression, label);
        if (granularityInflater) {
            return {
                queryType: 'timeseries',
                granularity: granularityInflater.granularity,
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.timeseriesNormalizerFactory(label), [granularityInflater.inflater], null)
            };
        }
        var dimensionInflater = this.expressionToDimensionInflaterHaving(splitExpression, label, leftoverHavingFilter);
        leftoverHavingFilter = dimensionInflater.having;
        var inflaters = [dimensionInflater.inflater].filter(Boolean);
        if (leftoverHavingFilter.equals(Expression.TRUE) &&
            (this.limit || split.maxBucketNumber() < 1000) &&
            !this.exactResultsOnly) {
            return {
                queryType: 'topN',
                dimension: dimensionInflater.dimension,
                granularity: 'all',
                leftoverHavingFilter: leftoverHavingFilter,
                postProcess: DruidExternal.postProcessFactory(DruidExternal.topNNormalizer, inflaters, null)
            };
        }
        return {
            queryType: 'groupBy',
            dimensions: [dimensionInflater.dimension],
            granularity: 'all',
            leftoverHavingFilter: leftoverHavingFilter,
            postProcess: DruidExternal.postProcessFactory(DruidExternal.groupByNormalizerFactory(), inflaters, null)
        };
    };
    DruidExternal.prototype.getAccessTypeForAggregation = function (aggregationType) {
        if (aggregationType === 'hyperUnique' || aggregationType === 'cardinality')
            return 'hyperUniqueCardinality';
        var customAggregations = this.customAggregations;
        for (var customName in customAggregations) {
            if (!hasOwnProperty(customAggregations, customName))
                continue;
            var customAggregation = customAggregations[customName];
            if (customAggregation.aggregation.type === aggregationType) {
                return customAggregation.accessType || 'fieldAccess';
            }
        }
        return 'fieldAccess';
    };
    DruidExternal.prototype.getAccessType = function (aggregations, aggregationName) {
        for (var _i = 0, aggregations_1 = aggregations; _i < aggregations_1.length; _i++) {
            var aggregation = aggregations_1[_i];
            if (aggregation.name === aggregationName) {
                var aggregationType = aggregation.type;
                if (aggregationType === 'filtered')
                    aggregationType = aggregation.aggregator.type;
                return this.getAccessTypeForAggregation(aggregationType);
            }
        }
        return 'fieldAccess';
    };
    DruidExternal.prototype.expressionToPostAggregation = function (ex, aggregations, postAggregations) {
        var _this = this;
        if (ex instanceof RefExpression) {
            var refName = ex.name;
            return {
                type: this.getAccessType(aggregations, refName),
                fieldName: refName
            };
        }
        else if (ex instanceof LiteralExpression) {
            if (ex.type !== 'NUMBER')
                throw new Error("must be a NUMBER type");
            return {
                type: 'constant',
                value: ex.value
            };
        }
        else if (ex instanceof ChainExpression) {
            var lastAction = ex.lastAction();
            if (lastAction instanceof AbsoluteAction ||
                lastAction instanceof PowerAction ||
                lastAction instanceof FallbackAction ||
                lastAction instanceof CastAction ||
                lastAction instanceof IndexOfAction ||
                lastAction instanceof TransformCaseAction) {
                var fieldNameRefs = ex.getFreeReferences();
                var fieldNames = fieldNameRefs.map(function (fieldNameRef) {
                    var accessType = _this.getAccessType(aggregations, fieldNameRef);
                    if (accessType === 'fieldAccess')
                        return fieldNameRef;
                    var fieldNameRefTemp = '!F_' + fieldNameRef;
                    postAggregations.push({
                        name: fieldNameRefTemp,
                        type: accessType,
                        fieldName: fieldNameRef
                    });
                    return fieldNameRefTemp;
                });
                return {
                    type: 'javascript',
                    fieldNames: fieldNames,
                    'function': "function(" + fieldNameRefs.map(RefExpression.toJavaScriptSafeName) + ") { return " + ex.getJS(null) + "; }"
                };
            }
            var pattern;
            if (pattern = ex.getExpressionPattern('add')) {
                return {
                    type: 'arithmetic',
                    fn: '+',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('subtract')) {
                return {
                    type: 'arithmetic',
                    fn: '-',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('multiply')) {
                return {
                    type: 'arithmetic',
                    fn: '*',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            if (pattern = ex.getExpressionPattern('divide')) {
                return {
                    type: 'arithmetic',
                    fn: '/',
                    fields: pattern.map(function (e) { return _this.expressionToPostAggregation(e, aggregations, postAggregations); })
                };
            }
            throw new Error("can not convert chain to post agg: " + ex);
        }
        else {
            throw new Error("can not convert expression to post agg: " + ex);
        }
    };
    DruidExternal.prototype.applyToPostAggregation = function (action, aggregations, postAggregations) {
        var postAgg = this.expressionToPostAggregation(action.expression, aggregations, postAggregations);
        postAgg.name = action.name;
        postAggregations.push(postAgg);
    };
    DruidExternal.prototype.makeNativeAggregateFilter = function (filterExpression, aggregator) {
        return {
            type: "filtered",
            name: aggregator.name,
            filter: this.timelessFilterToDruid(filterExpression, true),
            aggregator: aggregator
        };
    };
    DruidExternal.prototype.makeStandardAggregation = function (name, aggregateAction) {
        var fn = aggregateAction.action;
        var aggregateExpression = aggregateAction.expression;
        var aggregation = {
            name: name,
            type: AGGREGATE_TO_DRUID[fn]
        };
        if (fn !== 'count') {
            if (aggregateExpression instanceof RefExpression) {
                var refName = aggregateExpression.name;
                var attributeInfo = this.getAttributesInfo(refName);
                if (attributeInfo.unsplitable) {
                    aggregation.fieldName = refName;
                }
                else {
                    return this.makeJavaScriptAggregation(name, aggregateAction);
                }
            }
            else {
                return this.makeJavaScriptAggregation(name, aggregateAction);
            }
        }
        return aggregation;
    };
    DruidExternal.prototype.makeCountDistinctAggregation = function (name, action, postAggregations) {
        if (this.exactResultsOnly) {
            throw new Error("approximate query not allowed");
        }
        var attribute = action.expression;
        if (attribute instanceof RefExpression) {
            var attributeName = attribute.name;
        }
        else {
            throw new Error("can not compute countDistinct on derived attribute: " + attribute);
        }
        var attributeInfo = this.getAttributesInfo(attributeName);
        if (attributeInfo instanceof UniqueAttributeInfo) {
            return {
                name: name,
                type: "hyperUnique",
                fieldName: attributeName
            };
        }
        else if (attributeInfo instanceof ThetaAttributeInfo) {
            var tempName = '!Theta_' + name;
            postAggregations.push({
                type: "thetaSketchEstimate",
                name: name,
                field: { type: 'fieldAccess', fieldName: tempName }
            });
            return {
                name: tempName,
                type: "thetaSketch",
                fieldName: attributeName
            };
        }
        else {
            return {
                name: name,
                type: "cardinality",
                fieldNames: [attributeName],
                byRow: true
            };
        }
    };
    DruidExternal.prototype.makeCustomAggregation = function (name, action) {
        var customAggregationName = action.custom;
        var customAggregation = this.customAggregations[customAggregationName];
        if (!customAggregation)
            throw new Error("could not find '" + customAggregationName + "'");
        var aggregationObj = customAggregation.aggregation;
        if (typeof aggregationObj.type !== 'string')
            throw new Error("must have type in custom aggregation '" + customAggregationName + "'");
        try {
            aggregationObj = JSON.parse(JSON.stringify(aggregationObj));
        }
        catch (e) {
            throw new Error("must have JSON custom aggregation '" + customAggregationName + "'");
        }
        aggregationObj.name = name;
        return aggregationObj;
    };
    DruidExternal.prototype.makeQuantileAggregation = function (name, action, postAggregations) {
        if (this.exactResultsOnly) {
            throw new Error("approximate query not allowed");
        }
        var attribute = action.expression;
        if (attribute instanceof RefExpression) {
            var attributeName = attribute.name;
        }
        else {
            throw new Error("can not compute countDistinct on derived attribute: " + attribute);
        }
        var histogramAggregationName = "!H_" + name;
        var aggregation = {
            name: histogramAggregationName,
            type: "approxHistogramFold",
            fieldName: attributeName
        };
        postAggregations.push({
            name: name,
            type: "quantile",
            fieldName: histogramAggregationName,
            probability: action.quantile
        });
        return aggregation;
    };
    DruidExternal.prototype.makeJavaScriptAggregation = function (name, aggregateAction) {
        var aggregateActionType = aggregateAction.action;
        var aggregateExpression = aggregateAction.expression;
        var aggregateFunction = AGGREGATE_TO_FUNCTION[aggregateActionType];
        if (!aggregateFunction)
            throw new Error("Can not convert " + aggregateActionType + " to JS");
        var zero = AGGREGATE_TO_ZERO[aggregateActionType];
        var fieldNames = aggregateExpression.getFreeReferences();
        var simpleFieldNames = fieldNames.map(RefExpression.toJavaScriptSafeName);
        return {
            name: name,
            type: "javascript",
            fieldNames: fieldNames,
            fnAggregate: "function($$," + simpleFieldNames.join(',') + ") { return " + aggregateFunction('$$', aggregateExpression.getJS(null)) + "; }",
            fnCombine: "function(a,b) { return " + aggregateFunction('a', 'b') + "; }",
            fnReset: "function() { return " + zero + "; }"
        };
    };
    DruidExternal.prototype.applyToAggregation = function (action, aggregations, postAggregations) {
        var applyExpression = action.expression;
        if (applyExpression.op !== 'chain')
            throw new Error("can not convert apply: " + applyExpression);
        var actions = applyExpression.actions;
        var filterExpression = null;
        var aggregateAction = null;
        if (actions.length === 1) {
            aggregateAction = actions[0];
        }
        else if (actions.length === 2) {
            var filterAction = actions[0];
            if (filterAction instanceof FilterAction) {
                filterExpression = filterAction.expression;
            }
            else {
                throw new Error("first action not a filter in: " + applyExpression);
            }
            aggregateAction = actions[1];
        }
        else {
            throw new Error("can not convert strange apply: " + applyExpression);
        }
        var aggregation;
        switch (aggregateAction.action) {
            case "count":
            case "sum":
            case "min":
            case "max":
                aggregation = this.makeStandardAggregation(action.name, aggregateAction);
                break;
            case "countDistinct":
                aggregation = this.makeCountDistinctAggregation(action.name, aggregateAction, postAggregations);
                break;
            case "quantile":
                aggregation = this.makeQuantileAggregation(action.name, aggregateAction, postAggregations);
                break;
            case "customAggregate":
                aggregation = this.makeCustomAggregation(action.name, aggregateAction);
                break;
            default:
                throw new Error("unsupported aggregate action " + aggregateAction.action);
        }
        if (filterExpression) {
            aggregation = this.makeNativeAggregateFilter(filterExpression, aggregation);
        }
        aggregations.push(aggregation);
    };
    DruidExternal.prototype.getAggregationsAndPostAggregations = function (applies) {
        var _this = this;
        var _a = External.segregationAggregateApplies(applies.map(function (apply) {
            var expression = apply.expression;
            expression = _this.switchToRollupCount(_this.inlineDerivedAttributesInAggregate(expression).decomposeAverage()).distribute();
            return apply.changeExpression(expression);
        })), aggregateApplies = _a.aggregateApplies, postAggregateApplies = _a.postAggregateApplies;
        var aggregations = [];
        var postAggregations = [];
        for (var _i = 0, aggregateApplies_1 = aggregateApplies; _i < aggregateApplies_1.length; _i++) {
            var aggregateApply = aggregateApplies_1[_i];
            this.applyToAggregation(aggregateApply, aggregations, postAggregations);
        }
        for (var _b = 0, postAggregateApplies_1 = postAggregateApplies; _b < postAggregateApplies_1.length; _b++) {
            var postAggregateApply = postAggregateApplies_1[_b];
            this.applyToPostAggregation(postAggregateApply, aggregations, postAggregations);
        }
        return {
            aggregations: aggregations,
            postAggregations: postAggregations
        };
    };
    DruidExternal.prototype.makeHavingComparison = function (agg, op, value) {
        switch (op) {
            case '<':
                return { type: "lessThan", aggregation: agg, value: value };
            case '>':
                return { type: "greaterThan", aggregation: agg, value: value };
            case '<=':
                return { type: 'not', havingSpec: { type: "greaterThan", aggregation: agg, value: value } };
            case '>=':
                return { type: 'not', havingSpec: { type: "lessThan", aggregation: agg, value: value } };
            default:
                throw new Error("unknown op: " + op);
        }
    };
    DruidExternal.prototype.inToHavingFilter = function (agg, range) {
        var havingSpecs = [];
        if (range.start !== null) {
            havingSpecs.push(this.makeHavingComparison(agg, (range.bounds[0] === '[' ? '>=' : '>'), range.start));
        }
        if (range.end !== null) {
            havingSpecs.push(this.makeHavingComparison(agg, (range.bounds[1] === ']' ? '<=' : '<'), range.end));
        }
        return havingSpecs.length === 1 ? havingSpecs[0] : { type: 'and', havingSpecs: havingSpecs };
    };
    DruidExternal.prototype.havingFilterToDruid = function (filter) {
        var _this = this;
        if (filter instanceof LiteralExpression) {
            if (filter.value === true) {
                return null;
            }
            else {
                throw new Error("should never get here");
            }
        }
        else if (filter instanceof ChainExpression) {
            var pattern;
            if (pattern = filter.getExpressionPattern('and')) {
                return {
                    type: 'and',
                    havingSpecs: pattern.map(this.havingFilterToDruid, this)
                };
            }
            if (pattern = filter.getExpressionPattern('or')) {
                return {
                    type: 'or',
                    havingSpecs: pattern.map(this.havingFilterToDruid, this)
                };
            }
            if (filter.lastAction() instanceof NotAction) {
                return this.havingFilterToDruid(filter.popAction());
            }
            var lhs = filter.expression;
            var actions = filter.actions;
            if (actions.length !== 1)
                throw new Error("can not convert " + filter + " to Druid interval");
            var filterAction = actions[0];
            var rhs = filterAction.expression;
            if (filterAction instanceof IsAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    return {
                        type: "equalTo",
                        aggregation: lhs.name,
                        value: rhs.value
                    };
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid having filter");
                }
            }
            else if (filterAction instanceof InAction) {
                if (lhs instanceof RefExpression && rhs instanceof LiteralExpression) {
                    var rhsType = rhs.type;
                    if (rhsType === 'SET/STRING') {
                        return {
                            type: "or",
                            havingSpecs: rhs.value.elements.map(function (value) {
                                return {
                                    type: "equalTo",
                                    aggregation: lhs.name,
                                    value: value
                                };
                            })
                        };
                    }
                    else if (rhsType === 'SET/NUMBER_RANGE') {
                        return {
                            type: "or",
                            havingSpecs: rhs.value.elements.map(function (value) {
                                return _this.inToHavingFilter(lhs.name, value);
                            }, this)
                        };
                    }
                    else if (rhsType === 'NUMBER_RANGE') {
                        return this.inToHavingFilter(lhs.name, rhs.value);
                    }
                    else if (rhsType === 'TIME_RANGE') {
                        throw new Error("can not compute having filter on time");
                    }
                    else {
                        throw new Error("not supported " + rhsType);
                    }
                }
                else {
                    throw new Error("can not convert " + filter + " to Druid having filter");
                }
            }
        }
        throw new Error("could not convert filter " + filter + " to Druid having filter");
    };
    DruidExternal.prototype.isMinMaxTimeApply = function (apply) {
        var applyExpression = apply.expression;
        if (applyExpression instanceof ChainExpression) {
            var actions = applyExpression.actions;
            if (actions.length !== 1)
                return false;
            var minMaxAction = actions[0];
            return (minMaxAction.action === "min" || minMaxAction.action === "max") &&
                this.isTimeRef(minMaxAction.expression);
        }
        else {
            return false;
        }
    };
    DruidExternal.prototype.getTimeBoundaryQueryAndPostProcess = function () {
        var _a = this, applies = _a.applies, context = _a.context;
        var druidQuery = {
            queryType: "timeBoundary",
            dataSource: this.getDruidDataSource()
        };
        if (context) {
            druidQuery.context = context;
        }
        if (applies.length === 1) {
            var loneApplyExpression = applies[0].expression;
            druidQuery.bound = loneApplyExpression.actions[0].action + "Time";
        }
        return {
            query: druidQuery,
            postProcess: DruidExternal.timeBoundaryPostProcessFactory(applies)
        };
    };
    DruidExternal.prototype.getQueryAndPostProcess = function () {
        var _this = this;
        var _a = this, mode = _a.mode, applies = _a.applies, sort = _a.sort, limit = _a.limit, context = _a.context;
        if (applies && applies.length && applies.every(this.isMinMaxTimeApply, this)) {
            return this.getTimeBoundaryQueryAndPostProcess();
        }
        var druidQuery = {
            queryType: 'timeseries',
            dataSource: this.getDruidDataSource(),
            intervals: null,
            granularity: 'all'
        };
        if (context) {
            druidQuery.context = shallowCopy(context);
        }
        var filterAndIntervals = this.filterToDruid(this.getQueryFilter());
        druidQuery.intervals = filterAndIntervals.intervals;
        if (filterAndIntervals.filter) {
            druidQuery.filter = filterAndIntervals.filter;
        }
        switch (mode) {
            case 'raw':
                if (!this.allowSelectQueries) {
                    throw new Error("to issues 'select' queries allowSelectQueries flag must be set");
                }
                var selectDimensions = [];
                var selectMetrics = [];
                var inflaters = [];
                var timeAttribute = this.timeAttribute;
                var derivedAttributes = this.derivedAttributes;
                var selectedTimeAttribute = null;
                var selectedAttributes = this.getSelectedAttributes();
                selectedAttributes.forEach(function (attribute) {
                    var name = attribute.name, type = attribute.type, unsplitable = attribute.unsplitable;
                    if (name === timeAttribute) {
                        selectedTimeAttribute = name;
                    }
                    else {
                        if (unsplitable) {
                            selectMetrics.push(name);
                        }
                        else {
                            var derivedAttribute = derivedAttributes[name];
                            if (derivedAttribute) {
                                if (_this.versionBefore('0.9.1')) {
                                    throw new Error("can not have derived attributes in Druid select in " + _this.version + ", upgrade to 0.9.1");
                                }
                                var dimensionInflater = _this.expressionToDimensionInflater(derivedAttribute, name);
                                selectDimensions.push(dimensionInflater.dimension);
                                if (dimensionInflater.inflater)
                                    inflaters.push(dimensionInflater.inflater);
                                return;
                            }
                            else {
                                selectDimensions.push(name);
                            }
                        }
                    }
                    switch (type) {
                        case 'BOOLEAN':
                            inflaters.push(External.booleanInflaterFactory(name));
                            break;
                        case 'NUMBER':
                            inflaters.push(External.numberInflaterFactory(name));
                            break;
                        case 'TIME':
                            inflaters.push(External.timeInflaterFactory(name));
                            break;
                        case 'SET/STRING':
                            inflaters.push(External.setStringInflaterFactory(name));
                            break;
                    }
                });
                if (!selectDimensions.length)
                    selectDimensions.push(DUMMY_NAME);
                if (!selectMetrics.length)
                    selectMetrics.push(DUMMY_NAME);
                var resultLimit = limit ? limit.limit : Infinity;
                druidQuery.queryType = 'select';
                druidQuery.dimensions = selectDimensions;
                druidQuery.metrics = selectMetrics;
                druidQuery.pagingSpec = {
                    "pagingIdentifiers": {},
                    "threshold": Math.min(resultLimit, DruidExternal.SELECT_INIT_LIMIT)
                };
                var descending = sort && sort.direction === 'descending';
                if (descending) {
                    druidQuery.descending = true;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.postProcessFactory(DruidExternal.selectNormalizerFactory(selectedTimeAttribute), inflaters, selectedAttributes),
                    next: DruidExternal.selectNextFactory(resultLimit, descending)
                };
            case 'value':
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations([this.toValueApply()]);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.valuePostProcess
                };
            case 'total':
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations(this.applies);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                return {
                    query: druidQuery,
                    postProcess: DruidExternal.totalPostProcessFactory(applies)
                };
            case 'split':
                var split = this.getQuerySplit();
                var splitSpec = this.splitToDruid(split);
                druidQuery.queryType = splitSpec.queryType;
                druidQuery.granularity = splitSpec.granularity;
                if (splitSpec.dimension)
                    druidQuery.dimension = splitSpec.dimension;
                if (splitSpec.dimensions)
                    druidQuery.dimensions = splitSpec.dimensions;
                var leftoverHavingFilter = splitSpec.leftoverHavingFilter;
                var postProcess = splitSpec.postProcess;
                var aggregationsAndPostAggregations = this.getAggregationsAndPostAggregations(applies);
                if (aggregationsAndPostAggregations.aggregations.length) {
                    druidQuery.aggregations = aggregationsAndPostAggregations.aggregations;
                }
                else {
                    druidQuery.aggregations = [{ name: DUMMY_NAME, type: "count" }];
                }
                if (aggregationsAndPostAggregations.postAggregations.length) {
                    druidQuery.postAggregations = aggregationsAndPostAggregations.postAggregations;
                }
                switch (druidQuery.queryType) {
                    case 'timeseries':
                        if (sort && (sort.direction !== 'ascending' || !split.hasKey(sort.refName()))) {
                            throw new Error('can not sort within timeseries query');
                        }
                        if (limit) {
                            throw new Error('can not limit within timeseries query');
                        }
                        if (!druidQuery.context || !hasOwnProperty(druidQuery.context, 'skipEmptyBuckets')) {
                            druidQuery.context = druidQuery.context || {};
                            druidQuery.context.skipEmptyBuckets = "true";
                        }
                        break;
                    case 'topN':
                        var metric;
                        if (sort) {
                            var inverted;
                            if (this.sortOnLabel()) {
                                if (expressionNeedsAlphaNumericSort(split.firstSplitExpression())) {
                                    metric = { type: 'alphaNumeric' };
                                }
                                else {
                                    metric = { type: 'lexicographic' };
                                }
                                inverted = sort.direction === 'descending';
                            }
                            else {
                                metric = sort.refName();
                                inverted = sort.direction === 'ascending';
                            }
                            if (inverted) {
                                metric = { type: "inverted", metric: metric };
                            }
                        }
                        else {
                            metric = { type: 'lexicographic' };
                        }
                        druidQuery.metric = metric;
                        druidQuery.threshold = limit ? limit.limit : 1000;
                        break;
                    case 'groupBy':
                        var orderByColumn = null;
                        if (sort) {
                            var col = sort.refName();
                            orderByColumn = {
                                dimension: col,
                                direction: sort.direction
                            };
                            if (this.sortOnLabel()) {
                                if (expressionNeedsAlphaNumericSort(split.splits[col])) {
                                    orderByColumn.dimensionOrder = 'alphanumeric';
                                }
                            }
                        }
                        else {
                            var timestampLabel = splitSpec.timestampLabel;
                            var splitKeys = split.keys.filter(function (k) { return k !== timestampLabel; });
                            if (!splitKeys.length)
                                throw new Error('could not find order by column for group by');
                            var splitKey = splitKeys[0];
                            var keyExpression = split.splits[splitKey];
                            orderByColumn = {
                                dimension: splitKey
                            };
                            if (expressionNeedsAlphaNumericSort(keyExpression)) {
                                orderByColumn.dimensionOrder = 'alphanumeric';
                            }
                        }
                        druidQuery.limitSpec = {
                            type: "default",
                            columns: [orderByColumn || split.firstSplitName()]
                        };
                        if (limit) {
                            druidQuery.limitSpec.limit = limit.limit;
                        }
                        if (!leftoverHavingFilter.equals(Expression.TRUE)) {
                            druidQuery.having = this.havingFilterToDruid(leftoverHavingFilter);
                        }
                        break;
                }
                return {
                    query: druidQuery,
                    postProcess: postProcess
                };
            default:
                throw new Error("can not get query for: " + this.mode);
        }
    };
    DruidExternal.prototype.getIntrospectAttributesWithSegmentMetadata = function () {
        var _a = this, requester = _a.requester, timeAttribute = _a.timeAttribute, context = _a.context;
        var query = {
            queryType: 'segmentMetadata',
            dataSource: this.getDruidDataSource(),
            merge: true,
            analysisTypes: ['aggregators'],
            lenientAggregatorMerge: true
        };
        if (context) {
            query.context = context;
        }
        if (this.versionBefore('0.9.0')) {
            query.analysisTypes = [];
            delete query.lenientAggregatorMerge;
        }
        if (this.versionBefore('0.9.2') && query.dataSource.type === 'union') {
            query.dataSource = query.dataSource.dataSources[0];
        }
        return requester({ query: query }).then(DruidExternal.segmentMetadataPostProcessFactory(timeAttribute));
    };
    DruidExternal.prototype.getIntrospectAttributesWithGet = function () {
        var _a = this, requester = _a.requester, timeAttribute = _a.timeAttribute;
        return requester({
            query: {
                queryType: 'introspect',
                dataSource: this.getDruidDataSource()
            }
        })
            .then(DruidExternal.introspectPostProcessFactory(timeAttribute));
    };
    DruidExternal.prototype.getIntrospectAttributes = function () {
        var _this = this;
        switch (this.introspectionStrategy) {
            case 'segment-metadata-fallback':
                return this.getIntrospectAttributesWithSegmentMetadata()
                    .catch(function (err) {
                    if (err.message.indexOf("querySegmentSpec can't be null") === -1)
                        throw err;
                    return _this.getIntrospectAttributesWithGet();
                });
            case 'segment-metadata-only':
                return this.getIntrospectAttributesWithSegmentMetadata();
            case 'datasource-get':
                return this.getIntrospectAttributesWithGet();
            default:
                throw new Error('invalid introspectionStrategy');
        }
    };
    DruidExternal.type = 'DATASET';
    DruidExternal.TRUE_INTERVAL = "1000/3000";
    DruidExternal.FALSE_INTERVAL = "1000/1001";
    DruidExternal.VALID_INTROSPECTION_STRATEGIES = ['segment-metadata-fallback', 'segment-metadata-only', 'datasource-get'];
    DruidExternal.DEFAULT_INTROSPECTION_STRATEGY = 'segment-metadata-fallback';
    DruidExternal.SELECT_INIT_LIMIT = 50;
    DruidExternal.SELECT_MAX_LIMIT = 10000;
    DruidExternal.TIME_PART_TO_FORMAT = {
        SECOND_OF_MINUTE: "s",
        MINUTE_OF_HOUR: "m",
        HOUR_OF_DAY: "H",
        DAY_OF_WEEK: "e",
        DAY_OF_MONTH: "d",
        DAY_OF_YEAR: "D",
        WEEK_OF_YEAR: "w",
        MONTH_OF_YEAR: "M",
        YEAR: "Y"
    };
    DruidExternal.TIME_PART_TO_EXPR = {
        SECOND_OF_MINUTE: "d.getSecondOfMinute()",
        SECOND_OF_HOUR: "d.getSecondOfHour()",
        SECOND_OF_DAY: "d.getSecondOfDay()",
        SECOND_OF_WEEK: "d.getDayOfWeek()*86400 + d.getSecondOfMinute()",
        SECOND_OF_MONTH: "d.getDayOfMonth()*86400 + d.getSecondOfHour()",
        SECOND_OF_YEAR: "d.getDayOfYear()*86400 + d.getSecondOfDay()",
        MINUTE_OF_HOUR: "d.getMinuteOfHour()",
        MINUTE_OF_DAY: "d.getMinuteOfDay()",
        MINUTE_OF_WEEK: "d.getDayOfWeek()*1440 + d.getMinuteOfDay()",
        MINUTE_OF_MONTH: "d.getDayOfMonth()*1440 + d.getMinuteOfDay()",
        MINUTE_OF_YEAR: "d.getDayOfYear()*1440 + d.getMinuteOfDay()",
        HOUR_OF_DAY: "d.getHourOfDay()",
        HOUR_OF_WEEK: "d.getDayOfWeek()*24 + d.getHourOfDay()",
        HOUR_OF_MONTH: "d.getDayOfMonth()*24 + d.getHourOfDay()",
        HOUR_OF_YEAR: "d.getDayOfYear()*24 + d.getHourOfDay()",
        DAY_OF_WEEK: "d.getDayOfWeek()",
        DAY_OF_MONTH: "d.getDayOfMonth()",
        DAY_OF_YEAR: "d.getDayOfYear()",
        WEEK_OF_YEAR: "d.getWeekOfWeekyear()",
        MONTH_OF_YEAR: "d.getMonthOfYear()",
        YEAR: "d.getYearOfEra()"
    };
    DruidExternal.SPAN_TO_FLOOR_FORMAT = {
        second: "yyyy-MM-dd'T'HH:mm:ss'Z",
        minute: "yyyy-MM-dd'T'HH:mm'Z",
        hour: "yyyy-MM-dd'T'HH':00Z",
        day: "yyyy-MM-dd'Z",
        month: "yyyy-MM'-01Z",
        year: "yyyy'-01-01Z"
    };
    DruidExternal.SPAN_TO_PROPERTY = {
        second: 'secondOfMinute',
        minute: 'minuteOfHour',
        hour: 'hourOfDay',
        day: 'dayOfMonth',
        week: 'weekOfWeekyear',
        month: 'monthOfYear',
        year: 'yearOfEra'
    };
    DruidExternal.caseToDruid = {
        upperCase: 'upper',
        lowerCase: 'lower'
    };
    return DruidExternal;
}(External));
External.register(DruidExternal);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};





function correctResult(result) {
    return Array.isArray(result) && (result.length === 0 || typeof result[0] === 'object');
}
function getSplitInflaters(split) {
    return split.mapSplits(function (label, splitExpression) {
        var simpleInflater = External.getSimpleInflater(splitExpression, label);
        if (simpleInflater)
            return simpleInflater;
        if (splitExpression instanceof ChainExpression) {
            var lastAction = splitExpression.lastAction();
            if (lastAction instanceof TimeBucketAction) {
                return External.timeRangeInflaterFactory(label, lastAction.duration, lastAction.getTimezone());
            }
            if (lastAction instanceof NumberBucketAction) {
                return External.numberRangeInflaterFactory(label, lastAction.size);
            }
        }
        return undefined;
    });
}
function valuePostProcess(data) {
    if (!correctResult(data)) {
        var err = new Error("unexpected result (value)");
        err.result = data;
        throw err;
    }
    return data.length ? data[0][External.VALUE_NAME] : 0;
}
function postProcessFactory(inflaters, zeroTotalApplies) {
    return function (data) {
        if (!correctResult(data)) {
            var err = new Error("unexpected result");
            err.result = data;
            throw err;
        }
        var n = data.length;
        for (var _i = 0, inflaters_1 = inflaters; _i < inflaters_1.length; _i++) {
            var inflater = inflaters_1[_i];
            for (var i = 0; i < n; i++) {
                inflater(data[i], i, data);
            }
        }
        if (n === 0 && zeroTotalApplies) {
            data = [External.makeZeroDatum(zeroTotalApplies)];
        }
        return new Dataset({ data: data });
    };
}
var SQLExternal = exports.SQLExternal = (function (_super) {
    __extends(SQLExternal, _super);
    function SQLExternal(parameters, dialect) {
        _super.call(this, parameters, dummyObject);
        this.dialect = dialect;
    }
    SQLExternal.prototype.canHandleFilter = function (ex) {
        return true;
    };
    SQLExternal.prototype.canHandleTotal = function () {
        return true;
    };
    SQLExternal.prototype.canHandleSplit = function (ex) {
        return true;
    };
    SQLExternal.prototype.canHandleApply = function (ex) {
        return true;
    };
    SQLExternal.prototype.canHandleSort = function (sortAction) {
        return true;
    };
    SQLExternal.prototype.canHandleLimit = function (limitAction) {
        return true;
    };
    SQLExternal.prototype.canHandleHavingFilter = function (ex) {
        return true;
    };
    SQLExternal.prototype.getQueryAndPostProcess = function () {
        var _a = this, source = _a.source, mode = _a.mode, applies = _a.applies, sort = _a.sort, limit = _a.limit, derivedAttributes = _a.derivedAttributes, dialect = _a.dialect;
        var query = ['SELECT'];
        var postProcess = null;
        var inflaters = [];
        var zeroTotalApplies = null;
        var from = "FROM " + this.dialect.escapeName(source);
        var filter = this.getQueryFilter();
        if (!filter.equals(Expression.TRUE)) {
            from += '\nWHERE ' + filter.getSQL(dialect);
        }
        switch (mode) {
            case 'raw':
                var selectedAttributes = this.getSelectedAttributes();
                selectedAttributes.forEach(function (attribute) {
                    var name = attribute.name, type = attribute.type;
                    switch (type) {
                        case 'BOOLEAN':
                            inflaters.push(External.booleanInflaterFactory(name));
                            break;
                        case 'SET/STRING':
                            inflaters.push(External.setStringInflaterFactory(name));
                            break;
                    }
                });
                query.push(selectedAttributes.map(function (a) {
                    var name = a.name;
                    if (derivedAttributes[name]) {
                        return new ApplyAction({ name: name, expression: derivedAttributes[name] }).getSQL(null, '', dialect);
                    }
                    else {
                        return dialect.escapeName(name);
                    }
                }).join(', '), from);
                if (sort) {
                    query.push(sort.getSQL(null, '', dialect));
                }
                if (limit) {
                    query.push(limit.getSQL(null, '', dialect));
                }
                break;
            case 'value':
                query.push(this.toValueApply().getSQL(null, '', dialect), from, dialect.constantGroupBy());
                postProcess = valuePostProcess;
                break;
            case 'total':
                zeroTotalApplies = applies;
                query.push(applies.map(function (apply) { return apply.getSQL(null, '', dialect); }).join(',\n'), from, dialect.constantGroupBy());
                break;
            case 'split':
                var split = this.getQuerySplit();
                query.push(split.getSelectSQL(dialect)
                    .concat(applies.map(function (apply) { return apply.getSQL(null, '', dialect); }))
                    .join(',\n'), from, split.getShortGroupBySQL());
                if (!(this.havingFilter.equals(Expression.TRUE))) {
                    query.push('HAVING ' + this.havingFilter.getSQL(dialect));
                }
                if (sort) {
                    query.push(sort.getSQL(null, '', dialect));
                }
                if (limit) {
                    query.push(limit.getSQL(null, '', dialect));
                }
                inflaters = getSplitInflaters(split);
                break;
            default:
                throw new Error("can not get query for mode: " + mode);
        }
        return {
            query: query.join('\n'),
            postProcess: postProcess || postProcessFactory(inflaters, zeroTotalApplies)
        };
    };
    SQLExternal.type = 'DATASET';
    return SQLExternal;
}(External));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var MySQLExternal = exports.MySQLExternal = (function (_super) {
    __extends(MySQLExternal, _super);
    function MySQLExternal(parameters) {
        _super.call(this, parameters, new MySQLDialect());
        this._ensureEngine("mysql");
    }
    MySQLExternal.fromJS = function (parameters, requester) {
        var value = External.jsToValue(parameters, requester);
        return new MySQLExternal(value);
    };
    MySQLExternal.postProcessIntrospect = function (columns) {
        return columns.map(function (column) {
            var name = column.Field;
            var sqlType = column.Type.toLowerCase();
            if (sqlType === "datetime" || sqlType === "timestamp") {
                return new AttributeInfo({ name: name, type: 'TIME' });
            }
            else if (sqlType.indexOf("varchar(") === 0 || sqlType.indexOf("blob") === 0) {
                return new AttributeInfo({ name: name, type: 'STRING' });
            }
            else if (sqlType.indexOf("int(") === 0 || sqlType.indexOf("bigint(") === 0) {
                return new AttributeInfo({ name: name, type: 'NUMBER' });
            }
            else if (sqlType.indexOf("decimal(") === 0 || sqlType.indexOf("float") === 0 || sqlType.indexOf("double") === 0) {
                return new AttributeInfo({ name: name, type: 'NUMBER' });
            }
            else if (sqlType.indexOf("tinyint(1)") === 0) {
                return new AttributeInfo({ name: name, type: 'BOOLEAN' });
            }
            return null;
        }).filter(Boolean);
    };
    MySQLExternal.getSourceList = function (requester) {
        return requester({ query: "SHOW TABLES" })
            .then(function (sources) {
            if (!Array.isArray(sources))
                throw new Error('invalid sources response');
            if (!sources.length)
                return sources;
            var key = Object.keys(sources[0])[0];
            if (!key)
                throw new Error('invalid sources response (no key)');
            return sources.map(function (s) { return s[key]; }).sort();
        });
    };
    MySQLExternal.getVersion = function (requester) {
        return requester({ query: 'SELECT @@version' })
            .then(function (res) {
            if (!Array.isArray(res) || res.length !== 1)
                throw new Error('invalid version response');
            var key = Object.keys(res[0])[0];
            if (!key)
                throw new Error('invalid version response (no key)');
            return res[0][key];
        });
    };
    MySQLExternal.prototype.getIntrospectAttributes = function () {
        return this.requester({ query: "DESCRIBE " + this.dialect.escapeName(this.source) }).then(MySQLExternal.postProcessIntrospect);
    };
    MySQLExternal.type = 'DATASET';
    return MySQLExternal;
}(SQLExternal));
External.register(MySQLExternal, 'mysql');
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var PostgresExternal = exports.PostgresExternal = (function (_super) {
    __extends(PostgresExternal, _super);
    function PostgresExternal(parameters) {
        _super.call(this, parameters, new PostgresDialect());
        this._ensureEngine("postgres");
    }
    PostgresExternal.fromJS = function (parameters, requester) {
        var value = External.jsToValue(parameters, requester);
        return new PostgresExternal(value);
    };
    PostgresExternal.postProcessIntrospect = function (columns) {
        return columns.map(function (column) {
            var name = column.name;
            var sqlType = column.sqlType.toLowerCase();
            if (sqlType.indexOf('timestamp') !== -1) {
                return new AttributeInfo({ name: name, type: 'TIME' });
            }
            else if (sqlType === 'character varying') {
                return new AttributeInfo({ name: name, type: 'STRING' });
            }
            else if (sqlType === 'integer' || sqlType === 'bigint') {
                return new AttributeInfo({ name: name, type: 'NUMBER' });
            }
            else if (sqlType === 'double precision' || sqlType === 'float') {
                return new AttributeInfo({ name: name, type: 'NUMBER' });
            }
            else if (sqlType === 'boolean') {
                return new AttributeInfo({ name: name, type: 'BOOLEAN' });
            }
            else if (sqlType === 'array') {
                var arrayType = column.arrayType.toLowerCase();
                if (arrayType === 'character') {
                    return new AttributeInfo({ name: name, type: 'SET/STRING' });
                }
                else if (arrayType === 'timestamp') {
                    return new AttributeInfo({ name: name, type: 'SET/TIME' });
                }
                else if (arrayType === 'integer' || arrayType === 'bigint' || sqlType === 'double precision' || sqlType === 'float') {
                    return new AttributeInfo({ name: name, type: 'SET/NUMBER' });
                }
                else if (arrayType === 'boolean') {
                    return new AttributeInfo({ name: name, type: 'SET/BOOLEAN' });
                }
                return null;
            }
            return null;
        }).filter(Boolean);
    };
    PostgresExternal.getSourceList = function (requester) {
        return requester({
            query: "SELECT table_name AS \"tab\" FROM INFORMATION_SCHEMA.TABLES WHERE table_type = 'BASE TABLE' AND table_schema = 'public'"
        })
            .then(function (sources) {
            if (!Array.isArray(sources))
                throw new Error('invalid sources response');
            if (!sources.length)
                return sources;
            return sources.map(function (s) { return s['tab']; }).sort();
        });
    };
    PostgresExternal.getVersion = function (requester) {
        return requester({ query: 'SELECT version()' })
            .then(function (res) {
            if (!Array.isArray(res) || res.length !== 1)
                throw new Error('invalid version response');
            var key = Object.keys(res[0])[0];
            if (!key)
                throw new Error('invalid version response (no key)');
            var versionString = res[0][key];
            var match;
            if (match = versionString.match(/^PostgreSQL (\S+) on/))
                versionString = match[1];
            return versionString;
        });
    };
    PostgresExternal.prototype.getIntrospectAttributes = function () {
        return this.requester({
            query: "SELECT c.column_name as \"name\", c.data_type as \"sqlType\", e.data_type AS \"arrayType\"\n       FROM information_schema.columns c LEFT JOIN information_schema.element_types e\n       ON ((c.table_catalog, c.table_schema, c.table_name, 'TABLE', c.dtd_identifier)\n       = (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier))\n       WHERE table_name = " + this.dialect.escapeLiteral(this.source)
        }).then(PostgresExternal.postProcessIntrospect);
    };
    PostgresExternal.type = 'DATASET';
    return PostgresExternal;
}(SQLExternal));
External.register(PostgresExternal, 'postgres');












function getDataName(ex) {
    if (ex instanceof RefExpression) {
        return ex.name;
    }
    else if (ex instanceof ChainExpression) {
        return getDataName(ex.expression);
    }
    else {
        return null;
    }
}
function getValue(param) {
    if (param instanceof LiteralExpression)
        return param.value;
    return param;
}
function getString(param) {
    if (typeof param === 'string')
        return param;
    if (param instanceof LiteralExpression && param.type === 'STRING') {
        return param.value;
    }
    if (param instanceof RefExpression && param.nest === 0) {
        return param.name;
    }
    throw new Error('could not extract a string out of ' + String(param));
}
function getNumber(param) {
    if (typeof param === 'number')
        return param;
    if (param instanceof LiteralExpression && param.type === 'NUMBER') {
        return param.value;
    }
    throw new Error('could not extract a number out of ' + String(param));
}
var ply = exports.ply = function(dataset) {
    if (!dataset)
        dataset = new Dataset({ data: [{}] });
    return r(dataset);
}
var $ = exports.$ = function(name, nest, type) {
    if (typeof name !== 'string')
        throw new TypeError('$() argument must be a string');
    if (typeof nest === 'string') {
        type = nest;
        nest = 0;
    }
    return new RefExpression({
        name: name,
        nest: nest != null ? nest : 0,
        type: type
    });
}
var i$ = exports.i$ = function(name, nest, type) {
    if (typeof name !== 'string')
        throw new TypeError('$() argument must be a string');
    if (typeof nest === 'string') {
        type = nest;
        nest = 0;
    }
    return new RefExpression({
        name: name,
        nest: nest != null ? nest : 0,
        type: type,
        ignoreCase: true
    });
}
var r = exports.r = function(value) {
    if (External.isExternal(value))
        throw new TypeError('r can not accept externals');
    if (Array.isArray(value))
        value = Set.fromJS(value);
    return LiteralExpression.fromJS({ op: 'literal', value: value });
}
var toJS = exports.toJS = function(thing) {
    return (thing && typeof thing.toJS === 'function') ? thing.toJS() : thing;
}
function chainVia(op, expressions, zero) {
    var n = expressions.length;
    if (!n)
        return zero;
    var acc = expressions[0];
    if (!Expression.isExpression(acc))
        acc = Expression.fromJSLoose(acc);
    for (var i = 1; i < n; i++)
        acc = acc[op](expressions[i]);
    return acc;
}
var Expression = exports.Expression = (function () {
    function Expression(parameters, dummy) {
        if (dummy === void 0) { dummy = null; }
        this.op = parameters.op;
        if (dummy !== dummyObject) {
            throw new TypeError("can not call `new Expression` directly use Expression.fromJS instead");
        }
        if (parameters.simple)
            this.simple = true;
    }
    Expression.isExpression = function (candidate) {
        return isInstanceOf(candidate, Expression);
    };
    Expression.expressionLookupFromJS = function (expressionJSs) {
        var expressions = Object.create(null);
        for (var name in expressionJSs) {
            if (!hasOwnProperty(expressionJSs, name))
                continue;
            expressions[name] = Expression.fromJSLoose(expressionJSs[name]);
        }
        return expressions;
    };
    Expression.expressionLookupToJS = function (expressions) {
        var expressionsJSs = {};
        for (var name in expressions) {
            if (!hasOwnProperty(expressions, name))
                continue;
            expressionsJSs[name] = expressions[name].toJS();
        }
        return expressionsJSs;
    };
    Expression.parse = function (str, timezone) {
        if (str[0] === '{' && str[str.length - 1] === '}') {
            return Expression.fromJS(JSON.parse(str));
        }
        var original = Expression.defaultParserTimezone;
        if (timezone)
            Expression.defaultParserTimezone = timezone;
        try {
            return Expression.expressionParser.parse(str);
        }
        catch (e) {
            throw new Error("Expression parse error: " + e.message + " on '" + str + "'");
        }
        finally {
            Expression.defaultParserTimezone = original;
        }
    };
    Expression.parseSQL = function (str, timezone) {
        var original = Expression.defaultParserTimezone;
        if (timezone)
            Expression.defaultParserTimezone = timezone;
        try {
            return Expression.plyqlParser.parse(str);
        }
        catch (e) {
            throw new Error("SQL parse error: " + e.message + " on '" + str + "'");
        }
        finally {
            Expression.defaultParserTimezone = original;
        }
    };
    Expression.fromJSLoose = function (param) {
        var expressionJS;
        switch (typeof param) {
            case 'undefined':
                throw new Error('must have an expression');
            case 'object':
                if (param === null) {
                    return Expression.NULL;
                }
                else if (Expression.isExpression(param)) {
                    return param;
                }
                else if (isImmutableClass(param)) {
                    if (param.constructor.type) {
                        expressionJS = { op: 'literal', value: param };
                    }
                    else {
                        throw new Error("unknown object");
                    }
                }
                else if (param.op) {
                    expressionJS = param;
                }
                else if (param.toISOString) {
                    expressionJS = { op: 'literal', value: new Date(param) };
                }
                else if (Array.isArray(param)) {
                    expressionJS = { op: 'literal', value: Set.fromJS(param) };
                }
                else if (hasOwnProperty(param, 'start') && hasOwnProperty(param, 'end')) {
                    expressionJS = { op: 'literal', value: Range.fromJS(param) };
                }
                else {
                    throw new Error('unknown parameter');
                }
                break;
            case 'number':
            case 'boolean':
                expressionJS = { op: 'literal', value: param };
                break;
            case 'string':
                return Expression.parse(param);
            default:
                throw new Error("unrecognizable expression");
        }
        return Expression.fromJS(expressionJS);
    };
    Expression.inOrIs = function (lhs, value) {
        var literal = new LiteralExpression({
            op: 'literal',
            value: value
        });
        var literalType = literal.type;
        var returnExpression = null;
        if (literalType === 'NUMBER_RANGE' || literalType === 'TIME_RANGE' || literalType === 'STRING_RANGE' || isSetType(literalType)) {
            returnExpression = lhs.in(literal);
        }
        else {
            returnExpression = lhs.is(literal);
        }
        return returnExpression.simplify();
    };
    Expression.jsNullSafetyUnary = function (inputJS, ifNotNull) {
        return "(_=" + inputJS + ",(_==null?null:" + ifNotNull('_') + "))";
    };
    Expression.jsNullSafetyBinary = function (lhs, rhs, combine, lhsCantBeNull, rhsCantBeNull) {
        if (lhsCantBeNull) {
            if (rhsCantBeNull) {
                return "(" + combine(lhs, rhs) + ")";
            }
            else {
                return "(_=" + rhs + ",(_==null)?null:(" + combine(lhs, '_') + "))";
            }
        }
        else {
            if (rhsCantBeNull) {
                return "(_=" + lhs + ",(_==null)?null:(" + combine('_', rhs) + "))";
            }
            else {
                return "(_=" + rhs + ",_2=" + lhs + ",(_==null||_2==null)?null:(" + combine('_', '_2') + ")";
            }
        }
    };
    Expression.and = function (expressions) {
        return chainVia('and', expressions, Expression.TRUE);
    };
    Expression.or = function (expressions) {
        return chainVia('or', expressions, Expression.FALSE);
    };
    Expression.add = function (expressions) {
        return chainVia('add', expressions, Expression.ZERO);
    };
    Expression.subtract = function (expressions) {
        return chainVia('subtract', expressions, Expression.ZERO);
    };
    Expression.multiply = function (expressions) {
        return chainVia('multiply', expressions, Expression.ONE);
    };
    Expression.power = function (expressions) {
        return chainVia('power', expressions, Expression.ZERO);
    };
    Expression.concat = function (expressions) {
        return chainVia('concat', expressions, Expression.EMPTY_STRING);
    };
    Expression.register = function (ex) {
        var op = ex.name.replace('Expression', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        Expression.classMap[op] = ex;
    };
    Expression.fromJS = function (expressionJS) {
        if (!hasOwnProperty(expressionJS, "op")) {
            throw new Error("op must be defined");
        }
        var op = expressionJS.op;
        if (typeof op !== "string") {
            throw new Error("op must be a string");
        }
        var ClassFn = Expression.classMap[op];
        if (!ClassFn) {
            throw new Error("unsupported expression op '" + op + "'");
        }
        return ClassFn.fromJS(expressionJS);
    };
    Expression.prototype._ensureOp = function (op) {
        if (!this.op) {
            this.op = op;
            return;
        }
        if (this.op !== op) {
            throw new TypeError("incorrect expression op '" + this.op + "' (needs to be: '" + op + "')");
        }
    };
    Expression.prototype.valueOf = function () {
        var value = { op: this.op };
        if (this.simple)
            value.simple = true;
        return value;
    };
    Expression.prototype.toJS = function () {
        return {
            op: this.op
        };
    };
    Expression.prototype.toJSON = function () {
        return this.toJS();
    };
    Expression.prototype.toString = function (indent) {
        return 'BaseExpression';
    };
    Expression.prototype.equals = function (other) {
        return Expression.isExpression(other) &&
            this.op === other.op &&
            this.type === other.type;
    };
    Expression.prototype.canHaveType = function (wantedType) {
        var type = this.type;
        if (!type)
            return true;
        if (wantedType === 'SET') {
            return isSetType(type);
        }
        else {
            return type === wantedType;
        }
    };
    Expression.prototype.expressionCount = function () {
        return 1;
    };
    Expression.prototype.isOp = function (op) {
        return this.op === op;
    };
    Expression.prototype.containsOp = function (op) {
        return this.some(function (ex) { return ex.isOp(op) || null; });
    };
    Expression.prototype.hasExternal = function () {
        return this.some(function (ex) {
            if (ex instanceof ExternalExpression)
                return true;
            if (ex instanceof RefExpression)
                return ex.isRemote();
            return null;
        });
    };
    Expression.prototype.getBaseExternals = function () {
        var externals = [];
        this.forEach(function (ex) {
            if (ex instanceof ExternalExpression)
                externals.push(ex.external.getBase());
        });
        return External.deduplicateExternals(externals);
    };
    Expression.prototype.getRawExternals = function () {
        var externals = [];
        this.forEach(function (ex) {
            if (ex instanceof ExternalExpression)
                externals.push(ex.external.getRaw());
        });
        return External.deduplicateExternals(externals);
    };
    Expression.prototype.getFreeReferences = function () {
        var freeReferences = [];
        this.forEach(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression && nestDiff <= ex.nest) {
                freeReferences.push(repeat('^', ex.nest - nestDiff) + ex.name);
            }
        });
        return deduplicateSort(freeReferences);
    };
    Expression.prototype.getFreeReferenceIndexes = function () {
        var freeReferenceIndexes = [];
        this.forEach(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression && nestDiff <= ex.nest) {
                freeReferenceIndexes.push(index);
            }
        });
        return freeReferenceIndexes;
    };
    Expression.prototype.incrementNesting = function (by) {
        if (by === void 0) { by = 1; }
        var freeReferenceIndexes = this.getFreeReferenceIndexes();
        if (freeReferenceIndexes.length === 0)
            return this;
        return this.substitute(function (ex, index) {
            if (ex instanceof RefExpression && freeReferenceIndexes.indexOf(index) !== -1) {
                return ex.incrementNesting(by);
            }
            return null;
        });
    };
    Expression.prototype.simplify = function () {
        return this;
    };
    Expression.prototype.every = function (iter, thisArg) {
        return this._everyHelper(iter, thisArg, { index: 0 }, 0, 0);
    };
    Expression.prototype._everyHelper = function (iter, thisArg, indexer, depth, nestDiff) {
        var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
        if (pass != null) {
            return pass;
        }
        else {
            indexer.index++;
        }
        return true;
    };
    Expression.prototype.some = function (iter, thisArg) {
        var _this = this;
        return !this.every(function (ex, index, depth, nestDiff) {
            var v = iter.call(_this, ex, index, depth, nestDiff);
            return (v == null) ? null : !v;
        }, thisArg);
    };
    Expression.prototype.forEach = function (iter, thisArg) {
        var _this = this;
        this.every(function (ex, index, depth, nestDiff) {
            iter.call(_this, ex, index, depth, nestDiff);
            return null;
        }, thisArg);
    };
    Expression.prototype.substitute = function (substitutionFn, thisArg) {
        return this._substituteHelper(substitutionFn, thisArg, { index: 0 }, 0, 0);
    };
    Expression.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
        if (sub) {
            indexer.index += this.expressionCount();
            return sub;
        }
        else {
            indexer.index++;
        }
        return this;
    };
    Expression.prototype.substituteAction = function (actionMatchFn, actionSubstitutionFn, options, thisArg) {
        var _this = this;
        if (options === void 0) { options = {}; }
        return this.substitute(function (ex) {
            if (ex instanceof ChainExpression) {
                var actions = ex.actions;
                for (var i = 0; i < actions.length; i++) {
                    var action = actions[i];
                    if (actionMatchFn.call(_this, action)) {
                        var newEx = actionSubstitutionFn.call(_this, ex.headActions(i), action);
                        for (var j = i + 1; j < actions.length; j++)
                            newEx = newEx.performAction(actions[j]);
                        if (options.onceInChain)
                            return newEx;
                        return newEx.substituteAction(actionMatchFn, actionSubstitutionFn, options, _this);
                    }
                }
            }
            return null;
        }, thisArg);
    };
    Expression.prototype.getJSFn = function (datumVar) {
        if (datumVar === void 0) { datumVar = 'd[]'; }
        var type = this.type;
        var jsEx = this.getJS(datumVar);
        var body;
        if (type === 'NUMBER' || type === 'NUMBER_RANGE' || type === 'TIME') {
            body = "_=" + jsEx + ";return isNaN(_)?null:_";
        }
        else {
            body = "return " + jsEx + ";";
        }
        return "function(" + datumVar.replace('[]', '') + "){var _,_2;" + body + "}";
    };
    Expression.prototype.extractFromAnd = function (matchFn) {
        if (this.type !== 'BOOLEAN')
            return null;
        if (matchFn(this)) {
            return {
                extract: this,
                rest: Expression.TRUE
            };
        }
        else {
            return {
                extract: Expression.TRUE,
                rest: this
            };
        }
    };
    Expression.prototype.breakdownByDataset = function (tempNamePrefix) {
        var nameIndex = 0;
        var singleDatasetActions = [];
        var externals = this.getBaseExternals();
        if (externals.length < 2) {
            throw new Error('not a multiple dataset expression');
        }
        var combine = this.substitute(function (ex) {
            var externals = ex.getBaseExternals();
            if (externals.length !== 1)
                return null;
            var existingApply = SimpleArray.find(singleDatasetActions, function (apply) { return apply.expression.equals(ex); });
            var tempName;
            if (existingApply) {
                tempName = existingApply.name;
            }
            else {
                tempName = tempNamePrefix + (nameIndex++);
                singleDatasetActions.push(new ApplyAction({
                    action: 'apply',
                    name: tempName,
                    expression: ex
                }));
            }
            return new RefExpression({
                op: 'ref',
                name: tempName,
                nest: 0
            });
        });
        return {
            combineExpression: combine,
            singleDatasetActions: singleDatasetActions
        };
    };
    Expression.prototype.actionize = function (containingAction) {
        return null;
    };
    Expression.prototype.getExpressionPattern = function (actionType) {
        var actions = this.actionize(actionType);
        return actions ? actions.map(function (action) { return action.expression; }) : null;
    };
    Expression.prototype.firstAction = function () {
        return null;
    };
    Expression.prototype.lastAction = function () {
        return null;
    };
    Expression.prototype.headActions = function (n) {
        return this;
    };
    Expression.prototype.popAction = function () {
        return null;
    };
    Expression.prototype.getLiteralValue = function () {
        return null;
    };
    Expression.prototype.bumpStringLiteralToTime = function () {
        return this;
    };
    Expression.prototype.bumpStringLiteralToSetString = function () {
        return this;
    };
    Expression.prototype.upgradeToType = function (targetType) {
        return this;
    };
    Expression.prototype.performAction = function (action, markSimple) {
        return this.performActions([action], markSimple);
    };
    Expression.prototype.performActions = function (actions, markSimple) {
        if (!actions.length)
            return this;
        return new ChainExpression({
            expression: this,
            actions: actions,
            simple: Boolean(markSimple)
        });
    };
    Expression.prototype._performMultiAction = function (action, exs) {
        if (!exs.length)
            throw new Error(action + " action must have at least one argument");
        var ret = this;
        for (var _i = 0, exs_1 = exs; _i < exs_1.length; _i++) {
            var ex = exs_1[_i];
            if (!Expression.isExpression(ex))
                ex = Expression.fromJSLoose(ex);
            var ActionConstructor = Action.classMap[action];
            ret = ret.performAction(new ActionConstructor({ expression: ex }));
        }
        return ret;
    };
    Expression.prototype.add = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('add', exs);
    };
    Expression.prototype.subtract = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('subtract', exs);
    };
    Expression.prototype.negate = function () {
        return Expression.ZERO.subtract(this);
    };
    Expression.prototype.multiply = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('multiply', exs);
    };
    Expression.prototype.divide = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('divide', exs);
    };
    Expression.prototype.reciprocate = function () {
        return Expression.ONE.divide(this);
    };
    Expression.prototype.sqrt = function () {
        return this.power(0.5);
    };
    Expression.prototype.power = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('power', exs);
    };
    Expression.prototype.fallback = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new FallbackAction({ expression: ex }));
    };
    Expression.prototype.is = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new IsAction({ expression: ex }));
    };
    Expression.prototype.isnt = function (ex) {
        return this.is(ex).not();
    };
    Expression.prototype.lessThan = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new LessThanAction({ expression: ex }));
    };
    Expression.prototype.lessThanOrEqual = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new LessThanOrEqualAction({ expression: ex }));
    };
    Expression.prototype.greaterThan = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new GreaterThanAction({ expression: ex }));
    };
    Expression.prototype.greaterThanOrEqual = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new GreaterThanOrEqualAction({ expression: ex }));
    };
    Expression.prototype.contains = function (ex, compare) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        if (compare)
            compare = getString(compare);
        return this.performAction(new ContainsAction({ expression: ex, compare: compare }));
    };
    Expression.prototype.match = function (re) {
        return this.performAction(new MatchAction({ regexp: getString(re) }));
    };
    Expression.prototype.in = function (ex, snd) {
        if (arguments.length === 2) {
            ex = getValue(ex);
            snd = getValue(snd);
            if (typeof ex === 'string') {
                var parse = parseISODate(ex, Expression.defaultParserTimezone);
                if (parse)
                    ex = parse;
            }
            if (typeof snd === 'string') {
                var parse = parseISODate(snd, Expression.defaultParserTimezone);
                if (parse)
                    snd = parse;
            }
            if (typeof ex === 'number' && typeof snd === 'number') {
                ex = new NumberRange({ start: ex, end: snd });
            }
            else if (ex.toISOString && snd.toISOString) {
                ex = new TimeRange({ start: ex, end: snd });
            }
            else if (typeof ex === 'string' && typeof snd === 'string') {
                ex = new StringRange({ start: ex, end: snd });
            }
            else {
                throw new Error('uninterpretable IN parameters');
            }
        }
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new InAction({ expression: ex }));
    };
    Expression.prototype.overlap = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.bumpStringLiteralToSetString().performAction(new OverlapAction({ expression: ex.bumpStringLiteralToSetString() }));
    };
    Expression.prototype.not = function () {
        return this.performAction(new NotAction({}));
    };
    Expression.prototype.and = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('and', exs);
    };
    Expression.prototype.or = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('or', exs);
    };
    Expression.prototype.substr = function (position, length) {
        return this.performAction(new SubstrAction({ position: getNumber(position), length: getNumber(length) }));
    };
    Expression.prototype.extract = function (re) {
        return this.performAction(new ExtractAction({ regexp: getString(re) }));
    };
    Expression.prototype.concat = function () {
        var exs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            exs[_i - 0] = arguments[_i];
        }
        return this._performMultiAction('concat', exs);
    };
    Expression.prototype.lookup = function (lookup) {
        return this.performAction(new LookupAction({ lookup: getString(lookup) }));
    };
    Expression.prototype.indexOf = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new IndexOfAction({ expression: ex }));
    };
    Expression.prototype.transformCase = function (transformType) {
        return this.performAction(new TransformCaseAction({ transformType: getString(transformType) }));
    };
    Expression.prototype.customTransform = function (custom, outputType) {
        if (!custom)
            throw new Error("Must provide an extraction function name for custom transform");
        var outputType = outputType !== undefined ? getString(outputType) : null;
        return this.performAction(new CustomTransformAction({ custom: getString(custom), outputType: outputType }));
    };
    Expression.prototype.numberBucket = function (size, offset) {
        if (offset === void 0) { offset = 0; }
        return this.performAction(new NumberBucketAction({ size: getNumber(size), offset: getNumber(offset) }));
    };
    Expression.prototype.absolute = function () {
        return this.performAction(new AbsoluteAction({}));
    };
    Expression.prototype.length = function () {
        return this.performAction(new LengthAction({}));
    };
    Expression.prototype.timeBucket = function (duration, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeBucketAction({ duration: duration, timezone: timezone }));
    };
    Expression.prototype.timeFloor = function (duration, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeFloorAction({ duration: duration, timezone: timezone }));
    };
    Expression.prototype.timeShift = function (duration, step, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeShiftAction({ duration: duration, step: getNumber(step), timezone: timezone }));
    };
    Expression.prototype.timeRange = function (duration, step, timezone) {
        if (!Duration.isDuration(duration))
            duration = Duration.fromJS(getString(duration));
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimeRangeAction({ duration: duration, step: getNumber(step), timezone: timezone }));
    };
    Expression.prototype.timePart = function (part, timezone) {
        if (timezone && !Timezone.isTimezone(timezone))
            timezone = Timezone.fromJS(getString(timezone));
        return this.bumpStringLiteralToTime().performAction(new TimePartAction({ part: getString(part), timezone: timezone }));
    };
    Expression.prototype.cast = function (outputType) {
        return this.performAction(new CastAction({ outputType: getString(outputType) }));
    };
    Expression.prototype.cardinality = function () {
        return this.performAction(new CardinalityAction({}));
    };
    Expression.prototype.filter = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new FilterAction({ expression: ex }));
    };
    Expression.prototype.split = function (splits, name, dataName) {
        if (arguments.length === 3 ||
            (arguments.length === 2 && splits && (typeof splits === 'string' || typeof splits.op === 'string'))) {
            name = getString(name);
            var realSplits = Object.create(null);
            realSplits[name] = splits;
            splits = realSplits;
        }
        else {
            dataName = name;
        }
        var parsedSplits = Object.create(null);
        for (var k in splits) {
            if (!hasOwnProperty(splits, k))
                continue;
            var ex = splits[k];
            parsedSplits[k] = Expression.isExpression(ex) ? ex : Expression.fromJSLoose(ex);
        }
        dataName = dataName ? getString(dataName) : getDataName(this);
        if (!dataName)
            throw new Error("could not guess data name in `split`, please provide one explicitly");
        return this.performAction(new SplitAction({ splits: parsedSplits, dataName: dataName }));
    };
    Expression.prototype.apply = function (name, ex) {
        if (arguments.length < 2)
            throw new Error('invalid arguments to .apply, did you forget to specify a name?');
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new ApplyAction({ name: getString(name), expression: ex }));
    };
    Expression.prototype.sort = function (ex, direction) {
        if (direction === void 0) { direction = 'ascending'; }
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new SortAction({ expression: ex, direction: getString(direction) }));
    };
    Expression.prototype.limit = function (limit) {
        return this.performAction(new LimitAction({ limit: getNumber(limit) }));
    };
    Expression.prototype.select = function () {
        var attributes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            attributes[_i - 0] = arguments[_i];
        }
        attributes = attributes.map(getString);
        return this.performAction(new SelectAction({ attributes: attributes }));
    };
    Expression.prototype.count = function () {
        if (arguments.length)
            throw new Error('.count() should not have arguments, did you want to .filter().count()?');
        return this.performAction(new CountAction({}));
    };
    Expression.prototype.sum = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new SumAction({ expression: ex }));
    };
    Expression.prototype.min = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new MinAction({ expression: ex }));
    };
    Expression.prototype.max = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new MaxAction({ expression: ex }));
    };
    Expression.prototype.average = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new AverageAction({ expression: ex }));
    };
    Expression.prototype.countDistinct = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new CountDistinctAction({ expression: ex }));
    };
    Expression.prototype.quantile = function (ex, quantile) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new QuantileAction({ expression: ex, quantile: getNumber(quantile) }));
    };
    Expression.prototype.custom = function (custom) {
        return this.performAction(new CustomAggregateAction({ custom: getString(custom) }));
    };
    Expression.prototype.customAggregate = function (custom) {
        return this.performAction(new CustomAggregateAction({ custom: getString(custom) }));
    };
    Expression.prototype.join = function (ex) {
        if (!Expression.isExpression(ex))
            ex = Expression.fromJSLoose(ex);
        return this.performAction(new JoinAction({ expression: ex }));
    };
    Expression.prototype.defineEnvironment = function (environment) {
        if (!environment.timezone)
            environment = { timezone: Timezone.UTC };
        if (typeof environment.timezone === 'string')
            environment = { timezone: Timezone.fromJS(environment.timezone) };
        return this.substituteAction(function (action) { return action.needsEnvironment(); }, function (preEx, action) { return preEx.performAction(action.defineEnvironment(environment)); });
    };
    Expression.prototype.referenceCheck = function (context) {
        return this.referenceCheckInTypeContext(getFullTypeFromDatum(context));
    };
    Expression.prototype.definedInTypeContext = function (typeContext) {
        try {
            var alterations = {};
            this._fillRefSubstitutions(typeContext, { index: 0 }, alterations);
        }
        catch (e) {
            return false;
        }
        return true;
    };
    Expression.prototype.referenceCheckInTypeContext = function (typeContext) {
        var alterations = {};
        this._fillRefSubstitutions(typeContext, { index: 0 }, alterations);
        if (emptyLookup(alterations))
            return this;
        return this.substitute(function (ex, index) { return alterations[index] || null; });
    };
    Expression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        return typeContext;
    };
    Expression.prototype.resolve = function (context, ifNotFound) {
        if (ifNotFound === void 0) { ifNotFound = 'throw'; }
        var expressions = Object.create(null);
        for (var k in context) {
            if (!hasOwnProperty(context, k))
                continue;
            var value = context[k];
            expressions[k] = External.isExternal(value) ?
                new ExternalExpression({ external: value }) :
                new LiteralExpression({ value: value });
        }
        return this.resolveWithExpressions(expressions, ifNotFound);
    };
    Expression.prototype.resolveWithExpressions = function (expressions, ifNotFound) {
        if (ifNotFound === void 0) { ifNotFound = 'throw'; }
        return this.substitute(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression) {
                var nest = ex.nest, ignoreCase = ex.ignoreCase, name = ex.name;
                if (nestDiff === nest) {
                    var foundExpression = null;
                    var valueFound = false;
                    var property = ignoreCase ? RefExpression.findPropertyCI(expressions, name) : RefExpression.findProperty(expressions, name);
                    if (property != null) {
                        foundExpression = expressions[property];
                        valueFound = true;
                    }
                    else {
                        valueFound = false;
                    }
                    if (valueFound) {
                        return foundExpression;
                    }
                    else if (ifNotFound === 'throw') {
                        throw new Error("could not resolve " + ex + " because is was not in the context");
                    }
                    else if (ifNotFound === 'null') {
                        return Expression.NULL;
                    }
                    else if (ifNotFound === 'leave') {
                        return ex;
                    }
                }
                else if (nestDiff < nest) {
                    throw new Error("went too deep during resolve on: " + ex);
                }
            }
            return null;
        });
    };
    Expression.prototype.resolved = function () {
        return this.every(function (ex) {
            return (ex instanceof RefExpression) ? ex.nest === 0 : null;
        });
    };
    Expression.prototype.contained = function () {
        return this.every(function (ex, index, depth, nestDiff) {
            if (ex instanceof RefExpression) {
                var nest = ex.nest;
                return nestDiff >= nest;
            }
            return null;
        });
    };
    Expression.prototype.decomposeAverage = function (countEx) {
        return this.substituteAction(function (action) {
            return action.action === 'average';
        }, function (preEx, action) {
            var expression = action.expression;
            return preEx.sum(expression).divide(countEx ? preEx.sum(countEx) : preEx.count());
        });
    };
    Expression.prototype.distribute = function () {
        return this.substituteAction(function (action) {
            return action.canDistribute();
        }, function (preEx, action) {
            var distributed = action.distribute(preEx);
            if (!distributed)
                throw new Error('distribute returned null');
            return distributed;
        });
    };
    Expression.prototype._initialPrepare = function (context, environment) {
        return this.defineEnvironment(environment)
            .referenceCheck(context)
            .resolve(context)
            .simplify();
    };
    Expression.prototype.simulate = function (context, environment) {
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        var readyExpression = this._initialPrepare(context, environment);
        if (readyExpression instanceof ExternalExpression) {
            readyExpression = readyExpression.unsuppress();
        }
        return readyExpression._computeResolvedSimulate(true, []);
    };
    Expression.prototype.simulateQueryPlan = function (context, environment) {
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        if (!datumHasExternal(context) && !this.hasExternal())
            return [];
        var readyExpression = this._initialPrepare(context, environment);
        if (readyExpression instanceof ExternalExpression) {
            readyExpression = readyExpression.unsuppress();
        }
        var simulatedQueries = [];
        readyExpression._computeResolvedSimulate(true, simulatedQueries);
        return simulatedQueries;
    };
    Expression.prototype.compute = function (context, environment) {
        var _this = this;
        if (context === void 0) { context = {}; }
        if (environment === void 0) { environment = {}; }
        if (!datumHasExternal(context) && !this.hasExternal()) {
            return Q.fcall(function () {
                var referenceChecked = _this.defineEnvironment(environment).referenceCheck(context);
                return referenceChecked.getFn()(context, null);
            });
        }
        return introspectDatum(context)
            .then(function (introspectedContext) {
            var readyExpression = _this._initialPrepare(introspectedContext, environment);
            if (readyExpression instanceof ExternalExpression) {
                readyExpression = readyExpression.unsuppress();
            }
            return readyExpression._computeResolved(true);
        });
    };
    Expression.defaultParserTimezone = Timezone.UTC;
    Expression.classMap = {};
    return Expression;
}());
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};







var LiteralExpression = exports.LiteralExpression = (function (_super) {
    __extends(LiteralExpression, _super);
    function LiteralExpression(parameters) {
        _super.call(this, parameters, dummyObject);
        var value = parameters.value;
        this.value = value;
        this._ensureOp("literal");
        if (typeof this.value === 'undefined') {
            throw new TypeError("must have a `value`");
        }
        this.type = getValueType(value);
        this.simple = true;
    }
    LiteralExpression.fromJS = function (parameters) {
        var value = {
            op: parameters.op,
            type: parameters.type
        };
        if (!hasOwnProperty(parameters, 'value'))
            throw new Error('literal expression must have value');
        var v = parameters.value;
        if (isImmutableClass(v)) {
            value.value = v;
        }
        else {
            value.value = valueFromJS(v, parameters.type);
        }
        return new LiteralExpression(value);
    };
    LiteralExpression.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.value = this.value;
        if (this.type)
            value.type = this.type;
        return value;
    };
    LiteralExpression.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        if (this.value && this.value.toJS) {
            js.value = this.value.toJS();
            js.type = isSetType(this.type) ? 'SET' : this.type;
        }
        else {
            js.value = this.value;
            if (this.type === 'TIME')
                js.type = 'TIME';
        }
        return js;
    };
    LiteralExpression.prototype.toString = function () {
        var value = this.value;
        if (value instanceof Dataset && value.basis()) {
            return 'ply()';
        }
        else if (this.type === 'STRING') {
            return JSON.stringify(value);
        }
        else {
            return String(value);
        }
    };
    LiteralExpression.prototype.getFn = function () {
        var value = this.value;
        return function () { return value; };
    };
    LiteralExpression.prototype.getJS = function (datumVar) {
        return JSON.stringify(this.value);
    };
    LiteralExpression.prototype.getSQL = function (dialect) {
        var value = this.value;
        if (value === null)
            return 'NULL';
        switch (this.type) {
            case 'STRING':
                return dialect.escapeLiteral(value);
            case 'BOOLEAN':
                return dialect.booleanToSQL(value);
            case 'NUMBER':
                return dialect.numberToSQL(value);
            case 'NUMBER_RANGE':
                return "" + dialect.numberToSQL(value.start);
            case 'TIME':
                return dialect.timeToSQL(value);
            case 'TIME_RANGE':
                return "" + dialect.timeToSQL(value.start);
            case 'STRING_RANGE':
                return dialect.escapeLiteral(value.start);
            case 'SET/STRING':
            case 'SET/NUMBER':
                return '(' + value.elements.map(function (v) { return typeof v === 'number' ? v : dialect.escapeLiteral(v); }).join(',') + ')';
            case 'SET/NUMBER_RANGE':
            case 'SET/TIME_RANGE':
                return 'FALSE';
            default:
                throw new Error("currently unsupported type: " + this.type);
        }
    };
    LiteralExpression.prototype.equals = function (other) {
        if (!_super.prototype.equals.call(this, other) || this.type !== other.type)
            return false;
        if (this.value) {
            if (this.value.equals) {
                return this.value.equals(other.value);
            }
            else if (this.value.toISOString && other.value.toISOString) {
                return this.value.valueOf() === other.value.valueOf();
            }
            else {
                return this.value === other.value;
            }
        }
        else {
            return this.value === other.value;
        }
    };
    LiteralExpression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        if (this.type === 'DATASET') {
            var newTypeContext = this.value.getFullType();
            newTypeContext.parent = typeContext;
            return newTypeContext;
        }
        else {
            return { type: this.type };
        }
    };
    LiteralExpression.prototype.getLiteralValue = function () {
        return this.value;
    };
    LiteralExpression.prototype._computeResolvedSimulate = function () {
        return this.value;
    };
    LiteralExpression.prototype._computeResolved = function () {
        return Q(this.value);
    };
    LiteralExpression.prototype.maxPossibleSplitValues = function () {
        var value = this.value;
        return Set.isSet(value) ? value.size() : 1;
    };
    LiteralExpression.prototype.bumpStringLiteralToTime = function () {
        if (this.type !== 'STRING')
            return this;
        var parse = parseISODate(this.value, Expression.defaultParserTimezone);
        if (!parse)
            throw new Error("could not parse '" + this.value + "' as time");
        return r(parse);
    };
    LiteralExpression.prototype.bumpStringLiteralToSetString = function () {
        if (this.type !== 'STRING')
            return this;
        return r(Set.fromJS([this.value]));
    };
    LiteralExpression.prototype.upgradeToType = function (targetType) {
        var _a = this, type = _a.type, value = _a.value;
        if (type === targetType || targetType !== 'TIME')
            return this;
        if (type === 'STRING') {
            var parse = parseISODate(value, Expression.defaultParserTimezone);
            return parse ? r(parse) : this;
        }
        else if (type === 'STRING_RANGE') {
            var parseStart = parseISODate(value.start, Expression.defaultParserTimezone);
            var parseEnd = parseISODate(value.end, Expression.defaultParserTimezone);
            if (parseStart || parseEnd) {
                return new LiteralExpression({
                    type: "TIME_RANGE",
                    value: TimeRange.fromJS({
                        start: parseStart, end: parseEnd, bounds: '[]'
                    })
                });
            }
        }
        return this;
    };
    return LiteralExpression;
}(Expression));
Expression.NULL = new LiteralExpression({ value: null });
Expression.ZERO = new LiteralExpression({ value: 0 });
Expression.ONE = new LiteralExpression({ value: 1 });
Expression.FALSE = new LiteralExpression({ value: false });
Expression.TRUE = new LiteralExpression({ value: true });
Expression.EMPTY_STRING = new LiteralExpression({ value: '' });
Expression.EMPTY_SET = new LiteralExpression({ value: Set.fromJS([]) });
Expression.register(LiteralExpression);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var POSSIBLE_TYPES = exports.POSSIBLE_TYPES = {
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
var RefExpression = exports.RefExpression = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var ExternalExpression = exports.ExternalExpression = (function (_super) {
    __extends(ExternalExpression, _super);
    function ExternalExpression(parameters) {
        _super.call(this, parameters, dummyObject);
        var external = parameters.external;
        if (!external)
            throw new Error('must have an external');
        this.external = external;
        this._ensureOp('external');
        this.type = external.mode === 'value' ? 'NUMBER' : 'DATASET';
        this.simple = true;
    }
    ExternalExpression.fromJS = function (parameters) {
        var value = {
            op: parameters.op
        };
        value.external = External.fromJS(parameters.external);
        return new ExternalExpression(value);
    };
    ExternalExpression.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.external = this.external;
        return value;
    };
    ExternalExpression.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.external = this.external.toJS();
        return js;
    };
    ExternalExpression.prototype.toString = function () {
        return "E:" + this.external;
    };
    ExternalExpression.prototype.getFn = function () {
        throw new Error('should not call getFn on External');
    };
    ExternalExpression.prototype.getJS = function (datumVar) {
        throw new Error('should not call getJS on External');
    };
    ExternalExpression.prototype.getSQL = function (dialect) {
        throw new Error('should not call getSQL on External');
    };
    ExternalExpression.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.external.equals(other.external);
    };
    ExternalExpression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        var external = this.external;
        if (external.mode === 'value') {
            return { type: 'NUMBER' };
        }
        else {
            var newTypeContext = this.external.getFullType();
            newTypeContext.parent = typeContext;
            return newTypeContext;
        }
    };
    ExternalExpression.prototype._computeResolvedSimulate = function (lastNode, simulatedQueries) {
        var external = this.external;
        if (external.suppress)
            return external;
        return external.simulateValue(lastNode, simulatedQueries);
    };
    ExternalExpression.prototype._computeResolved = function (lastNode) {
        var external = this.external;
        if (external.suppress)
            return Q(external);
        return external.queryValue(lastNode);
    };
    ExternalExpression.prototype.unsuppress = function () {
        var value = this.valueOf();
        value.external = this.external.show();
        return new ExternalExpression(value);
    };
    ExternalExpression.prototype.addAction = function (action) {
        var newExternal = this.external.addAction(action);
        if (!newExternal)
            return null;
        return new ExternalExpression({ external: newExternal });
    };
    ExternalExpression.prototype.maxPossibleSplitValues = function () {
        return Infinity;
    };
    return ExternalExpression;
}(Expression));
Expression.register(ExternalExpression);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};







var ChainExpression = exports.ChainExpression = (function (_super) {
    __extends(ChainExpression, _super);
    function ChainExpression(parameters) {
        _super.call(this, parameters, dummyObject);
        var expression = parameters.expression;
        var actions = parameters.actions;
        if (!actions.length)
            throw new Error('can not have empty actions');
        this._ensureOp('chain');
        var type = expression.type;
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            var upgradedAction = action.getUpgradedType(type);
            if (upgradedAction !== action) {
                actions = actions.slice();
                actions[i] = action = upgradedAction;
            }
            try {
                type = action.getOutputType(type);
            }
            catch (e) {
                var neededType = action.getNecessaryInputTypes();
                if (i === 0) {
                    expression = expression.upgradeToType(neededType);
                    type = expression.type;
                }
                else {
                    var upgradedChain = new ChainExpression({
                        expression: expression,
                        actions: actions.slice(0, i)
                    }).upgradeToType(neededType);
                    expression = upgradedChain.expression;
                    actions = upgradedChain.actions;
                    type = upgradedChain.type;
                }
                type = action.getOutputType(type);
            }
        }
        this.expression = expression;
        this.actions = actions;
        this.type = type;
    }
    ChainExpression.fromJS = function (parameters) {
        var value = {
            op: parameters.op
        };
        value.expression = Expression.fromJS(parameters.expression);
        if (hasOwnProperty(parameters, 'action')) {
            value.actions = [Action.fromJS(parameters.action)];
        }
        else {
            if (!Array.isArray(parameters.actions))
                throw new Error('chain `actions` must be an array');
            value.actions = parameters.actions.map(Action.fromJS);
        }
        return new ChainExpression(value);
    };
    ChainExpression.prototype.upgradeToType = function (neededType) {
        var actions = this.actions;
        var upgradedActions = [];
        for (var i = actions.length - 1; i >= 0; i--) {
            var action = actions[i];
            var upgradedAction = action.getUpgradedType(neededType);
            upgradedActions.unshift(upgradedAction);
            neededType = upgradedAction.getNeededType();
        }
        var value = this.valueOf();
        value.actions = upgradedActions;
        value.expression = this.expression.upgradeToType(neededType);
        return new ChainExpression(value);
    };
    ChainExpression.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.expression = this.expression;
        value.actions = this.actions;
        return value;
    };
    ChainExpression.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.expression = this.expression.toJS();
        var actions = this.actions;
        if (actions.length === 1) {
            js.action = actions[0].toJS();
        }
        else {
            js.actions = actions.map(function (action) { return action.toJS(); });
        }
        return js;
    };
    ChainExpression.prototype.toString = function (indent) {
        var expression = this.expression;
        var actions = this.actions;
        var joinStr = '.';
        var nextIndent = null;
        if (indent != null && (actions.length > 1 || expression.type === 'DATASET')) {
            joinStr = '\n' + repeat(' ', indent) + joinStr;
            nextIndent = indent + 2;
        }
        return [expression.toString()]
            .concat(actions.map(function (action) { return action.toString(nextIndent); }))
            .join(joinStr);
    };
    ChainExpression.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.expression.equals(other.expression) &&
            immutableArraysEqual(this.actions, other.actions);
    };
    ChainExpression.prototype.expressionCount = function () {
        var expressionCount = 1 + this.expression.expressionCount();
        var actions = this.actions;
        for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
            var action = actions_1[_i];
            expressionCount += action.expressionCount();
        }
        return expressionCount;
    };
    ChainExpression.prototype.getFn = function () {
        var _a = this, expression = _a.expression, actions = _a.actions;
        var fn = expression.getFn();
        var type = expression.type;
        for (var _i = 0, actions_2 = actions; _i < actions_2.length; _i++) {
            var action = actions_2[_i];
            fn = action.getFn(type, fn);
            type = action.getOutputType(type);
        }
        return fn;
    };
    ChainExpression.prototype.getJS = function (datumVar) {
        var _a = this, expression = _a.expression, actions = _a.actions;
        var js = expression.getJS(datumVar);
        var type = expression.type;
        for (var _i = 0, actions_3 = actions; _i < actions_3.length; _i++) {
            var action = actions_3[_i];
            js = action.getJS(type, js, datumVar);
            type = action.getOutputType(type);
        }
        return js;
    };
    ChainExpression.prototype.getSQL = function (dialect) {
        var _a = this, expression = _a.expression, actions = _a.actions;
        var sql = expression.getSQL(dialect);
        var type = expression.type;
        for (var _i = 0, actions_4 = actions; _i < actions_4.length; _i++) {
            var action = actions_4[_i];
            sql = action.getSQL(type, sql, dialect);
            type = action.getOutputType(type);
        }
        return sql;
    };
    ChainExpression.prototype.getSingleAction = function (neededAction) {
        var actions = this.actions;
        if (actions.length !== 1)
            return null;
        var singleAction = actions[0];
        if (neededAction && singleAction.action !== neededAction)
            return null;
        return singleAction;
    };
    ChainExpression.prototype.foldIntoExternal = function () {
        var _a = this, expression = _a.expression, actions = _a.actions;
        var baseExternals = this.getBaseExternals();
        if (baseExternals.length === 0)
            return this;
        if (expression instanceof ExternalExpression) {
            var myExternal = expression;
            var undigestedActions = [];
            for (var _i = 0, actions_5 = actions; _i < actions_5.length; _i++) {
                var action = actions_5[_i];
                var newExternal = myExternal.addAction(action);
                if (newExternal) {
                    myExternal = newExternal;
                }
                else {
                    undigestedActions.push(action);
                }
            }
            if (undigestedActions.length) {
                return new ChainExpression({
                    expression: myExternal,
                    actions: undigestedActions,
                    simple: true
                });
            }
            else {
                return myExternal;
            }
        }
        var dataset = expression.getLiteralValue();
        if (Dataset.isDataset(dataset) && dataset.basis()) {
            if (baseExternals.length > 1) {
                throw new Error('multiple externals not supported for now');
            }
            var dataDefinitions = Object.create(null);
            var hasExternalValueApply = false;
            var applies = [];
            var undigestedActions = [];
            var allActions = [];
            for (var _b = 0, actions_6 = actions; _b < actions_6.length; _b++) {
                var action_1 = actions_6[_b];
                if (action_1 instanceof ApplyAction) {
                    var substitutedAction = action_1.substitute(function (ex, index, depth, nestDiff) {
                        if (ex instanceof RefExpression && ex.type === 'DATASET' && nestDiff === 1) {
                            return dataDefinitions[ex.name] || null;
                        }
                        return null;
                    }).simplify();
                    if (substitutedAction.expression instanceof ExternalExpression) {
                        var externalMode = substitutedAction.expression.external.mode;
                        if (externalMode === 'raw') {
                            dataDefinitions[substitutedAction.name] = substitutedAction.expression;
                        }
                        else if (externalMode === 'value') {
                            applies.push(substitutedAction);
                            allActions.push(substitutedAction);
                            hasExternalValueApply = true;
                        }
                        else {
                            undigestedActions.push(substitutedAction);
                            allActions.push(substitutedAction);
                        }
                    }
                    else if (substitutedAction.expression.type !== 'DATASET') {
                        applies.push(substitutedAction);
                        allActions.push(substitutedAction);
                    }
                    else {
                        undigestedActions.push(substitutedAction);
                        allActions.push(substitutedAction);
                    }
                }
                else {
                    undigestedActions.push(action_1);
                    allActions.push(action_1);
                }
            }
            var newExpression;
            if (hasExternalValueApply) {
                var combinedExternal = baseExternals[0].makeTotal(applies);
                if (!combinedExternal)
                    throw new Error('something went wrong');
                newExpression = new ExternalExpression({ external: combinedExternal });
                if (undigestedActions.length)
                    newExpression = newExpression.performActions(undigestedActions, true);
                return newExpression;
            }
            else {
                return ply().performActions(allActions);
            }
        }
        return this.substituteAction(function (action) {
            var expression = action.expression;
            return (expression instanceof ExternalExpression) && expression.external.mode === 'value';
        }, function (preEx, action) {
            var external = action.expression.external;
            return new ExternalExpression({
                external: external.prePack(preEx, action)
            });
        }, {
            onceInChain: true
        }).simplify();
    };
    ChainExpression.prototype.simplify = function () {
        if (this.simple)
            return this;
        var simpleExpression = this.expression.simplify();
        var actions = this.actions;
        if (simpleExpression instanceof ChainExpression) {
            return new ChainExpression({
                expression: simpleExpression.expression,
                actions: simpleExpression.actions.concat(actions)
            }).simplify();
        }
        for (var _i = 0, actions_7 = actions; _i < actions_7.length; _i++) {
            var action = actions_7[_i];
            simpleExpression = action.performOnSimple(simpleExpression);
        }
        if (!simpleExpression.isOp('chain'))
            return simpleExpression;
        return simpleExpression.foldIntoExternal();
    };
    ChainExpression.prototype._everyHelper = function (iter, thisArg, indexer, depth, nestDiff) {
        var pass = iter.call(thisArg, this, indexer.index, depth, nestDiff);
        if (pass != null) {
            return pass;
        }
        else {
            indexer.index++;
        }
        depth++;
        var expression = this.expression;
        if (!expression._everyHelper(iter, thisArg, indexer, depth, nestDiff))
            return false;
        var actions = this.actions;
        var every = true;
        for (var _i = 0, actions_8 = actions; _i < actions_8.length; _i++) {
            var action = actions_8[_i];
            if (every) {
                every = action._everyHelper(iter, thisArg, indexer, depth, nestDiff);
            }
            else {
                indexer.index += action.expressionCount();
            }
        }
        return every;
    };
    ChainExpression.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var sub = substitutionFn.call(thisArg, this, indexer.index, depth, nestDiff);
        if (sub) {
            indexer.index += this.expressionCount();
            return sub;
        }
        else {
            indexer.index++;
        }
        depth++;
        var expression = this.expression;
        var subExpression = expression._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff);
        var actions = this.actions;
        var subActions = actions.map(function (action) { return action._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff); });
        if (expression === subExpression && arraysEqual(actions, subActions))
            return this;
        var value = this.valueOf();
        value.expression = subExpression;
        value.actions = subActions;
        delete value.simple;
        return new ChainExpression(value);
    };
    ChainExpression.prototype.performAction = function (action, markSimple) {
        if (!action)
            throw new Error('must have action');
        return new ChainExpression({
            expression: this.expression,
            actions: this.actions.concat(action),
            simple: Boolean(markSimple)
        });
    };
    ChainExpression.prototype._fillRefSubstitutions = function (typeContext, indexer, alterations) {
        indexer.index++;
        var currentContext = typeContext;
        var outputContext = this.expression._fillRefSubstitutions(currentContext, indexer, alterations);
        currentContext = outputContext.type === 'DATASET' ? outputContext : typeContext;
        var actions = this.actions;
        for (var _i = 0, actions_9 = actions; _i < actions_9.length; _i++) {
            var action = actions_9[_i];
            outputContext = action._fillRefSubstitutions(currentContext, outputContext, indexer, alterations);
            currentContext = outputContext.type === 'DATASET' ? outputContext : typeContext;
        }
        return outputContext;
    };
    ChainExpression.prototype.actionize = function (containingAction) {
        var actions = this.actions;
        var k = actions.length - 1;
        for (; k >= 0; k--) {
            if (actions[k].action !== containingAction)
                break;
        }
        k++;
        if (k === actions.length)
            return null;
        var newExpression;
        if (k === 0) {
            newExpression = this.expression;
        }
        else {
            var value = this.valueOf();
            value.actions = actions.slice(0, k);
            newExpression = new ChainExpression(value);
        }
        var ActionConstructor = Action.classMap[containingAction];
        return [
            new ActionConstructor({
                expression: newExpression
            })
        ].concat(actions.slice(k));
    };
    ChainExpression.prototype.firstAction = function () {
        return this.actions[0] || null;
    };
    ChainExpression.prototype.lastAction = function () {
        var actions = this.actions;
        return actions[actions.length - 1] || null;
    };
    ChainExpression.prototype.headActions = function (n) {
        var actions = this.actions;
        if (actions.length <= n)
            return this;
        if (n <= 0)
            return this.expression;
        var value = this.valueOf();
        value.actions = actions.slice(0, n);
        return new ChainExpression(value);
    };
    ChainExpression.prototype.popAction = function () {
        var actions = this.actions;
        if (!actions.length)
            return null;
        actions = actions.slice(0, -1);
        if (!actions.length)
            return this.expression;
        var value = this.valueOf();
        value.actions = actions;
        return new ChainExpression(value);
    };
    ChainExpression.prototype._computeResolvedSimulate = function (lastNode, simulatedQueries) {
        var _a = this, expression = _a.expression, actions = _a.actions;
        if (expression.isOp('external')) {
            var exV = expression._computeResolvedSimulate(false, simulatedQueries);
            var newExpression = r(exV).performActions(actions).simplify();
            if (newExpression.hasExternal()) {
                return newExpression._computeResolvedSimulate(true, simulatedQueries);
            }
            else {
                return newExpression.getFn()(null, null);
            }
        }
        function execAction(i, dataset) {
            var action = actions[i];
            var actionExpression = action.expression;
            if (action instanceof FilterAction) {
                return dataset.filter(actionExpression.getFn(), null);
            }
            else if (action instanceof ApplyAction) {
                if (actionExpression.hasExternal()) {
                    return dataset.apply(action.name, function (d) {
                        var simpleExpression = actionExpression.resolve(d).simplify();
                        return simpleExpression._computeResolvedSimulate(simpleExpression.isOp('external'), simulatedQueries);
                    }, actionExpression.type, null);
                }
                else {
                    return dataset.apply(action.name, actionExpression.getFn(), actionExpression.type, null);
                }
            }
            else if (action instanceof SortAction) {
                return dataset.sort(actionExpression.getFn(), action.direction, null);
            }
            else if (action instanceof LimitAction) {
                return dataset.limit(action.limit);
            }
            else if (action instanceof SelectAction) {
                return dataset.select(action.attributes);
            }
            throw new Error("could not execute action " + action);
        }
        var value = expression._computeResolvedSimulate(false, simulatedQueries);
        for (var i = 0; i < actions.length; i++) {
            value = execAction(i, value);
        }
        return value;
    };
    ChainExpression.prototype._computeResolved = function () {
        var _a = this, expression = _a.expression, actions = _a.actions;
        if (expression.isOp('external')) {
            return expression._computeResolved(false).then(function (exV) {
                var newExpression = r(exV).performActions(actions).simplify();
                if (newExpression.hasExternal()) {
                    return newExpression._computeResolved(true);
                }
                else {
                    return newExpression.getFn()(null, null);
                }
            });
        }
        function execAction(i) {
            return function (dataset) {
                var action = actions[i];
                var actionExpression = action.expression;
                if (action instanceof FilterAction) {
                    return dataset.filter(actionExpression.getFn(), null);
                }
                else if (action instanceof ApplyAction) {
                    if (actionExpression.hasExternal()) {
                        return dataset.applyPromise(action.name, function (d) {
                            var simpleExpression = actionExpression.resolve(d).simplify();
                            return simpleExpression._computeResolved(simpleExpression.isOp('external'));
                        }, actionExpression.type, null);
                    }
                    else {
                        return dataset.apply(action.name, actionExpression.getFn(), actionExpression.type, null);
                    }
                }
                else if (action instanceof SortAction) {
                    return dataset.sort(actionExpression.getFn(), action.direction, null);
                }
                else if (action instanceof LimitAction) {
                    return dataset.limit(action.limit);
                }
                else if (action instanceof SelectAction) {
                    return dataset.select(action.attributes);
                }
                throw new Error("could not execute action " + action);
            };
        }
        var promise = expression._computeResolved(false);
        for (var i = 0; i < actions.length; i++) {
            promise = promise.then(execAction(i));
        }
        return promise;
    };
    ChainExpression.prototype.extractFromAnd = function (matchFn) {
        if (!this.simple)
            return this.simplify().extractFromAnd(matchFn);
        var andExpressions = this.getExpressionPattern('and');
        if (!andExpressions)
            return _super.prototype.extractFromAnd.call(this, matchFn);
        var includedExpressions = [];
        var excludedExpressions = [];
        for (var _i = 0, andExpressions_1 = andExpressions; _i < andExpressions_1.length; _i++) {
            var ex = andExpressions_1[_i];
            if (matchFn(ex)) {
                includedExpressions.push(ex);
            }
            else {
                excludedExpressions.push(ex);
            }
        }
        return {
            extract: Expression.and(includedExpressions).simplify(),
            rest: Expression.and(excludedExpressions).simplify()
        };
    };
    ChainExpression.prototype.maxPossibleSplitValues = function () {
        return this.type === 'BOOLEAN' ? 3 : this.lastAction().maxPossibleSplitValues();
    };
    return ChainExpression;
}(Expression));
Expression.register(ChainExpression);








var Action = exports.Action = (function () {
    function Action(parameters, dummy) {
        if (dummy === void 0) { dummy = null; }
        this._stringTransformInputType = ['STRING', 'SET/STRING'];
        if (dummy !== dummyObject) {
            throw new TypeError("can not call `new Action` directly use Action.fromJS instead");
        }
        this.action = parameters.action;
        this.expression = parameters.expression;
        this.simple = parameters.simple;
    }
    Action.jsToValue = function (parameters) {
        var value = {
            action: parameters.action
        };
        if (parameters.expression) {
            value.expression = Expression.fromJS(parameters.expression);
        }
        return value;
    };
    Action.actionsDependOn = function (actions, name) {
        for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
            var action = actions_1[_i];
            var freeReferences = action.getFreeReferences();
            if (freeReferences.indexOf(name) !== -1)
                return true;
            if (action.name === name)
                return false;
        }
        return false;
    };
    Action.isAction = function (candidate) {
        return isInstanceOf(candidate, Action);
    };
    Action.register = function (act) {
        var action = act.name.replace('Action', '').replace(/^\w/, function (s) { return s.toLowerCase(); });
        Action.classMap[action] = act;
    };
    Action.fromJS = function (actionJS) {
        if (!hasOwnProperty(actionJS, "action")) {
            throw new Error("action must be defined");
        }
        var action = actionJS.action;
        if (typeof action !== "string") {
            throw new Error("action must be a string");
        }
        if (action === 'custom')
            actionJS.action = action = 'customAggregate';
        var ClassFn = Action.classMap[action];
        if (!ClassFn) {
            throw new Error("unsupported action '" + action + "'");
        }
        return ClassFn.fromJS(actionJS);
    };
    Action.fromValue = function (value) {
        var ClassFn = Action.classMap[value.action];
        return new ClassFn(value);
    };
    Action.prototype._ensureAction = function (action) {
        if (!this.action) {
            this.action = action;
            return;
        }
        if (this.action !== action) {
            throw new TypeError("incorrect action '" + this.action + "' (needs to be: '" + action + "')");
        }
    };
    Action.prototype._toStringParameters = function (expressionString) {
        return expressionString ? [expressionString] : [];
    };
    Action.prototype.toString = function (indent) {
        var expression = this.expression;
        var spacer = '';
        var joinStr = indent != null ? ', ' : ',';
        var nextIndent = null;
        if (indent != null && expression && expression.type === 'DATASET') {
            var space = repeat(' ', indent);
            spacer = '\n' + space;
            joinStr = ',\n' + space;
            nextIndent = indent + 2;
        }
        return [
            this.action,
            '(',
            spacer,
            this._toStringParameters(expression ? expression.toString(nextIndent) : null).join(joinStr),
            spacer,
            ')'
        ].join('');
    };
    Action.prototype.valueOf = function () {
        var value = {
            action: this.action
        };
        if (this.expression)
            value.expression = this.expression;
        if (this.simple)
            value.simple = true;
        return value;
    };
    Action.prototype.toJS = function () {
        var js = {
            action: this.action
        };
        if (this.expression) {
            js.expression = this.expression.toJS();
        }
        return js;
    };
    Action.prototype.toJSON = function () {
        return this.toJS();
    };
    Action.prototype.equals = function (other) {
        return Action.isAction(other) &&
            this.action === other.action &&
            Boolean(this.expression) === Boolean(other.expression) &&
            (!this.expression || this.expression.equals(other.expression));
    };
    Action.prototype.isAggregate = function () {
        return false;
    };
    Action.prototype._checkInputTypes = function (inputType) {
        var neededTypes = this.getNecessaryInputTypes();
        if (typeof neededTypes === 'string')
            neededTypes = [neededTypes];
        if (inputType && inputType !== 'NULL' && neededTypes.indexOf(inputType) === -1) {
            if (neededTypes.length === 1) {
                throw new Error(this.action + " must have input of type " + neededTypes[0] + " (is " + inputType + ")");
            }
            else {
                throw new Error(this.action + " must have input of type " + neededTypes.join(' or ') + " (is " + inputType + ")");
            }
        }
    };
    Action.prototype._checkNoExpression = function () {
        if (this.expression) {
            throw new Error(this.action + " must no have an expression (is " + this.expression + ")");
        }
    };
    Action.prototype._checkExpressionTypes = function () {
        var neededTypes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            neededTypes[_i - 0] = arguments[_i];
        }
        var expressionType = this.expression.type;
        if (expressionType && expressionType !== 'NULL' && neededTypes.indexOf(expressionType) === -1) {
            if (neededTypes.length === 1) {
                throw new Error(this.action + " must have expression of type " + neededTypes[0] + " (is " + expressionType + ")");
            }
            else {
                throw new Error(this.action + " must have expression of type " + neededTypes.join(' or ') + " (is " + expressionType + ")");
            }
        }
    };
    Action.prototype._stringTransformOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return inputType;
    };
    Action.prototype.getNeededType = function () {
        var expression = this.expression;
        if (expression)
            return expression.type;
        return null;
    };
    Action.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var action = this.action;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV[action](expressionFn, foldContext(d, c)) : null;
        };
    };
    Action.prototype.getFn = function (inputType, inputFn) {
        var expression = this.expression;
        var expressionFn = expression ? expression.getFn() : null;
        return this._getFnHelper(inputType, inputFn, expressionFn);
    };
    Action.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        throw new Error('can not call this directly');
    };
    Action.prototype.getJS = function (inputType, inputJS, datumVar) {
        var expression = this.expression;
        var expressionJS = expression ? expression.getJS(datumVar) : null;
        return this._getJSHelper(inputType, inputJS, expressionJS);
    };
    Action.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('can not call this directly');
    };
    Action.prototype.getSQL = function (inputType, inputSQL, dialect) {
        var expression = this.expression;
        var expressionSQL = expression ? expression.getSQL(dialect) : null;
        return this._getSQLHelper(inputType, dialect, inputSQL, expressionSQL);
    };
    Action.prototype.expressionCount = function () {
        return this.expression ? this.expression.expressionCount() : 0;
    };
    Action.prototype.fullyDefined = function () {
        var expression = this.expression;
        return !expression || expression.isOp('literal');
    };
    Action.prototype._specialSimplify = function (simpleExpression) {
        return null;
    };
    Action.prototype.simplify = function () {
        if (this.simple)
            return this;
        var expression = this.expression;
        var simpleExpression = expression ? expression.simplify() : null;
        var special = this._specialSimplify(simpleExpression);
        if (special)
            return special;
        var value = this.valueOf();
        if (simpleExpression) {
            value.expression = simpleExpression;
        }
        value.simple = true;
        return Action.fromValue(value);
    };
    Action.prototype._removeAction = function (inputType) {
        return false;
    };
    Action.prototype._nukeExpression = function (precedingExpression) {
        return null;
    };
    Action.prototype._distributeAction = function () {
        return null;
    };
    Action.prototype._performOnLiteral = function (literalExpression) {
        return null;
    };
    Action.prototype._performOnRef = function (refExpression) {
        return null;
    };
    Action.prototype._foldWithPrevAction = function (prevAction) {
        return null;
    };
    Action.prototype._putBeforeLastAction = function (lastAction) {
        return null;
    };
    Action.prototype._performOnSimpleChain = function (chainExpression) {
        return null;
    };
    Action.prototype.performOnSimple = function (simpleExpression) {
        if (!this.simple)
            return this.simplify().performOnSimple(simpleExpression);
        if (!simpleExpression.simple)
            throw new Error('must get a simple expression');
        if (this._removeAction(simpleExpression.type))
            return simpleExpression;
        var nukedExpression = this._nukeExpression(simpleExpression);
        if (nukedExpression)
            return nukedExpression;
        var distributedActions = this._distributeAction();
        if (distributedActions) {
            for (var _i = 0, distributedActions_1 = distributedActions; _i < distributedActions_1.length; _i++) {
                var distributedAction = distributedActions_1[_i];
                simpleExpression = distributedAction.performOnSimple(simpleExpression);
            }
            return simpleExpression;
        }
        if (simpleExpression instanceof LiteralExpression) {
            if (this.fullyDefined()) {
                return new LiteralExpression({
                    value: this.getFn(simpleExpression.type, simpleExpression.getFn())(null, null)
                });
            }
            var special = this._performOnLiteral(simpleExpression);
            if (special)
                return special;
        }
        else if (simpleExpression instanceof RefExpression) {
            var special = this._performOnRef(simpleExpression);
            if (special)
                return special;
        }
        else if (simpleExpression instanceof ChainExpression) {
            var actions = simpleExpression.actions;
            var lastAction = actions[actions.length - 1];
            var foldedAction = this._foldWithPrevAction(lastAction);
            if (foldedAction) {
                return foldedAction.performOnSimple(simpleExpression.popAction());
            }
            var beforeAction = this._putBeforeLastAction(lastAction);
            if (beforeAction) {
                return lastAction.performOnSimple(beforeAction.performOnSimple(simpleExpression.popAction()));
            }
            var special = this._performOnSimpleChain(simpleExpression);
            if (special)
                return special;
        }
        return simpleExpression.performAction(this, true);
    };
    Action.prototype.getExpressions = function () {
        return this.expression ? [this.expression] : [];
    };
    Action.prototype.getFreeReferences = function () {
        var freeReferences = [];
        this.getExpressions().forEach(function (ex) {
            freeReferences = freeReferences.concat(ex.getFreeReferences());
        });
        return deduplicateSort(freeReferences);
    };
    Action.prototype._everyHelper = function (iter, thisArg, indexer, depth, nestDiff) {
        var nestDiffNext = nestDiff + Number(this.isNester());
        return this.getExpressions().every(function (ex) { return ex._everyHelper(iter, thisArg, indexer, depth, nestDiffNext); });
    };
    Action.prototype.substitute = function (substitutionFn, thisArg) {
        return this._substituteHelper(substitutionFn, thisArg, { index: 0 }, 0, 0);
    };
    Action.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var expression = this.expression;
        if (!expression)
            return this;
        var subExpression = expression._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiff + Number(this.isNester()));
        if (expression === subExpression)
            return this;
        var value = this.valueOf();
        value.simple = false;
        value.expression = subExpression;
        return Action.fromValue(value);
    };
    Action.prototype.canDistribute = function () {
        return false;
    };
    Action.prototype.distribute = function (preEx) {
        return null;
    };
    Action.prototype.changeExpression = function (newExpression) {
        var expression = this.expression;
        if (!expression || expression.equals(newExpression))
            return this;
        var value = this.valueOf();
        value.expression = newExpression;
        return Action.fromValue(value);
    };
    Action.prototype.isNester = function () {
        return false;
    };
    Action.prototype.getLiteralValue = function () {
        var expression = this.expression;
        if (expression instanceof LiteralExpression) {
            return expression.value;
        }
        return null;
    };
    Action.prototype.maxPossibleSplitValues = function () {
        return Infinity;
    };
    Action.prototype.getUpgradedType = function (type) {
        return this;
    };
    Action.prototype.needsEnvironment = function () {
        return false;
    };
    Action.prototype.defineEnvironment = function (environment) {
        return this;
    };
    Action.prototype.getTimezone = function () {
        return Timezone.UTC;
    };
    Action.prototype.alignsWith = function (actions) {
        return true;
    };
    Action.classMap = {};
    return Action;
}());
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var AbsoluteAction = exports.AbsoluteAction = (function (_super) {
    __extends(AbsoluteAction, _super);
    function AbsoluteAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("absolute");
        this._checkNoExpression();
    }
    AbsoluteAction.fromJS = function (parameters) {
        return new AbsoluteAction(Action.jsToValue(parameters));
    };
    AbsoluteAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    AbsoluteAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    AbsoluteAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    AbsoluteAction.prototype._getFnHelper = function (inputType, inputFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return Math.abs(inV);
        };
    };
    AbsoluteAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction.equals(this)) {
            return this;
        }
        return null;
    };
    AbsoluteAction.prototype._getJSHelper = function (inputType, inputJS) {
        return "Math.abs(" + inputJS + ")";
    };
    AbsoluteAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "ABS(" + inputSQL + ")";
    };
    return AbsoluteAction;
}(Action));
Action.register(AbsoluteAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var AddAction = exports.AddAction = (function (_super) {
    __extends(AddAction, _super);
    function AddAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("add");
        this._checkExpressionTypes('NUMBER');
    }
    AddAction.fromJS = function (parameters) {
        return new AddAction(Action.jsToValue(parameters));
    };
    AddAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    AddAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    AddAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    AddAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return (inputFn(d, c) || 0) + (expressionFn(d, c) || 0);
        };
    };
    AddAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "+" + expressionJS + ")";
    };
    AddAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "+" + expressionSQL + ")";
    };
    AddAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.ZERO);
    };
    AddAction.prototype._distributeAction = function () {
        return this.expression.actionize(this.action);
    };
    AddAction.prototype._performOnLiteral = function (literalExpression) {
        if (literalExpression.equals(Expression.ZERO)) {
            return this.expression;
        }
        return null;
    };
    AddAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof AddAction) {
            var prevValue = prevAction.expression.getLiteralValue();
            var myValue = this.expression.getLiteralValue();
            if (typeof prevValue === 'number' && typeof myValue === 'number') {
                return new AddAction({
                    expression: r(prevValue + myValue)
                });
            }
        }
        return null;
    };
    return AddAction;
}(Action));
Action.register(AddAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




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
var AndAction = exports.AndAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var ApplyAction = exports.ApplyAction = (function (_super) {
    __extends(ApplyAction, _super);
    function ApplyAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        this.name = parameters.name;
        this._ensureAction("apply");
    }
    ApplyAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.name = parameters.name;
        return new ApplyAction(value);
    };
    ApplyAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.name = this.name;
        return value;
    };
    ApplyAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.name = this.name;
        return js;
    };
    ApplyAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    ApplyAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    ApplyAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        typeContext.datasetType[this.name] = this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return typeContext;
    };
    ApplyAction.prototype._toStringParameters = function (expressionString) {
        var name = this.name;
        if (!RefExpression.SIMPLE_NAME_REGEXP.test(name))
            name = JSON.stringify(name);
        return [name, expressionString];
    };
    ApplyAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.name === other.name;
    };
    ApplyAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var name = this.name;
        var type = this.expression.type;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.apply(name, expressionFn, type, foldContext(d, c)) : null;
        };
    };
    ApplyAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return expressionSQL + " AS " + dialect.escapeName(this.name);
    };
    ApplyAction.prototype.isSimpleAggregate = function () {
        var expression = this.expression;
        if (expression instanceof ChainExpression) {
            var actions = expression.actions;
            return actions.length === 1 && actions[0].isAggregate();
        }
        return false;
    };
    ApplyAction.prototype.isNester = function () {
        return true;
    };
    ApplyAction.prototype._removeAction = function () {
        var _a = this, name = _a.name, expression = _a.expression;
        if (expression instanceof RefExpression) {
            return expression.name === name && expression.nest === 0;
        }
        return false;
    };
    ApplyAction.prototype._putBeforeLastAction = function (lastAction) {
        if (this.isSimpleAggregate() &&
            lastAction instanceof ApplyAction &&
            !lastAction.isSimpleAggregate() &&
            this.expression.getFreeReferences().indexOf(lastAction.name) === -1) {
            return this;
        }
        return null;
    };
    return ApplyAction;
}(Action));
Action.register(ApplyAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var AverageAction = exports.AverageAction = (function (_super) {
    __extends(AverageAction, _super);
    function AverageAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("average");
        this._checkExpressionTypes('NUMBER');
    }
    AverageAction.fromJS = function (parameters) {
        return new AverageAction(Action.jsToValue(parameters));
    };
    AverageAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    AverageAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    AverageAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    AverageAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "AVG(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    AverageAction.prototype.isAggregate = function () {
        return true;
    };
    AverageAction.prototype.isNester = function () {
        return true;
    };
    return AverageAction;
}(Action));
Action.register(AverageAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var CardinalityAction = exports.CardinalityAction = (function (_super) {
    __extends(CardinalityAction, _super);
    function CardinalityAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("cardinality");
        this._checkNoExpression();
    }
    CardinalityAction.fromJS = function (parameters) {
        return new CardinalityAction(Action.jsToValue(parameters));
    };
    CardinalityAction.prototype.getNecessaryInputTypes = function () {
        return getAllSetTypes();
    };
    CardinalityAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CardinalityAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    CardinalityAction.prototype._getFnHelper = function (inputType, inputFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            if (Array.isArray(inV))
                return inV.length;
            return inV.cardinality();
        };
    };
    CardinalityAction.prototype._getJSHelper = function (inputType, inputJS) {
        return Expression.jsNullSafetyUnary(inputJS, function (input) { return (input + ".length"); });
    };
    CardinalityAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "cardinality(" + inputSQL + ")";
    };
    return CardinalityAction;
}(Action));
Action.register(CardinalityAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var CAST_TYPE_TO_FN = {
    TIME: {
        NUMBER: function (n) { return new Date(n); }
    },
    NUMBER: {
        TIME: function (n) { return Date.parse(n.toString()); },
        UNIVERSAL: function (s) { return Number(s); }
    },
    STRING: {
        UNIVERSAL: function (v) { return '' + v; }
    }
};
var CAST_TYPE_TO_JS = {
    TIME: {
        NUMBER: function (inputJS) { return ("new Date(" + inputJS + ")"); }
    },
    NUMBER: {
        UNIVERSAL: function (s) { return ("+(" + s + ")"); }
    },
    STRING: {
        UNIVERSAL: function (inputJS) { return ("('' + " + inputJS + ")"); }
    }
};
var CastAction = exports.CastAction = (function (_super) {
    __extends(CastAction, _super);
    function CastAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.outputType = parameters.outputType;
        this._ensureAction("cast");
        if (typeof this.outputType !== 'string') {
            throw new Error("`outputType` must be a string");
        }
    }
    CastAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        var outputType = parameters.outputType;
        if (!outputType && hasOwnProperty(parameters, 'castType')) {
            outputType = parameters.castType;
        }
        value.outputType = outputType;
        return new CastAction(value);
    };
    CastAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.outputType = this.outputType;
        return value;
    };
    CastAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.outputType = this.outputType;
        return js;
    };
    CastAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.outputType === other.outputType;
    };
    CastAction.prototype._toStringParameters = function (expressionString) {
        return [this.outputType];
    };
    CastAction.prototype.getNecessaryInputTypes = function () {
        var castType = this.outputType;
        return Object.keys(CAST_TYPE_TO_FN[castType]);
    };
    CastAction.prototype.getOutputType = function (inputType) {
        return this.outputType;
    };
    CastAction.prototype._fillRefSubstitutions = function () {
        var outputType = this.outputType;
        return {
            type: outputType
        };
    };
    CastAction.prototype._removeAction = function (inputType) {
        return this.outputType === inputType;
    };
    CastAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction.equals(this)) {
            return this;
        }
        return null;
    };
    CastAction.prototype._getFnHelper = function (inputType, inputFn) {
        var outputType = this.outputType;
        var caster = CAST_TYPE_TO_FN[outputType];
        var castFn = caster[inputType] || caster['UNIVERSAL'];
        if (!castFn)
            throw new Error("unsupported cast from " + inputType + " to '" + outputType + "'");
        return function (d, c) {
            var inV = inputFn(d, c);
            if (!inV)
                return null;
            return castFn(inV);
        };
    };
    CastAction.prototype._getJSHelper = function (inputType, inputJS) {
        var outputType = this.outputType;
        var castJS = CAST_TYPE_TO_JS[outputType];
        if (!castJS)
            throw new Error("unsupported cast type in getJS '" + outputType + "'");
        var js = castJS[inputType] || castJS['UNIVERSAL'];
        if (!js)
            throw new Error("unsupported combo in getJS of cast action: " + inputType + " to " + outputType);
        return js(inputJS);
    };
    CastAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.castExpression(inputType, inputSQL, this.outputType);
    };
    return CastAction;
}(Action));
Action.register(CastAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var ConcatAction = exports.ConcatAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var ContainsAction = exports.ContainsAction = (function (_super) {
    __extends(ContainsAction, _super);
    function ContainsAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var compare = parameters.compare;
        if (!compare) {
            compare = ContainsAction.NORMAL;
        }
        else if (compare !== ContainsAction.NORMAL && compare !== ContainsAction.IGNORE_CASE) {
            throw new Error("compare must be '" + ContainsAction.NORMAL + "' or '" + ContainsAction.IGNORE_CASE + "'");
        }
        this.compare = compare;
        this._ensureAction("contains");
        this._checkExpressionTypes('STRING');
    }
    ContainsAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.compare = parameters.compare;
        return new ContainsAction(value);
    };
    ContainsAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.compare = this.compare;
        return value;
    };
    ContainsAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.compare = this.compare;
        return js;
    };
    ContainsAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.compare === other.compare;
    };
    ContainsAction.prototype._toStringParameters = function (expressionString) {
        return [expressionString, this.compare];
    };
    ContainsAction.prototype.getNecessaryInputTypes = function () {
        return ['STRING', 'SET/STRING'];
    };
    ContainsAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    ContainsAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    ContainsAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        if (this.compare === ContainsAction.NORMAL) {
            return function (d, c) {
                return String(inputFn(d, c)).indexOf(expressionFn(d, c)) > -1;
            };
        }
        else {
            return function (d, c) {
                return String(inputFn(d, c)).toLowerCase().indexOf(String(expressionFn(d, c)).toLowerCase()) > -1;
            };
        }
    };
    ContainsAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        var combine;
        if (this.compare === ContainsAction.NORMAL) {
            combine = function (lhs, rhs) { return ("(''+" + lhs + ").indexOf(" + rhs + ")>-1"); };
        }
        else {
            combine = function (lhs, rhs) { return ("(''+" + lhs + ").toLowerCase().indexOf((''+" + rhs + ").toLowerCase())>-1"); };
        }
        return Expression.jsNullSafetyBinary(inputJS, expressionJS, combine, inputJS[0] === '"', expressionJS[0] === '"');
    };
    ContainsAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        if (this.compare === ContainsAction.IGNORE_CASE) {
            expressionSQL = "LOWER(" + expressionSQL + ")";
            inputSQL = "LOWER(" + inputSQL + ")";
        }
        return dialect.containsExpression(expressionSQL, inputSQL);
    };
    ContainsAction.prototype._performOnSimpleChain = function (chainExpression) {
        var expression = this.expression;
        if (expression instanceof ChainExpression) {
            var precedingAction = chainExpression.lastAction();
            var succeedingAction = expression.lastAction();
            if (precedingAction instanceof TransformCaseAction && succeedingAction instanceof TransformCaseAction) {
                if (precedingAction.transformType === succeedingAction.transformType) {
                    var precedingExpression = chainExpression.expression;
                    return precedingExpression.contains(expression.expression, ContainsAction.IGNORE_CASE).simplify();
                }
            }
        }
        return null;
    };
    ContainsAction.NORMAL = 'normal';
    ContainsAction.IGNORE_CASE = 'ignoreCase';
    return ContainsAction;
}(Action));
Action.register(ContainsAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var CountAction = exports.CountAction = (function (_super) {
    __extends(CountAction, _super);
    function CountAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("count");
        this._checkNoExpression();
    }
    CountAction.fromJS = function (parameters) {
        return new CountAction(Action.jsToValue(parameters));
    };
    CountAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CountAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CountAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER'
        };
    };
    CountAction.prototype.getFn = function (inputType, inputFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.count() : 0;
        };
    };
    CountAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return inputSQL.indexOf(' WHERE ') === -1 ? "COUNT(*)" : "SUM(" + dialect.aggregateFilterIfNeeded(inputSQL, '1') + ")";
    };
    CountAction.prototype.isAggregate = function () {
        return true;
    };
    return CountAction;
}(Action));
Action.register(CountAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var CountDistinctAction = exports.CountDistinctAction = (function (_super) {
    __extends(CountDistinctAction, _super);
    function CountDistinctAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("countDistinct");
    }
    CountDistinctAction.fromJS = function (parameters) {
        return new CountDistinctAction(Action.jsToValue(parameters));
    };
    CountDistinctAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CountDistinctAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CountDistinctAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    CountDistinctAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "COUNT(DISTINCT " + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL, 'NULL') + ")";
    };
    CountDistinctAction.prototype.isAggregate = function () {
        return true;
    };
    CountDistinctAction.prototype.isNester = function () {
        return true;
    };
    return CountDistinctAction;
}(Action));
Action.register(CountDistinctAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var CustomAggregateAction = exports.CustomAggregateAction = (function (_super) {
    __extends(CustomAggregateAction, _super);
    function CustomAggregateAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.custom = parameters.custom;
        this._ensureAction("customAggregate");
    }
    CustomAggregateAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.custom = parameters.custom;
        if (value.action === 'custom')
            value.action = 'customAggregate';
        return new CustomAggregateAction(value);
    };
    CustomAggregateAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.custom = this.custom;
        return value;
    };
    CustomAggregateAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.custom = this.custom;
        return js;
    };
    CustomAggregateAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.custom === other.custom;
    };
    CustomAggregateAction.prototype._toStringParameters = function (expressionString) {
        return [this.custom];
    };
    CustomAggregateAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    CustomAggregateAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    CustomAggregateAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        return {
            type: 'NUMBER'
        };
    };
    CustomAggregateAction.prototype.getFn = function (inputType, inputFn) {
        throw new Error('can not getFn on custom action');
    };
    CustomAggregateAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('custom action not implemented');
    };
    CustomAggregateAction.prototype.isAggregate = function () {
        return true;
    };
    return CustomAggregateAction;
}(Action));
Action.register(CustomAggregateAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var CustomTransformAction = exports.CustomTransformAction = (function (_super) {
    __extends(CustomTransformAction, _super);
    function CustomTransformAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.custom = parameters.custom;
        if (parameters.outputType)
            this.outputType = parameters.outputType;
        this._ensureAction("customTransform");
    }
    CustomTransformAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.custom = parameters.custom;
        if (parameters.outputType)
            value.outputType = parameters.outputType;
        return new CustomTransformAction(value);
    };
    CustomTransformAction.prototype.getNecessaryInputTypes = function () {
        return ['NULL', 'BOOLEAN', 'NUMBER', 'TIME', 'STRING'];
    };
    CustomTransformAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.custom = this.custom;
        if (this.outputType)
            value.outputType = this.outputType;
        return value;
    };
    CustomTransformAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.custom = this.custom;
        if (this.outputType)
            js.outputType = this.outputType;
        return js;
    };
    CustomTransformAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.custom === other.custom &&
            this.outputType === other.outputType;
    };
    CustomTransformAction.prototype._toStringParameters = function (expressionString) {
        var param = [(this.custom + " }")];
        if (this.outputType)
            param.push(this.outputType);
        return param;
    };
    CustomTransformAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return this.outputType || inputType;
    };
    CustomTransformAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    CustomTransformAction.prototype.getFn = function (inputType, inputFn) {
        throw new Error('can not getFn on custom transform action');
    };
    CustomTransformAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error("Custom transform not supported in SQL");
    };
    CustomTransformAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("Custom transform can't yet be expressed as JS");
    };
    return CustomTransformAction;
}(Action));
Action.register(CustomTransformAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var DivideAction = exports.DivideAction = (function (_super) {
    __extends(DivideAction, _super);
    function DivideAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("divide");
        this._checkExpressionTypes('NUMBER');
    }
    DivideAction.fromJS = function (parameters) {
        return new DivideAction(Action.jsToValue(parameters));
    };
    DivideAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    DivideAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    DivideAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    DivideAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var v = (inputFn(d, c) || 0) / (expressionFn(d, c) || 0);
            return isNaN(v) ? null : v;
        };
    };
    DivideAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "/" + expressionJS + ")";
    };
    DivideAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "/" + expressionSQL + ")";
    };
    DivideAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.ONE);
    };
    return DivideAction;
}(Action));
Action.register(DivideAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var ExtractAction = exports.ExtractAction = (function (_super) {
    __extends(ExtractAction, _super);
    function ExtractAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.regexp = parameters.regexp;
        this._ensureAction("extract");
    }
    ExtractAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.regexp = parameters.regexp;
        return new ExtractAction(value);
    };
    ExtractAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.regexp = this.regexp;
        return value;
    };
    ExtractAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.regexp = this.regexp;
        return js;
    };
    ExtractAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.regexp === other.regexp;
    };
    ExtractAction.prototype._toStringParameters = function (expressionString) {
        return [this.regexp];
    };
    ExtractAction.prototype.getNecessaryInputTypes = function () {
        return this._stringTransformInputType;
    };
    ExtractAction.prototype.getOutputType = function (inputType) {
        return this._stringTransformOutputType(inputType);
    };
    ExtractAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        return inputType;
    };
    ExtractAction.prototype._getFnHelper = function (inputType, inputFn) {
        var re = new RegExp(this.regexp);
        return function (d, c) {
            return (String(inputFn(d, c)).match(re) || [])[1] || null;
        };
    };
    ExtractAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "((''+" + inputJS + ").match(/" + this.regexp + "/) || [])[1] || null";
    };
    ExtractAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.extractExpression(inputSQL, this.regexp);
    };
    return ExtractAction;
}(Action));
Action.register(ExtractAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var FallbackAction = exports.FallbackAction = (function (_super) {
    __extends(FallbackAction, _super);
    function FallbackAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        this._ensureAction("fallback");
    }
    FallbackAction.fromJS = function (parameters) {
        return new FallbackAction(Action.jsToValue(parameters));
    };
    FallbackAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    FallbackAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType && expressionType !== 'NULL')
            this._checkInputTypes(inputType);
        return expressionType;
    };
    FallbackAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    FallbackAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var val = inputFn(d, c);
            if (val === null) {
                return expressionFn(d, c);
            }
            return val;
        };
    };
    FallbackAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(_ = " + inputJS + ", (_ === null ? " + expressionJS + " : _))";
    };
    FallbackAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "COALESCE(" + inputSQL + ", " + expressionSQL + ")";
    };
    FallbackAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.NULL);
    };
    return FallbackAction;
}(Action));
Action.register(FallbackAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};






var FilterAction = exports.FilterAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var GreaterThanAction = exports.GreaterThanAction = (function (_super) {
    __extends(GreaterThanAction, _super);
    function GreaterThanAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("greaterThan");
        this._checkExpressionTypes('NUMBER', 'TIME', 'STRING');
    }
    GreaterThanAction.fromJS = function (parameters) {
        return new GreaterThanAction(Action.jsToValue(parameters));
    };
    GreaterThanAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    GreaterThanAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType)
            this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    GreaterThanAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    GreaterThanAction.prototype.getUpgradedType = function (type) {
        return this.changeExpression(this.expression.upgradeToType(type));
    };
    GreaterThanAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) > expressionFn(d, c);
        };
    };
    GreaterThanAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + ">" + expressionJS + ")";
    };
    GreaterThanAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + ">" + expressionSQL + ")";
    };
    GreaterThanAction.prototype._specialSimplify = function (simpleExpression) {
        if (simpleExpression instanceof LiteralExpression) {
            return new InAction({
                expression: new LiteralExpression({
                    value: Range.fromJS({ start: simpleExpression.value, end: null, bounds: '()' })
                })
            });
        }
        return null;
    };
    GreaterThanAction.prototype._performOnLiteral = function (literalExpression) {
        return (new InAction({
            expression: new LiteralExpression({
                value: Range.fromJS({ start: null, end: literalExpression.value, bounds: '()' })
            })
        })).performOnSimple(this.expression);
    };
    return GreaterThanAction;
}(Action));
Action.register(GreaterThanAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var GreaterThanOrEqualAction = exports.GreaterThanOrEqualAction = (function (_super) {
    __extends(GreaterThanOrEqualAction, _super);
    function GreaterThanOrEqualAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("greaterThanOrEqual");
        this._checkExpressionTypes('NUMBER', 'TIME', 'STRING');
    }
    GreaterThanOrEqualAction.fromJS = function (parameters) {
        return new GreaterThanOrEqualAction(Action.jsToValue(parameters));
    };
    GreaterThanOrEqualAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    GreaterThanOrEqualAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType)
            this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    GreaterThanOrEqualAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    GreaterThanOrEqualAction.prototype.getUpgradedType = function (type) {
        return this.changeExpression(this.expression.upgradeToType(type));
    };
    GreaterThanOrEqualAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) >= expressionFn(d, c);
        };
    };
    GreaterThanOrEqualAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + ">=" + expressionJS + ")";
    };
    GreaterThanOrEqualAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + ">=" + expressionSQL + ")";
    };
    GreaterThanOrEqualAction.prototype._specialSimplify = function (simpleExpression) {
        if (simpleExpression instanceof LiteralExpression) {
            return new InAction({
                expression: new LiteralExpression({
                    value: Range.fromJS({ start: simpleExpression.value, end: null, bounds: '[)' })
                })
            });
        }
        return null;
    };
    GreaterThanOrEqualAction.prototype._performOnLiteral = function (literalExpression) {
        return (new InAction({
            expression: new LiteralExpression({
                value: Range.fromJS({ start: null, end: literalExpression.value, bounds: '(]' })
            })
        })).performOnSimple(this.expression);
    };
    return GreaterThanOrEqualAction;
}(Action));
Action.register(GreaterThanOrEqualAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};







var InAction = exports.InAction = (function (_super) {
    __extends(InAction, _super);
    function InAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("in");
    }
    InAction.fromJS = function (parameters) {
        return new InAction(Action.jsToValue(parameters));
    };
    InAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    InAction.prototype.getOutputType = function (inputType) {
        var expression = this.expression;
        if (inputType) {
            if (!((!isSetType(inputType) && expression.canHaveType('SET')) ||
                (inputType === 'NUMBER' && expression.canHaveType('NUMBER_RANGE')) ||
                (inputType === 'STRING' && expression.canHaveType('STRING_RANGE')) ||
                (inputType === 'TIME' && expression.canHaveType('TIME_RANGE')))) {
                throw new TypeError("in action has a bad type combination " + inputType + " IN " + (expression.type || '*'));
            }
        }
        else {
            if (!(expression.canHaveType('NUMBER_RANGE') || expression.canHaveType('STRING_RANGE') || expression.canHaveType('TIME_RANGE') || expression.canHaveType('SET'))) {
                throw new TypeError("in action has invalid expression type " + expression.type);
            }
        }
        return 'BOOLEAN';
    };
    InAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    InAction.prototype.getUpgradedType = function (type) {
        return this.changeExpression(this.expression.upgradeToType(type));
    };
    InAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            var exV = expressionFn(d, c);
            if (!exV)
                return null;
            return exV.contains(inV);
        };
    };
    InAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        var expression = this.expression;
        if (expression instanceof LiteralExpression) {
            switch (expression.type) {
                case 'NUMBER_RANGE':
                case 'STRING_RANGE':
                case 'TIME_RANGE':
                    var range = expression.value;
                    var r0 = range.start;
                    var r1 = range.end;
                    var bounds = range.bounds;
                    var cmpStrings = [];
                    if (r0 != null) {
                        cmpStrings.push(JSON.stringify(r0) + " " + (bounds[0] === '(' ? '<' : '<=') + " _");
                    }
                    if (r1 != null) {
                        cmpStrings.push("_ " + (bounds[1] === ')' ? '<' : '<=') + " " + JSON.stringify(r1));
                    }
                    return "(_=" + inputJS + ", " + cmpStrings.join(' && ') + ")";
                case 'SET/STRING':
                    var valueSet = expression.value;
                    return JSON.stringify(valueSet.elements) + ".indexOf(" + inputJS + ")>-1";
                default:
                    throw new Error("can not convert " + this + " to JS function, unsupported type " + expression.type);
            }
        }
        throw new Error("can not convert " + this + " to JS function");
    };
    InAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        var expression = this.expression;
        var expressionType = expression.type;
        switch (expressionType) {
            case 'NUMBER_RANGE':
            case 'TIME_RANGE':
                if (expression instanceof LiteralExpression) {
                    var range = expression.value;
                    return dialect.inExpression(inputSQL, dialect.numberOrTimeToSQL(range.start), dialect.numberOrTimeToSQL(range.end), range.bounds);
                }
                throw new Error("can not convert action to SQL " + this);
            case 'STRING_RANGE':
                if (expression instanceof LiteralExpression) {
                    var stringRange = expression.value;
                    return dialect.inExpression(inputSQL, dialect.escapeLiteral(stringRange.start), dialect.escapeLiteral(stringRange.end), stringRange.bounds);
                }
                throw new Error("can not convert action to SQL " + this);
            case 'SET/STRING':
            case 'SET/NUMBER':
                return inputSQL + " IN " + expressionSQL;
            case 'SET/NUMBER_RANGE':
            case 'SET/TIME_RANGE':
                if (expression instanceof LiteralExpression) {
                    var setOfRange = expression.value;
                    return setOfRange.elements.map(function (range) {
                        return dialect.inExpression(inputSQL, dialect.numberOrTimeToSQL(range.start), dialect.numberOrTimeToSQL(range.end), range.bounds);
                    }).join(' OR ');
                }
                throw new Error("can not convert action to SQL " + this);
            default:
                throw new Error("can not convert action to SQL " + this);
        }
    };
    InAction.prototype._nukeExpression = function () {
        var expression = this.expression;
        if (expression instanceof LiteralExpression &&
            isSetType(expression.type) &&
            expression.value.empty())
            return Expression.FALSE;
        return null;
    };
    InAction.prototype._performOnSimpleWhatever = function (ex) {
        var expression = this.expression;
        var setValue = expression.getLiteralValue();
        if (setValue && 'SET/' + ex.type === expression.type && setValue.size() === 1) {
            return new IsAction({ expression: r(setValue.elements[0]) }).performOnSimple(ex);
        }
        if (ex instanceof ChainExpression) {
            var indexOfAction = ex.getSingleAction('indexOf');
            var range = expression.getLiteralValue();
            if (indexOfAction && ((range.start < 0 && range.end === null) || (range.start === 0 && range.end === null && range.bounds[0] === '['))) {
                return new ContainsAction({ expression: indexOfAction.expression }).performOnSimple(ex.expression);
            }
        }
        return null;
    };
    InAction.prototype._performOnLiteral = function (literalExpression) {
        return this._performOnSimpleWhatever(literalExpression);
    };
    InAction.prototype._performOnRef = function (refExpression) {
        return this._performOnSimpleWhatever(refExpression);
    };
    InAction.prototype._performOnSimpleChain = function (chainExpression) {
        return this._performOnSimpleWhatever(chainExpression);
    };
    return InAction;
}(Action));
Action.register(InAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};









var IsAction = exports.IsAction = (function (_super) {
    __extends(IsAction, _super);
    function IsAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("is");
    }
    IsAction.fromJS = function (parameters) {
        return new IsAction(Action.jsToValue(parameters));
    };
    IsAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    IsAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType && expressionType !== 'NULL')
            this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    IsAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    IsAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) === expressionFn(d, c);
        };
    };
    IsAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "===" + expressionJS + ")";
    };
    IsAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.isNotDistinctFromExpression(inputSQL, expressionSQL);
    };
    IsAction.prototype._nukeExpression = function (precedingExpression) {
        var prevAction = precedingExpression.lastAction();
        var literalValue = this.getLiteralValue();
        if (prevAction instanceof TimeBucketAction && literalValue instanceof TimeRange && prevAction.timezone) {
            if (literalValue.start !== null && TimeRange.timeBucket(literalValue.start, prevAction.duration, prevAction.timezone).equals(literalValue))
                return null;
            return Expression.FALSE;
        }
        if (prevAction instanceof NumberBucketAction && literalValue instanceof NumberRange) {
            if (literalValue.start !== null && NumberRange.numberBucket(literalValue.start, prevAction.size, prevAction.offset).equals(literalValue))
                return null;
            return Expression.FALSE;
        }
        return null;
    };
    IsAction.prototype._foldWithPrevAction = function (prevAction) {
        var literalValue = this.getLiteralValue();
        if (prevAction instanceof TimeBucketAction && literalValue instanceof TimeRange && prevAction.timezone) {
            if (!(literalValue.start !== null && TimeRange.timeBucket(literalValue.start, prevAction.duration, prevAction.timezone).equals(literalValue)))
                return null;
            return new InAction({ expression: this.expression });
        }
        if (prevAction instanceof NumberBucketAction && literalValue instanceof NumberRange) {
            if (!(literalValue.start !== null && NumberRange.numberBucket(literalValue.start, prevAction.size, prevAction.offset).equals(literalValue)))
                return null;
            return new InAction({ expression: this.expression });
        }
        if (prevAction instanceof FallbackAction && prevAction.expression.isOp('literal') && this.expression.isOp('literal') && !prevAction.expression.equals(this.expression)) {
            return this;
        }
        return null;
    };
    IsAction.prototype._performOnLiteral = function (literalExpression) {
        var expression = this.expression;
        if (!expression.isOp('literal')) {
            return new IsAction({ expression: literalExpression }).performOnSimple(expression);
        }
        return null;
    };
    IsAction.prototype._performOnRef = function (refExpression) {
        if (this.expression.equals(refExpression)) {
            return Expression.TRUE;
        }
        return null;
    };
    IsAction.prototype._performOnSimpleChain = function (chainExpression) {
        if (this.expression.equals(chainExpression)) {
            return Expression.TRUE;
        }
        var prevAction = chainExpression.lastAction();
        var literalValue = this.getLiteralValue();
        if (prevAction instanceof IndexOfAction && literalValue === -1) {
            var precedingExpression = chainExpression.expression;
            var actionExpression = prevAction.expression;
            return precedingExpression.contains(actionExpression).not().simplify();
        }
        return null;
    };
    return IsAction;
}(Action));
Action.register(IsAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var JoinAction = exports.JoinAction = (function (_super) {
    __extends(JoinAction, _super);
    function JoinAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("join");
        if (!this.expression.canHaveType('DATASET'))
            throw new TypeError('expression must be a DATASET');
    }
    JoinAction.fromJS = function (parameters) {
        return new JoinAction(Action.jsToValue(parameters));
    };
    JoinAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    JoinAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    JoinAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        var typeContextParent = typeContext.parent;
        var expressionFullType = this.expression._fillRefSubstitutions(typeContextParent, indexer, alterations);
        var inputDatasetType = typeContext.datasetType;
        var expressionDatasetType = expressionFullType.datasetType;
        var newDatasetType = Object.create(null);
        for (var k in inputDatasetType) {
            newDatasetType[k] = inputDatasetType[k];
        }
        for (var k in expressionDatasetType) {
            var ft = expressionDatasetType[k];
            if (hasOwnProperty(newDatasetType, k)) {
                if (newDatasetType[k].type !== ft.type) {
                    throw new Error("incompatible types of joins on " + k + " between " + newDatasetType[k].type + " and " + ft.type);
                }
            }
            else {
                newDatasetType[k] = ft;
            }
        }
        return {
            parent: typeContextParent,
            type: 'DATASET',
            datasetType: newDatasetType,
            remote: typeContext.remote || expressionFullType.remote
        };
    };
    JoinAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.join(expressionFn(d, c)) : inV;
        };
    };
    JoinAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('not possible');
    };
    return JoinAction;
}(Action));
Action.register(JoinAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var LengthAction = exports.LengthAction = (function (_super) {
    __extends(LengthAction, _super);
    function LengthAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("length");
        this._checkNoExpression();
    }
    LengthAction.fromJS = function (parameters) {
        return new LengthAction(Action.jsToValue(parameters));
    };
    LengthAction.prototype.getNecessaryInputTypes = function () {
        return 'STRING';
    };
    LengthAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    LengthAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    LengthAction.prototype._getFnHelper = function (inputType, inputFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return inV.length;
        };
    };
    LengthAction.prototype._getJSHelper = function (inputType, inputJS) {
        return Expression.jsNullSafetyUnary(inputJS, function (input) { return (input + ".length"); });
    };
    LengthAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.lengthExpression(inputSQL);
    };
    return LengthAction;
}(Action));
Action.register(LengthAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var LessThanAction = exports.LessThanAction = (function (_super) {
    __extends(LessThanAction, _super);
    function LessThanAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("lessThan");
        this._checkExpressionTypes('NUMBER', 'TIME', 'STRING');
    }
    LessThanAction.fromJS = function (parameters) {
        return new LessThanAction(Action.jsToValue(parameters));
    };
    LessThanAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    LessThanAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType)
            this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    LessThanAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    LessThanAction.prototype.getUpgradedType = function (type) {
        return this.changeExpression(this.expression.upgradeToType(type));
    };
    LessThanAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) < expressionFn(d, c);
        };
    };
    LessThanAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "<" + expressionJS + ")";
    };
    LessThanAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "<" + expressionSQL + ")";
    };
    LessThanAction.prototype._specialSimplify = function (simpleExpression) {
        if (simpleExpression instanceof LiteralExpression) {
            return new InAction({
                expression: new LiteralExpression({
                    value: Range.fromJS({ start: null, end: simpleExpression.value, bounds: '()' })
                })
            });
        }
        return null;
    };
    LessThanAction.prototype._performOnLiteral = function (literalExpression) {
        return (new InAction({
            expression: new LiteralExpression({
                value: Range.fromJS({ start: literalExpression.value, end: null, bounds: '()' })
            })
        })).performOnSimple(this.expression);
    };
    return LessThanAction;
}(Action));
Action.register(LessThanAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var LessThanOrEqualAction = exports.LessThanOrEqualAction = (function (_super) {
    __extends(LessThanOrEqualAction, _super);
    function LessThanOrEqualAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("lessThanOrEqual");
        this._checkExpressionTypes('NUMBER', 'TIME', 'STRING');
    }
    LessThanOrEqualAction.fromJS = function (parameters) {
        return new LessThanOrEqualAction(Action.jsToValue(parameters));
    };
    LessThanOrEqualAction.prototype.getNecessaryInputTypes = function () {
        return this.expression.type;
    };
    LessThanOrEqualAction.prototype.getOutputType = function (inputType) {
        var expressionType = this.expression.type;
        if (expressionType)
            this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    LessThanOrEqualAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    LessThanOrEqualAction.prototype.getUpgradedType = function (type) {
        return this.changeExpression(this.expression.upgradeToType(type));
    };
    LessThanOrEqualAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return inputFn(d, c) <= expressionFn(d, c);
        };
    };
    LessThanOrEqualAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "<=" + expressionJS + ")";
    };
    LessThanOrEqualAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "<=" + expressionSQL + ")";
    };
    LessThanOrEqualAction.prototype._specialSimplify = function (simpleExpression) {
        if (simpleExpression instanceof LiteralExpression) {
            return new InAction({
                expression: new LiteralExpression({
                    value: Range.fromJS({ start: null, end: simpleExpression.value, bounds: '(]' })
                })
            });
        }
        return null;
    };
    LessThanOrEqualAction.prototype._performOnLiteral = function (literalExpression) {
        return (new InAction({
            expression: new LiteralExpression({
                value: Range.fromJS({ start: literalExpression.value, end: null, bounds: '[)' })
            })
        })).performOnSimple(this.expression);
    };
    return LessThanOrEqualAction;
}(Action));
Action.register(LessThanOrEqualAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var IndexOfAction = exports.IndexOfAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var LookupAction = exports.LookupAction = (function (_super) {
    __extends(LookupAction, _super);
    function LookupAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.lookup = parameters.lookup;
        this._ensureAction("lookup");
    }
    LookupAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.lookup = parameters.lookup;
        return new LookupAction(value);
    };
    LookupAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.lookup = this.lookup;
        return value;
    };
    LookupAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.lookup = this.lookup;
        return js;
    };
    LookupAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.lookup === other.lookup;
    };
    LookupAction.prototype._toStringParameters = function (expressionString) {
        return [String(this.lookup)];
    };
    LookupAction.prototype.getNecessaryInputTypes = function () {
        return this._stringTransformInputType;
    };
    LookupAction.prototype.getOutputType = function (inputType) {
        return this._stringTransformOutputType(inputType);
    };
    LookupAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    LookupAction.prototype.fullyDefined = function () {
        return false;
    };
    LookupAction.prototype._getFnHelper = function (inputType, inputFn) {
        throw new Error('can not express as JS');
    };
    LookupAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error('can not express as JS');
    };
    LookupAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('can not express as SQL');
    };
    return LookupAction;
}(Action));
Action.register(LookupAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var LimitAction = exports.LimitAction = (function (_super) {
    __extends(LimitAction, _super);
    function LimitAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        this.limit = parameters.limit;
        this._ensureAction("limit");
    }
    LimitAction.fromJS = function (parameters) {
        return new LimitAction({
            action: parameters.action,
            limit: parameters.limit
        });
    };
    LimitAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.limit = this.limit;
        return value;
    };
    LimitAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.limit = this.limit;
        return js;
    };
    LimitAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.limit === other.limit;
    };
    LimitAction.prototype._toStringParameters = function (expressionString) {
        return [String(this.limit)];
    };
    LimitAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    LimitAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    LimitAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        return inputType;
    };
    LimitAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var limit = this.limit;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.limit(limit) : null;
        };
    };
    LimitAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "LIMIT " + this.limit;
    };
    LimitAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof LimitAction) {
            return new LimitAction({
                limit: Math.min(prevAction.limit, this.limit)
            });
        }
        return null;
    };
    LimitAction.prototype._putBeforeLastAction = function (lastAction) {
        if (lastAction instanceof ApplyAction) {
            return this;
        }
        return null;
    };
    return LimitAction;
}(Action));
Action.register(LimitAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var REGEXP_SPECIAL = "\\^$.|?*+()[{";

var MatchAction = exports.MatchAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var MaxAction = exports.MaxAction = (function (_super) {
    __extends(MaxAction, _super);
    function MaxAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("max");
        this._checkExpressionTypes('NUMBER', 'TIME');
    }
    MaxAction.fromJS = function (parameters) {
        return new MaxAction(Action.jsToValue(parameters));
    };
    MaxAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    MaxAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    MaxAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    MaxAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "MAX(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    MaxAction.prototype.isAggregate = function () {
        return true;
    };
    MaxAction.prototype.isNester = function () {
        return true;
    };
    return MaxAction;
}(Action));
Action.register(MaxAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var MinAction = exports.MinAction = (function (_super) {
    __extends(MinAction, _super);
    function MinAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("min");
        this._checkExpressionTypes('NUMBER', 'TIME');
    }
    MinAction.fromJS = function (parameters) {
        return new MinAction(Action.jsToValue(parameters));
    };
    MinAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    MinAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    MinAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    MinAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "MIN(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    MinAction.prototype.isAggregate = function () {
        return true;
    };
    MinAction.prototype.isNester = function () {
        return true;
    };
    return MinAction;
}(Action));
Action.register(MinAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var MultiplyAction = exports.MultiplyAction = (function (_super) {
    __extends(MultiplyAction, _super);
    function MultiplyAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("multiply");
        this._checkExpressionTypes('NUMBER');
    }
    MultiplyAction.fromJS = function (parameters) {
        return new MultiplyAction(Action.jsToValue(parameters));
    };
    MultiplyAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    MultiplyAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    MultiplyAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    MultiplyAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return (inputFn(d, c) || 0) * (expressionFn(d, c) || 0);
        };
    };
    MultiplyAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "*" + expressionJS + ")";
    };
    MultiplyAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "*" + expressionSQL + ")";
    };
    MultiplyAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.ONE);
    };
    MultiplyAction.prototype._nukeExpression = function () {
        if (this.expression.equals(Expression.ZERO))
            return Expression.ZERO;
        return null;
    };
    MultiplyAction.prototype._distributeAction = function () {
        return this.expression.actionize(this.action);
    };
    MultiplyAction.prototype._performOnLiteral = function (literalExpression) {
        if (literalExpression.equals(Expression.ONE)) {
            return this.expression;
        }
        else if (literalExpression.equals(Expression.ZERO)) {
            return Expression.ZERO;
        }
        return null;
    };
    return MultiplyAction;
}(Action));
Action.register(MultiplyAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var NotAction = exports.NotAction = (function (_super) {
    __extends(NotAction, _super);
    function NotAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("not");
        this._checkNoExpression();
    }
    NotAction.fromJS = function (parameters) {
        return new NotAction(Action.jsToValue(parameters));
    };
    NotAction.prototype.getNecessaryInputTypes = function () {
        return 'BOOLEAN';
    };
    NotAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    NotAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    NotAction.prototype._getFnHelper = function (inputType, inputFn) {
        return function (d, c) {
            return !inputFn(d, c);
        };
    };
    NotAction.prototype._getJSHelper = function (inputType, inputJS) {
        return "!(" + inputJS + ")";
    };
    NotAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "NOT(" + inputSQL + ")";
    };
    NotAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof NotAction) {
            return new AndAction({ expression: Expression.TRUE });
        }
        return null;
    };
    return NotAction;
}(Action));
Action.register(NotAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var NumberBucketAction = exports.NumberBucketAction = (function (_super) {
    __extends(NumberBucketAction, _super);
    function NumberBucketAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.size = parameters.size;
        this.offset = parameters.offset;
        this._ensureAction("numberBucket");
    }
    NumberBucketAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.size = parameters.size;
        value.offset = hasOwnProperty(parameters, 'offset') ? parameters.offset : 0;
        return new NumberBucketAction(value);
    };
    NumberBucketAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.size = this.size;
        value.offset = this.offset;
        return value;
    };
    NumberBucketAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.size = this.size;
        if (this.offset)
            js.offset = this.offset;
        return js;
    };
    NumberBucketAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.size === other.size &&
            this.offset === other.offset;
    };
    NumberBucketAction.prototype._toStringParameters = function (expressionString) {
        var params = [String(this.size)];
        if (this.offset)
            params.push(String(this.offset));
        return params;
    };
    NumberBucketAction.prototype.getNecessaryInputTypes = function () {
        return ['NUMBER', 'NUMBER_RANGE'];
    };
    NumberBucketAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER_RANGE';
    };
    NumberBucketAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER_RANGE'
        };
    };
    NumberBucketAction.prototype._getFnHelper = function (inputType, inputFn) {
        var size = this.size;
        var offset = this.offset;
        return function (d, c) {
            var num = inputFn(d, c);
            if (num === null)
                return null;
            return NumberRange.numberBucket(num, size, offset);
        };
    };
    NumberBucketAction.prototype._getJSHelper = function (inputType, inputJS) {
        var _this = this;
        return Expression.jsNullSafetyUnary(inputJS, function (n) { return continuousFloorExpression(n, "Math.floor", _this.size, _this.offset); });
    };
    NumberBucketAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return continuousFloorExpression(inputSQL, "FLOOR", this.size, this.offset);
    };
    return NumberBucketAction;
}(Action));
Action.register(NumberBucketAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




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
var OrAction = exports.OrAction = (function (_super) {
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
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};





var OverlapAction = exports.OverlapAction = (function (_super) {
    __extends(OverlapAction, _super);
    function OverlapAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("overlap");
        if (!this.expression.canHaveType('SET')) {
            throw new Error(this.action + " must have an expression of type SET (is: " + this.expression.type + ")");
        }
    }
    OverlapAction.fromJS = function (parameters) {
        return new OverlapAction(Action.jsToValue(parameters));
    };
    OverlapAction.prototype.getNecessaryInputTypes = function () {
        var expressionType = this.expression.type;
        if (expressionType && expressionType !== 'NULL' && expressionType !== 'SET/NULL') {
            var setExpressionType = wrapSetType(expressionType);
            var unwrapped = unwrapSetType(setExpressionType);
            return [setExpressionType, unwrapped];
        }
        else {
            return [
                'NULL', 'BOOLEAN', 'NUMBER', 'TIME', 'STRING', 'NUMBER_RANGE', 'TIME_RANGE', 'STRING_RANGE',
                'SET', 'SET/NULL', 'SET/BOOLEAN', 'SET/NUMBER', 'SET/TIME', 'SET/STRING',
                'SET/NUMBER_RANGE', 'SET/TIME_RANGE', 'DATASET'
            ];
        }
    };
    OverlapAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'BOOLEAN';
    };
    OverlapAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'BOOLEAN'
        };
    };
    OverlapAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            var inV = inputFn(d, c);
            var exV = expressionFn(d, c);
            if (exV == null)
                return null;
            return Set.isSet(inV) ? inV.overlap(exV) : exV.contains(inV);
        };
    };
    OverlapAction.prototype._nukeExpression = function () {
        if (this.expression.equals(Expression.EMPTY_SET))
            return Expression.FALSE;
        return null;
    };
    OverlapAction.prototype._performOnSimpleWhatever = function (ex) {
        var expression = this.expression;
        if ('SET/' + ex.type === expression.type) {
            return new InAction({ expression: expression }).performOnSimple(ex);
        }
        return null;
    };
    OverlapAction.prototype._performOnLiteral = function (literalExpression) {
        var expression = this.expression;
        if (!expression.isOp('literal'))
            return new OverlapAction({ expression: literalExpression }).performOnSimple(expression);
        return this._performOnSimpleWhatever(literalExpression);
    };
    OverlapAction.prototype._performOnRef = function (refExpression) {
        return this._performOnSimpleWhatever(refExpression);
    };
    OverlapAction.prototype._performOnSimpleChain = function (chainExpression) {
        return this._performOnSimpleWhatever(chainExpression);
    };
    return OverlapAction;
}(Action));
Action.register(OverlapAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var PowerAction = exports.PowerAction = (function (_super) {
    __extends(PowerAction, _super);
    function PowerAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("power");
        this._checkExpressionTypes('NUMBER');
    }
    PowerAction.fromJS = function (parameters) {
        return new PowerAction(Action.jsToValue(parameters));
    };
    PowerAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    PowerAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    PowerAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    PowerAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return Math.pow((inputFn(d, c) || 0), (expressionFn(d, c) || 0));
        };
    };
    PowerAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "Math.pow(" + inputJS + "," + expressionJS + ")";
    };
    PowerAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "POW(" + inputSQL + "," + expressionSQL + ")";
    };
    PowerAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.ONE);
    };
    PowerAction.prototype._performOnRef = function (simpleExpression) {
        if (this.expression.equals(Expression.ZERO))
            return simpleExpression;
        return null;
    };
    return PowerAction;
}(Action));
Action.register(PowerAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var QuantileAction = exports.QuantileAction = (function (_super) {
    __extends(QuantileAction, _super);
    function QuantileAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.quantile = parameters.quantile;
        this._ensureAction("quantile");
        this._checkExpressionTypes('NUMBER');
    }
    QuantileAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.quantile = parameters.quantile;
        return new QuantileAction(value);
    };
    QuantileAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.quantile = this.quantile;
        return value;
    };
    QuantileAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.quantile = this.quantile;
        return js;
    };
    QuantileAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.quantile === other.quantile;
    };
    QuantileAction.prototype._toStringParameters = function (expressionString) {
        return [expressionString, String(this.quantile)];
    };
    QuantileAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    QuantileAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    QuantileAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    QuantileAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var quantile = this.quantile;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.quantile(expressionFn, quantile, foldContext(d, c)) : null;
        };
    };
    QuantileAction.prototype.isAggregate = function () {
        return true;
    };
    QuantileAction.prototype.isNester = function () {
        return true;
    };
    return QuantileAction;
}(Action));
Action.register(QuantileAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var SelectAction = exports.SelectAction = (function (_super) {
    __extends(SelectAction, _super);
    function SelectAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        this.attributes = parameters.attributes;
        this._ensureAction("select");
    }
    SelectAction.fromJS = function (parameters) {
        return new SelectAction({
            action: parameters.action,
            attributes: parameters.attributes
        });
    };
    SelectAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.attributes = this.attributes;
        return value;
    };
    SelectAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.attributes = this.attributes;
        return js;
    };
    SelectAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            String(this.attributes) === String(other.attributes);
    };
    SelectAction.prototype._toStringParameters = function (expressionString) {
        return this.attributes;
    };
    SelectAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    SelectAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    SelectAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        var attributes = this.attributes;
        var datasetType = typeContext.datasetType;
        var newDatasetType = Object.create(null);
        for (var _i = 0, attributes_1 = attributes; _i < attributes_1.length; _i++) {
            var attr = attributes_1[_i];
            var attrType = datasetType[attr];
            if (!attrType)
                throw new Error("unknown attribute '" + attr + "' in select");
            newDatasetType[attr] = attrType;
        }
        typeContext.datasetType = newDatasetType;
        return typeContext;
    };
    SelectAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var attributes = this.attributes;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.select(attributes) : null;
        };
    };
    SelectAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error('can not be expressed as SQL directly');
    };
    SelectAction.prototype._foldWithPrevAction = function (prevAction) {
        var attributes = this.attributes;
        if (prevAction instanceof SelectAction) {
            return new SelectAction({
                attributes: prevAction.attributes.filter(function (a) { return attributes.indexOf(a) !== -1; })
            });
        }
        else if (prevAction instanceof ApplyAction) {
            if (attributes.indexOf(prevAction.name) === -1) {
                return this;
            }
        }
        return null;
    };
    return SelectAction;
}(Action));
Action.register(SelectAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var SortAction = exports.SortAction = (function (_super) {
    __extends(SortAction, _super);
    function SortAction(parameters) {
        if (parameters === void 0) { parameters = {}; }
        _super.call(this, parameters, dummyObject);
        var direction = parameters.direction || 'ascending';
        if (direction !== SortAction.DESCENDING && direction !== SortAction.ASCENDING) {
            throw new Error("direction must be '" + SortAction.DESCENDING + "' or '" + SortAction.ASCENDING + "'");
        }
        this.direction = direction;
        if (!this.expression.isOp('ref')) {
            throw new Error("must be a reference expression: " + this.expression);
        }
        this._ensureAction("sort");
    }
    SortAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.direction = parameters.direction;
        return new SortAction(value);
    };
    SortAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.direction = this.direction;
        return value;
    };
    SortAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.direction = this.direction;
        return js;
    };
    SortAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.direction === other.direction;
    };
    SortAction.prototype._toStringParameters = function (expressionString) {
        return [expressionString, this.direction];
    };
    SortAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    SortAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    SortAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return typeContext;
    };
    SortAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        var direction = this.direction;
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.sort(expressionFn, direction) : null;
        };
    };
    SortAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        var dir = this.direction === SortAction.DESCENDING ? 'DESC' : 'ASC';
        return "ORDER BY " + expressionSQL + " " + dir;
    };
    SortAction.prototype.refName = function () {
        var expression = this.expression;
        return (expression instanceof RefExpression) ? expression.name : null;
    };
    SortAction.prototype.isNester = function () {
        return true;
    };
    SortAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof SortAction && this.expression.equals(prevAction.expression)) {
            return this;
        }
        return null;
    };
    SortAction.prototype.toggleDirection = function () {
        return new SortAction({
            expression: this.expression,
            direction: this.direction === SortAction.ASCENDING ? SortAction.DESCENDING : SortAction.ASCENDING
        });
    };
    SortAction.DESCENDING = 'descending';
    SortAction.ASCENDING = 'ascending';
    return SortAction;
}(Action));
Action.register(SortAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};






var SplitAction = exports.SplitAction = (function (_super) {
    __extends(SplitAction, _super);
    function SplitAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var splits = parameters.splits;
        if (!splits)
            throw new Error('must have splits');
        this.splits = splits;
        this.keys = Object.keys(splits).sort();
        if (!this.keys.length)
            throw new Error('must have at least one split');
        this.dataName = parameters.dataName;
        this._ensureAction("split");
    }
    SplitAction.fromJS = function (parameters) {
        var value = {
            action: parameters.action
        };
        var splits;
        if (parameters.expression && parameters.name) {
            splits = (_a = {}, _a[parameters.name] = parameters.expression, _a);
        }
        else {
            splits = parameters.splits;
        }
        value.splits = Expression.expressionLookupFromJS(splits);
        value.dataName = parameters.dataName;
        return new SplitAction(value);
        var _a;
    };
    SplitAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.splits = this.splits;
        value.dataName = this.dataName;
        return value;
    };
    SplitAction.prototype.toJS = function () {
        var splits = this.splits;
        var js = _super.prototype.toJS.call(this);
        if (this.isMultiSplit()) {
            js.splits = Expression.expressionLookupToJS(splits);
        }
        else {
            for (var name in splits) {
                js.name = name;
                js.expression = splits[name].toJS();
            }
        }
        js.dataName = this.dataName;
        return js;
    };
    SplitAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            immutableLookupsEqual(this.splits, other.splits) &&
            this.dataName === other.dataName;
    };
    SplitAction.prototype._toStringParameters = function (expressionString) {
        if (this.isMultiSplit()) {
            var splits = this.splits;
            var splitStrings = [];
            for (var name in splits) {
                splitStrings.push(name + ": " + splits[name]);
            }
            return [splitStrings.join(', '), this.dataName];
        }
        else {
            return [this.firstSplitExpression().toString(), this.firstSplitName(), this.dataName];
        }
    };
    SplitAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    SplitAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'DATASET';
    };
    SplitAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        var newDatasetType = {};
        this.mapSplits(function (name, expression) {
            var fullType = expression._fillRefSubstitutions(typeContext, indexer, alterations);
            newDatasetType[name] = {
                type: unwrapSetType(fullType.type)
            };
        });
        newDatasetType[this.dataName] = typeContext;
        return {
            parent: typeContext.parent,
            type: 'DATASET',
            datasetType: newDatasetType,
            remote: false
        };
    };
    SplitAction.prototype.getFn = function (inputType, inputFn) {
        var dataName = this.dataName;
        var splitFns = this.mapSplitExpressions(function (ex) { return ex.getFn(); });
        return function (d, c) {
            var inV = inputFn(d, c);
            return inV ? inV.split(splitFns, dataName) : null;
        };
    };
    SplitAction.prototype.getSQL = function (inputType, inputSQL, dialect) {
        var groupBys = this.mapSplits(function (name, expression) { return expression.getSQL(dialect); });
        return "GROUP BY " + groupBys.join(', ');
    };
    SplitAction.prototype.getSelectSQL = function (dialect) {
        return this.mapSplits(function (name, expression) { return (expression.getSQL(dialect) + " AS " + dialect.escapeName(name)); });
    };
    SplitAction.prototype.getShortGroupBySQL = function () {
        return 'GROUP BY ' + Object.keys(this.splits).map(function (d, i) { return i + 1; }).join(', ');
    };
    SplitAction.prototype.expressionCount = function () {
        var count = 0;
        this.mapSplits(function (k, expression) {
            count += expression.expressionCount();
        });
        return count;
    };
    SplitAction.prototype.fullyDefined = function () {
        return false;
    };
    SplitAction.prototype.simplify = function () {
        if (this.simple)
            return this;
        var simpleSplits = this.mapSplitExpressions(function (ex) { return ex.simplify(); });
        var value = this.valueOf();
        value.splits = simpleSplits;
        value.simple = true;
        return new SplitAction(value);
    };
    SplitAction.prototype.getExpressions = function () {
        return this.mapSplits(function (name, ex) { return ex; });
    };
    SplitAction.prototype._substituteHelper = function (substitutionFn, thisArg, indexer, depth, nestDiff) {
        var nestDiffNext = nestDiff + 1;
        var hasChanged = false;
        var subSplits = this.mapSplitExpressions(function (ex) {
            var subExpression = ex._substituteHelper(substitutionFn, thisArg, indexer, depth, nestDiffNext);
            if (subExpression !== ex)
                hasChanged = true;
            return subExpression;
        });
        if (!hasChanged)
            return this;
        var value = this.valueOf();
        value.splits = subSplits;
        return new SplitAction(value);
    };
    SplitAction.prototype.isNester = function () {
        return true;
    };
    SplitAction.prototype.numSplits = function () {
        return this.keys.length;
    };
    SplitAction.prototype.isMultiSplit = function () {
        return this.numSplits() > 1;
    };
    SplitAction.prototype.mapSplits = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var res = [];
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            var v = fn(k, splits[k]);
            if (typeof v !== 'undefined')
                res.push(v);
        }
        return res;
    };
    SplitAction.prototype.mapSplitExpressions = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var ret = Object.create(null);
        for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
            var key = keys_2[_i];
            ret[key] = fn(splits[key], key);
        }
        return ret;
    };
    SplitAction.prototype.transformExpressions = function (fn) {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var newSplits = Object.create(null);
        var changed = false;
        for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
            var key = keys_3[_i];
            var ex = splits[key];
            var transformed = fn(ex, key);
            if (transformed !== ex)
                changed = true;
            newSplits[key] = transformed;
        }
        if (!changed)
            return this;
        var value = this.valueOf();
        value.splits = newSplits;
        return new SplitAction(value);
    };
    SplitAction.prototype.firstSplitName = function () {
        return this.keys[0];
    };
    SplitAction.prototype.firstSplitExpression = function () {
        return this.splits[this.firstSplitName()];
    };
    SplitAction.prototype.filterFromDatum = function (datum) {
        return Expression.and(this.mapSplits(function (name, expression) {
            if (isSetType(expression.type)) {
                return r(datum[name]).in(expression);
            }
            else {
                return expression.is(r(datum[name]));
            }
        })).simplify();
    };
    SplitAction.prototype.hasKey = function (key) {
        return hasOwnProperty(this.splits, key);
    };
    SplitAction.prototype.isLinear = function () {
        var _a = this, splits = _a.splits, keys = _a.keys;
        for (var _i = 0, keys_4 = keys; _i < keys_4.length; _i++) {
            var k = keys_4[_i];
            var split = splits[k];
            if (isSetType(split.type))
                return false;
        }
        return true;
    };
    SplitAction.prototype.maxBucketNumber = function () {
        var _a = this, splits = _a.splits, keys = _a.keys;
        var num = 1;
        for (var _i = 0, keys_5 = keys; _i < keys_5.length; _i++) {
            var key = keys_5[_i];
            num *= splits[key].maxPossibleSplitValues();
        }
        return num;
    };
    SplitAction.prototype.isAggregate = function () {
        return true;
    };
    return SplitAction;
}(Action));
Action.register(SplitAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var SubstrAction = exports.SubstrAction = (function (_super) {
    __extends(SubstrAction, _super);
    function SubstrAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.position = parameters.position;
        this.length = parameters.length;
        this._ensureAction("substr");
    }
    SubstrAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.position = parameters.position;
        value.length = parameters.length;
        return new SubstrAction(value);
    };
    SubstrAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.position = this.position;
        value.length = this.length;
        return value;
    };
    SubstrAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.position = this.position;
        js.length = this.length;
        return js;
    };
    SubstrAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.position === other.position &&
            this.length === other.length;
    };
    SubstrAction.prototype._toStringParameters = function (expressionString) {
        return [String(this.position), String(this.length)];
    };
    SubstrAction.prototype.getNecessaryInputTypes = function () {
        return this._stringTransformInputType;
    };
    SubstrAction.prototype.getOutputType = function (inputType) {
        return this._stringTransformOutputType(inputType);
    };
    SubstrAction.prototype._fillRefSubstitutions = function (typeContext, inputType) {
        return inputType;
    };
    SubstrAction.prototype._getFnHelper = function (inputType, inputFn) {
        var _a = this, position = _a.position, length = _a.length;
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return inV.substr(position, length);
        };
    };
    SubstrAction.prototype._getJSHelper = function (inputType, inputJS) {
        var _a = this, position = _a.position, length = _a.length;
        return "(_=" + inputJS + ",_==null?null:(''+_).substr(" + position + "," + length + "))";
    };
    SubstrAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "SUBSTR(" + inputSQL + "," + (this.position + 1) + "," + this.length + ")";
    };
    return SubstrAction;
}(Action));
Action.register(SubstrAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};


var SubtractAction = exports.SubtractAction = (function (_super) {
    __extends(SubtractAction, _super);
    function SubtractAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("subtract");
        this._checkExpressionTypes('NUMBER');
    }
    SubtractAction.fromJS = function (parameters) {
        return new SubtractAction(Action.jsToValue(parameters));
    };
    SubtractAction.prototype.getNecessaryInputTypes = function () {
        return 'NUMBER';
    };
    SubtractAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    SubtractAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return inputType;
    };
    SubtractAction.prototype._getFnHelper = function (inputType, inputFn, expressionFn) {
        return function (d, c) {
            return (inputFn(d, c) || 0) - (expressionFn(d, c) || 0);
        };
    };
    SubtractAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        return "(" + inputJS + "-" + expressionJS + ")";
    };
    SubtractAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "(" + inputSQL + "-" + expressionSQL + ")";
    };
    SubtractAction.prototype._removeAction = function () {
        return this.expression.equals(Expression.ZERO);
    };
    return SubtractAction;
}(Action));
Action.register(SubtractAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var SumAction = exports.SumAction = (function (_super) {
    __extends(SumAction, _super);
    function SumAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this._ensureAction("sum");
        this._checkExpressionTypes('NUMBER');
    }
    SumAction.fromJS = function (parameters) {
        return new SumAction(Action.jsToValue(parameters));
    };
    SumAction.prototype.getNecessaryInputTypes = function () {
        return 'DATASET';
    };
    SumAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    SumAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        this.expression._fillRefSubstitutions(typeContext, indexer, alterations);
        return {
            type: 'NUMBER'
        };
    };
    SumAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return "SUM(" + dialect.aggregateFilterIfNeeded(inputSQL, expressionSQL) + ")";
    };
    SumAction.prototype.isAggregate = function () {
        return true;
    };
    SumAction.prototype.isNester = function () {
        return true;
    };
    SumAction.prototype.canDistribute = function () {
        var expression = this.expression;
        return expression instanceof LiteralExpression ||
            Boolean(expression.getExpressionPattern('add') || expression.getExpressionPattern('subtract'));
    };
    SumAction.prototype.distribute = function (preEx) {
        var expression = this.expression;
        if (expression instanceof LiteralExpression) {
            var value = expression.value;
            if (value === 0)
                return Expression.ZERO;
            return expression.multiply(preEx.count()).simplify();
        }
        var pattern;
        if (pattern = expression.getExpressionPattern('add')) {
            return Expression.add(pattern.map(function (ex) { return preEx.sum(ex).distribute(); }));
        }
        if (pattern = expression.getExpressionPattern('subtract')) {
            return Expression.subtract(pattern.map(function (ex) { return preEx.sum(ex).distribute(); }));
        }
        return null;
    };
    return SumAction;
}(Action));
Action.register(SumAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var TimeBucketAction = exports.TimeBucketAction = (function (_super) {
    __extends(TimeBucketAction, _super);
    function TimeBucketAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var duration = parameters.duration;
        this.duration = duration;
        this.timezone = parameters.timezone;
        this._ensureAction("timeBucket");
        if (!Duration.isDuration(duration)) {
            throw new Error("`duration` must be a Duration");
        }
        if (!duration.isFloorable()) {
            throw new Error("duration '" + duration.toString() + "' is not floorable");
        }
    }
    TimeBucketAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeBucketAction(value);
    };
    TimeBucketAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeBucketAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeBucketAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeBucketAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeBucketAction.prototype.getNecessaryInputTypes = function () {
        return ['TIME', 'TIME_RANGE'];
    };
    TimeBucketAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME_RANGE';
    };
    TimeBucketAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME_RANGE'
        };
    };
    TimeBucketAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return TimeRange.timeBucket(inV, duration, timezone);
        };
    };
    TimeBucketAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeBucketAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeBucketExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeBucketAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeBucketAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeBucketAction(value);
    };
    TimeBucketAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    return TimeBucketAction;
}(Action));
Action.register(TimeBucketAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};








var TimeFloorAction = exports.TimeFloorAction = (function (_super) {
    __extends(TimeFloorAction, _super);
    function TimeFloorAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var duration = parameters.duration;
        this.duration = duration;
        this.timezone = parameters.timezone;
        this._ensureAction("timeFloor");
        if (!Duration.isDuration(duration)) {
            throw new Error("`duration` must be a Duration");
        }
        if (!duration.isFloorable()) {
            throw new Error("duration '" + duration.toString() + "' is not floorable");
        }
    }
    TimeFloorAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeFloorAction(value);
    };
    TimeFloorAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeFloorAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeFloorAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeFloorAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeFloorAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeFloorAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME';
    };
    TimeFloorAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME'
        };
    };
    TimeFloorAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return duration.floor(inV, timezone);
        };
    };
    TimeFloorAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeFloorAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeFloorExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeFloorAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction.equals(this)) {
            return this;
        }
        return null;
    };
    TimeFloorAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeFloorAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeFloorAction(value);
    };
    TimeFloorAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeFloorAction.prototype.alignsWith = function (actions) {
        if (!actions.length)
            return false;
        var action = actions[0];
        var _a = this, timezone = _a.timezone, duration = _a.duration;
        if (!timezone)
            return false;
        if (action instanceof TimeFloorAction || action instanceof TimeBucketAction) {
            return timezone.equals(action.timezone) && action.duration.dividesBy(duration);
        }
        if (action instanceof InAction || action instanceof OverlapAction) {
            var literal = action.getLiteralValue();
            if (TimeRange.isTimeRange(literal)) {
                return literal.isAligned(duration, timezone);
            }
            else if (Set.isSet(literal)) {
                if (literal.setType !== 'TIME_RANGE')
                    return false;
                return literal.elements.every(function (e) {
                    return e.isAligned(duration, timezone);
                });
            }
        }
        return false;
    };
    return TimeFloorAction;
}(Action));
Action.register(TimeFloorAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var PART_TO_FUNCTION = {
    SECOND_OF_MINUTE: function (d) { return d.getSeconds(); },
    SECOND_OF_HOUR: function (d) { return d.getMinutes() * 60 + d.getSeconds(); },
    SECOND_OF_DAY: function (d) { return (d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_WEEK: function (d) { return ((d.getDay() * 24) + d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_MONTH: function (d) { return (((d.getDate() - 1) * 24) + d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds(); },
    SECOND_OF_YEAR: null,
    MINUTE_OF_HOUR: function (d) { return d.getMinutes(); },
    MINUTE_OF_DAY: function (d) { return d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_WEEK: function (d) { return (d.getDay() * 24) + d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_MONTH: function (d) { return ((d.getDate() - 1) * 24) + d.getHours() * 60 + d.getMinutes(); },
    MINUTE_OF_YEAR: null,
    HOUR_OF_DAY: function (d) { return d.getHours(); },
    HOUR_OF_WEEK: function (d) { return d.getDay() * 24 + d.getHours(); },
    HOUR_OF_MONTH: function (d) { return (d.getDate() - 1) * 24 + d.getHours(); },
    HOUR_OF_YEAR: null,
    DAY_OF_WEEK: function (d) { return d.getDay() || 7; },
    DAY_OF_MONTH: function (d) { return d.getDate(); },
    DAY_OF_YEAR: null,
    WEEK_OF_MONTH: null,
    WEEK_OF_YEAR: null,
    MONTH_OF_YEAR: function (d) { return d.getMonth(); },
    YEAR: function (d) { return d.getFullYear(); }
};
var PART_TO_MAX_VALUES = {
    SECOND_OF_MINUTE: 61,
    SECOND_OF_HOUR: 3601,
    SECOND_OF_DAY: 93601,
    SECOND_OF_WEEK: null,
    SECOND_OF_MONTH: null,
    SECOND_OF_YEAR: null,
    MINUTE_OF_HOUR: 60,
    MINUTE_OF_DAY: 26 * 60,
    MINUTE_OF_WEEK: null,
    MINUTE_OF_MONTH: null,
    MINUTE_OF_YEAR: null,
    HOUR_OF_DAY: 26,
    HOUR_OF_WEEK: null,
    HOUR_OF_MONTH: null,
    HOUR_OF_YEAR: null,
    DAY_OF_WEEK: 7,
    DAY_OF_MONTH: 31,
    DAY_OF_YEAR: 366,
    WEEK_OF_MONTH: 5,
    WEEK_OF_YEAR: 53,
    MONTH_OF_YEAR: 12,
    YEAR: null
};
var TimePartAction = exports.TimePartAction = (function (_super) {
    __extends(TimePartAction, _super);
    function TimePartAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.part = parameters.part;
        this.timezone = parameters.timezone;
        this._ensureAction("timePart");
        if (typeof this.part !== 'string') {
            throw new Error("`part` must be a string");
        }
    }
    TimePartAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.part = parameters.part;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimePartAction(value);
    };
    TimePartAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.part = this.part;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimePartAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.part = this.part;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimePartAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.part === other.part &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimePartAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.part];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimePartAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimePartAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'NUMBER';
    };
    TimePartAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'NUMBER'
        };
    };
    TimePartAction.prototype._getFnHelper = function (inputType, inputFn) {
        var part = this.part;
        var timezone = this.getTimezone();
        var parter = PART_TO_FUNCTION[part];
        if (!parter)
            throw new Error("unsupported part '" + part + "'");
        return function (d, c) {
            var inV = inputFn(d, c);
            if (!inV)
                return null;
            inV = WallTime.UTCToWallTime(inV, timezone.toString());
            return parter(inV);
        };
    };
    TimePartAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimePartAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timePartExpression(inputSQL, this.part, this.getTimezone());
    };
    TimePartAction.prototype.maxPossibleSplitValues = function () {
        var maxValue = PART_TO_MAX_VALUES[this.part];
        if (!maxValue)
            return Infinity;
        return maxValue + 1;
    };
    TimePartAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimePartAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimePartAction(value);
    };
    TimePartAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    return TimePartAction;
}(Action));
Action.register(TimePartAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};




var TimeRangeAction = exports.TimeRangeAction = (function (_super) {
    __extends(TimeRangeAction, _super);
    function TimeRangeAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.duration = parameters.duration;
        this.step = parameters.step || TimeRangeAction.DEFAULT_STEP;
        this.timezone = parameters.timezone;
        this._ensureAction("timeRange");
        if (!Duration.isDuration(this.duration)) {
            throw new Error("`duration` must be a Duration");
        }
    }
    TimeRangeAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        value.step = parameters.step;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeRangeAction(value);
    };
    TimeRangeAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        value.step = this.step;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeRangeAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        js.step = this.step;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeRangeAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            this.step === other.step &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeRangeAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString(), this.step.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeRangeAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeRangeAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME_RANGE';
    };
    TimeRangeAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME_RANGE'
        };
    };
    TimeRangeAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var step = this.step;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            var other = duration.shift(inV, timezone, step);
            if (step > 0) {
                return new TimeRange({ start: inV, end: other });
            }
            else {
                return new TimeRange({ start: other, end: inV });
            }
        };
    };
    TimeRangeAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeRangeAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        throw new Error("implement me");
    };
    TimeRangeAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeRangeAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeRangeAction(value);
    };
    TimeRangeAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeRangeAction.DEFAULT_STEP = 1;
    return TimeRangeAction;
}(Action));
Action.register(TimeRangeAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};



var TimeShiftAction = exports.TimeShiftAction = (function (_super) {
    __extends(TimeShiftAction, _super);
    function TimeShiftAction(parameters) {
        _super.call(this, parameters, dummyObject);
        this.duration = parameters.duration;
        this.step = parameters.step || TimeShiftAction.DEFAULT_STEP;
        this.timezone = parameters.timezone;
        this._ensureAction("timeShift");
        if (!Duration.isDuration(this.duration)) {
            throw new Error("`duration` must be a Duration");
        }
    }
    TimeShiftAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.duration = Duration.fromJS(parameters.duration);
        value.step = parameters.step;
        if (parameters.timezone)
            value.timezone = Timezone.fromJS(parameters.timezone);
        return new TimeShiftAction(value);
    };
    TimeShiftAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.duration = this.duration;
        value.step = this.step;
        if (this.timezone)
            value.timezone = this.timezone;
        return value;
    };
    TimeShiftAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.duration = this.duration.toJS();
        js.step = this.step;
        if (this.timezone)
            js.timezone = this.timezone.toJS();
        return js;
    };
    TimeShiftAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.duration.equals(other.duration) &&
            this.step === other.step &&
            immutableEqual(this.timezone, other.timezone);
    };
    TimeShiftAction.prototype._toStringParameters = function (expressionString) {
        var ret = [this.duration.toString(), this.step.toString()];
        if (this.timezone)
            ret.push(this.timezone.toString());
        return ret;
    };
    TimeShiftAction.prototype.getNecessaryInputTypes = function () {
        return 'TIME';
    };
    TimeShiftAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'TIME';
    };
    TimeShiftAction.prototype._fillRefSubstitutions = function () {
        return {
            type: 'TIME'
        };
    };
    TimeShiftAction.prototype._getFnHelper = function (inputType, inputFn) {
        var duration = this.duration;
        var step = this.step;
        var timezone = this.getTimezone();
        return function (d, c) {
            var inV = inputFn(d, c);
            if (inV === null)
                return null;
            return duration.shift(inV, timezone, step);
        };
    };
    TimeShiftAction.prototype._getJSHelper = function (inputType, inputJS) {
        throw new Error("implement me");
    };
    TimeShiftAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL, expressionSQL) {
        return dialect.timeShiftExpression(inputSQL, this.duration, this.getTimezone());
    };
    TimeShiftAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof TimeShiftAction) {
            if (this.duration.equals(prevAction.duration) &&
                Boolean(this.timezone) === Boolean(prevAction.timezone) &&
                (!this.timezone || this.timezone.equals(prevAction.timezone))) {
                var value = this.valueOf();
                value.step += prevAction.step;
                return new TimeShiftAction(value);
            }
        }
        return null;
    };
    TimeShiftAction.prototype.needsEnvironment = function () {
        return !this.timezone;
    };
    TimeShiftAction.prototype.defineEnvironment = function (environment) {
        if (this.timezone || !environment.timezone)
            return this;
        var value = this.valueOf();
        value.timezone = environment.timezone;
        return new TimeShiftAction(value);
    };
    TimeShiftAction.prototype.getTimezone = function () {
        return this.timezone || Timezone.UTC;
    };
    TimeShiftAction.DEFAULT_STEP = 1;
    return TimeShiftAction;
}(Action));
Action.register(TimeShiftAction);
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var TransformCaseAction = exports.TransformCaseAction = (function (_super) {
    __extends(TransformCaseAction, _super);
    function TransformCaseAction(parameters) {
        _super.call(this, parameters, dummyObject);
        var transformType = parameters.transformType;
        if (transformType !== TransformCaseAction.UPPER_CASE && transformType !== TransformCaseAction.LOWER_CASE) {
            throw new Error("Must supply transform type of '" + TransformCaseAction.UPPER_CASE + "' or '" + TransformCaseAction.LOWER_CASE + "'");
        }
        this.transformType = transformType;
        this._ensureAction("transformCase");
    }
    TransformCaseAction.fromJS = function (parameters) {
        var value = Action.jsToValue(parameters);
        value.transformType = parameters.transformType;
        return new TransformCaseAction(value);
    };
    TransformCaseAction.prototype.valueOf = function () {
        var value = _super.prototype.valueOf.call(this);
        value.transformType = this.transformType;
        return value;
    };
    TransformCaseAction.prototype.toJS = function () {
        var js = _super.prototype.toJS.call(this);
        js.transformType = this.transformType;
        return js;
    };
    TransformCaseAction.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other) &&
            this.transformType === other.transformType;
    };
    TransformCaseAction.prototype.getNecessaryInputTypes = function () {
        return 'STRING';
    };
    TransformCaseAction.prototype.getOutputType = function (inputType) {
        this._checkInputTypes(inputType);
        return 'STRING';
    };
    TransformCaseAction.prototype._fillRefSubstitutions = function (typeContext, inputType, indexer, alterations) {
        return inputType;
    };
    TransformCaseAction.prototype._foldWithPrevAction = function (prevAction) {
        if (prevAction instanceof TransformCaseAction) {
            return this;
        }
        return null;
    };
    TransformCaseAction.prototype._getFnHelper = function (inputType, inputFn) {
        var transformType = this.transformType;
        return function (d, c) {
            return transformType === TransformCaseAction.UPPER_CASE ? inputFn(d, c).toLocaleUpperCase() : inputFn(d, c).toLocaleLowerCase();
        };
    };
    TransformCaseAction.prototype._getJSHelper = function (inputType, inputJS, expressionJS) {
        var transformType = this.transformType;
        return transformType === TransformCaseAction.UPPER_CASE ? inputJS + ".toLocaleUpperCase()" : inputJS + ".toLocaleLowerCase()";
    };
    TransformCaseAction.prototype._getSQLHelper = function (inputType, dialect, inputSQL) {
        var transformType = this.transformType;
        return transformType === TransformCaseAction.UPPER_CASE ? "UPPER(" + inputSQL + ")" : "LOWER(" + inputSQL + ")";
    };
    TransformCaseAction.UPPER_CASE = 'upperCase';
    TransformCaseAction.LOWER_CASE = 'lowerCase';
    return TransformCaseAction;
}(Action));
Action.register(TransformCaseAction);
var basicExecutorFactory = exports.basicExecutorFactory = function(parameters) {
    var datasets = parameters.datasets;
    return function (ex, env) {
        if (env === void 0) { env = {}; }
        return ex.compute(datasets, env);
    };
}
Expression.expressionParser = require("./expressionParser")(exports, Chronoshift);
Expression.plyqlParser = require("./plyqlParser")(exports, Chronoshift);

function addHasMoved(obj, name, fn) {
  obj[name] = function() {
    console.warn(name + ' has moved, please update your code');
    return fn.apply(this, arguments);
  };
}

var helper = {};
addHasMoved(helper, 'parseJSON', Dataset.parseJSON);
addHasMoved(helper, 'find', SimpleArray.find);
addHasMoved(helper, 'findIndex', SimpleArray.findIndex);
addHasMoved(helper, 'findByName', NamedArray.findByName);
addHasMoved(helper, 'findIndexByName', NamedArray.findIndexByName);
addHasMoved(helper, 'overrideByName', NamedArray.overrideByName);
addHasMoved(helper, 'overridesByName', NamedArray.overridesByName);
addHasMoved(helper, 'shallowCopy', shallowCopy);
addHasMoved(helper, 'deduplicateSort', deduplicateSort);
addHasMoved(helper, 'mapLookup', mapLookup);
addHasMoved(helper, 'emptyLookup', emptyLookup);
addHasMoved(helper, 'nonEmptyLookup', nonEmptyLookup);
addHasMoved(helper, 'verboseRequesterFactory', verboseRequesterFactory);
addHasMoved(helper, 'retryRequesterFactory', retryRequesterFactory);
addHasMoved(helper, 'concurrentLimitRequesterFactory', concurrentLimitRequesterFactory);
addHasMoved(helper, 'promiseWhile', promiseWhile);

exports.helper = helper;
addHasMoved(exports, 'find', SimpleArray.find);
addHasMoved(exports, 'findIndex', SimpleArray.findIndex);
addHasMoved(exports, 'findByName', NamedArray.findByName);
addHasMoved(exports, 'findIndexByName', NamedArray.findIndexByName);
addHasMoved(exports, 'overrideByName', NamedArray.overrideByName);
addHasMoved(exports, 'overridesByName', NamedArray.overridesByName);


