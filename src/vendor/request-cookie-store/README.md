# Request Cookie Store
An implementation of the [Cookie Store API](https://wicg.github.io/cookie-store) for request handlers. 

It uses the `Cookie` header of a request to populate the store and
keeps a record of changes that can be exported as a list of `Set-Cookie` headers.

Note this is not a polyfill. It is intended as a cookie middleware for Cloudflare Workers,
and published here as a standalone module.

## Recipes 
The following snippets should give you an idea how to use this class:

```ts
const example = new Request({ headers: { 'cookie': 'foo=bar; fizz=buzz' } });
const cookieStore = new RequestCookieStore(example);
```

### Fast Read Access
Avoid using `(await cookieStore.get(name))?.value` for every read, by parsing all cookies into a `Map` once:

```ts
type Cookies = ReadonlyMap<string, string>;
const all = await cookieStore.getAll();
const cookies: Cookies = new Map(all.map(({ name, value }) => [name, value]));
// => Map { "foo" => "bar", "fizz" => "buzz" }
```

 
### Exporting Headers 

```ts
cookieStore.set('foo', 'buzz');
cookieStore.set('fizz', 'bar');
event.respondWith(new Response(null, cookieStore));
```

Will produce the following HTTP:

```http
HTTP/1.1 200 OK
content-length: 0
set-cookie: foo=buzz
set-cookie: fizz=bar
```

Note that [due to the weirdness][1] of the Fetch API `Headers` class, inspecting the response in JS will not produce the correct result.  
However, Cloudflare Workers does put the correct `set-cookie` headers on the network.

[1]: #fetch-api-headers

### Combine With Other Headers
The above example uses a shortcut. To add additional headers to a response, you can do the following:

```ts
const response = new Response(null, {
  headers: [
    ...new Headers({ 'X-Foo': 'Bar' }),
    ...cookieStore.headers,
  ],
});
// or set imperatively:
response.headers.set('X-Fizz', 'Buzz');
```