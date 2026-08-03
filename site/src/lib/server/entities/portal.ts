import { disambiguateLabels } from "../disambiguate-labels";
import { all, get } from "../db";
import { validateRenderContext } from "../json";
import { getEntityNodeBySlug } from "./item";

interface PortalOverviewRecord {
  id: string;
  name: string;
  route_path: string;
  short_id: string;
}

interface PortalPresentationRecord {
  id: string;
  name: string;
  render_context: string;
  map_id: string | null;
  map_x: number | null;
  map_y: number | null;
  elevation: number | null;
  connected_portal_id: string | null;
  route_path: string;
}

interface ConnectedPortalRecord {
  id: string;
  label: string;
  route_path: string;
}

export interface PortalOverviewRow {
  id: string;
  name: string;
  routePath: string;
}

export interface ConnectedPortalLink {
  id: string;
  label: string;
  routePath: string;
}

export interface PortalPresentationRow {
  id: string;
  name: string;
  renderContext: "portal-presentation-v1";
  routePath: string;
  mapId: string | null;
  mapLabel: string;
  mapX: number | null;
  mapY: number | null;
  elevation: number | null;
  connectedPortal: ConnectedPortalLink | null;
}

const displayMapLabel = (mapId: string | null): string => {
  if (mapId === null) return "Unknown";
  return mapId.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

export const listPortals = (): PortalOverviewRow[] => {
  const rows = all<PortalOverviewRecord>(
    `SELECT p.id, p.name, n.route_path, n.short_id
     FROM portal_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'portal'
      AND n.entity_id = p.id
     ORDER BY p.name, p.id`,
  ).map((row) => ({
    id: row.id,
    name: row.name,
    routePath: row.route_path,
    shortId: row.short_id,
  }));
  return disambiguateLabels(rows, "name", (row) => row.shortId).map(
    ({ shortId: _shortId, ...row }) => row,
  );
};

export const getPortalPresentation = (slug: string): PortalPresentationRow | undefined => {
  const node = getEntityNodeBySlug("portal", slug);
  if (!node) return undefined;
  const row = get<PortalPresentationRecord>(
    `SELECT p.id, p.name, p.render_context, p.map_id, p.map_x, p.map_y, p.elevation,
            p.connected_portal_id, n.route_path
     FROM portal_presentation_rows p
     JOIN entity_nodes n
       ON n.entity_type = 'portal'
      AND n.entity_id = p.id
     WHERE p.id = ?`,
    [node.entityId],
  );
  if (!row) return undefined;

  let connectedPortal: ConnectedPortalLink | null = null;
  if (row.connected_portal_id !== null) {
    const target = get<ConnectedPortalRecord>(
      `SELECT entity_id AS id, label, route_path
       FROM entity_nodes
       WHERE entity_type = 'portal' AND entity_id = ? AND has_page = 1`,
      [row.connected_portal_id],
    );
    if (!target) {
      throw new Error(
        `Portal '${row.id}' references missing connected portal page '${row.connected_portal_id}'`,
      );
    }
    connectedPortal = { id: target.id, label: target.label, routePath: target.route_path };
  }

  return {
    id: row.id,
    name: row.name,
    renderContext: validateRenderContext(
      row.render_context,
      "portal",
      row.id,
      "portal-presentation-v1",
    ),
    routePath: row.route_path,
    mapId: row.map_id,
    mapLabel: displayMapLabel(row.map_id),
    mapX: row.map_x,
    mapY: row.map_y,
    elevation: row.elevation,
    connectedPortal,
  };
};
