import {resolveLocation} from './location-resolver.js';
/** Stored location-policy-v2 decisions are authoritative. Older withheld imports are re-evaluated.
 * Historical aliases include 한양, 스탈린그라드, 콘스탄티노폴리스; administrative names share stable representatives.
 * No continent or display-group fallback is permitted under any code path.
 */
export function resolvePoint(event){return resolveLocation(event||{});}
