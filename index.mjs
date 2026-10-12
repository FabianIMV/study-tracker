// Entrada ESM: reutiliza la build UMD para que ESM y CommonJS compartan la misma instancia.
import StudyTracker from './study-tracker.js';

export default StudyTracker;
export const { create, version, schema, periodStart, nextPeriodStart, memoryStorage } = StudyTracker;
