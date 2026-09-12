export const OPENFRONTIO_REVISION = "9f30fee4e51bc9cc954c6ec549779d11306e3ad6";
const ROOT = `https://github.com/openfrontio/OpenFrontIO/blob/${OPENFRONTIO_REVISION}/`;

const files = {
  config: ["Core configuration", "src/core/configuration/Config.ts"],
  clock: ["Doomsday Clock", "src/core/game/DoomsdayClock.ts"],
  attack: ["Attack resolution", "src/core/game/AttackImpl.ts"],
  alliances: ["Alliance state", "src/core/game/AllianceImpl.ts"],
  nations: ["Nation behavior", "src/core/game/NationCreation.ts"],
  maps: ["Map registry and terrain", "src/core/game/Maps.gen.ts"],
  rail: ["Rail networks", "src/core/game/RailNetwork.ts"],
  railImpl: ["Rail network implementation", "src/core/game/RailNetworkImpl.ts"],
  station: ["Train stations", "src/core/game/TrainStation.ts"],
  transport: ["Transport ships", "src/core/game/TransportShipUtils.ts"],
  veterancy: ["Unit veterancy", "src/core/game/Veterancy.ts"],
  water: ["Water systems", "src/core/game/WaterManager.ts"],
  gameMap: ["Game map model", "src/core/game/GameMap.ts"],
};

const bySlug = {
  Doomsday_Clock: ["clock", "config"],
  Defense_Post: ["config"],
  SAM_Launcher: ["config"],
  Missile_Silo: ["config"],
  Atom_Bomb: ["config"],
  Hydrogen_Bomb: ["config"],
  MIRV: ["config"],
  Nuke: ["config", "attack"],
  Combat: ["attack", "config"],
  Ally: ["alliances"],
  Annexation: ["attack", "alliances"],
  Traitor: ["alliances", "attack"],
  Nations: ["nations"],
  Train: ["rail", "railImpl", "station"],
  Railroad: ["rail", "railImpl"],
  Trade: ["config", "water"],
  Trade_Ship: ["config", "water"],
  Transport_Ship: ["transport", "water"],
  Warship: ["config", "veterancy"],
  Maps: ["maps", "gameMap"],
  Terrain: ["gameMap", "water"],
  Tile: ["gameMap"],
};

const bySection = {
  Maps: ["maps", "gameMap"],
  Units: ["config"],
  Buildings: ["config"],
  "Combat & mechanics": ["attack", "config"],
  Economy: ["config", "water"],
  "Game modes": ["config"],
  Guides: ["config"],
};

export function githubReferencesForPage(page) {
  if (page.source === "liquipedia") return [];
  const keys = bySlug[page.slug] || bySection[page.section] || ["config"];
  return [...new Set(keys)].map((key) => {
    const [label, path] = files[key];
    return { label, path, url: `${ROOT}${path}` };
  });
}

export const GITHUB_SOURCE_FILES = Object.values(files).map(([label, path]) => ({
  label,
  path,
  url: `${ROOT}${path}`,
}));