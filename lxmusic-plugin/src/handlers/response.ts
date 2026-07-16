export function jsonResponse(body: unknown, status: number = 200): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  const json = JSON.stringify(body);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: new Uint8Array(json.split('').map(c => c.charCodeAt(0))),
  };
}

export function successResponse(data: unknown, msg: string = 'success'): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return jsonResponse({ code: 0, msg, data });
}

export function errorResponse(msg: string, code: number = 500): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return jsonResponse({ code, msg, data: null }, code);
}

export function warningResponse(data: unknown, warning: string): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return jsonResponse({ code: 0, msg: 'success', data, warning });
}

export function textResponse(text: string, status: number = 200): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: new Uint8Array(text.split('').map(c => c.charCodeAt(0))),
  };
}

export function htmlResponse(html: string, status: number = 200): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
    body: new Uint8Array(html.split('').map(c => c.charCodeAt(0))),
  };
}

export function notFoundResponse(): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return jsonResponse({ code: 404, msg: 'Not Found', data: null }, 404);
}

export function badRequestResponse(msg: string): {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
} {
  return jsonResponse({ code: 400, msg, data: null }, 400);
}
