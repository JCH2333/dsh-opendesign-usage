window.__ModuleLoader__.load({
	id: "dsh-opendesign-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		/** Element factories, mirroring the compiler output of the reference bundle. */
		const jsx = react_jsx_runtime.jsx;
		const jsxs = react_jsx_runtime.jsxs;
		//#region dsh-opendesign-usage/client/style.css
		/** The single <style> tag this plugin owns. */
		const STYLE_ID = "opendesign-usage-style";
		/** All plugin CSS, injected once from apply(). Class names are odus-* prefixed. */
		const CSS = `
.odus-wrap{display:inline-flex;position:relative}
.odus-chip{height:24px;color:var(--dsw-alias-label-primary,#0f1115);cursor:pointer;white-space:nowrap;user-select:none;background:0 0;border:0;border-radius:999px;align-items:center;gap:6px;padding:0 6px 0 8px;font-size:12px;line-height:1;transition:background-color .12s;display:inline-flex}
.odus-chip:hover,.odus-chipOpen{background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
.odus-logo{flex:none;display:inline-flex}
.odus-seg{align-items:baseline;gap:3px;display:inline-flex}
.odus-segSep{opacity:.45}
.odus-chevron{color:var(--dsw-alias-label-caption,#81858c);flex:none;transition:transform .12s;display:inline-flex}
.odus-chevronOpen{transform:rotate(180deg)}
.odus-segWarn50{color:var(--dsw-static-amber-400,#f7ad31);--odus-fill:var(--dsw-static-amber-400,#f7ad31)}
.odus-segWarn70{color:var(--dsw-static-amber-600,#dd8629);--odus-fill:var(--dsw-static-amber-600,#dd8629)}
.odus-segErr80{color:var(--dsw-alias-state-error-primary,#dc2626);--odus-fill:var(--dsw-alias-state-error-primary,#dc2626)}
.odus-segCrit90{color:var(--dsw-alias-state-error-primary,#dc2626);font-weight:600;--odus-fill:var(--dsw-alias-state-error-primary,#dc2626)}
.odus-details{z-index:40;border:1px solid var(--dsw-alias-border-l2,#0000001a);background:#fff;background-color:#fff;min-width:260px;color:var(--dsw-alias-label-primary,#0f1115);box-shadow:var(--dsw-shadow-lv3,0 4px 12px #00000014);border-radius:8px;flex-direction:column;gap:8px;padding:10px 12px;font-size:12px;display:flex;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%);-webkit-backdrop-filter:none;backdrop-filter:none;opacity:1}
.odus-detailsDark{background:#1f2023;background-color:#1f2023;border-color:#ffffff1f;color:#e6edf3;opacity:1}
.odus-window{flex-direction:column;gap:4px;display:flex}
.odus-windowLabel{color:var(--dsw-alias-label-secondary,#61666b);opacity:.9;font-size:11px}
.odus-bar{background:var(--dsw-alias-bg-layer-2,#0000000f);border-radius:999px;height:4px;overflow:hidden;display:block}
.odus-barFill{background:var(--odus-fill,var(--dsw-alias-state-business-primary,#3964fe));border-radius:999px;height:100%;transition:width .18s;display:block}
.odus-windowMeta{color:var(--dsw-alias-label-secondary,#61666b);opacity:.8;font-variant-numeric:tabular-nums;font-size:11px;white-space:nowrap}
.odus-divider{border-top:1px solid var(--dsw-alias-border-l1,#0000000a);display:block}
.odus-hint{opacity:.55;font-size:11px;white-space:normal}
.odus-loginMsg{color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;white-space:normal}
.odus-loginMsgError{color:var(--dsw-alias-state-error-primary,#dc2626);font-size:11px;white-space:normal}
.odus-loginMsgOk{color:var(--dsw-alias-state-success-primary,#16a34a);font-size:11px;white-space:normal}
.odus-errRow{align-items:baseline;gap:6px;display:flex;white-space:normal}
.odus-errCode{color:var(--dsw-alias-state-error-primary,#dc2626);font-weight:600;flex:none}
.odus-errMsg{opacity:.75;font-size:11px}
.odus-foot{justify-content:space-between;align-items:center;gap:8px;font-size:11px;display:flex}
.odus-footRight{align-items:center;gap:8px;margin-left:auto;display:inline-flex}
.odus-loginBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}
.odus-loginBtn:hover{text-decoration:underline}
.odus-loginBtn:disabled{opacity:.6;cursor:default;text-decoration:none}
.odus-loginBtnHot{color:var(--dsw-alias-state-business-primary,#3964fe);font-weight:600;border-radius:4px;box-shadow:0 0 0 2px var(--dsw-alias-state-business-primary,#3964fe);padding:1px 6px;margin:-1px -6px;animation:odus-pulse 1.4s ease-in-out infinite}
.odus-refreshBtn{color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;background:0 0;border:0;padding:0;font-size:11px}
.odus-refreshBtn:hover{text-decoration:underline}
.odus-updatedAt{opacity:.6;font-variant-numeric:tabular-nums}
@keyframes odus-pulse{0%,100%{box-shadow:0 0 0 2px var(--dsw-alias-state-business-primary,#3964fe)}50%{box-shadow:0 0 0 4px var(--dsw-alias-state-business-primary,#3964fe33)}}
`;
		/** Append the plugin stylesheet to <head> exactly once. */
		function injectStyle() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const tag = document.createElement("style");
			tag.id = STYLE_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		/** Class-name map for the stylesheet above. */
		const styles = {
			wrap: "odus-wrap",
			chip: "odus-chip",
			chipOpen: "odus-chipOpen",
			logo: "odus-logo",
			seg: "odus-seg",
			segSep: "odus-segSep",
			chevron: "odus-chevron",
			chevronOpen: "odus-chevronOpen",
			segWarn50: "odus-segWarn50",
			segWarn70: "odus-segWarn70",
			segErr80: "odus-segErr80",
			segCrit90: "odus-segCrit90",
			details: "odus-details",
			detailsDark: "odus-detailsDark",
			window: "odus-window",
			windowLabel: "odus-windowLabel",
			bar: "odus-bar",
			barFill: "odus-barFill",
			windowMeta: "odus-windowMeta",
			divider: "odus-divider",
			hint: "odus-hint",
			loginMsg: "odus-loginMsg",
			loginMsgError: "odus-loginMsgError",
			loginMsgOk: "odus-loginMsgOk",
			errRow: "odus-errRow",
			errCode: "odus-errCode",
			errMsg: "odus-errMsg",
			foot: "odus-foot",
			footRight: "odus-footRight",
			loginBtn: "odus-loginBtn",
			loginBtnHot: "odus-loginBtnHot",
			refreshBtn: "odus-refreshBtn",
			updatedAt: "odus-updatedAt"
		};
		//#endregion
		//#region dsh-opendesign-usage/client/api
		/** Same-origin snapshot endpoint (cached host read). */
		const API_VIEW = "/api/opendesign-usage";
		/** Same-origin forced-refresh endpoint. */
		const API_REFRESH = "/api/opendesign-usage/refresh";
		/** Masked config endpoint (GET reads, POST writes). */
		const API_CONFIG = "/api/opendesign-usage/config";
		/** Spawn the host login window (Chrome + CDP cookie harvest). */
		const API_LOGIN = "/api/opendesign-usage/login";
		/** Login progress endpoint polled while a login is in flight. */
		const API_LOGIN_STATUS = "/api/opendesign-usage/login/status";
		/** Same-origin JSON fetch helper; tolerates an empty or non-JSON body. */
		async function odusageFetch(path, init) {
			const response = await fetch(path, init);
			if (!response.ok) throw new Error("opendesign-usage " + path + " failed: " + response.status);
			try {
				const body = await response.json();
				return body !== null && typeof body === "object" ? body : {};
			} catch (error) {
				return {};
			}
		}
		/** The host usage API as the browser sees it (same-origin JSON endpoints). */
		const odusageApi = {
			view: () => odusageFetch(API_VIEW),
			refresh: () => odusageFetch(API_REFRESH),
			config: () => odusageFetch(API_CONFIG),
			writeConfig: (partial) => odusageFetch(API_CONFIG, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(partial)
			}),
			login: () => odusageFetch(API_LOGIN, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({})
			}),
			loginStatus: () => odusageFetch(API_LOGIN_STATUS)
		};
		//#endregion
		//#region dsh-opendesign-usage/client/format
		/** Poll interval for the host snapshot. */
		const POLL_MS = 1e4;
		/** Poll interval while a host login window is open. */
		const LOGIN_POLL_MS = 2e3;
		/** Short window label used in the collapsed chip. */
		const WINDOW_LABELS = {
			rolling: "5h",
			weekly: "7d"
		};
		/** Display order of the two chip windows. */
		const WINDOW_ORDER = {
			rolling: 0,
			weekly: 1
		};
		/** Format a duration (seconds) compactly: 45s / 23m / 5h 23m / 4d 6h. */
		function formatDuration(totalSec) {
			if (totalSec < 60) return String(Math.max(0, Math.floor(totalSec))) + "s";
			if (totalSec < 3600) return Math.floor(totalSec / 60) + "m";
			if (totalSec < 86400) {
				const h = Math.floor(totalSec / 3600);
				const m = Math.floor(totalSec % 3600 / 60);
				return m > 0 ? h + "h " + m + "m" : h + "h";
			}
			const d = Math.floor(totalSec / 86400);
			const h = Math.floor(totalSec % 86400 / 3600);
			return h > 0 ? d + "d " + h + "h" : d + "d";
		}
		/** Format an epoch-ms time as HH:MM. */
		function formatClock(epochMs) {
			const d = new Date(epochMs);
			return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
		}
		/** Clamp one window's used percentage into 0-100 integers. */
		function usedPercentOf(windowView) {
			const used = Number.isFinite(windowView.usedPercent) ? windowView.usedPercent : Number.isFinite(windowView.remainingPercent) ? 100 - windowView.remainingPercent : 0;
			return Math.min(100, Math.max(0, Math.round(used)));
		}
		/** Seconds until the window resets (host value first, ISO fallback). */
		function resetInSecOf(windowView) {
			if (Number.isFinite(windowView.resetInSec)) return windowView.resetInSec;
			if (typeof windowView.resetsAt === "string") {
				const at = Date.parse(windowView.resetsAt);
				if (Number.isFinite(at)) return Math.max(0, Math.round((at - Date.now()) / 1e3));
			}
			return void 0;
		}
		/** Severity class of one used percentage: >=50 amber, >=70 orange, >=80 red, >=90 red bold. */
		function severityClass(usedPercent) {
			if (usedPercent >= 90) return styles.segCrit90;
			if (usedPercent >= 80) return styles.segErr80;
			if (usedPercent >= 70) return styles.segWarn70;
			if (usedPercent >= 50) return styles.segWarn50;
			return void 0;
		}
		//#endregion
		//#region dsh-opendesign-usage/client/OpendesignDockEntry
		/** Detect dark mode via the DSH body attribute, kept live by a MutationObserver. */
		function useDarkMode() {
			const [dark, setDark] = react.useState(() => {
				if (typeof document === "undefined") return false;
				const body = document.body;
				return body !== null && body !== void 0 && body.hasAttribute("data-ds-dark-theme");
			});
			react.useEffect(() => {
				const el = document.body;
				if (el === null || el === void 0) return void 0;
				const observer = new MutationObserver(() => {
					setDark(el.hasAttribute("data-ds-dark-theme"));
				});
				observer.observe(el, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme"]
				});
				return () => observer.disconnect();
			}, []);
			return dark;
		}
		/** The OpenDesign mark: a ring around a cut diamond, inlined to avoid asset requests. */
		function OpendesignLogo(props) {
			const dark = props.dark === true;
			return jsxs("svg", {
				className: styles.logo,
				width: "14",
				height: "14",
				viewBox: "0 0 24 24",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [jsx("circle", {
					cx: "12",
					cy: "12",
					r: "9.3",
					stroke: dark ? "#e6edf3" : "#0f1115",
					strokeWidth: "1.6",
					opacity: "0.85"
				}), jsx("path", {
					d: "M12 4.4 19.6 12 12 19.6 4.4 12Z M12 9.2 14.8 12 12 14.8 9.2 12Z",
					fill: dark ? "#7c9bff" : "#3964fe",
					fillRule: "evenodd"
				})]
			});
		}
		/** Render one collapsed-chip segment: "· 5h 12%". */
		function WindowSegment(props) {
			const windowView = props.window;
			const used = usedPercentOf(windowView);
			const label = typeof windowView.label === "string" && windowView.label.length > 0 ? windowView.label : WINDOW_LABELS[windowView.kind] !== void 0 ? WINDOW_LABELS[windowView.kind] : "?";
			return jsxs("span", {
				className: styles.seg,
				children: [props.sep !== void 0 ? jsx("span", {
					className: styles.segSep,
					children: props.sep
				}) : null, jsxs("span", {
					className: severityClass(used),
					children: [label, " ", used, "%"]
				})]
			});
		}
		/** True for the two windows the chip shows (rolling 5h, weekly 7d). */
		function isChipWindow(windowView) {
			return windowView !== null && typeof windowView === "object" && (windowView.kind === "rolling" || windowView.kind === "weekly");
		}
		/**
		 * The OpenDesign usage chip: polls the host snapshot, renders the 5-hour and
		 * 7-day windows inline, expands into a detail panel with per-window progress
		 * bars, a login action and a manual refresh.
		 * @param props - the composed dock entry props.
		 */
		function OpendesignDockEntry(props) {
			const t = typeof props.t === "function" ? props.t : fallbackTranslate;
			const [view, setView] = react.useState(null);
			const [open, setOpen] = react.useState(false);
			const [login, setLogin] = react.useState({
				state: "idle",
				message: void 0
			});
			const [busy, setBusy] = react.useState(false);
			const wrapRef = react.useRef(null);
			const loginTimerRef = react.useRef(null);
			const dark = useDarkMode();
			const refresh = react.useCallback(() => {
				setBusy(true);
				odusageApi.refresh().then((snapshot) => {
					setView(snapshot);
					setBusy(false);
				}, () => {
					setBusy(false);
				});
			}, []);
			const stopLoginPoll = react.useCallback(() => {
				if (loginTimerRef.current !== null) {
					window.clearInterval(loginTimerRef.current);
					loginTimerRef.current = null;
				}
			}, []);
			const startLoginPoll = react.useCallback(() => {
				stopLoginPoll();
				loginTimerRef.current = window.setInterval(() => {
					odusageApi.loginStatus().then((status) => {
						const state = typeof status.state === "string" ? status.state : "pending";
						setLogin({
							state,
							message: status.message
						});
						if (state === "success") {
							stopLoginPoll();
							refresh();
						} else if (state === "failed") stopLoginPoll();
					}, () => void 0);
				}, LOGIN_POLL_MS);
			}, [refresh, stopLoginPoll]);
			const doLogin = react.useCallback(() => {
				setOpen(true);
				setLogin({
					state: "pending",
					message: void 0
				});
				odusageApi.login().then((result) => {
					const state = typeof result.state === "string" ? result.state : "pending";
					if (state === "failed") {
						setLogin({
							state: "failed",
							message: result.message
						});
						return;
					}
					if (state === "success") {
						setLogin({
							state: "success",
							message: result.message
						});
						refresh();
						return;
					}
					startLoginPoll();
				}, (error) => {
					setLogin({
						state: "failed",
						message: error instanceof Error ? error.message : String(error)
					});
				});
			}, [refresh, startLoginPoll]);
			const pollNow = react.useCallback(() => {
				let live = true;
				odusageApi.view().then((snapshot) => {
					if (live) setView(snapshot);
				}, () => {
					if (live) setView({ error: "fetch" });
				});
				return () => {
					live = false;
				};
			}, []);
			react.useEffect(() => {
				const stop = pollNow();
				const timer = window.setInterval(pollNow, POLL_MS);
				const onVisibility = () => {
					if (document.visibilityState === "visible") pollNow();
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					stop();
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisibility);
				};
			}, [pollNow]);
			react.useEffect(() => () => stopLoginPoll(), [stopLoginPoll]);
			react.useEffect(() => {
				if (!open) return void 0;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target !== null && wrapRef.current !== null && !wrapRef.current.contains(target)) setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			const sep = " " + t("odusage.sep") + " ";
			const error = view === null ? {
				code: "fetch",
				message: t("odusage.error", { code: "fetch" })
			} : view.error !== void 0 && view.error !== null ? {
				code: String(view.error),
				message: typeof view.message === "string" && view.message.length > 0 ? view.message : t("odusage.error", { code: String(view.error) })
			} : null;
			const needsLogin = error !== null && (error.code === "noconfig" || error.code === "unauthorized");
			const windows = (view !== null && Array.isArray(view.windows) ? view.windows : []).filter(isChipWindow).sort((a, b) => (WINDOW_ORDER[a.kind] !== void 0 ? WINDOW_ORDER[a.kind] : 9) - (WINDOW_ORDER[b.kind] !== void 0 ? WINDOW_ORDER[b.kind] : 9));
			const windowTitle = (windowView) => {
				if (windowView.kind === "rolling") return t("odusage.rolling");
				if (windowView.kind === "weekly") return t("odusage.weekly");
				return typeof windowView.label === "string" ? windowView.label : t("odusage.other");
			};
			const renderWindowRow = (windowView) => {
				const used = usedPercentOf(windowView);
				const remaining = 100 - used;
				const cls = severityClass(used);
				const resetIn = resetInSecOf(windowView);
				return jsxs("span", {
					className: styles.window,
					children: [jsx("span", {
						className: styles.windowLabel,
						children: windowTitle(windowView)
					}), jsx("span", {
						className: styles.bar,
						children: jsx("span", {
							className: cls === void 0 ? styles.barFill : styles.barFill + " " + cls,
							style: { width: used + "%" }
						})
					}), jsxs("span", {
						className: styles.windowMeta,
						children: [jsx("span", {
							className: cls,
							children: t("odusage.used", { percent: used })
						}), sep, t("odusage.remaining", { percent: remaining }), resetIn === void 0 ? "" : sep, resetIn === void 0 ? "" : t("odusage.resetsAt", { duration: formatDuration(resetIn) })]
					})]
				}, windowView.kind);
			};
			const renderPanel = () => {
				const children = [];
				if (error !== null) children.push(jsxs("span", {
					className: styles.errRow,
					children: [jsx("span", {
						className: styles.errCode,
						children: "<err:" + error.code + ">"
					}), jsx("span", {
						className: styles.errMsg,
						children: error.message
					})]
				}));
				else for (const windowView of windows) children.push(renderWindowRow(windowView));
				children.push(jsx("span", {
					className: styles.hint,
					children: t("odusage.hint")
				}));
				if (login.state === "pending") children.push(jsx("span", {
					className: styles.loginMsg,
					children: t("odusage.loggingIn")
				}));
				else if (login.state === "success") children.push(jsx("span", {
					className: styles.loginMsgOk,
					children: t("odusage.loginSuccess")
				}));
				else if (login.state === "failed") children.push(jsx("span", {
					className: styles.loginMsgError,
					children: t("odusage.loginFailed", { message: typeof login.message === "string" && login.message.length > 0 ? login.message : t("odusage.loginFailedUnknown") })
				}));
				children.push(jsx("span", { className: styles.divider }));
				children.push(jsxs("span", {
					className: styles.foot,
					children: [jsx("button", {
						type: "button",
						className: needsLogin ? styles.loginBtn + " " + styles.loginBtnHot : styles.loginBtn,
						onClick: doLogin,
						disabled: login.state === "pending",
						children: login.state === "pending" ? t("odusage.loggingIn") : t("odusage.login")
					}), jsxs("span", {
						className: styles.footRight,
						children: [jsx("button", {
							type: "button",
							className: styles.refreshBtn,
							onClick: refresh,
							children: busy ? t("odusage.refreshing") : t("odusage.refresh")
						}), view !== null && Number.isFinite(view.updatedAt) ? jsx("span", {
							className: styles.updatedAt,
							children: t("odusage.updatedAt", { time: formatClock(view.updatedAt) })
						}) : null]
					})]
				}));
				return jsx("span", {
					className: dark ? styles.details + " " + styles.detailsDark : styles.details,
					children
				});
			};
			const chipClass = open ? styles.chip + " " + styles.chipOpen : styles.chip;
			const onChipClick = () => setOpen((current) => !current);
			const chevron = jsx("span", {
				className: open ? styles.chevron + " " + styles.chevronOpen : styles.chevron,
				"aria-hidden": "true",
				children: jsx("svg", {
					width: "12",
					height: "12",
					viewBox: "0 0 12 12",
					fill: "none",
					children: jsx("path", {
						d: "M3 4.5L6 7.5L9 4.5",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})
			});
			if (error !== null) return jsxs("span", {
				className: styles.wrap,
				ref: wrapRef,
				"data-testid": "odus-chip-error",
				children: [jsxs("button", {
					type: "button",
					className: chipClass,
					onClick: onChipClick,
					title: error.message,
					children: [jsx(OpendesignLogo, { dark }), " <err:" + error.code + ">", chevron]
				}), open ? renderPanel() : null]
			});
			if (windows.length === 0) return jsxs("button", {
				type: "button",
				className: styles.chip,
				onClick: refresh,
				title: t("odusage.refresh"),
				"data-testid": "odus-chip-empty",
				children: [jsx(OpendesignLogo, { dark }), " " + t("odusage.unavailable")]
			});
			return jsxs("span", {
				className: styles.wrap,
				ref: wrapRef,
				"data-testid": "odus-chip",
				children: [jsxs("button", {
					type: "button",
					className: chipClass,
					onClick: onChipClick,
					title: open ? t("odusage.collapse") : t("odusage.expand"),
					children: [jsx(OpendesignLogo, { dark }), windows.map((windowView, index) => jsx(WindowSegment, {
						window: windowView,
						sep: index === 0 ? void 0 : sep
					}, windowView.kind)), chevron]
				}), open ? renderPanel() : null]
			});
		}
		//#endregion
		//#region dsh-opendesign-usage/client/locales
		/** Chinese copy. */
		const zh = {
			"odusage.sep": "·",
			"odusage.rolling": "5 小时",
			"odusage.weekly": "7 天",
			"odusage.other": "窗口",
			"odusage.used": "已用 {percent}%",
			"odusage.remaining": "剩余 {percent}%",
			"odusage.resetsAt": "重置于 {duration}",
			"odusage.login": "登录",
			"odusage.loggingIn": "登录中…",
			"odusage.loginSuccess": "登录成功",
			"odusage.loginFailed": "登录失败：{message}",
			"odusage.loginFailedUnknown": "未知错误",
			"odusage.hint": "将打开浏览器窗口，请在其中完成登录",
			"odusage.refresh": "刷新",
			"odusage.refreshing": "刷新中…",
			"odusage.updatedAt": "更新于 {time}",
			"odusage.error": "查询失败：{code}",
			"odusage.unavailable": "用量不可用",
			"odusage.expand": "展开用量详情",
			"odusage.collapse": "收起"
		};
		/** English copy. */
		const en = {
			"odusage.sep": "·",
			"odusage.rolling": "5-hour",
			"odusage.weekly": "7-day",
			"odusage.other": "window",
			"odusage.used": "used {percent}%",
			"odusage.remaining": "left {percent}%",
			"odusage.resetsAt": "resets in {duration}",
			"odusage.login": "Sign in",
			"odusage.loggingIn": "Signing in…",
			"odusage.loginSuccess": "Signed in",
			"odusage.loginFailed": "Sign-in failed: {message}",
			"odusage.loginFailedUnknown": "unknown error",
			"odusage.hint": "A browser window will open - finish signing in there",
			"odusage.refresh": "Refresh",
			"odusage.refreshing": "Refreshing…",
			"odusage.updatedAt": "upd {time}",
			"odusage.error": "Query failed: {code}",
			"odusage.unavailable": "usage unavailable",
			"odusage.expand": "Show usage details",
			"odusage.collapse": "Collapse"
		};
		/** Stand-in translate used when the slot does not compose a "t". */
		function fallbackTranslate(key, params) {
			const template = zh[key] !== void 0 ? zh[key] : en[key] !== void 0 ? en[key] : key;
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (match, name) => params[name] !== void 0 ? String(params[name]) : match);
		}
		//#endregion
		//#region dsh-opendesign-usage/client/index
		/** Dictionary namespace owned by this plugin. */
		const NS = "odusage";
		/** Required services: slots for the composer tool-row entry, locale for the copy. */
		const inject = ["slots", "locale"];
		/**
		 * Register the usage chip into the composer tool row next to the model selector.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			injectStyle();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-opendesign-usage: dictionaries");
			ctx.inject(["slots", "conversation", "connection"], (scope) => {
				scope.effect(() => scope.slots.register({
					name: "conversation.input.right",
					id: "opendesign-usage",
					order: 110,
					locale: NS
				}, OpendesignDockEntry), "dsh-opendesign-usage: chip registration");
			});
		}
		//#endregion
		exports.OpendesignDockEntry = OpendesignDockEntry;
		exports.apply = apply;
		exports.formatDuration = formatDuration;
		exports.inject = inject;
		return module.exports;
	}
});
