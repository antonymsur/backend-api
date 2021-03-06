import * as OpenApiValidator from 'express-openapi-validator';
import * as api from '@api/api/controllers'

import {connector, summarise} from 'swagger-routes-express'

import {Express} from 'express-serve-static-core'
import YAML from 'yamljs'
import bodyParser from 'body-parser'
import config from '@api/config'
import express from 'express'
import {expressDevLogger} from '@api/utils/express_dev_logger'
import logger from '@api/utils/logger'
import morgan from 'morgan'
import morganBody from 'morgan-body'

export async function createServer(): Promise<Express> {
  const yamlSpecFile = './config/openapi.yml'
  const apiDefinition = YAML.load(yamlSpecFile)
  const apiSummary = summarise(apiDefinition)
  logger.info(apiSummary)
 
  const server = express()
  
  server.use(bodyParser.json())
  
  if (config.morganLogger) {
    server.use(morgan(':method :url :status :response-time ms - :res[content-length]'))
  }
  
  if (config.morganBodyLogger) {
    morganBody(server)
  }

  if (config.apiDevLogger) {
    server.use(expressDevLogger)
  }
  
  // setup API validator
  const validatorOptions = {
    apiSpec: yamlSpecFile,
    validateRequests: true,
    validateResponses: true
  }
  server.use(OpenApiValidator.middleware(validatorOptions))
  
  // error customization, if request is invalid
  server.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(err.status).json({
      error: {
        type: 'request_validation',
        message: err.message,
        errors: err.errors
      }
    })
  })
 
  const connect = connector(api, apiDefinition, {
    onCreateRoute: (method: string, descriptor: any[]) => {
      descriptor.shift()
      logger.verbose(`${method}: ${descriptor.map((d: any) => d.name).join(', ')}`)
    },
    security: {
      bearerAuth: api.auth
    }
  })
  connect(server)
 
  return server
}
