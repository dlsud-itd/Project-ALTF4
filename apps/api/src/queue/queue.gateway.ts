import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface QueueCallPayload {
  queueId: number;
  queueEntryId: number;
  ticketNumber: string;
  patientName: string;
  roomNumber: string;
  calledAt: string;
}

export interface QueueUpdatePayload {
  queueId: number;
  queueEntryId?: number;
  ticketNumber?: string;
  status: string;
  totalWaiting: number;
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow all origins in gateway or match CORS_ORIGINS
      callback(null, true);
    },
    credentials: true,
  },
})
export class QueueGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(QueueGateway.name);

  afterInit() {
    this.logger.log('Queue Socket.IO Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to WebSocket: ${client.id}`);
    client.emit('connection:status', {
      connected: true,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  @SubscribeMessage('subscribeQueue')
  handleSubscribeQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { queueId: number },
  ) {
    const room = `queue_${data.queueId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'subscribed', room };
  }

  @SubscribeMessage('unsubscribeQueue')
  handleUnsubscribeQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { queueId: number },
  ) {
    const room = `queue_${data.queueId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'unsubscribed', room };
  }

  emitQueueCalled(payload: QueueCallPayload) {
    this.server.to(`queue_${payload.queueId}`).emit('queue:called', payload);
    this.server.emit('queue:called', payload);
  }

  emitQueueUpdated(payload: QueueUpdatePayload) {
    this.server.to(`queue_${payload.queueId}`).emit('queue:updated', payload);
    this.server.emit('queue:updated', payload);
  }

  emitQueueStatus(queueId: number, statusData: unknown) {
    this.server.to(`queue_${queueId}`).emit('queue:status', statusData);
    this.server.emit('queue:status', statusData);
  }
}
