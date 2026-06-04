import { getMapView } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({ mapView: getMapView() });
