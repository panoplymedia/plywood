var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { External } from "./baseExternal";
import { SQLExternal } from "./sqlExternal";
import { AttributeInfo } from "../datatypes/attributeInfo";
import { MySQLDialect } from "../dialect/mySqlDialect";
export var MySQLExternal = (function (_super) {
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
