import { ZodError, type ZodTypeAny, z } from "zod";

import { validationError } from "./errors";

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    throw validationError("Request body must be valid JSON.");
  }

  try {
    return schema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError("Request validation failed.", error.flatten());
    }

    throw error;
  }
}

export async function parseOptionalJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let rawBody: unknown = {};

  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  try {
    return schema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationError("Request validation failed.", error.flatten());
    }

    throw error;
  }
}
