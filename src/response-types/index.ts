const mkResponse = (status: number, statusText: string) => (body: BodyInit = null, init: Omit<RequestInit, 'status' | 'statusText'> = {}) => new Response(body, {
  status,
  statusText,
  ...init,
});

const mkRedirect = (status: number, statusText: string) => (location: string | URL, init: Omit<RequestInit, 'status' | 'statusText'> = {}) => new Response(null, {
  status,
  statusText,
  ...init,
  headers: [
    ...init?.headers ? Array.isArray(init.headers) ? init.headers : new Headers(init.headers) : [],
    ['Location', location.toString()],
  ],
}); 

export const ok = mkResponse(200, 'OK');
export const created = mkResponse(201, 'Created');
export const accepted = mkResponse(202, 'Accepted');
export const nonAuthoritativeInformation = mkResponse(203, 'Non-Authoritative Information');
export const noContent = mkResponse(204, 'No Content');
export const resetContent = mkResponse(205, 'Reset Content');
export const partialContent = mkResponse(206, 'Partial Content');
export const multiStatus = mkResponse(207, 'Multi-Status');
export const alreadyReported = mkResponse(208, 'Already Reported');
export const imUsed = mkResponse(226, 'IM Used');

export const multipleChoices = mkRedirect(300, 'Multiple Choices');
export const movedPermanently = mkRedirect(301, 'Moved Permanently');
export const found = mkRedirect(302, 'Found');
export const seeOther = mkRedirect(303, 'See Other');
export const notModified = mkResponse(304, 'Not Modified');
export const temporaryRedirect = mkRedirect(307, 'Temporary Redirect');
export const permanentRedirect = mkRedirect(308, 'Permanent Redirect');

export const badRequest = mkResponse(400, 'Bad Request');
export const unauthorized = mkResponse(401, 'Unauthorized');
export const paymentRequired = mkResponse(402, 'Payment Required');
export const forbidden = mkResponse(403, 'Forbidden');
export const notFound = mkResponse(404, 'Not Found');
export const methodNotAllowed = mkResponse(405, 'Method Not Allowed');
export const notAcceptable = mkResponse(406, 'Not Acceptable');
export const proxyAuthenticationRequired = mkResponse(407, 'Proxy Authentication Required');
export const requestTimeout = mkResponse(408, 'Request Timeout');
export const conflict = mkResponse(409, 'Conflict');
export const gone = mkResponse(410, 'Gone');
export const lengthRequired = mkResponse(411, 'Length Required');
export const preconditionFailed = mkResponse(412, 'Precondition Failed');
export const payloadTooLarge = mkResponse(413, 'Payload Too Large');
export const uriTooLong = mkResponse(414, 'URI Too Long');
export const unsupportedMediaType = mkResponse(415, 'Unsupported Media Type');
export const rangeNotSatisfiable = mkResponse(416, 'Range Not Satisfiable');
export const expectationFailed = mkResponse(417, 'Expectation Failed');
export const imATeapot = mkResponse(418, 'I\'m a teapot');
export const misdirectedRequest = mkResponse(421, 'Misdirected Request');
export const unprocessableEntity = mkResponse(422, 'Unprocessable Entity');
export const locked  = mkResponse(423, 'Locked');
export const failedDependency = mkResponse(424, 'Failed Dependency');
export const tooEarly = mkResponse(425, 'Too Early');
export const upgradeRequired = mkResponse(426, 'Upgrade Required');
export const preconditionRequired = mkResponse(428, 'Precondition Required');
export const tooManyRequests = mkResponse(429, 'Too Many Requests');
export const requestHeaderFieldsTooLarge = mkResponse(431, 'Request Header Fields Too Large');
export const unavailableForLegalReasons = mkResponse(451, 'Unavailable For Legal Reasons');

export const internalServerError = mkResponse(500, 'Internal Server Error');
export const notImplemented = mkResponse(501, 'Not Implemented');
export const badGateway = mkResponse(502, 'Bad Gateway');
export const serviceUnavailable = mkResponse(503, 'Service Unavailable');
export const gatewayTimeout = mkResponse(504, 'Gateway Timeout');
export const httpVersionNotSupported = mkResponse(505, 'HTTP Version Not Supported');
export const variantAlsoNegotiates = mkResponse(506, 'Variant Also Negotiates');
export const insufficientStorage = mkResponse(507, 'Insufficient Storage');
export const loopDetected = mkResponse(508, 'Loop Detected');
export const notExtended = mkResponse(510, 'Not Extended');
export const networkAuthenticationRequired = mkResponse(511, 'Network Authentication Required');
