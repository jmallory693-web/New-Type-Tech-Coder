/// <reference types="vite/client" />

import type { NttcApi } from "../shared/types";

declare global {
  interface Window {
    nttc: NttcApi;
  }
}

export {};
