import { BadRequestException, ConflictException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  function createHost() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = { method: 'PATCH', url: '/queues/1/entries/2' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };
    return { host, response };
  }

  it('returns validation failures with a stable code and named fields', () => {
    const { host, response } = createHost();
    const filter = new ApiExceptionFilter();

    filter.catch(
      new BadRequestException({
        message: ['room should not be empty', 'provider must be shorter'],
        error: 'Bad Request',
      }),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'room should not be empty; provider must be shorter',
    });
  });

  it('preserves transition details in conflict responses', () => {
    const { host, response } = createHost();
    const filter = new ApiExceptionFilter();

    filter.catch(
      new ConflictException({
        code: 'INVALID_TRANSITION',
        message: 'Cannot transition.',
        currentStatus: 'COMPLETED',
        requestedStatus: 'CANCELLED',
        allowedNextStatuses: [],
      }),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      code: 'INVALID_TRANSITION',
      message: 'Cannot transition.',
      currentStatus: 'COMPLETED',
      requestedStatus: 'CANCELLED',
      allowedNextStatuses: [],
    });
  });
});
