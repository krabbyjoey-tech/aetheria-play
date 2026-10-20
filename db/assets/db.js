/* EMBERWISP web database (tools/db/build_db.py copies this to assets/db.js).
   Theme and language buttons, list filters and sorting, and the home page's search. Plain JS, no libraries.
   The pages work without it: every row is in the HTML, in English. */
(function () {
	"use strict";

	var I18N = window.DB_I18N || {};
	var root = document.documentElement;

	function store(key, value) {
		try {
			if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
		} catch (e) { /* private mode: the choice lasts for this page only */ }
	}
	function load(key) {
		try { return localStorage.getItem(key); } catch (e) { return null; }
	}

	// --- theme ----------------------------------------------------------------------------------

	var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
	function effectiveTheme() {
		return root.dataset.theme || (darkQuery && darkQuery.matches ? "dark" : "light");
	}
	var themeBtn = document.getElementById("theme-btn");
	if (themeBtn) {
		themeBtn.addEventListener("click", function () {
			var next = effectiveTheme() === "dark" ? "light" : "dark";
			root.dataset.theme = next;
			store("db-theme", next);
		});
	}

	// --- language (UI labels only; the game's names stay as the game writes them) ------------------

	var lang = load("db-lang") === "th" ? "th" : "en";

	function label(key, args) {
		var entry = I18N[key];
		var text = entry ? (entry[lang] || entry.en) : null;
		if (text === null) return null;
		if (args) {
			Object.keys(args).forEach(function (k) { text = text.split("{" + k + "}").join(String(args[k])); });
		}
		return text;
	}

	function applyLang(scope) {
		root.lang = lang;
		(scope || document).querySelectorAll("[data-i18n]").forEach(function (el) {
			var args = null;
			if (el.dataset.i18nArgs) {
				try { args = JSON.parse(el.dataset.i18nArgs); } catch (e) { args = null; }
			}
			var text = label(el.dataset.i18n, args);
			if (text !== null) el.textContent = text;
		});
		(scope || document).querySelectorAll("[data-i18n-ph]").forEach(function (el) {
			var text = label(el.dataset.i18nPh);
			if (text !== null) el.placeholder = text;
		});
		var btn = document.getElementById("lang-btn");
		if (btn) {
			btn.textContent = label("ui.lang") || btn.textContent;
			btn.lang = lang === "en" ? "th" : "en";
		}
	}

	var langBtn = document.getElementById("lang-btn");
	if (langBtn) {
		langBtn.addEventListener("click", function () {
			lang = lang === "en" ? "th" : "en";
			store("db-lang", lang === "th" ? "th" : null);
			applyLang();
		});
	}
	if (lang !== "en") applyLang();

	// --- list filters ------------------------------------------------------------------------------

	var params = new URLSearchParams(location.search);

	function setupFilters(form) {
		var table = document.getElementById(form.dataset.list);
		if (!table) return;
		var rows = Array.prototype.slice.call(table.tBodies[0].rows);
		var fields = Array.prototype.slice.call(form.querySelectorAll("[data-f]"));
		var counter = document.querySelector('[data-count="' + form.dataset.list + '"]');

		fields.forEach(function (f) {
			var v = params.get(f.dataset.f);
			if (v !== null) f.value = v;
		});

		function run() {
			var shown = 0;
			var state = new URLSearchParams();
			var tests = [];
			fields.forEach(function (f) {
				var v = f.value.trim();
				if (v === "") return;
				state.set(f.dataset.f, v);
				var key = f.dataset.f;
				if (key === "q") {
					var words = v.toLowerCase().split(/\s+/);
					tests.push(function (row) {
						var hay = row.dataset.search || "";
						return words.every(function (w) { return hay.indexOf(w) >= 0; });
					});
				} else if (f.dataset.max) {
					var max = Number(v);
					if (!isNaN(max)) tests.push(function (row) { return Number(row.dataset[key] || 0) <= max; });
				} else if (f.dataset.tokens) {
					tests.push(function (row) {
						var tokens = (row.dataset[key] || "").split(" ");
						// "all": an item every class can use also suits each class
						return tokens.indexOf(v) >= 0 || (key === "class" && tokens.indexOf("all") >= 0);
					});
				} else {
					tests.push(function (row) { return (row.dataset[key] || "") === v; });
				}
			});
			rows.forEach(function (row) {
				var ok = tests.every(function (t) { return t(row); });
				row.hidden = !ok;
				if (ok) shown += 1;
			});
			if (counter) {
				var n = counter.querySelector(".n");
				var t = counter.querySelector(".t");
				if (n) n.textContent = String(shown);
				if (t) t.textContent = String(rows.length);
			}
			var qs = state.toString();
			try {
				history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
			} catch (e) { /* file:// in some browsers */ }
		}

		form.addEventListener("input", run);
		form.addEventListener("change", run);
		form.addEventListener("reset", function () { setTimeout(run, 0); });
		run();
	}
	document.querySelectorAll("form.filters").forEach(setupFilters);

	// --- sorting ------------------------------------------------------------------------------------

	function setupSort(table) {
		var heads = table.tHead ? table.tHead.querySelectorAll("th[data-sort]") : [];
		Array.prototype.forEach.call(heads, function (th) {
			th.tabIndex = 0;
			th.setAttribute("role", "button");
			function sort() {
				var key = th.dataset.sort;
				var dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
				Array.prototype.forEach.call(heads, function (h) { h.removeAttribute("aria-sort"); });
				th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
				var body = table.tBodies[0];
				var rows = Array.prototype.slice.call(body.rows);
				var numeric = rows.every(function (r) { return r.dataset[key] !== undefined && r.dataset[key] !== "" && !isNaN(Number(r.dataset[key])); });
				rows.sort(function (a, b) {
					var x = a.dataset[key] || "";
					var y = b.dataset[key] || "";
					var c = numeric ? Number(x) - Number(y) : x.localeCompare(y);
					if (c === 0) c = (a.dataset.name || "").localeCompare(b.dataset.name || "");
					return c * dir;
				});
				rows.forEach(function (r) { body.appendChild(r); });
			}
			th.addEventListener("click", sort);
			th.addEventListener("keydown", function (e) {
				if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); }
			});
		});
	}
	document.querySelectorAll("table.list").forEach(setupSort);

	// --- the home page's search (items and monsters, from data/*.json) --------------------------------

	var all = document.getElementById("search-all");
	if (all && window.fetch) {
		var input = all.querySelector("input");
		var hint = document.getElementById("search-all-hint");
		var list = document.createElement("ul");
		list.className = "search-results";
		hint.parentNode.insertBefore(list, hint.nextSibling);
		var data = null;
		var loading = null;

		function getData() {
			if (data) return Promise.resolve(data);
			if (!loading) {
				loading = Promise.all(["data/items.json", "data/monsters.json"].map(function (u) {
					return fetch(u).then(function (r) { return r.ok ? r.json() : []; });
				})).then(function (res) {
					data = res[0].map(function (i) { return { kind: "item", id: i.id, name: i.name, img: i.icon, w: 32, rarity: i.type === "card" ? 9 : ["Normal", "Rare", "Epic", "Legendary"].indexOf(i.rarity) }; })
						.concat(res[1].map(function (m) { return { kind: "monster", id: m.id, name: m.name, img: m.thumb, w: 0, lv: m.level }; }));
					return data;
				}).catch(function () { data = []; return data; });
			}
			return loading;
		}

		function show() {
			var q = input.value.trim().toLowerCase();
			list.textContent = "";
			if (!q) return;
			getData().then(function (d) {
				if (input.value.trim().toLowerCase() !== q) return;
				list.textContent = "";
				var words = q.split(/\s+/);
				d.filter(function (e) {
					var hay = (e.name + " " + e.id).toLowerCase();
					return words.every(function (w) { return hay.indexOf(w) >= 0; });
				}).slice(0, 12).forEach(function (e) {
					var li = document.createElement("li");
					var a = document.createElement("a");
					a.href = e.kind + "/" + e.id + ".html";
					if (e.img) {
						var img = document.createElement("img");
						img.src = e.img;
						img.alt = "";
						img.className = "px";
						if (e.w) { img.width = e.w; img.height = e.w; }
						a.appendChild(img);
					}
					var nm = document.createElement("span");
					nm.className = "nm" + (e.kind === "item" && e.rarity >= 0 ? " r" + e.rarity : "");
					nm.textContent = e.name;
					a.appendChild(nm);
					var kind = document.createElement("span");
					kind.className = "kind";
					kind.textContent = (label(e.kind === "item" ? "col.item" : "col.monster") || e.kind) + (e.lv ? " · Lv " + e.lv : "");
					a.appendChild(kind);
					li.appendChild(a);
					list.appendChild(li);
				});
			});
		}
		input.addEventListener("input", show);
		input.addEventListener("focus", function () { getData(); }, { once: true });
	}
}());
