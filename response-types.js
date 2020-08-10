export const ok = (msg = null) => new Response(msg, { status: 200 });
export const badRequest = (msg = null) => new Response(msg, { status: 400 });
export const forbidden = (msg = null) => new Response(msg, { status: 401 });
export const notFound = (msg = null) => new Response(msg, { status: 404 });
export const conflict = (msg = null) => new Response(msg, { status: 409 });
export const redirect = (location) => new Response(null, { status: 301, headers: { 'Location': location } })
