import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import { initialize } from './_helpers/db';
import { errorHandler } from './_middleware/error-handler';
import accountsRouter from './accounts/accounts.controller';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: '*', credentials: true }));

// Swagger docs
const swaggerDocument = yaml.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/accounts', accountsRouter);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = 4000;

initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📄 Swagger docs at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize DB:', err);
});