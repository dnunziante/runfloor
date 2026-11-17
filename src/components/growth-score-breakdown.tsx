import { calculateGrowthPriority, growthPriorityLabel, type GrowthScore, type GrowthScoreWeights } from "@/lib/growth/data";

const dimensions: Array<[keyof GrowthScore, string, boolean]> = [["impact", "Impact", false], ["effort", "Effort", true], ["confidence", "Confidence", false], ["cost", "Cost", true], ["risk", "Risk", true], ["alignment", "Strategic alignment", false]];

export function GrowthScoreBreakdown({ score, weights }: { score: GrowthScore; weights: GrowthScoreWeights }) {
  const total = calculateGrowthPriority(score, weights);
  return <section className="card growth-score-breakdown"><div className="metric-row"><div><span className="badge blue">Calculated score</span><h2>Priority assessment</h2></div><span className="growth-score-total"><strong>{total}</strong><small>{growthPriorityLabel(total)}</small></span></div><div className="growth-score-bars">{dimensions.map(([key, label, inverse]) => <div key={key}><span><strong>{label}</strong><small>{weights[key]}% weight{inverse ? " · lower is better" : ""}</small></span><div className="progress"><span style={{ width: `${score[key] * 20}%` }}/></div><b>{score[key]}/5</b></div>)}</div><p className="field-help">This score uses workspace-configured ratings and weights. It does not use live market data or AI.</p></section>;
}
