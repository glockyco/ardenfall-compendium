import { getMapView } from "#lib/server/read-models.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ mapView: getMapView() });
