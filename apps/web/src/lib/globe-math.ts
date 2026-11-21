export type GlobeNode = {
  id: string;
  lon: number;
  lat: number;
  labelZh: string;
  labelEn: string;
  weight: number;
  hub?: boolean;
  labelSide?: "left" | "right";
};

export const GLOBE_CENTER = 300;
export const GLOBE_RADIUS = 228;
export const INITIAL_YAW = -116;
export const INITIAL_PITCH = -22;

const DEG = Math.PI / 180;

export const GLOBE_NODES: GlobeNode[] = [
  {
    id: "hk",
    lon: 114.17,
    lat: 22.32,
    labelZh: "香港",
    labelEn: "Hong Kong",
    weight: 12,
    hub: true,
    labelSide: "left",
  },
  {
    id: "tokyo",
    lon: 139.69,
    lat: 35.68,
    labelZh: "东京",
    labelEn: "Tokyo",
    weight: 9,
  },
  {
    id: "sg",
    lon: 103.82,
    lat: 1.35,
    labelZh: "新加坡",
    labelEn: "Singapore",
    weight: 8,
  },
  {
    id: "seoul",
    lon: 126.98,
    lat: 37.57,
    labelZh: "首尔",
    labelEn: "Seoul",
    weight: 5,
    labelSide: "left",
  },
  {
    id: "sydney",
    lon: 151.21,
    lat: -33.87,
    labelZh: "悉尼",
    labelEn: "Sydney",
    weight: 5,
  },
  {
    id: "mumbai",
    lon: 72.88,
    lat: 19.08,
    labelZh: "孟买",
    labelEn: "Mumbai",
    weight: 4,
    labelSide: "left",
  },
  {
    id: "frankfurt",
    lon: 8.68,
    lat: 50.11,
    labelZh: "法兰克福",
    labelEn: "Frankfurt",
    weight: 7,
  },
  {
    id: "london",
    lon: -0.13,
    lat: 51.51,
    labelZh: "伦敦",
    labelEn: "London",
    weight: 7,
    labelSide: "left",
  },
  {
    id: "sfo",
    lon: -122.42,
    lat: 37.77,
    labelZh: "旧金山",
    labelEn: "San Francisco",
    weight: 8,
  },
  {
    id: "nyc",
    lon: -74.01,
    lat: 40.71,
    labelZh: "纽约",
    labelEn: "New York",
    weight: 6,
  },
  {
    id: "saopaulo",
    lon: -46.63,
    lat: -23.55,
    labelZh: "圣保罗",
    labelEn: "São Paulo",
    weight: 4,
  },
];

