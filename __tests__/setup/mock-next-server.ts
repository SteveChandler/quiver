// Simplified mock for `next/server` to make NextRequest/NextResponse usable in Jest.
// Covers the minimal surface used in our tests and routes.

class MockNextRequest {
  url: string;
  method: string;
  headers: Headers;
  private _body?: string | Uint8Array | null;

  constructor(input: string | URL, init: RequestInit = {}) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = (init.method || 'GET').toUpperCase();
    this.headers = new Headers(init.headers);
    // Support both string and Uint8Array bodies
    this._body = (init as any).body ?? null;
  }

  async json() {
    if (!this._body) return null;
    if (typeof this._body === 'string') return JSON.parse(this._body);
    try {
      const text = new TextDecoder().decode(this._body);
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async text() {
    if (!this._body) return '';
    if (typeof this._body === 'string') return this._body;
    return new TextDecoder().decode(this._body);
  }
}

class MockNextResponse extends Response {
  static json(data: any, init: ResponseInit = {}): MockNextResponse {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return new MockNextResponse(body, { ...init, headers });
  }

  static redirect(url: string | URL, init: number | ResponseInit = 307): MockNextResponse {
    const status = typeof init === 'number' ? init : (init.status ?? 307);
    const headers = new Headers(typeof init === 'number' ? undefined : init.headers);
    headers.set('Location', typeof url === 'string' ? url : url.toString());
    return new MockNextResponse(undefined, { status, headers });
  }

  static next(init: ResponseInit = {}): MockNextResponse {
    return new MockNextResponse(undefined, init);
  }
}

// Named exports matching next/server
export { MockNextRequest as NextRequest, MockNextResponse as NextResponse };

// Provide a minimal type export for compatibility in some imports
export type { MockNextRequest as NextRequestType };

