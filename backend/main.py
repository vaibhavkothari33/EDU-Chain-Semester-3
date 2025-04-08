from fastapi import FastAPI, HTTPException, Body, Path, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any, Set
import uvicorn
from datetime import datetime
import json
import logging
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Data Models ---
class Room(BaseModel):
    id: str
    name: str
    created_at: str
    description: Optional[str] = None
    active_users: int = 0
    
class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # Structure: {room_id: {document_id: {client_id: websocket}}}
        self.active_connections: Dict[str, Dict[str, Dict[str, WebSocket]]] = {}
        
    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, document_id: str):
        await websocket.accept()
        
        # Initialize nested dictionaries if they don't exist
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        
        if document_id not in self.active_connections[room_id]:
            self.active_connections[room_id][document_id] = {}
        
        # Store the connection
        self.active_connections[room_id][document_id][user_id] = websocket
        
        logger.info(f"WebSocket connected: room={room_id}, user={user_id}, document={document_id}")
        
        # Send awareness update to all clients in the room
        await self.broadcast_awareness(room_id, document_id)
    
    def disconnect(self, room_id: str, user_id: str, document_id: str):
        if (room_id in self.active_connections and 
            document_id in self.active_connections[room_id] and 
            user_id in self.active_connections[room_id][document_id]):
            
            # Remove the connection
            del self.active_connections[room_id][document_id][user_id]
            
            # Clean up empty dictionaries
            if not self.active_connections[room_id][document_id]:
                del self.active_connections[room_id][document_id]
            
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                
            logger.info(f"WebSocket disconnected: room={room_id}, user={user_id}, document={document_id}")
            return True
        return False
    
    async def broadcast_awareness(self, room_id: str, document_id: str):
        """Send awareness update (who's online) to all clients in the document"""
        if room_id in self.active_connections and document_id in self.active_connections[room_id]:
            users = list(self.active_connections[room_id][document_id].keys())
            awareness_message = {
                "type": "awareness",
                "users": users,
                "count": len(users)
            }
            
            await self.broadcast(room_id, document_id, awareness_message)
    
    async def broadcast(self, room_id: str, document_id: str, message: Any):
        """
        Broadcast a message to all connected clients in a document
        """
        if room_id in self.active_connections and document_id in self.active_connections[room_id]:
            # Convert message to JSON if it's not a string already
            if not isinstance(message, str):
                message = json.dumps(message)
                
            # Send to all connected clients
            for user_id, connection in self.active_connections[room_id][document_id].items():
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error sending message to {user_id}: {e}")
    
    async def broadcast_update(self, room_id: str, document_id: str, sender_id: str, update: Any):
        """
        Broadcast an update to all connected clients except the sender
        """
        if room_id in self.active_connections and document_id in self.active_connections[room_id]:
            # Convert update to JSON if it's not a string already
            if not isinstance(update, str):
                update = json.dumps(update)
                
            # Send to all connected clients except sender
            for user_id, connection in self.active_connections[room_id][document_id].items():
                if user_id != sender_id:  # Don't send back to the sender
                    try:
                        await connection.send_text(update)
                    except Exception as e:
                        logger.error(f"Error sending update to {user_id}: {e}")
    
    def get_active_users(self, room_id: str, document_id: str = None) -> int:
        """
        Get the number of active users in a room or document
        """
        if room_id not in self.active_connections:
            return 0
            
        if document_id is None:
            # Count all users across all documents in the room
            count = 0
            for doc_id in self.active_connections[room_id]:
                count += len(self.active_connections[room_id][doc_id])
            return count
        elif document_id in self.active_connections[room_id]:
            # Count users in specific document
            return len(self.active_connections[room_id][document_id])
        return 0

# Create connection manager instance
manager = ConnectionManager()

# Mock database (in-memory)
rooms_db: Dict[str, Room] = {}

# Initialize the FastAPI app
app = FastAPI(
    title="Mentora Collaborative Backend",
    description="API for real-time collaboration features.",
    version="0.1.0",
)

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",  # Allow all origins for development - remove in production!
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Logging Middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request path: {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"Response status code: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {e}")
        raise

# --- API Endpoints ---

@app.get("/")
async def read_root():
    """
    Root endpoint to check if the backend is running.
    """
    return {"message": "Welcome to the Mentora Collaborative Backend!"}

@app.get("/api/v1/status")
async def get_status():
    """
    A simple status check endpoint.
    """
    return {"status": "ok", "message": "Backend is operational"}

# --- Room Management Endpoints ---

