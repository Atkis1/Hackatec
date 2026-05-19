import { getActiveBuildingSite } from "../services/buildingsStore.js";

export const infrastructure = new Proxy(
  {},
  {
    get(_t, prop) {
      const site = getActiveBuildingSite();
      if (!site) return undefined;
      return site[prop];
    },
  },
);

export function getAllAreas() {
  const site = getActiveBuildingSite();
  if (!site) return [];
  return site.floors.flatMap((floor) =>
    floor.areas.map((area) => ({
      ...area,
      floorId: floor.id,
      floorName: floor.name,
    })),
  );
}

export function findArea(areaId) {
  return getAllAreas().find((a) => a.id === areaId) ?? null;
}
