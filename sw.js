// Nama cache. Dinaikkan ke v2 supaya MP3 lama yang pernah tersimpan ikut terhapus. Selanjutnya tidak perlu dinaikkan: halaman selalu diambil dari
// jaringan dulu (network-first), jadi update otomatis tanpa ganti versi.
var CACHE = "musik-v2";
var SHELL = ["./", "index.html"];

function key(url) {
  var u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.href;
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (f) {
        return fetch(f, { cache: "reload" }).then(function (r) {
          if (r.ok) return c.put(new URL(f, self.location).href, r);
        }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        if (n.indexOf("musik-") === 0 && n !== CACHE) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var k = key(req.url);
  // Halaman: coba jaringan dulu, kalau offline pakai cache.
  var isShell = /\.html$/i.test(url.pathname) || /\/$/.test(url.pathname);
  if (isShell) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(k, copy); });
        }
        return res;
      }).catch(function () {
        return caches.open(CACHE).then(function (c) {
          return c.match(k).then(function (r) {
            return r || c.match(new URL("index.html", self.location).href);
          });
        });
      })
    );
  }
});
