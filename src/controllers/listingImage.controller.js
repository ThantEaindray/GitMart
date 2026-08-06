const fs = require('fs');
const imageController = require('./image.controller.js');

// Same SCP upload used for chat images (multer -> ./src/tmp -> node-scp to
// the shared image host) — chat's uploadImg only touches req.file, nothing
// chat-specific, so it's reused as-is rather than duplicated.
module.exports.uploadCoverImage = imageController.uploadImg;

module.exports.respondWithUrl = (req, res) => {
  const url = imageController.buildPublicImageUrl(req.file.filename);
  const file = `./src/tmp/${req.file.filename}`;

  fs.unlink(file, (err) => {
    if (err) {
      console.error(err);
    }
    return res.status(201).json({ url });
  });
};
