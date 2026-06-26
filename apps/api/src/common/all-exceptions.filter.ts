import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Consistent JSON error shape across the API. Known HttpExceptions pass through
// their status/message; anything unexpected is logged (with stack) and returned
// as a generic 500 so internals never leak to clients.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown = 'Internal server error';
    if (isHttp) {
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : (body as { message?: unknown }).message ?? body;
    }

    if (!isHttp || status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
