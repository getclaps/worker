export const ok = (msg = null) => new Response(msg, { status: 200 });
export const badRequest = (msg = null) => new Response(msg, { status: 400 });
export const forbidden = (msg = null) => new Response(msg, { status: 401 });
export const paymentRequired = (msg = null) => new Response(msg, { status: 402 });
export const notFound = (msg = null) => new Response(msg, { status: 404 });
export const conflict = (msg = null) => new Response(msg, { status: 409 });
export const internalServerError = (msg = null) => new Response(msg, { status: 500 })

/** @param {string|URL} location @param {RequestInit} param1 */
export const redirect = (location, { headers = [], ...options } = {}) => new Response(null, { 
  ...options, 
  status: 303, 
  headers: [
    ['Location', location],
    // @ts-ignore
    ...new Headers(headers),
  ], 
}); 
