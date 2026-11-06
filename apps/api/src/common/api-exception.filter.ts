import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.getErrorPayload(exception, status);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${payload.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(payload);
  }

  private getErrorPayload(
    exception: unknown,
    status: number,
  ): { code?: string; message: string } {
    if (status === 500) {
      return { message: 'Internal server error' };
    }

    if (!(exception instanceof HttpException)) {
      return { message: 'Internal server error' };
    }

    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { message: body };
    }
    if (typeof body === 'object' && body !== null) {
      const code = 'code' in body ? body.code : undefined;
      const message = 'message' in body ? body.message : undefined;
      if (typeof code === 'string' && typeof message === 'string') {
        return { code, message };
      }
      if (typeof message === 'string') {
        return { message };
      }
      if (
        Array.isArray(message) &&
        message.every((item) => typeof item === 'string')
      ) {
        return { message: message.join('; ') };
      }
      const error = 'error' in body ? body.error : undefined;
      if (typeof error === 'string') {
        return { message: error };
      }
    }

    return { message: exception.message };
  }
}
