export const ok = (msg: BodyInit = null) => new Response(msg, { status: 200 });
export const badRequest = (msg: BodyInit = null) => new Response(msg, { status: 400 });
export const forbidden = (msg: BodyInit = null) => new Response(msg, { status: 401 });
export const paymentRequired = (msg: BodyInit = null) => new Response(msg, { status: 402 });
export const notFound = (msg: BodyInit = null) => new Response(msg, { status: 404 });
export const conflict = (msg: BodyInit = null) => new Response(msg, { status: 409 });
export const internalServerError = (msg: BodyInit = null) => new Response(msg, { status: 500 })

export const redirect = (
  location: string|URL, 
  { headers = [], ...options }: Omit<RequestInit, 'headers'> & { headers?: [string, string][] } = {}
) => new Response(null, { 
  ...options, 
  status: 303, 
  headers: [
    ['Location', location.toString()],
    ...headers,
  ], 
}); 
