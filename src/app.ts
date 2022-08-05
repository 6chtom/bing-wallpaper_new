import Fastify, { FastifyInstance, FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Ajv, { JSONSchemaType } from 'ajv';
import path from 'path';
import { promises as fs } from 'fs';

const resolutions = [
	'UHD',
	'1920x1200',
	'1920x1080',
	'1366x768',
	'1280x768',
	'1024x768',
	'800x600',
	'800x480',
	'768x1280',
	'720x1280',
	'640x480',
	'480x800',
	'400x240',
	'320x240',
	'240x320',
] as const;

type QuerystringType = {
	resolution?: typeof resolutions[number];
	w?: number;
	h?: number;
	qlt?: number;
	index?: number;
	date?: string;
	rand?: boolean;
	format?: 'json';
};

const querystringSchema: JSONSchemaType<QuerystringType> = {
	type: 'object',
	properties: {
		resolution: {
			type: 'string',
			nullable: true,
			enum: resolutions,
			default: '1920x1080',
		},
		w: {
			type: 'integer',
			minimum: 0,
			nullable: true,
		},
		h: {
			type: 'integer',
			minimum: 0,
			nullable: true,
		},
		qlt: {
			type: 'integer',
			nullable: true,
			minimum: 0,
			maximum: 100,
		},
		index: {
			type: 'integer',
			nullable: true,
		},
		date: {
			type: 'string',
			pattern: '\\d{8}',
			nullable: true,
		},
		rand: {
			type: 'boolean',
			nullable: true,
			default: false,
		},
		format: {
			type: 'string',
			nullable: true,
			enum: ['json'],
		},
	},
	additionalProperties: false,
};

interface ImageType {
	startdate: string;
	copyright: string;
	urlbase: string;
	title: string;
}

const BASE_URL = 'https://www.bing.com';

const dataFilePath = path.join(__dirname, '..', 'json', 'data.json');

const getImageByIndex = (data: ImageType[], index: number) => {
	const len = data.length;

	if (index >= len) {
		throw new Error(`Out of range, max is ${len - 1}`);
	}

	if (index < 0) {
		return data[len + index];
	}

	return data[index];
};

const getImageByDate = (data: ImageType[], date: string) => {
	const image = data.find((item) => item.startdate === date);

	if (!image) {
		throw new Error(`Out of date`);
	}

	return image;
};

const getImageRandom = (data: ImageType[]) => {
	const len = data.length;
	const idx = Math.floor(len * Math.random());

	return getImageByIndex(data, idx);
};

export const createApp = (options: FastifyServerOptions = {}) => {
	const app = Fastify({
		ignoreTrailingSlash: true,
		...options,
	});

	app.register(cors, { origin: true, methods: ['GET'] });
	app.register(sensible);

	app.get(
		'/api',
		{
			schema: {
				querystring: querystringSchema,
			},
		},
		async (
			request: FastifyRequest<{
				Querystring: QuerystringType;
			}>,
			reply: FastifyReply
		) => {
			const { date, index, rand, format, resolution, ...params } = request.query;

			const data = JSON.parse(await fs.readFile(dataFilePath, 'utf8'));

			let image: ImageType & { url?: string };

			if (typeof index === 'number') {
				image = getImageByIndex(data, index);
			} else if (date) {
				image = getImageByDate(data, date);
			} else if (rand === true) {
				image = getImageRandom(data);
			} else {
				image = getImageByIndex(data, 0);
			}

			const search = new URLSearchParams(params as any).toString();
			const url = `${BASE_URL}${image.urlbase}_${resolution}.jpg` + (search ? `&${search}` : '');

			console.log('url: ', url);

			if (format === 'json') {
				return { ...image, url };
			}

			return reply.redirect(307, url);
		}
	);

	return app;
};