// Simplified recognizable world landmass rings ([lon, lat] degrees)
const RAW_LAND: [number, number][][] = [
  // Eurasia
  [
    [-9, 36],
    [-9, 43],
    [-1, 43],
    [-4, 48],
    [2, 51],
    [8, 54],
    [10, 58],
    [5, 61],
    [14, 68],
    [28, 71],
    [42, 68],
    [60, 70],
    [74, 73],
    [104, 77],
    [136, 73],
    [168, 66],
    [174, 62],
    [160, 56],
    [156, 51],
    [141, 53],
    [135, 44],
    [129, 35],
    [126, 38],
    [121, 39],
    [118, 38],
    [122, 31],
    [120, 23],
    [114, 22],
    [108, 21],
    [109, 12],
    [103, 1],
    [100, 7],
    [98, 16],
    [92, 22],
    [87, 22],
    [80, 13],
    [77, 8],
    [72, 21],
    [67, 25],
    [56, 26],
    [50, 29],
    [59, 22],
    [44, 13],
    [35, 30],
    [36, 36],
    [27, 37],
    [24, 41],
    [14, 45],
    [16, 40],
    [10, 44],
    [4, 43],
    [-5, 36],
  ],
  // Africa
  [
    [-17, 15],
    [-16, 21],
    [-10, 31],
    [-5, 36],
    [10, 37],
    [12, 33],
    [24, 32],
    [32, 31],
    [35, 25],
    [43, 12],
    [51, 11],
    [45, 2],
    [40, -6],
    [40, -15],
    [35, -24],
    [28, -33],
    [18, -34],
    [14, -22],
    [12, -12],
    [9, -2],
    [9, 4],
    [2, 6],
    [-8, 5],
    [-15, 11],
  ],
  // Australia
  [
    [114, -22],
    [122, -18],
    [130, -12],
    [136, -12],
    [142, -11],
    [146, -18],
    [153, -27],
    [150, -37],
    [141, -38],
    [135, -35],
    [129, -32],
    [115, -34],
    [113, -26],
  ],
  // Japan
  [
    [130, 31],
    [132, 34],
    [136, 34],
    [140, 36],
    [141, 41],
    [145, 44],
    [142, 45],
    [140, 41],
    [138, 37],
    [133, 35],
    [130, 33],
  ],
  // Maritime SE Asia (Borneo / Sumatra / Java simplified)
  [
    [109, 2],
    [116, 6],
    [118, 1],
    [116, -3],
    [111, -3],
    [109, 0],
  ],
  [
    [95, 5],
    [100, 3],
    [105, -6],
    [114, -8],
    [110, -7],
    [102, -4],
    [97, 2],
  ],
  // UK
  [
    [-5, 50],
    [1, 51],
    [1, 54],
    [-2, 58],
    [-6, 58],
    [-5, 54],
  ],
  // Greenland
  [
    [-44, 60],
    [-36, 66],
    [-22, 72],
    [-18, 81],
    [-42, 83],
    [-60, 77],
    [-52, 68],
  ],
  // North America
  [
    [-166, 65],
    [-156, 71],
    [-134, 69],
    [-110, 68],
    [-94, 68],
    [-82, 63],
    [-64, 60],
    [-56, 52],
    [-66, 44],
    [-74, 40],
    [-81, 31],
    [-80, 25],
    [-83, 29],
    [-90, 29],
    [-97, 26],
    [-96, 19],
    [-87, 21],
    [-83, 10],
    [-78, 8],
    [-84, 9],
    [-92, 14],
    [-105, 20],
    [-110, 24],
    [-117, 32],
    [-123, 38],
    [-125, 48],
    [-136, 58],
    [-152, 60],
    [-162, 56],
  ],
  // South America
  [
    [-78, 9],
    [-72, 11],
    [-62, 10],
    [-50, 1],
    [-35, -6],
    [-38, -14],
    [-42, -23],
    [-52, -33],
    [-64, -42],
    [-67, -54],
    [-73, -53],
    [-74, -42],
    [-71, -30],
    [-71, -18],
    [-81, -5],
    [-79, 2],
  ],
];

function densifyRing(
  ring: [number, number][],
  maxStep = 6,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

const LAND_RINGS = RAW_LAND.map((ring) => densifyRing(ring, 5));

export type Vec3 = { x: number; y: number; z: number };

export function projectPoint(
  lon: number,
  lat: number,
  yaw: number,
  pitch: number,
): Vec3 {
  const dLon = (lon + yaw) * DEG;
  const latR = lat * DEG;
  const phi0 = -pitch * DEG;
  const cosLat = Math.cos(latR);
  const sinLat = Math.sin(latR);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const cosDLon = Math.cos(dLon);

  const x = cosLat * Math.sin(dLon);
  const y = cosPhi0 * sinLat - sinPhi0 * cosLat * cosDLon;
  const z = sinPhi0 * sinLat + cosPhi0 * cosLat * cosDLon;
  return { x, y, z };
}

function toScreen(v: Vec3, scale = 1): [number, number] {
  return [
    GLOBE_CENTER + v.x * GLOBE_RADIUS * scale,
    GLOBE_CENTER - v.y * GLOBE_RADIUS * scale,
  ];
}

function clipPolygonFront(pts: Vec3[]): Vec3[] {
  const clipped: Vec3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const aIn = a.z >= 0;
    const bIn = b.z >= 0;
    if (aIn) clipped.push(a);
    if (aIn !== bIn) {
      const t = a.z / (a.z - b.z);
      let ix = a.x + (b.x - a.x) * t;
      let iy = a.y + (b.y - a.y) * t;
      const len = Math.hypot(ix, iy) || 1;
      ix /= len;
      iy /= len;
      clipped.push({ x: ix, y: iy, z: 0 });
    }
  }
  return clipped;
}

