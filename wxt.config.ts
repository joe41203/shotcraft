import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "shotcraft",
		description:
			"スクリーンショットを撮影して、その場で注釈・モザイク・クロップ。完全ローカル動作のスクリーンショット編集ツール",
		permissions: ["activeTab", "scripting", "storage"],
		icons: {
			16: "/icon/16.png",
			32: "/icon/32.png",
			48: "/icon/48.png",
			128: "/icon/128.png",
		},
		action: {
			default_icon: {
				16: "/icon/16.png",
				32: "/icon/32.png",
				48: "/icon/48.png",
			},
		},
	},
});
