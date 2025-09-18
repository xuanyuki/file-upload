import express from "express";
import morgan from "morgan";
import cors from "cors";
import router from './router.js'

const PORT = 3000;
const app = express();


app.use(morgan('dev'))
app.use(cors())
app.use('/',router)

const server = app.listen(PORT, () => {
  console.log("服务启动");
});
