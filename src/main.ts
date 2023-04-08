import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import server from './server';
import FileStorage from './file-storage';
import env from './env';
import bytes from 'bytes';

const PORT = Number(env.get('PORT') || 3000);

export default async function main() {
  const db = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  const storage = new FileStorage({
    bucket: env.require('S3_BUCKET'),
    basePath: env.get('S3_BASE_PATH'),
    storageBaseURL: env.require('S3_STORAGE_BASE_URL'),
    maxFileSize: Number(env.get('S3_MAX_FILE_SIZE')) || bytes('10MB'),
    storage: {
      endPoint: env.require('S3_ENDPOINT'),
      port: Number(env.get('S3_PORT')) || undefined,
      useSSL: env.get('S3_USE_SSL')
        ? env.get('S3_USE_SSL') === 'true'
        : undefined,
      accessKey: env.require('S3_ACCESS_KEY'),
      secretKey: env.require('S3_SECRET_KEY'),
      region: env.get('S3_REGION'),
    },
  });

  await db.$connect();

  const fastify = server({ db, storage });

  return fastify;
}

if (require.main === module) {
  main()
    .then((fastify) => {
      fastify.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
        if (err) {
          fastify.log.error(err);
          process.exit(1);
        }
        fastify.log.info(`Server started`);
      });
    })
    .catch((err) => {
      console.error('failed to start server.', err);
      process.exit(1);
    });
}
