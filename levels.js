function makePlatforms(seed) {
  // Long-form stage layout with repeated challenge pockets and seeded offsets.
  const floorY = 600;
  const platforms = [];
  const groundSections = [
    [0, 820], [900, 520], [1540, 560], [2240, 420], [2830, 500], [3460, 460],
    [4050, 520], [4710, 420], [5280, 500], [5910, 430], [6480, 520], [7140, 430],
    [7700, 520], [8360, 420], [8920, 500], [9550, 560], [10250, 430], [10840, 500],
    [11470, 470], [12080, 540], [12760, 740],
  ];
  for (const [x, width] of groundSections) {
    platforms.push({ x, y: floorY, width, height: 140 });
  }

  const raisedTemplate = [
    [300, 500, 170, 24], [560, 430, 150, 24], [880, 360, 130, 24], [1090, 310, 120, 24],
    [1540, 470, 140, 24], [1760, 400, 130, 24], [2140, 330, 120, 24], [2580, 460, 160, 24],
    [2870, 390, 130, 24], [3190, 320, 120, 24], [3670, 460, 170, 24], [3960, 390, 140, 24],
    [4250, 330, 120, 24],
  ];

  for (let block = 0; block < 3; block += 1) {
    const blockOffset = block * 4200;
    const yShift = ((seed + block) % 3) * 8;
    for (const [x, y, width, height] of raisedTemplate) {
      platforms.push({
        x: x + blockOffset + seed * 14,
        y: y + yShift,
        width,
        height,
      });
    }
  }

  const stairRuns = [
    [4420, 520, 120], [4560, 450, 120], [4700, 380, 120], [4840, 310, 120],
    [8610, 520, 120], [8750, 450, 120], [8890, 380, 120], [9030, 310, 120],
  ];
  for (const [x, y, width] of stairRuns) {
    platforms.push({ x: x + seed * 9, y, width, height: 22 });
  }

  const movers = [
    { x: 1670, y: 280, axis: "x", min: 1540, max: 1890, speed: 105 },
    { x: 2470, y: 250, axis: "y", min: 200, max: 430, speed: 82 },
    { x: 4120, y: 270, axis: "x", min: 3980, max: 4380, speed: 110 },
    { x: 5710, y: 250, axis: "y", min: 210, max: 450, speed: 78 },
    { x: 7330, y: 260, axis: "x", min: 7190, max: 7570, speed: 118 },
    { x: 9550, y: 260, axis: "y", min: 210, max: 470, speed: 86 },
    { x: 11240, y: 290, axis: "x", min: 11040, max: 11520, speed: 112 },
  ];
  for (const mover of movers) {
    platforms.push({
      x: mover.x + seed * 6,
      y: mover.y,
      width: 140,
      height: 22,
      moving: true,
      axis: mover.axis,
      min: mover.min,
      max: mover.max + seed * 6,
      speed: mover.speed,
      dir: 1,
      vx: 0,
    });
  }
  return platforms;
}

function makeEnemies(seed) {
  const hats = ["top", "wizard", "crown", "bowler"];
  const template = [
    [780, 528, 0.5], [1210, 408, 1.2], [1990, 388, 2.1], [2730, 538, 0.8],
    [3300, 318, 1.9], [3920, 388, 0.7], [4480, 518, 1.5], [5160, 248, 2.7],
    [5840, 308, 1.1], [6400, 338, 2.4], [7160, 518, 0.4], [7920, 368, 1.6],
    [8520, 288, 2.2], [9340, 518, 0.9], [10020, 248, 1.4], [10840, 308, 2.8],
    [11640, 358, 0.6], [12460, 278, 1.7],
  ];
  return template.map(([x, y, phase], index) => ({
    x: x + seed * 10,
    y,
    hat: hats[(seed + index) % 4],
    speed: 76 + (index % 5) * 6 + seed * 2,
    phase,
  }));
}

function makeCollectibles(seed) {
  const coins = [];
  const template = [
    [380, 455], [700, 385], [1100, 305], [1570, 235], [2295, 315], [2875, 425],
    [3215, 345], [4050, 315], [4565, 385], [5230, 245], [5910, 295], [6500, 335],
    [7410, 485], [8040, 325], [8730, 255], [9480, 485], [10110, 235], [10910, 285],
    [11720, 335], [12510, 255],
  ];
  for (const [x, y] of template) {
    coins.push({ x: x + seed * 6, y, taken: false });
  }
  return coins;
}

function makeCivilians(seed) {
  return [
    { x: 540 + seed * 14, y: 524, variant: "man", speed: 36, dir: 1, phase: 0.2 },
    { x: 1700 + seed * 12, y: 524, variant: "woman", speed: 32, dir: -1, phase: 1.1 },
    { x: 3010 + seed * 10, y: 542, variant: "child", child: true, speed: 42, dir: 1, phase: 2.2 },
    { x: 4700 + seed * 8, y: 524, variant: "woman", speed: 34, dir: 1, phase: 0.9 },
    { x: 6160 + seed * 6, y: 542, variant: "child", child: true, speed: 40, dir: -1, phase: 1.7 },
    { x: 7820 + seed * 8, y: 524, variant: "man", speed: 38, dir: 1, phase: 0.5 },
    { x: 9140 + seed * 6, y: 524, variant: "woman", speed: 35, dir: -1, phase: 1.9 },
    { x: 10640 + seed * 5, y: 542, variant: "child", child: true, speed: 44, dir: 1, phase: 0.8 },
    { x: 11960 + seed * 4, y: 524, variant: "man", speed: 39, dir: -1, phase: 2.1 },
  ];
}

