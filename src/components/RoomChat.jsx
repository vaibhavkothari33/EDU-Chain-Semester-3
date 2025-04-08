import React, { useState, useEffect, useRef } from 'react';

const RoomChat = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Generate a unique ID for this user (in real app, use authentication)
  const currentUser = useRef({
    id: `user-${Date.now()}`,
    name: `User ${Math.floor(Math.random() * 1000)}`
  }).current;

  useEffect(() => {
    // Connect to WebSocket for chat
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`ws://localhost:8000/ws/chat/${roomId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Chat WebSocket connected');
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            // Single new message
            setMessages(prev => [...prev, data.message]);
          } 
          else if (data.type === 'history') {
            // Message history from server
            console.log('Received message history:', data.messages.length, 'messages');
            setMessages(data.messages);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Failed to connect to chat server');
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          setIsConnected(false);
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (document.visibilityState !== 'hidden') {
              connectWebSocket();
            }
          }, 3000);
        };

        return () => {
          if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            ws.close();
          }
        };
      } catch (err) {
        console.error('Error connecting to WebSocket:', err);
        setError('Failed to connect to chat server');
        
        // For development, add some mock messages
        if (process.env.NODE_ENV === 'development') {
          setMessages([
            { id: '1', userId: '2', userName: 'Jane Smith', text: 'Hey everyone, I just pushed some updates to the layout', timestamp: new Date(Date.now() - 3600000).toISOString() },
            { id: '2', userId: '3', userName: 'Alex Johnson', text: 'Looks good! I\'ll review it soon', timestamp: new Date(Date.now() - 1800000).toISOString() },
            { id: '3', userId: '1', userName: currentUser.name, text: 'I\'m working on the API integration now', timestamp: new Date(Date.now() - 900000).toISOString() }
          ]);
          setIsConnected(true);
        }
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageData = {
      type: 'message',
      message: {
        userId: currentUser.id,
        userName: currentUser.name,
        text: newMessage,
        timestamp: new Date().toISOString()
      }
    };

    // Send message over WebSocket if connected
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(messageData));
    }

    // Add message to local state (optimistic update)
    const message = {
      id: Date.now().toString(),
      ...messageData.message
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="bg-gray-200 px-4 py-2 flex justify-between items-center">
        <h3 className="font-medium">Room Chat</h3>
        <div className="flex items-center">
          <span className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-2 text-sm">
          {error}
        </div>
      )}

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date} className="space-y-3">
            {/* Date separator */}
            <div className="flex justify-center">
              <div className="bg-gray-100 text-gray-500 rounded-full px-3 py-1 text-xs">
                {date}
              </div>
            </div>
            
            {/* Messages for this date */}
            {dateMessages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.userId === currentUser.id ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                    message.userId === currentUser.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200'
                  }`}
                >
                  {message.userId !== currentUser.id && (
                    <div className="font-medium text-sm mb-1">{message.userName}</div>
                  )}
                  <div>{message.text}</div>
                  <div className="text-xs text-right mt-1 opacity-75">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="border-t p-2">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded-l px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r"
            disabled={!isConnected || !newMessage.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default RoomChat;