import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PerksBoostsEvents, PerkBoostEvent } from '../services/perks-boosts-events.service';

@WebSocketGateway({
    namespace: 'boosts',
    cors: {
        origin: '*',
    },
})
export class PerkBoostGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(PerkBoostGateway.name);

    constructor(private readonly events: PerksBoostsEvents) { }

    onModuleInit() {
        // Subscribe to internal events and push to clients via WebSockets
        this.events.events$.subscribe(({ type, data }) => {
            if (type === PerkBoostEvent.BOOST_ACTIVATED || type === PerkBoostEvent.BOOST_EXPIRED) {
                this.notifyPlayer(data.playerId, type, data);
            }
        });
    }

    afterInit(server: Server) {
        this.logger.log('Perk Boost WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId;
        if (userId) {
            client.join(`user_${userId}`);
            this.logger.log(`Client connected: ${client.id}, User: ${userId}`);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    private notifyPlayer(userId: number, event: PerkBoostEvent, payload: any) {
        this.logger.log(`Sending realtime notification to user_${userId}: ${event}`);
        this.server.to(`user_${userId}`).emit(event, payload);
    }
}
