/**
 * Country from an IP address, looked up in the free DB-IP "IP to Country Lite" database that ships in
 * node_modules (@ip-location-db/dbip-country, CC BY 4.0: the country picker links to db-ip.com as the
 * licence asks). Nothing leaves the server and nothing is stored: the address is looked up and dropped.
 *
 * The tables are sorted ranges, held as typed arrays and searched by bisection. They load in the
 * background on start; until they are ready a lookup answers null and the home shows the default photos.
 */
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const require = createRequire(import.meta.url);

let v4 = null; // { start: Uint32Array, end: Uint32Array, code: Uint16Array }
let v6 = null; // { sHi, sLo, eHi, eLo: BigUint64Array, code: Uint16Array }
const CODES = [];
const CODE_INDEX = new Map();

function codeIndex(cc) {
  let i = CODE_INDEX.get(cc);
  if (i === undefined) {
    i = CODES.length;
    CODES.push(cc);
    CODE_INDEX.set(cc, i);
  }
  return i;
}

async function readRows(file, onRow) {
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const [a, b, cc] = line.split(",");
    if (a && b && /^[A-Z]{2}$/.test(cc ?? "")) onRow(a, b, cc);
  }
}

const MASK = (1n << 64n) - 1n;

export async function loadGeo(dir) {
  const base = dir ?? dirname(require.resolve("@ip-location-db/dbip-country/package.json"));
  const s4 = [], e4 = [], c4 = [];
  await readRows(join(base, "dbip-country-ipv4-num.csv"), (a, b, cc) => {
    s4.push(Number(a));
    e4.push(Number(b));
    c4.push(codeIndex(cc));
  });
  v4 = { start: Uint32Array.from(s4), end: Uint32Array.from(e4), code: Uint16Array.from(c4) };
  const rows = [];
  await readRows(join(base, "dbip-country-ipv6-num.csv"), (a, b, cc) => rows.push([BigInt(a), BigInt(b), codeIndex(cc)]));
  const n = rows.length;
  const t = { sHi: new BigUint64Array(n), sLo: new BigUint64Array(n), eHi: new BigUint64Array(n), eLo: new BigUint64Array(n), code: new Uint16Array(n) };
  rows.forEach(([s, e, c], i) => {
    t.sHi[i] = s >> 64n;
    t.sLo[i] = s & MASK;
    t.eHi[i] = e >> 64n;
    t.eLo[i] = e & MASK;
    t.code[i] = c;
  });
  v6 = t;
  return { v4: v4.start.length, v6: n };
}

export const geoReady = () => v4 !== null;

function parseV4(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function parseV6(ip) {
  if (!/^[0-9a-f:]+$/i.test(ip) || !ip.includes(":")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

/** The two-letter country for an address, or null (unknown, private, or tables still loading). */
export function countryForIp(raw) {
  if (!v4 || !raw) return null;
  let ip = String(raw).trim();
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  const n4 = parseV4(ip);
  if (n4 !== null) {
    let lo = 0, hi = v4.start.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (n4 < v4.start[mid]) hi = mid - 1;
      else if (n4 > v4.end[mid]) lo = mid + 1;
      else return CODES[v4.code[mid]];
    }
    return null;
  }
  const n6 = v6 ? parseV6(ip) : null;
  if (n6 === null) return null;
  const h = n6 >> 64n, l = n6 & MASK;
  const lt = (aH, aL, bH, bL) => aH < bH || (aH === bH && aL < bL);
  let lo = 0, hi = v6.code.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lt(h, l, v6.sHi[mid], v6.sLo[mid])) hi = mid - 1;
    else if (lt(v6.eHi[mid], v6.eLo[mid], h, l)) lo = mid + 1;
    else return CODES[v6.code[mid]];
  }
  return null;
}
