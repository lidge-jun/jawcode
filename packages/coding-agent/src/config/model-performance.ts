import type { Database, Statement } from "bun:sqlite";

export interface ModelPerformanceSample {
	/** End-to-end provider request latency. Omit when the provider did not report it. */
	latencyMs?: number;
	/** Whether the request ended in a model/provider error. */
	error: boolean;
}

export interface ModelPerformanceStats {
	samples: number;
	errors: number;
	errorRate: number;
	averageLatencyMs: number | null;
}

interface ModelPerformanceRow {
	model_key: string;
	sample_count: number;
	error_count: number;
	latency_samples: number;
	latency_total_ms: number;
}

interface NormalizedModelPerformanceSample {
	modelKey: string;
	errorCount: 0 | 1;
	latencySamples: 0 | 1;
	latencyMs: number;
}

const MODEL_PERFORMANCE_DECAY_AT = 256;

export function initializeModelPerformanceSchema(db: Database): void {
	db.run(`
CREATE TABLE IF NOT EXISTS model_performance (
	model_key TEXT PRIMARY KEY,
	sample_count REAL NOT NULL DEFAULT 0,
	error_count REAL NOT NULL DEFAULT 0,
	latency_samples REAL NOT NULL DEFAULT 0,
	latency_total_ms REAL NOT NULL DEFAULT 0,
	updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
);
`);
}

function normalizeSample(
	modelKey: string,
	sample: ModelPerformanceSample,
): NormalizedModelPerformanceSample | undefined {
	const normalizedKey = modelKey.trim();
	if (!normalizedKey) return undefined;
	const latencyMs = sample.latencyMs;
	const hasLatency = latencyMs !== undefined && Number.isFinite(latencyMs) && latencyMs >= 0;
	return {
		modelKey: normalizedKey,
		errorCount: sample.error ? 1 : 0,
		latencySamples: hasLatency ? 1 : 0,
		latencyMs: hasLatency ? latencyMs : 0,
	};
}

/** Persistent recency-weighted latency and error aggregates over the shared agent database. */
export class ModelPerformanceStore {
	#upsert: Statement;
	#list: Statement;

	constructor(db: Database) {
		this.#upsert = db.prepare(
			`INSERT INTO model_performance
	(model_key, sample_count, error_count, latency_samples, latency_total_ms, updated_at)
VALUES (?1, 1, ?2, ?3, ?4, CAST(strftime('%s','now') AS INTEGER))
ON CONFLICT(model_key) DO UPDATE SET
	sample_count = (CASE WHEN model_performance.sample_count >= ${MODEL_PERFORMANCE_DECAY_AT} THEN model_performance.sample_count * 0.5 ELSE model_performance.sample_count END) + 1,
	error_count = (CASE WHEN model_performance.sample_count >= ${MODEL_PERFORMANCE_DECAY_AT} THEN model_performance.error_count * 0.5 ELSE model_performance.error_count END) + excluded.error_count,
	latency_samples = (CASE WHEN model_performance.sample_count >= ${MODEL_PERFORMANCE_DECAY_AT} THEN model_performance.latency_samples * 0.5 ELSE model_performance.latency_samples END) + excluded.latency_samples,
	latency_total_ms = (CASE WHEN model_performance.sample_count >= ${MODEL_PERFORMANCE_DECAY_AT} THEN model_performance.latency_total_ms * 0.5 ELSE model_performance.latency_total_ms END) + excluded.latency_total_ms,
	updated_at = CAST(strftime('%s','now') AS INTEGER)`,
		);
		this.#list = db.prepare(
			"SELECT model_key, sample_count, error_count, latency_samples, latency_total_ms FROM model_performance",
		);
	}

	record(modelKey: string, sample: ModelPerformanceSample): void {
		const normalized = normalizeSample(modelKey, sample);
		if (!normalized) return;
		this.#upsert.run(normalized.modelKey, normalized.errorCount, normalized.latencySamples, normalized.latencyMs);
	}

	getAll(): Map<string, ModelPerformanceStats> {
		const result = new Map<string, ModelPerformanceStats>();
		for (const row of this.#list.all() as ModelPerformanceRow[]) {
			if (row.sample_count <= 0) continue;
			result.set(row.model_key, {
				samples: row.sample_count,
				errors: row.error_count,
				errorRate: row.error_count / row.sample_count,
				averageLatencyMs: row.latency_samples > 0 ? row.latency_total_ms / row.latency_samples : null,
			});
		}
		return result;
	}

	close(): void {
		this.#upsert.finalize();
		this.#list.finalize();
	}
}
