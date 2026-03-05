export interface Point {
  x: number;
  y: number;
}

export interface AngleAnalysisResult {
  isAngleFound: boolean;
  description: string;
  angle: number | null;
  points: [Point, Point, Point] | null;
}
