// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        // Bundle trpc-electron in preload so it resolves correctly
        exclude: ["trpc-electron"]
      })
    ]
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared")
      }
    },
    plugins: [tailwindcss(), react()],
    // Serve Monaco files from public directory
    publicDir: resolve("public")
  }
});
export {
  electron_vite_config_default as default
};
