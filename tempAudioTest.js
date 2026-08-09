const https = require("https");
const urls = [
  { id: "MisharyAlafasy", bit: "64", ayah: 255 },
  { id: "AbdulBasit_Murattal", bit: "64", ayah: 255 },
  { id: "SaadAlGhamdi", bit: "64", ayah: 255 },
  { id: "MahmoudKhalilAlHusary", bit: "64", ayah: 255 },
];
urls.forEach((o) => {
  const u =
    "https://cdn.islamic.network/quran/audio/" +
    o.bit +
    "/" +
    o.id +
    "/" +
    o.ayah +
    ".mp3";
  https
    .get(u, (res) => {
      console.log(u, res.statusCode, res.headers["content-type"]);
      res.resume();
    })
    .on("error", (e) => console.log(u, "ERR", e.message));
});
