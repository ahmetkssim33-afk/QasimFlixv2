require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI bulunamadı. .env veya Vercel Environment Variables içine ekle.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log("MongoDB bağlandı. Ağır base64 görseller temizleniyor...");

  const seriesPoster = await db.collection("series").updateMany(
    { poster: { $regex: "^data:image/" } },
    { $unset: { poster: "" } }
  );

  const seriesBanner = await db.collection("series").updateMany(
    { banner: { $regex: "^data:image/" } },
    { $unset: { banner: "" } }
  );

  const episodeThumb = await db.collection("episodes").updateMany(
    { thumbnail: { $regex: "^data:image/" } },
    { $unset: { thumbnail: "" } }
  );

  console.log("Series poster temizlenen:", seriesPoster.modifiedCount);
  console.log("Series banner temizlenen:", seriesBanner.modifiedCount);
  console.log("Episode thumbnail temizlenen:", episodeThumb.modifiedCount);

  await mongoose.disconnect();
  console.log("Bitti. Siteyi Ctrl + F5 ile yenile.");
}

run().catch((err) => {
  console.error("Hata:", err);
  process.exit(1);
});
