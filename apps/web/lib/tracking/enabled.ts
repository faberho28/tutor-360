/**
 * Master switch of the local mask tracking (HU-37). Off: OpenCV is never
 * downloaded, the masks stay where the models drew them and the change engine
 * decides when to analyze, exactly as before the tracking existed. A code
 * constant on purpose: analysis behavior is not configured through env vars.
 */
export const TRACKING_ENABLED = true;
