import { v4 as uuid } from 'uuid';

export default io => {
    let rooms = [];
    let inGameRooms = [];

    io.on('connection', socket => {

        socket.on('connectUser', userId => {
            socket.userId = userId;
            const roomPlayerIsWaitingIn = rooms.find(room => room.creatorId === userId);
            if (roomPlayerIsWaitingIn) io.to(socket.id).emit('verifyStillInRoom', roomPlayerIsWaitingIn.id);

            const roomPlayerWasIn = inGameRooms.find(room => room.visitorId === userId || room.creatorId === userId);
            if (!roomPlayerWasIn) return;

            const timeOutType = socket.userId === roomPlayerWasIn.creatorId ? 'creatorTimeOut' : 'visitorTimeOut';
            if (roomPlayerWasIn[timeOutType]) clearTimeout(roomPlayerWasIn[timeOutType]);

            socket.join(roomPlayerWasIn.id);
            if ((roomPlayerWasIn.lastMove?.id || 0) < 2) io.to(socket.id).emit('verifyGameStarted')
            io.to(socket.id).emit('verifyLastMove', roomPlayerWasIn.lastMove || {}); // Opponent could have made a move while we were disconnected
        });

        function filterRooms(roomId = null) {
            rooms = rooms.filter(room => room.id !== roomId && (room.timeOut || room.creatorId !== socket.userId));
            const roomsToShow = rooms.filter(room => !room.timeOut);
            io.emit('updateRooms', roomsToShow);
        }

        socket.on('verifyStillInRoom', () => {
            const room = rooms.find(room => room.creatorId === socket.userId);
            clearTimeout(room.timeOut);
            delete room.timeOut;
            socket.join(room.id);
            socket.emit('roomJoined', room.id);
            const roomsToShow = rooms.filter(room => !room.timeOut);
            socket.broadcast.emit('updateRooms', roomsToShow);
        });

        socket.on('requestRooms', () => socket.emit('updateRooms', rooms));

        socket.on('createRoom', options => {
            const roomId = uuid();
            rooms.push({ ...options, id: roomId });
            socket.join(roomId);
            socket.emit('roomJoined', roomId);
            socket.broadcast.emit('updateRooms', rooms);
        })

        socket.on('joinRoom', (roomId, visitorId) => {
            socket.join(roomId);
            socket.emit('roomJoined', roomId);
            io.in(roomId).emit('gameStart');
            const room = rooms.find(room => room.id === roomId);
            room.visitorId = visitorId;
            inGameRooms.push(room);
            filterRooms(roomId);
        })

        socket.on('message', ({ message, sender, roomId }) => {
            io.to(roomId).emit('message', { message, sender });
        })

        socket.on('move', ({ move, roomId }) => {
            const room = inGameRooms.find(room => room.id === roomId);
            if (!room) return;
            room.lastMove = move;
            socket.broadcast.to(roomId).emit('move', move);
        })

        socket.on('leftRoom', roomId => {
            filterRooms(roomId);
            socket.broadcast.to(roomId).emit('playerDisconnected', socket.userId);
            deleteIngameRoom(roomId);
        });

        socket.on('disconnect', () => {
            const roomPlayerIsWaitingIn = rooms.find(room => room.creatorId === socket.userId);
            if (roomPlayerIsWaitingIn) {
                roomPlayerIsWaitingIn.timeOut = setTimeout(() => {
                    delete roomPlayerIsWaitingIn.timeOut;
                    filterRooms();
                }, 60 * 1000);
            }

            filterRooms();

            const roomPlayerWasIn = inGameRooms.find(room => room.visitorId === socket.userId || room.creatorId === socket.userId);
            if (!roomPlayerWasIn) return;
            
            const timeOutType = socket.userId === roomPlayerWasIn.creatorId ? 'creatorTimeOut' : 'visitorTimeOut';
            if (roomPlayerWasIn[timeOutType]) clearTimeout(roomPlayerWasIn[timeOutType]);

            roomPlayerWasIn[timeOutType] = setTimeout(() => {
                io.in(roomPlayerWasIn.id).emit('playerDisconnected', socket.userId);
                deleteIngameRoom(roomPlayerWasIn.id);
            }, 15 * 1000);
        });

        socket.on('gameOver', deleteIngameRoom);

        function deleteIngameRoom(roomId) {
            inGameRooms = inGameRooms.filter(room => room.id !== roomId);
            io.in(roomId).socketsLeave(roomId);
        }
    });
}
