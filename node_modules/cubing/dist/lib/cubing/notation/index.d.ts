import { M as LeafCount, c as PuzzleLoader, gt as Alg } from "../index-nWspzjVK.js";
//#region ../src/cubing/notation/CountAnimatedLeaves.d.ts
declare const countAnimatedLeaves: (alg: Alg) => LeafCount;
//#endregion
//#region ../src/cubing/notation/commonMetrics.d.ts
type CommonMetric = (typeof CommonMetric)[keyof typeof CommonMetric];
declare const CommonMetric: {
  OuterBlockTurnMetric: string;
  RangeBlockTurnMetric: string;
  SingleSliceTurnMetric: string;
  OuterBlockQuantumTurnMetric: string;
  RangeBlockQuantumTurnMetric: string;
  SingleSliceQuantumTurnMetric: string;
  ExecutionTurnMetric: string;
};
type CommonMetricAlias = (typeof CommonMetricAlias)[keyof typeof CommonMetricAlias];
declare const CommonMetricAlias: {
  QuantumTurnMetric: string;
  HandTurnMetric: string;
  SliceTurnMetric: string;
};
//#endregion
//#region ../src/cubing/notation/CountMoves.d.ts
declare const countMoves: (alg: Alg) => number;
declare const countMovesETM: (alg: Alg) => number;
/**
 * Only implemented so far:
 *
 * - 3x3x3: OBTM, RBTM, ETM
 */
declare function countMetricMoves(puzzleLoader: PuzzleLoader, metric: CommonMetric, alg: Alg): number;
//#endregion
export { CommonMetric as ExperimentalCommonMetric, CommonMetricAlias as ExperimentalCommonMetricAlias, countAnimatedLeaves as experimentalCountAnimatedLeaves, countMetricMoves as experimentalCountMetricMoves, countMoves as experimentalCountMoves, countMovesETM as experimentalCountMovesETM };