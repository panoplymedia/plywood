var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
import { External } from "./baseExternal";
import { SQLExternal } from "./sqlExternal";
import { AttributeInfo } from "../datatypes/attributeInfo";
import { PostgresDialect } from "../dialect/postgresDialect";
export var PostgresExternal = (function (_super) {
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