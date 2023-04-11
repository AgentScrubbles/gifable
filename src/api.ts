import { Prisma } from '@prisma/client';
import { FastifyError, FastifyInstance, FastifyRequest } from 'fastify';
import {
  Asset,
  AssetCreate,
  AssetCreateType,
  AssetSearch,
  AssetSearchType,
  AssetType,
  AssetUpdate,
  AssetUpdateType,
  UpdateParams,
  UpdateParamsType,
  Upload,
  UploadType,
  UserType,
  LoginType,
  Login,
  AssetListType,
  AssetList,
  User,
} from './api.types';
import { errorHandler } from './error-handler';
import createHttpError from 'http-errors';
import { getImageData } from './image-service';
import ms from 'ms';
import bytes from 'bytes';

const MAX_FILE_SIZE = bytes('10MB');

export default async function api(app: FastifyInstance) {
  app.post<{ Body: AssetCreateType; Reply: AssetType }>(
    '/assets',
    { schema: { body: AssetCreate, response: { 201: Asset } } },
    async (request, reply) => {
      const userId = await getSessionUserId(request);

      const asset = await app.db.asset.create({
        data: {
          ...request.body,
          user: {
            connect: { id: userId },
          },
        },
      });

      reply.status(201);

      return asset;
    }
  );

  app.post<{
    Body: AssetUpdateType;
    Params: UpdateParamsType;
    Reply: AssetType;
  }>(
    '/assets/:id',
    {
      schema: {
        params: UpdateParams,
        body: AssetUpdate,
        response: { 200: Asset },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await getSessionUserId(request);

      const assets = await app.db.asset.findMany({
        where: { id, userId },
        select: { id: true },
      });

      if (!assets?.length) {
        throw createHttpError.NotFound();
      }

      const asset = await app.db.asset.update({
        where: { id },
        data: request.body,
      });

      reply.status(200);

      return asset;
    }
  );

  app.get<{
    Params: UpdateParamsType;
    Reply: AssetType;
  }>(
    '/assets/:id',
    { schema: { params: UpdateParams, response: { 200: Asset } } },
    async (request) => {
      const userId = await getSessionUserId(request);

      const [asset] = await app.db.asset.findMany({
        where: { id: request.params.id, userId },
      });

      if (!asset) throw createHttpError.NotFound();

      return asset;
    }
  );

  app.get<{ Reply: AssetListType; Querystring: AssetSearchType }>(
    '/assets',
    { schema: { querystring: AssetSearch, response: { 200: AssetList } } },
    async (request, reply) => {
      const userId = await getSessionUserId(request);

      const { search } = request.query;
      const where: Prisma.AssetWhereInput = {
        userId,
      };
      if (search) {
        where.comment = { contains: search.trim() };
      }
      reply.header('Cache-Control', 'no-cache');
      return app.db.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    }
  );

  app.delete<{
    Params: UpdateParamsType;
    Reply: null;
  }>(
    '/assets/:id',
    { schema: { params: UpdateParams } },
    async (request, reply) => {
      const userId = await getSessionUserId(request);

      const [asset] = await app.db.asset.findMany({
        where: { id: request.params.id, userId },
        select: { url: true },
      });

      if (!asset) {
        throw createHttpError.NotFound();
      }

      await app.db.asset.delete({
        where: { id: request.params.id },
      });

      const storageFilename = app.storage.getFilenameFromURL(asset.url);
      if (storageFilename) {
        await app.storage.delete(storageFilename);
      }

      reply.status(204);
      return null;
    }
  );

  app.post<{ Body: UploadType; Reply: AssetType }>(
    '/upload-url',
    { schema: { body: Upload } },
    async (request, reply) => {
      const userId = await getSessionUserId(request);

      if (await app.storage.exists(request.body.filename)) {
        throw createHttpError.Conflict(
          `File with name "${request.body.filename}" already exists`
        );
      }

      const buffer = await app.storage.download(request.body.url, {
        progress(size) {
          if (size > MAX_FILE_SIZE) {
            throw createHttpError.PayloadTooLarge(
              `File size is too large (max ${bytes(MAX_FILE_SIZE)})`
            );
          }
        },
      });

      const { url } = await app.storage.upload(buffer, request.body.filename);

      const asset = await app.db.asset.create({
        data: {
          userId,
          url,
        },
      });

      reply.status(201);
      return asset;
    }
  );

  app.post<{
    Reply: AssetType;
    Params: UpdateParamsType;
  }>(
    '/assets/:id/parse',
    { schema: { params: UpdateParams } },
    async (request, reply) => {
      const { id } = request.params;
      const userId = await getSessionUserId(request);

      const [asset] = await app.db.asset.findMany({
        where: { id, userId },
      });

      if (!asset) throw createHttpError.NotFound();

      try {
        const imageData = await getImageData(asset.url);
        const updatedAsset = await app.db.asset.update({
          where: { id },
          data: imageData,
        });
        return updatedAsset;
      } catch (error) {
        request.log.error(error, "Couldn't parse image");
        return asset;
      }
    }
  );

  app.post<{
    Reply: UserType;
  }>(
    '/users',
    { schema: { response: { 201: User } } },
    async (request, reply) => {
      if (process.env.DISABLE_SIGNUP) {
        throw createHttpError.Forbidden('Signup is disabled');
      }
      const user = await app.db.user.create({ data: {} });
      reply.status(201);
      request.session.set('userId', user.id);
      request.session.options({ maxAge: ms('1 day') / 1000 });
      return user;
    }
  );

  app.post<{
    Body: LoginType;
  }>('/login', { schema: { body: Login } }, async (request, reply) => {
    const user = await app.db.user.findUnique({
      where: { account: request.body.account },
    });
    if (!user) throw createHttpError.NotFound();

    request.session.set('userId', user.id);
    request.session.options({ maxAge: ms('1 day') / 1000 });

    return {
      message: 'Logged in',
    };
  });

  app.setErrorHandler(errorHandler);

  app.addHook('onError', async (request, reply, error: FastifyError) => {
    if (!error.statusCode || error.statusCode >= 500) {
      request.log.error(error, error.message);
    }
  });

  async function getSessionUserId(request: FastifyRequest) {
    let userId = request.session.get('userId');

    const authorisation = request.headers.authorization;
    if (authorisation) {
      let account: string;
      const [type, auth] = authorisation.split(' ');

      switch (type) {
        case 'Basic':
          const [username, password] = Buffer.from(auth, 'base64')
            .toString()
            .split(':');
          account = password;
          break;

        case 'Bearer':
          account = auth;
          break;

        default:
          throw createHttpError.BadRequest(
            `Invalid authorization type "${type}"`
          );
      }

      const user = await app.db.user.findUnique({
        where: { account },
        select: { id: true },
      });
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      throw createHttpError.Unauthorized();
    }
    return userId;
  }
}
