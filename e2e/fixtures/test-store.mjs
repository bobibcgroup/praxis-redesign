/**
 * A stand-in Shopify store for the hybrid tests (suite 14): /products.json and /meta.json in the
 * shape a real store serves, with pieces chosen so the dinner looks come out mixed. POST /__mode with
 * "down" or "up" makes the list fail or work. Photos point at an https host the tests answer for.
 */
import { createServer } from "node:http";

export const PHOTO_HOST = "https://cdn.praxis-test.example";
const v = (id, size, price, available) => ({ id, option1: size, title: size, price, available });
const ROWS = [
  // title, type, price, sizes in stock (the first size is sold out), photo
  ["Wool Blazer in Charcoal", "Outerwear", "398.00", ["38", "40", "42"], "blazer.jpg"],
  ["Merino Crew in Navy", "Sweaters", "98.00", ["S", "M", "L"], "crew.jpg"],
  ["Chino in Charcoal", "Pants", "128.00", ["30", "32", "34"], "chino.jpg"],
  ["Selvedge Jean in Indigo", "Pants", "158.00", ["30", "32", "34"], "jean.jpg"],
  ["Ripstop Pant in Black", "Pants", "142.00", ["30", "32"], "missing.jpg"],
  ["Organic Tee in Heather Grey", "T-Shirts", "38.00", ["S", "M", "L"], "tee.jpg"],
  ["Overshirt in Olive", "Shirts", "148.00", ["M", "L"], "overshirt.jpg"],
  ["Suede Chukka in Brown", "Footwear", "248.00", ["9", "10", "11"], "chukka.jpg"],
  ["White Leather Sneaker", "Footwear", "198.00", ["9", "10", "11"], "missing.jpg"],
  ["Chelsea Boot in Black Leather", "Footwear", "298.00", null, "boot.jpg"],
  ["Gift Card", "Gift Card", "50.00", ["Default Title"], null],
];
export const PRODUCTS = ROWS.map(([title, type, price, sizes, photo], i) => ({
  id: i + 1,
  handle: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  vendor: "Test Tailors",
  product_type: type,
  tags: [],
  options: [{ name: "Size" }],
  // A null size list: every size sold out.
  variants: (sizes ?? ["9", "10"]).map((s, j) => v(i * 10 + j, s, price, sizes !== null && j !== 0)),
  images: photo ? [{ src: `${PHOTO_HOST}/${photo}`, alt: title, width: 1200, height: 1500 }] : [],
}));

export function startTestStore(port = 4199) {
  let down = false;
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url.startsWith("/__mode")) {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        down = body.trim() === "down";
        res.end("{}");
      });
      return;
    }
    if (req.url.startsWith("/products.json")) {
      if (down) {
        res.statusCode = 503;
        return res.end("{}");
      }
      return res.end(JSON.stringify({ products: req.url.includes("page=1") ? PRODUCTS : [] }));
    }
    if (req.url.startsWith("/meta.json")) return res.end(JSON.stringify({ name: "Test Tailors" }));
    res.statusCode = 404;
    res.end("{}");
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}
