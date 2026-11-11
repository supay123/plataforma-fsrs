import type { FSRSParameters } from "ts-fsrs";

export interface StoredCard {
  due_at: string;
  stability: number | string | null;
  difficulty: number | string | null;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review_at: string | null;
}

export interface FsrsConfig {
  library_name: string;
  library_version: string;
  parameters: Partial<FSRSParameters>;
}
