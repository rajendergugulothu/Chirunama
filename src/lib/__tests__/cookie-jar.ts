// An in-memory stand-in for next/headers' cookies() in tests that run outside a request.
// Use with: vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }))

export type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  path?: string;
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
};

export class CookieJar {
  private readonly values = new Map<string, string>();
  readonly options = new Map<string, CookieOptions>();
  readonly deleted: string[] = [];

  get(name: string): { name: string; value: string } | undefined {
    const value = this.values.get(name);
    return value === undefined ? undefined : { name, value };
  }

  has(name: string): boolean {
    return this.values.has(name);
  }

  set(name: string, value: string, options: CookieOptions = {}): this {
    this.values.set(name, value);
    this.options.set(name, options);
    return this;
  }

  delete(name: string): this {
    this.values.delete(name);
    this.deleted.push(name);
    return this;
  }

  clear(): void {
    this.values.clear();
    this.options.clear();
    this.deleted.length = 0;
  }
}
