import multiparty from "multiparty";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

const fileMergeLocks = new Set();

export default (req, res) => {
  // 处理预检请求
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const form = new multiparty.Form();
  const uploadDir = "./files";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).send("上传失败");
      return;
    }

    try {
      const chunk = files.chunk[0];
      const fileName = fields.filename[0];
      const fileHash = fields.fileHash[0];
      const chunkHash = fields.chunkHash[0];
      const chunkIndex = chunkHash.split("-")[1];
      const chunkTotal = fields.chunkTotal[0];
      console.log(`收到分片: ${fileName}，分片${chunkIndex}`);

      // 创建临时文件夹
      const chunkDir = path.join("./cache", fileHash);
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
      }

      const chunkPath = path.join(chunkDir, `${chunkIndex}`);
      const readStream = fs.createReadStream(chunk.path);
      const ws = fs.createWriteStream(chunkPath);
      await pipeline(readStream, ws);
      fs.unlinkSync(chunk.path);

      const chunkFiles = fs.readdirSync(chunkDir);
      // 开始合并
      if (chunkFiles.length === parseInt(chunkTotal)) {
        // 检查是否已经在合并中
        if (fileMergeLocks.has(fileHash)) {
          console.log(`文件 ${fileHash} 正在合并中，跳过重复操作`);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              message: `分片 ${chunkIndex} 上传成功，合并进行中`,
              uploaded: chunkFiles.length,
            })
          );
          return;
        }
        // 设置合并锁
        fileMergeLocks.add(fileHash);

        const finalFilePath = path.join(uploadDir, `${Date.now()}-${fileName}`);
        const writeStream = fs.createWriteStream(finalFilePath);
        try {
          const chunks = chunkFiles
            .map((name) => parseInt(name))
            .sort((a, b) => a - b);

          for (let i = 0; i < chunks.length; i++) {
            const index = chunks[i];
            const chunkPath = path.join(chunkDir, `${index}`);
            const chunkReadStream = fs.createReadStream(chunkPath);

            await new Promise((resolve, reject) => {
              chunkReadStream.pipe(writeStream, { end: false });
              chunkReadStream.on("end", resolve);
              chunkReadStream.on("error", reject);
            });

            // 删除已合并的分片文件
            fs.unlinkSync(chunkPath);
          }
        } finally {
          // 合并结束后释放锁
          fileMergeLocks.delete(fileHash);
        }

        res.statusCode = 200;
        res.json({
          success: true,
          message: "文件上传完成",
          path: finalFilePath,
        });
      } else {
        res.statusCode = 200;
        res.json({
          success: true,
          message: `分片 ${chunkIndex} 上传成功`,
          uploaded: chunkFiles.length,
        });
      }
    } catch (error) {
      console.error("处理错误:", error);
      res.statusCode = 500;
      res.json({ success: false, message: "服务器处理错误" });
    }
  });
};
