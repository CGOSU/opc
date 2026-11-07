import { Elysia } from "elysia";
import { node } from "@elysia/node";

export function createApp() {
  return (
    new Elysia({ adapter: node() })
      // Liveness only: does not claim database or external-service readiness.
      .get("/health", () => ({
        status: "ok",
        service: "opc-api",
        check: "liveness",
      }))
  );
}
