import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from "redis"

async function main() {


    // Creating PublishClient and SubscribeClient for publishing and subscribing respectively as one Client cannot perform both Operations.
    const publishClient = createClient();
    await publishClient.connect();

    const subscribeClient = createClient();
    await subscribeClient.connect();

    const wss = new WebSocketServer({ port: 8080 });

    const subscriptions: {
        [key: string]: {
            ws: WebSocket,
            rooms: string[]
        }
    } = {
        // "user1":{
        //     ws: ,
        //     rooms: []
        // },
        // "user2":{
        //     ws: ,
        //     rooms: []
        //     }

    }

    wss.on('connection', function connection(userSocket) {
        const id = randomId();
        subscriptions[id] = {
            ws: userSocket,
            rooms: []
        }

        userSocket.on('message', function message(data) {
            const parsedMessage = JSON.parse(data as unknown as string);
            // Subscribing to particular Room 
            if (parsedMessage.type === "SUBSCRIBE") {
                // pushing to queue
                subscriptions[id].rooms.push(parsedMessage.room);
                // Subscribing Room if Room is subscribed FirstTime
                if (oneUserSubscribedTo(parsedMessage.room)) {
                    // console.log("subscribing on the pub sub to room " + parsedMessage.room);
                    subscribeClient.subscribe(parsedMessage.room, (message) => {
                        // Iterating over objects
                        Object.keys(subscriptions).forEach((userId) => {
                            const { ws, rooms } = subscriptions[userId];
                            if (rooms.includes(parsedMessage.roomId)) {
                                ws.send(parsedMessage.message);
                            }
                        })
                    })
                }
            }

            //Unsubscribing to the Room
            if (parsedMessage.type === "UNSUBSCRIBE") {
                subscriptions[id].rooms = subscriptions[id].rooms.filter(x => x !== parsedMessage.room)
                // Unsubscribing from room if no Client has subscription for ir
                if (lastPersonLeftRoom(parsedMessage.room)) {
                    // console.log("unsubscribing from pub sub on room" + parsedMessage.room);
                    subscribeClient.unsubscribe(parsedMessage.room);
                }
            }

            // Sending Message to the Room
            if (parsedMessage.type === "sendMessage") {
                const message = parsedMessage.message;
                const roomId = parsedMessage.roomId;


                // Publishing message
                publishClient.publish(roomId, JSON.stringify({
                    type: "sendMessage",
                    roomId: roomId,
                    message: message
                }))
            }
        });

    });

      // To check if people already has subscribed to Room
    function oneUserSubscribedTo(roomId: string) {
        let totalPeople = 0;
        Object.keys(subscriptions).map(userId => {
            if (subscriptions[userId].rooms.includes(roomId)) {
                totalPeople++;
            }
        })
        // Returning if Client has already Subscribe to the room
        if (totalPeople == 1) {
            return true;
        }
        return false;
    }

    // To check if no people has subscribed to Room
    function lastPersonLeftRoom(roomId: string) {
        let totalPeople = 0;
        Object.keys(subscriptions).map(userId => {
            if (subscriptions[userId].rooms.includes(roomId)) {
                totalPeople++;
            }
        })
        // Returning if no one is subscribed to room
        if (totalPeople == 0) {
            return true;
        }
        return false;
    }

    function randomId() {
        // Generating Random_ID between 0-1 
        return Math.random().toString(36).substr(2, 9);
    }
    
}
main();