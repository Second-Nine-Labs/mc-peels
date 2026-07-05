import { handle } from 'hono/vercel';
import { createApp } from '../src/http/app';

export default handle(createApp());
