import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const username = process.env.VOICE_JOURNAL_BASIC_AUTH_USER;
  const password = process.env.VOICE_JOURNAL_BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const credentials = parseBasicAuth(authorization);

  if (credentials?.username === username && credentials.password === password) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Voice Journal", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|manifest.webmanifest|sw.js|icons|favicon.ico).*)"
  ]
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
