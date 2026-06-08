import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (error: Error, request: FastifyRequest, reply: FastifyReply) => void
  ) => void;
}): void {
  app.setErrorHandler((error, _request, reply) => {
    let statusCode = 500;
    let detail = error.message || "Internal Server Error";

    if (error instanceof AppError) {
      statusCode = error.statusCode;
    } else if (error instanceof ZodError) {
      statusCode = 422;
      detail = "Validation error";
    }

    reply.status(statusCode).send({ detail });
  });
}
