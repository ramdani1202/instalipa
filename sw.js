// Nama cache tetap. Tidak perlu dinaikkan: halaman & songs.json selalu diambil dari
// jaringan dulu (network-first), jadi update otomatis tanpa ganti versi.
var CACHE = "musik-v1";
var SHELL = ["./", "index.html", "songs.json"];

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

function rangeResponse(req, res) {
  return res.arrayBuffer().then(function (buf) {
    var m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range"));
    var total = buf.byteLength;
    var start = m[1] ? parseInt(m[1], 10) : 0;
    var end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (end >= total) end = total - 1;
    var slice = buf.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": "bytes " + start + "-" + (start + slice.byteLength - 1) + "/" + total,
        "Content-Length": String(slice.byteLength)
      }
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var k = key(req.url);
  var isAudio = /\.(mp3|m4a|aac|wav|ogg)$/i.test(url.pathname);

  if (isAudio) {
    // Cache-first. Kalau tidak ada di cache, ambil dari jaringan seperti biasa.
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(k).then(function (res) {
          if (!res) return fetch(req);
          if (req.headers.get("range")) return rangeResponse(req, res.clone());
          return res;
        });
      })
    );
    return;
  }

  // Halaman & songs.json: coba jaringan dulu, kalau offline pakai cache.
  var isShell = /\.(html|json)$/i.test(url.pathname) || /\/$/.test(url.pathname);
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
