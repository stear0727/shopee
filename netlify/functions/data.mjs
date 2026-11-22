// /api/data：電腦與手機之間的雲端同步（Netlify Blobs）
import { getStore } from '@netlify/blobs';
import { makeHandler } from '../lib/sync-core.mjs';

export default makeHandler(getStore);
export const config = { path: '/api/data' };
