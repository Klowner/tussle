import handleCreate from './create';
import handlePatch from './patch';
import handleHead from './head';
import handleOptions from './options';

export const defaultHandlers = {
  'POST': handleCreate,
  'PATCH': handlePatch,
  'HEAD': handleHead,
  'OPTIONS': handleOptions,
};
