export interface NutritionItem {
  id: string;
  name: string;
  carbsPerServing: number;
  hydrationPerServing: number;
  sodiumPerServing: number;
  servingUnit: string;
}

export interface NutritionEntry {
  nutritionId: string;
  qty: number;
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
  movingTime?: number | string;
  elapsedTime?: number | string;
  useMovingTime?: boolean;
  vert: number | string;
  hr: number | string;
  notes: string;
  workoutDetails?: string;
  nutritionEntries?: NutritionEntry[];
}

export interface CrossEntry {
  id: string;
  date: string;
  actType: 'cross';
  sport?: string;
  subtype: string;
  dist: number | string;
  dur: number | string;
  movingTime?: number | string;
  elapsedTime?: number | string;
  useMovingTime?: boolean;
  vert: number | string;
  rpe: number | string;
  hr?: number | string;
  notes: string;
  nutritionEntries?: NutritionEntry[];
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

export interface GoalRange {
  min: number;
  max: number;
}

export interface WeeklyGoal {
  run: {
    enabled: boolean;
    metrics: { time: boolean; dist: boolean; vert: boolean };
    time: GoalRange;
    dist: GoalRange;
    vert: GoalRange;
  };
  cross: {
    enabled: boolean;
    metrics: { time: boolean; dist: boolean; vert: boolean };
    time: GoalRange;
    dist: GoalRange;
    vert: GoalRange;
  };
}

export const defaultWeeklyGoal: WeeklyGoal = {
  run: {
    enabled: true,
    metrics: { time: true, dist: false, vert: false },
    time: { min: 0, max: 0 },
    dist: { min: 0, max: 0 },
    vert: { min: 0, max: 0 },
  },
  cross: {
    enabled: false,
    metrics: { time: true, dist: false, vert: false },
    time: { min: 0, max: 0 },
    dist: { min: 0, max: 0 },
    vert: { min: 0, max: 0 },
  },
};

export interface TrainingDB {
  runs: RunEntry[];
  crosses: CrossEntry[];
  strengths: StrengthEntry[];
  recoveries: RecoveryEntry[];
  races: unknown[];
  plans: unknown[];
  nutrition: NutritionItem[];
  trainingPlans: unknown[];
  goals: WeeklyGoal | Record<string, unknown>;
  weeklyGoals: Record<string, WeeklyGoal | Record<string, unknown>>;
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
