import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@` / `~` をプロジェクトルートに解決する（wxt/.wxt tsconfig のパスに一致）。
// これでソースが使う `@/lib/...` 形式の import をテストからも読める。
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
	resolve: {
		alias: {
			"@": root,
			"~": root,
		},
	},
});
