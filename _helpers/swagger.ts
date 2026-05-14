import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';

const router = express.Router();
const swaggerDocument = yaml.load('./swagger.yaml');

router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;