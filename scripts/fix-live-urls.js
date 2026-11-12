
const fs = require("fs");
const { execFileSync } = require("child_process");

const files = execFileSync(
  "git",
  ["ls-files", "-z"],
  { encoding: "utf8" }
).split("\0").filter(Boolean);

const frontendFolders = [
  "admin/",
  "customer/",
  "Inventory/",
  "Cashier/",
  "staff/",
  "graphic-designer/"
];

const allowedExtensions = /\.(js|html|css)$/i;

let updated = 0;

for (const file of files) {
  const isFrontend =
    frontendFolders.some(folder => file.startsWith(folder)) ||
    [
      "index.html",
      "user-register.html",
      "email-verification.html",
      "email-verifiaction.js",
      "email-verification.js",
      "email-verification.css"
    ].includes(file);

  if (!isFrontend || !allowedExtensions.test(file)) continue;

  const original = fs.readFileSync(file, "utf8");

  const modified = original
    .replaceAll("http://localhost:5000", "")
    .replaceAll("http://127.0.0.1:5000", "")
    .replaceAll("http://localhost:5500", "")
    .replaceAll("http://127.0.0.1:5500", "");

  if (modified !== original) {
    fs.writeFileSync(file, modified, "utf8");
    console.log("Updated:", file);
    updated++;
  }
}

console.log(`Updated ${updated} frontend files.`);
