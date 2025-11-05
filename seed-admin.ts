import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const db = new PrismaClient();

const log = (message: string) => console.log(`ADMIN SEED: ${message}`);

async function main() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return;
  }

  try {
    const admin = await db.user.findUnique({
      where: { username: ADMIN_USERNAME },
    });

    if (admin) {
      log(`Admin user '${ADMIN_USERNAME}' already exists`);
      return;
    }

    log(`Seeding admin user '${ADMIN_USERNAME}'`);

    await db.user.create({
      data: {
        username: ADMIN_USERNAME,
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        isAdmin: true,
      },
    });

    log(`Admin user '${ADMIN_USERNAME}' created`);
  } catch (error: any) {
    if (
      error?.code === "P2021" ||
      error?.message?.includes("does not exist")
    ) {
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