@app.get("/api/v1/rooms")
async def get_rooms():
    """
    Get all available rooms.
    """
    logger.info(f"Returning all rooms. Current count: {len(rooms_db)}")
    return list(rooms_db.values())

@app.post("/api/v1/rooms", status_code=201)
async def create_room(room_data: RoomCreate):
    """
    Create a new collaboration room.
    """
    # Generate a timestamp-based ID
    room_id = str(int(datetime.now().timestamp() * 1000))
    
    # Create new room instance
    new_room = Room(
        id=room_id,
        name=room_data.name,
        description=room_data.description,
        created_at=datetime.now().isoformat(),
        active_users=0
    )
    
    # Save to "database"
    rooms_db[room_id] = new_room
    logger.info(f"Created new room with ID: {room_id}")
    
    return new_room

@app.get("/api/v1/rooms/{room_id}")
async def get_room(room_id: str = Path(..., description="The ID of the room to retrieve")):
    """
    Get details for a specific room.
    """
    logger.info(f"Fetching room with ID: {room_id}")
    
    # Check if this is a new room ID we don't have yet
    if room_id not in rooms_db:
        logger.warning(f"Room {room_id} not found. Creating a placeholder room.")
        
        # For development purposes, create a room on-the-fly if it doesn't exist
        new_room = Room(
            id=room_id,
            name=f"Auto-created Room {room_id[-4:]}",
            description="This room was automatically created on request",
            created_at=datetime.now().isoformat(),
            active_users=0
        )
        rooms_db[room_id] = new_room
        
        return new_room
    
    # Update active users count from WebSocket connections
    rooms_db[room_id].active_users = manager.get_active_users(room_id)
    
    logger.info(f"Room {room_id} found and returned")
    return rooms_db[room_id]

@app.put("/api/v1/rooms/{room_id}")
async def update_room(
    room_id: str = Path(...), 
    room_data: dict = Body(...)
):
    """
    Update a specific room's details.
    """
    if room_id not in rooms_db:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get the existing room
    room = rooms_db[room_id]
    
    # Update fields that are present in the request
    for key, value in room_data.items():
        if hasattr(room, key) and key not in ["id", "created_at"]:  # Protect certain fields
            setattr(room, key, value)
    
    # Update in "database"
    rooms_db[room_id] = room
    logger.info(f"Updated room with ID: {room_id}")
    
    return room

@app.delete("/api/v1/rooms/{room_id}")
async def delete_room(room_id: str = Path(..., description="The ID of the room to delete")):
    """
    Delete a specific room.
    """
    if room_id not in rooms_db:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Remove room from "database"
    deleted_room = rooms_db.pop(room_id)
    logger.info(f"Deleted room with ID: {room_id}")
    
    return {"message": f"Room '{deleted_room.name}' deleted successfully"}

# --- WebSocket Collaboration Endpoints ---

@app.websocket("/ws/collaboration/{room_id}/{user_id}/{document_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    room_id: str, 
    user_id: str, 
    document_id: str
):
    """
    WebSocket endpoint for real-time collaboration.
    This handles Y.js updates and awareness information.
    """
    try:
        # Accept the connection
        await manager.connect(websocket, room_id, user_id, document_id)
        
        # Make sure the room exists
        if room_id not in rooms_db:
            # Create room on the fly
            new_room = Room(
                id=room_id,
                name=f"Auto-created Room {room_id[-4:]}",
                description="This room was automatically created by WebSocket connection",
                created_at=datetime.now().isoformat(),
                active_users=1
            )
            rooms_db[room_id] = new_room
        else:
            # Update active users count
            rooms_db[room_id].active_users = manager.get_active_users(room_id)
        
        # Handle WebSocket messages
        try:
            while True:
                # Wait for messages from the client
                data = await websocket.receive_text()
                
                try:
                    # Try to parse as JSON
                    message = json.loads(data)
                    
                    # Handle different message types
                    if isinstance(message, dict) and "type" in message:
                        if message["type"] == "sync":
                            # This is a Y.js sync message - broadcast to others
                            await manager.broadcast_update(room_id, document_id, user_id, message)
                        elif message["type"] == "awareness":
                            # This is an awareness update - broadcast to all
                            await manager.broadcast(room_id, document_id, message)
                        elif message["type"] == "ping":
                            # Ping message - respond with pong
                            await websocket.send_text(json.dumps({"type": "pong"}))
                    else:
                        # Default: treat as Y.js update and broadcast
                        await manager.broadcast_update(room_id, document_id, user_id, data)
                        
                except json.JSONDecodeError:
                    # Not JSON, treat as binary update and broadcast as is
                    await manager.broadcast_update(room_id, document_id, user_id, data)
                    
        except WebSocketDisconnect:
            # Handle client disconnect
            manager.disconnect(room_id, user_id, document_id)
            
            # Update room active users count
            if room_id in rooms_db:
                rooms_db[room_id].active_users = manager.get_active_users(room_id)
            
            # Notify other clients about the disconnect
            await manager.broadcast_awareness(room_id, document_id)
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

