export interface RunEntry {
  id: string;
  date: string;
  actType: 'run';
  runType: string;
  terrain: string;
  bikeType?: string;
  dist: number | string;
  dur: number | string;
  vert: number | string;
  hr: number | string;
  notes: string;
  workoutDetails?: string;
  nutritionEntries?: unknown[];
}

export interface CrossEntry {
  id: string;
  date: string;
  actType: 'cross';
  sport?: string;
  subtype: string;
  dist: number | string;
  dur: number | string;
  vert: number | string;
  rpe: number | string;
  notes: string;
}

export interface StrengthEntry {
  id: string;
  date: string;
  actType: 'strength';
  subtype: string;
  dur: number | string;
  notes: string;
}

export interface RecoveryEntry {
  id: string;
  date: string;
  actType: 'recovery';
  subtype: string;
  dur: number | string;
  notes: string;
}

export type ActivityEntry = RunEntry | CrossEntry | StrengthEntry | RecoveryEntry;

export interface PlannedWorkout {
  id: string;
  date: string;
  actType: string;
  subtype: string;
  dist: number | string;
  dur: number | string;
  notes: string;
  planned: true;
}

export interface TrainingDB {
  runs: RunEntry[];
  crosses: CrossEntry[];
  strengths: StrengthEntry[];
  recoveries: RecoveryEntry[];
  races: unknown[];
  plans: PlannedWorkout[];
  nutrition: unknown[];
  trainingPlans: unknown[];
  goals: Record<string, unknown>;
  weeklyGoals: Record<string, unknown>;
  goalCelebrations: Record<string, unknown>;
  logName: string;
  theme: string;
  primarySport: string;
}

export const emptyDB: TrainingDB = {
  runs: [],
  crosses: [],
  strengths: [],
  recoveries: [],
  races: [],
  plans: [],
  nutrition: [],
  trainingPlans: [],
  goals: {},
  weeklyGoals: {},
  goalCelebrations: {},
  logName: '',
  theme: 'dark',
  primarySport: '',
};
