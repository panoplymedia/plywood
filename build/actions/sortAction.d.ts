import { Action, ActionJS, ActionValue } from "./baseAction";
import { PlyType, DatasetFullType, FullType } from "../types";
import { Indexer, Alterations } from "../expressions/baseExpression";
import { SQLDialect } from "../dialect/baseDialect";
import { ComputeFn } from "../datatypes/dataset";
export declare type Direction = 'ascending' | 'descending';
export declare class SortAction extends Action {
    static DESCENDING: Direction;
    static ASCENDING: Direction;
    static fromJS(parameters: ActionJS): SortAction;
    direction: Direction;
    constructor(parameters?: ActionValue);
    valueOf(): ActionValue;
    toJS(): ActionJS;
    equals(other: SortAction): boolean;
    protected _toStringParameters(expressionString: string): string[];
    getNecessaryInputTypes(): PlyType | PlyType[];
    getOutputType(inputType: PlyType): PlyType;
    _fillRefSubstitutions(typeContext: DatasetFullType, inputType: FullType, indexer: Indexer, alterations: Alterations): FullType;
    protected _getFnHelper(inputType: PlyType, inputFn: ComputeFn, expressionFn: ComputeFn): ComputeFn;
    protected _getSQLHelper(inputType: PlyType, dialect: SQLDialect, inputSQL: string, expressionSQL: string): string;
    refName(): string;
    isNester(): boolean;
    protected _foldWithPrevAction(prevAction: Action): Action;
    toggleDirection(): SortAction;
}