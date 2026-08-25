import { FastifyInstance } from "fastify";

// Manual security headers — equivalent to @fastify/helmet core defaults.
// Avoids a full helmet dependency for a lightweight API.
export function securityPlugin(app: FastifyInstance): void {
  app.addHook("onSend", async (_req, reply) => {
    // Prevent MIME sniffing
    reply.header("X-Content-Type-Options", "nosniff");
    // Stop browsers from rendering the page in a frame/iframe (clickjacking)
    reply.header("X-Frame-Options", "DENY");
    // XSS filter (legacy browsers)
    reply.header("X-XSS-Protection", "1; mode=block");
    // Force HTTPS for future requests (1 year)
    reply.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    // No referrer info to external sites
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    // CSP: block inline scripts & restrict resource origins
    // Allows API JSON responses and same-origin fetches.
    reply.header(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "script-src 'none'",
        "style-src 'none'",
        "img-src 'none'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join("; ")
    );
    // Remove server fingerprint
    reply.removeHeader("X-Powered-By");
    reply.removeHeader("Server");
  });
}
