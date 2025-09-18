// 预定义分片大小
const CHUNK_SIZE = 1024 * 1024 * 5; // 1MB
const percentDom = document.querySelector(".percent1");

/**
 * @param {File} file
 * @returns {Array<Blob>}
 */
function createFileChunk(file) {
  let start = 0;
  let total = 0;
  const chunks = [];
  while (start < file.size) {
    chunks.push(file.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE;
    total++;
  }
  return { chunks, total };
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function calculateHash(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(file);
    fileReader.onload = () => {
      const spark = new SparkMD5.ArrayBuffer();
      spark.append(fileReader.result);
      resolve(spark.end());
    };
    fileReader.onerror = () => {
      reject("Failed to read file");
    };
  });
}
/**
 * @param {Array<Blob>} chunks
 */
async function uploadFile(chunks, fileHash, filename,chunkTotal) {
  const formDatas = chunks
    .map((chunk, index) => {
      return {
        fileHash,
        chunkHash: `${fileHash}-${index}`,
        chunk,
      };
    })
    .map((item) => {
      const formData = new FormData();
      formData.append("fileHash", item.fileHash);
      formData.append("chunkHash", item.chunkHash);
      formData.append("chunk", item.chunk);
      formData.append("filename", filename);
      formData.append("chunkTotal", chunkTotal);
      return formData;
    });

  const taskPool = formDatas.map(
    (formData) => () =>
      fetch("http://localhost:3000/upload1", {
        method: "POST",
        body: formData,
      })
  );

  await concurRequest(taskPool, 6);
}
/**
 * 并发控制
 * @param {Array<Promise>} taskPool
 * @param {number} max 同时执行的最大任务数
 */
function concurRequest(taskPool, max) {
  return new Promise((resolve) => {
    if (taskPool.length === 0) return resolve([]);
    const results = new Array(taskPool.length);
    let index = 0;
    let count = 0;

    const request = async () => {
      if (index === taskPool.length) return;
      const i = index;
      const task = taskPool[index];
      index++
      try {
        results[i] = await task();
      } catch (e) {
        results[i] = e;
      } finally {
        count++;
        if (count === taskPool.length) {
          resolve(results);
        }
        console.debug(
          `${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}  上传分片，${
            i + 1
          } ，共 ${taskPool.length}`
        );
         percentDom.innerHTML=`${Math.floor((i+1) / taskPool.length * 100)}%`;
        request(); // 继续执行下一个任务
      }
    };

    const times = Math.min(max, taskPool.length);
    for (let i = 0; i < times; i++) {
      request();
    }
  });
}

async function upload1(event) {
  if (!event.target.files[0]) return alert("No file selected");
  /**
   * @type {File}
   */
  const file = event.target.files[0];
  console.debug(`开始创建文件切片`);
  // 创建文件切片
  const { chunks, total } = createFileChunk(file);
  console.debug(`文件切片创建完成`);
  console.debug(`开始计算文件哈希`);
  // 计算文件哈希
  const fileHash = await calculateHash(file);
  console.debug(`文件哈希计算完成, 文件哈希为: ${fileHash}`);
  console.debug(`开始上传文件`);
  uploadFile(chunks, fileHash, file.name,total).then(() => {
    console.debug(`文件上传完成`);
    percentDom.innerHTML='完成'
  });
}

export default upload1;
