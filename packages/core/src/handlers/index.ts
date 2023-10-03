import handleDelete from './delete';
import handleHead from './head';
import handleOptions from './options';
import handlePatch from './patch';
import handlePost from './post';

export const defaultHandlers = {
  'DELETE': handleDelete,
  'HEAD': handleHead,
  'OPTIONS': handleOptions,
  'PATCH': handlePatch,
  'POST': handlePost,
};
