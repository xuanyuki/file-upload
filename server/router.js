import express from 'express'
import upload1 from './modules/upload1.js'

const router = express.Router()

router.post('/upload1',upload1)

export default router