export const LEVELS = [
  {
    name: "Manhattan",
    subtitle: "Neon avenues and oversized ambition",
    palette: ["#89d7ff", "#ffd56e", "#ff7f50"],
    sky: ["#72c6ff", "#f9b85e"],
    width: 13600,
    spawn: { x: 90, y: 470 },
    goal: { x: 13280, y: 470, width: 48, height: 130 },
    deco: { skyline: "manhattan" },
    platforms: makePlatforms(0),
    enemies: makeEnemies(0),
    civilians: makeCivilians(0),
    collectibles: makeCollectibles(0),
  },
  {
    name: "Brooklyn",
    subtitle: "Bridge steel, murals, and rooftop swagger",
    palette: ["#8ce1b7", "#f2ac5d", "#ef476f"],
    sky: ["#a4e0ff", "#f1a76f"],
    width: 13680,
    spawn: { x: 90, y: 470 },
    goal: { x: 13360, y: 470, width: 48, height: 130 },
    deco: { skyline: "brooklyn" },
    platforms: makePlatforms(1),
    enemies: makeEnemies(1),
    civilians: makeCivilians(1),
    collectibles: makeCollectibles(1),
  },
  {
    name: "Hamburg",
    subtitle: "Canals, cranes, and floating mischief",
    palette: ["#96d7ff", "#ffda79", "#ef8354"],
    sky: ["#80d3ff", "#ffbe77"],
    width: 13760,
    spawn: { x: 90, y: 470 },
    goal: { x: 13440, y: 470, width: 48, height: 130 },
    deco: { skyline: "hamburg" },
    platforms: makePlatforms(2),
    enemies: makeEnemies(2),
    civilians: makeCivilians(2),
    collectibles: makeCollectibles(2),
  },
  {
    name: "Tokyo",
    subtitle: "Billboards, bustle, and impossible glow",
    palette: ["#74f5ff", "#ff6bb0", "#fee440"],
    sky: ["#5bc0ff", "#f672b7"],
    width: 13840,
    spawn: { x: 90, y: 470 },
    goal: { x: 13520, y: 470, width: 48, height: 130 },
    deco: { skyline: "tokyo" },
    platforms: makePlatforms(3),
    enemies: makeEnemies(3),
    civilians: makeCivilians(3),
    collectibles: makeCollectibles(3),
  },
  {
    name: "London",
    subtitle: "Foggy skyline with theatrical attitude",
    palette: ["#b8d8d8", "#ff6f59", "#254441"],
    sky: ["#b9d7f5", "#d7b8ff"],
    width: 13920,
    spawn: { x: 90, y: 470 },
    goal: { x: 13600, y: 470, width: 48, height: 130 },
    deco: { skyline: "london" },
    platforms: makePlatforms(4),
    enemies: makeEnemies(4),
    civilians: makeCivilians(4),
    collectibles: makeCollectibles(4),
  },
  {
    name: "Dubai",
    subtitle: "Sunset towers and extravagant nonsense",
    palette: ["#ffd166", "#ff7b54", "#577590"],
    sky: ["#ffbf69", "#ff6f91"],
    width: 14000,
    spawn: { x: 90, y: 470 },
    goal: { x: 13680, y: 470, width: 48, height: 130 },
    deco: { skyline: "dubai" },
    platforms: makePlatforms(5),
    enemies: makeEnemies(5),
    civilians: makeCivilians(5),
    collectibles: makeCollectibles(5),
  },
];

const LEVEL_LENGTH_FACTORS = [0.5, 0.8, 0.9, 1, 1, 1];

export function cloneLevel(index) {
  const level = LEVELS[index];
  const lengthFactor = LEVEL_LENGTH_FACTORS[index] ?? 1;
  const width = Math.floor(level.width * lengthFactor);
  const goalX = Math.max(level.spawn.x + 800, width - 320);
  return {
    ...level,
    width,
    goal: {
      ...level.goal,
      x: goalX,
    },
    platforms: level.platforms
      .filter((platform) => platform.x < width)
      .map((platform) => ({
        ...platform,
        width: Math.min(platform.width, width - platform.x),
        max: platform.moving ? Math.min(platform.max, width - platform.width) : platform.max,
      }))
      .filter((platform) => platform.width > 0),
    enemies: level.enemies.filter((enemy) => enemy.x < goalX - 120).map((enemy) => ({ ...enemy })),
    civilians: level.civilians.filter((civilian) => civilian.x < goalX - 180).map((civilian) => ({ ...civilian })),
    collectibles: level.collectibles.filter((coin) => coin.x < goalX - 80).map((coin) => ({ ...coin })),
  };
}