# --- User Room Interaction ---
class ChatMessage(BaseModel):
    userId: str
    userName: str
    text: str
    timestamp: str
    id: Optional[str] = None

# Chat connection manager
class ChatConnectionManager:
    def __init__(self):
        # Map of room_id to list of WebSocket connections
        self.active_chats: Dict[str, List[WebSocket]] = {}
        # Map of room_id to list of recent messages (keep last 50 messages)
        self.message_history: Dict[str, List[ChatMessage]] = {}
        # Maximum number of messages to keep in history per room
        self.max_history = 50
    
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        
        # Initialize the room if it doesn't exist
        if room_id not in self.active_chats:
            self.active_chats[room_id] = []
        
        # Add the connection to the room
        self.active_chats[room_id].append(websocket)
        
        # Initialize message history for the room if it doesn't exist
        if room_id not in self.message_history:
            self.message_history[room_id] = []
        
        logger.info(f"Chat WebSocket connected for room: {room_id}, total connections: {len(self.active_chats[room_id])}")
        
        # Send message history to the new connection
        await self.send_history(websocket, room_id)
    
    def disconnect(self, websocket: WebSocket, room_id: str):
        # Remove the connection from the room
        if room_id in self.active_chats and websocket in self.active_chats[room_id]:
            self.active_chats[room_id].remove(websocket)
            logger.info(f"Chat WebSocket disconnected from room: {room_id}, remaining: {len(self.active_chats[room_id])}")
            
            # Clean up empty rooms
            if not self.active_chats[room_id]:
                del self.active_chats[room_id]
                logger.info(f"Removed empty chat room: {room_id}")
    
    async def broadcast(self, room_id: str, message: dict):
        """Broadcast a message to all connections in a room"""
        if room_id in self.active_chats:
            # Store message in history
            if message.get("type") == "message" and "message" in message:
                msg_data = message["message"]
                # Generate ID if not present
                if "id" not in msg_data:
                    msg_data["id"] = str(int(datetime.now().timestamp() * 1000))
                
                # Create and store the message
                chat_message = ChatMessage(**msg_data)
                self.add_to_history(room_id, chat_message)
            
            # Serialize message to JSON
            message_json = json.dumps(message)
            
            # Send to all connections in the room
            disconnected = []
            for connection in self.active_chats[room_id]:
                try:
                    await connection.send_text(message_json)
                except Exception as e:
                    logger.error(f"Error sending message to connection in room {room_id}: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for connection in disconnected:
                self.active_chats[room_id].remove(connection)
    
    def add_to_history(self, room_id: str, message: ChatMessage):
        """Add a message to the room's history"""
        if room_id not in self.message_history:
            self.message_history[room_id] = []
        
        # Add the message
        self.message_history[room_id].append(message)
        
        # Trim history if needed
        if len(self.message_history[room_id]) > self.max_history:
            self.message_history[room_id] = self.message_history[room_id][-self.max_history:]
    
    async def send_history(self, websocket: WebSocket, room_id: str):
        """Send message history to a specific connection"""
        if room_id in self.message_history and self.message_history[room_id]:
            try:
                # Create a message with the history
                history_message = {
                    "type": "history",
                    "messages": [msg.dict() for msg in self.message_history[room_id]]
                }
                
                # Send history
                await websocket.send_text(json.dumps(history_message))
            except Exception as e:
                logger.error(f"Error sending history to connection in room {room_id}: {e}")
    
    def get_active_connections(self, room_id: str = None) -> int:
        """Get the number of active connections"""
        if room_id is None:
            # Total connections across all rooms
            return sum(len(connections) for connections in self.active_chats.values())
        elif room_id in self.active_chats:
            # Connections in a specific room
            return len(self.active_chats[room_id])
        return 0

# Create chat manager instance
chat_manager = ChatConnectionManager()

# --- Chat WebSocket endpoint ---
@app.websocket("/ws/chat/{room_id}")
async def chat_websocket(websocket: WebSocket, room_id: str):
    """
    WebSocket endpoint for room chat.
    Handles real-time messaging between users in a room.
    """
    try:
        # Accept the connection
        await chat_manager.connect(websocket, room_id)
        
        # Make sure the room exists in the room database
        if room_id not in rooms_db:
            # Create room on the fly
            new_room = Room(
                id=room_id,
                name=f"Auto-created Room {room_id[-4:]}",
                description="This room was automatically created by WebSocket connection",
                created_at=datetime.now().isoformat(),
                active_users=1
            )
            rooms_db[room_id] = new_room
        
        # Handle WebSocket messages
        try:
            while True:
                # Wait for messages from the client
                data = await websocket.receive_text()
                
                try:
                    # Parse as JSON
                    message = json.loads(data)
                    
                    # Handle message types
                    if message.get("type") == "message":
                        # Broadcast message to all clients in the room
                        await chat_manager.broadcast(room_id, message)
                    elif message.get("type") == "ping":
                        # Respond with pong
                        await websocket.send_text(json.dumps({"type": "pong"}))
                    
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received in chat: {data}")
                
        except WebSocketDisconnect:
            # Handle client disconnect
            chat_manager.disconnect(websocket, room_id)
            
    except Exception as e:
        logger.error(f"Chat WebSocket error: {e}")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

# --- Add debug endpoint for chat ---
@app.get("/api/v1/debug/chat")
async def debug_chat():
    """
    Debug endpoint to view chat stats and connections.
    """
    return {
        "active_rooms": len(chat_manager.active_chats),
        "total_connections": chat_manager.get_active_connections(),
        "rooms": {
            room_id: {
                "connections": len(connections),
                "message_count": len(chat_manager.message_history.get(room_id, []))
            }
            for room_id, connections in chat_manager.active_chats.items()
        }
    }

@app.post("/api/v1/rooms/{room_id}/join")
async def join_room(room_id: str = Path(...)):
    """
    Join a specific room (increment active users).
    """
    if room_id not in rooms_db:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Update active users count from WebSocket connections
    rooms_db[room_id].active_users = manager.get_active_users(room_id)
    logger.info(f"User joined room {room_id}. Active users: {rooms_db[room_id].active_users}")
    
    return {"message": "Joined room successfully", "room": rooms_db[room_id]}

@app.post("/api/v1/rooms/{room_id}/leave")
async def leave_room(room_id: str = Path(...)):
    """
    Leave a specific room (decrement active users).
    """
    if room_id not in rooms_db:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Update active users count from WebSocket connections
    rooms_db[room_id].active_users = manager.get_active_users(room_id)
    logger.info(f"User left room {room_id}. Active users: {rooms_db[room_id].active_users}")
    
    return {"message": "Left room successfully", "room": rooms_db[room_id]}

# --- Debug Endpoints ---

@app.get("/api/v1/debug/rooms")
async def debug_rooms():
    """
    Debug endpoint to view all room data.
    """
    # Update active users for each room
    for room_id in rooms_db:
        rooms_db[room_id].active_users = manager.get_active_users(room_id)
    
    return {
        "room_count": len(rooms_db),
        "rooms": {id: room.dict() for id, room in rooms_db.items()}
    }

@app.get("/api/v1/debug/connections")
async def debug_connections():
    """
    Debug endpoint to view all WebSocket connections.
    """
    connections = {}
    
    for room_id in manager.active_connections:
        connections[room_id] = {}
        for doc_id in manager.active_connections[room_id]:
            connections[room_id][doc_id] = list(manager.active_connections[room_id][doc_id].keys())
    
    return {
        "connections": connections
    }

# --- Main execution block ---
if __name__ == "__main__":
    print("--- Starting Mentora Backend Server ---")
    print(f"Access the API at: http://127.0.0.1:8000")
    print(f"API Documentation available at: http://127.0.0.1:8000/docs")
    print(f"WebSocket collaboration available at: ws://localhost:8000/ws/collaboration/{room_id}/{user_id}/{document_id}")
    print("------------------------------------")
    
    # Add some sample rooms for testing
    sample_room = Room(
        id="1",
        name="Sample Study Room",
        description="A sample room for collaborative studying",
        created_at=datetime.now().isoformat(),
        active_users=0
    )
    rooms_db["1"] = sample_room
    
    # Add rooms from your logs
    specific_room = Room(
        id="1744151147110",
        name="Specific Room",
        description="This is the specific room mentioned in the logs",
        created_at=datetime.now().isoformat(),
        active_users=0
    )
    rooms_db["1744151147110"] = specific_room
    
    specific_room2 = Room(
        id="1744151263756",
        name="Collaboration Room",
        description="This is the collaboration room from WebSocket logs",
        created_at=datetime.now().isoformat(),
        active_users=0
    )
    rooms_db["1744151263756"] = specific_room2
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )