export interface NutritionLogEntry {
  itemId: string;
  servings: number;
}

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
  nutritionEntries?: NutritionLogEntry[];
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
  type: string;
  desc: string;
  dist: number | string;
  dur: number | string;
  notes: string;
  planned: true;
  completed?: boolean;
  actualDist?: number | string;
  actualDur?: number | string;
  actualVert?: number | string;
  actualHr?: number | string;
  completionNotes?: string;
}

export interface NutritionItem {
  id: string;
  name: string;
  carbsPerServing: number | string;
  hydrationPerServing: number | string;
  sodiumPerServing: number | string;
  servingUnit: string;
}

export interface Race {
  id: string;
  date: string;
  name: string;
  raceType: 'run' | 'bike' | 'skimo';
  bikeType?: string;
  skimoCategory?: string;
  dist: number | string;
  loc: string;
  goal: string;
  vert: number | string;
  result: string;
  notes: string;
}

export interface TrainingDB {
  runs: RunEntry[];
  crosses: CrossEntry[];
  strengths: StrengthEntry[];
  recoveries: RecoveryEntry[];
  races: Race[];
  plans: PlannedWorkout[];
  nutrition: NutritionItem[];
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
