
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");

const folders = [
  "admin",
  "assets_models",
  "Cashier",
  "customer",
  "graphic-designer",
  "Inventory",
  "staff"
];

const files = [
  "index.html",
  "user-register.html",
  "email-verification.html",
  "email-verification.js",
  "email-verification.css",
  "logo.png",
  "showroom.jpg"
];

fs.mkdirSync(output, { recursive: true });

for (const folder of folders) {
  const source = path.join(root, folder);
  const destination = path.join(output, folder);

  if (!fs.existsSync(source)) continue;

  fs.cpSync(source, destination, {
    recursive: true,
    force: true
  });
}

for (const file of files) {
  const source = path.join(root, file);
  const destination = path.join(output, file);

  if (!fs.existsSync(source)) continue;

  fs.copyFileSync(source, destination);
}

console.log("JCN public files prepared.");
