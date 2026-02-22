import { Hono } from 'hono'
import crud from './crud'
import logs from './logs'
import session from './session'

const issues = new Hono()
issues.route('/', crud)
issues.route('/', session)
issues.route('/', logs)

export default issues
