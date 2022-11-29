import handlePost from './post';
import handlePatch from './patch';
import handleHead from './head';
import handleOptions from './options';

export const defaultHandlers = {
  'POST': handlePost,
  'PATCH': handlePatch,
  'HEAD': handleHead,
  'OPTIONS': handleOptions,
};
