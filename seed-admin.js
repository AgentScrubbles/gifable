"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// seed-admin.ts
var import_client = require("@prisma/client");
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var db = new import_client.PrismaClient();
var log = (message) => console.log(`ADMIN SEED: ${message}`);
async function main() {
  var _a;
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return;
  }
  try {
    const admin = await db.user.findUnique({
      where: { username: ADMIN_USERNAME }
    });
    if (admin) {
      log(`Admin user '${ADMIN_USERNAME}' already exists`);
      return;
    }
    log(`Seeding admin user '${ADMIN_USERNAME}'`);
    await db.user.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash: await import_bcryptjs.default.hash(ADMIN_PASSWORD, 10),
        isAdmin: true
      }
    });
    log(`Admin user '${ADMIN_USERNAME}' created`);
  } catch (error) {
    if ((error == null ? void 0 : error.code) === "P2021" || ((_a = error == null ? void 0 : error.message) == null ? void 0 : _a.includes("does not exist"))) {
      log(
        "Database tables not found. Run 'npx prisma migrate deploy' first for new databases."
      );
      return;
    }
    throw error;
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error("Error in seed-admin:", e);
  process.exit(1);
});
