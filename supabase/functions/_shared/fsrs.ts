import { type Card, createEmptyCard, fsrs, Rating } from "ts-fsrs";
import type { Json } from "./database.types.ts";
import { AppError } from "./errors.ts";
import type { FsrsConfig, StoredCard } from "./interfaces/fsrs.interfaces.ts";

function numberValue(value: number | string | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(
      500,
      "invalid_fsrs_state",
      "Stored FSRS state is invalid.",
    );
  }
  return parsed;
}

export function toFsrsCard(stored: StoredCard | null, now: Date): Card {
  if (!stored) return createEmptyCard(now);
  return {
    due: new Date(stored.due_at),
    stability: numberValue(stored.stability),
    difficulty: numberValue(stored.difficulty),
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state,
    last_review: stored.last_review_at
      ? new Date(stored.last_review_at)
      : undefined,
  } as Card;
}

export function scheduleAnswer(
  stored: StoredCard | null,
  config: FsrsConfig,
  correct: boolean,
  reviewedAt = new Date(),
): Record<string, Json | undefined> {
  if (config.library_name !== "ts-fsrs" || config.library_version !== "5.4.1") {
    throw new AppError(
      500,
      "unsupported_fsrs_config",
      "The active FSRS configuration does not match the deployed scheduler.",
    );
  }

  const result = fsrs(config.parameters ?? {}).next(
    toFsrsCard(stored, reviewedAt),
    reviewedAt,
    correct ? Rating.Good : Rating.Again,
  );
  const card = result.card;
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  };
}
