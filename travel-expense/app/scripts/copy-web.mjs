// 把網頁版（../index.html 與圖示）複製到 www/，供 Capacitor 打包
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const src = dirname(app);
const www = join(app, "www");
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const f of ["index.html", "config.js", "manifest.webmanifest", "icons"]) cpSync(join(src, f), join(www, f), { recursive: true });
console.log("已複製網頁到", www);
