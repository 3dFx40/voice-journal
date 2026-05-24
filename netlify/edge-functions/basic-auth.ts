type EdgeContext = {
  next: () => Promise<Response>;
};

declare const Netlify: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export default async function basicAuth(request: Request, context: EdgeContext) {
  const username = Netlify.env.get("VOICE_JOURNAL_BASIC_AUTH_USER");
  const password = Netlify.env.get("VOICE_JOURNAL_BASIC_AUTH_PASSWORD");

  if (!username || !password) {
    return context.next();
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));

  if (credentials?.username === username && credentials.password === password) {
    return context.next();
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Voice Journal", charset="UTF-8"'
    }
  });
}

export const config = {
  path: "/*"
};

function parseBasicAuth(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}
