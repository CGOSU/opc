import { env } from "cloudflare:workers";
import { createApp } from "./app";

export default createApp(() => env).compile();