export function buildLandPath(yaw: number, pitch: number): string {
  const parts: string[] = [];
  for (const ring of LAND_RINGS) {
    const projected = ring.map(([lon, lat]) =>
      projectPoint(lon, lat, yaw, pitch),
    );
    const clipped = clipPolygonFront(projected);
    if (clipped.length < 3) continue;
    let seg = "";
    for (let i = 0; i < clipped.length; i++) {
      const [sx, sy] = toScreen(clipped[i]);
      seg += `${i === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`;
    }
    parts.push(seg + "Z");
  }
  return parts.join(" ");
}

export function buildGraticulePath(yaw: number, pitch: number): string {
  const parts: string[] = [];
  // Latitudes
  for (const lat of [-60, -30, 0, 30, 60]) {
    let drawing = false;
    for (let lon = -180; lon <= 180; lon += 6) {
      const p = projectPoint(lon, lat, yaw, pitch);
      if (p.z > 0.01) {
        const [sx, sy] = toScreen(p);
        parts.push(`${drawing ? "L" : "M"}${sx.toFixed(1)},${sy.toFixed(1)}`);
        drawing = true;
      } else {
        drawing = false;
      }
    }
  }
  // Longitudes
  for (let lon = -150; lon <= 180; lon += 30) {
    let drawing = false;
    for (let lat = -84; lat <= 84; lat += 6) {
      const p = projectPoint(lon, lat, yaw, pitch);
      if (p.z > 0.01) {
        const [sx, sy] = toScreen(p);
        parts.push(`${drawing ? "L" : "M"}${sx.toFixed(1)},${sy.toFixed(1)}`);
        drawing = true;
      } else {
        drawing = false;
      }
    }
  }
  return parts.join(" ");
}

function lonLatToUnit(lon: number, lat: number): [number, number, number] {
  const lonR = lon * DEG;
  const latR = lat * DEG;
  return [
    Math.cos(latR) * Math.cos(lonR),
    Math.cos(latR) * Math.sin(lonR),
    Math.sin(latR),
  ];
}

export function buildArcPaths(yaw: number, pitch: number): string[] {
  const hub = GLOBE_NODES[0];
  const u0 = lonLatToUnit(hub.lon, hub.lat);
  const paths: string[] = [];

  for (let n = 1; n < GLOBE_NODES.length; n++) {
    const target = GLOBE_NODES[n];
    const u1 = lonLatToUnit(target.lon, target.lat);
    const dot = Math.max(
      -1,
      Math.min(1, u0[0] * u1[0] + u0[1] * u1[1] + u0[2] * u1[2]),
    );
    const omega = Math.acos(dot);
    if (omega < 0.01) continue;
    const sinOmega = Math.sin(omega);

    let d = "";
    let drawing = false;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w0 = Math.sin((1 - t) * omega) / sinOmega;
      const w1 = Math.sin(t * omega) / sinOmega;
      const vx = w0 * u0[0] + w1 * u1[0];
      const vy = w0 * u0[1] + w1 * u1[1];
      const vz = w0 * u0[2] + w1 * u1[2];
      const lat = Math.asin(Math.max(-1, Math.min(1, vz))) / DEG;
      const lon = Math.atan2(vy, vx) / DEG;
      const p = projectPoint(lon, lat, yaw, pitch);
      if (p.z > 0.04) {
        const lift = 1 + 0.1 * Math.sin(Math.PI * t);
        const [sx, sy] = toScreen(p, lift);
        d += `${drawing ? "L" : "M"}${sx.toFixed(1)},${sy.toFixed(1)}`;
        drawing = true;
      } else {
        drawing = false;
      }
    }
    if (d) paths.push(d);
  }
  return paths;
}

export function projectNodes(yaw: number, pitch: number) {
  return GLOBE_NODES.map((node) => {
    const p = projectPoint(node.lon, node.lat, yaw, pitch);
    const [sx, sy] = toScreen(p);
    const r = node.hub
      ? 9
      : Math.max(4.5, Math.min(11, 3.2 + Math.sqrt(node.weight) * 1.9));
    return {
      ...node,
      sx,
      sy,
      z: p.z,
      r,
      visible: p.z > 0.06,
    };
  });
}
