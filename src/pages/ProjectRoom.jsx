import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CollaborativeEditor from '../components/CollaborativeEditor';
import RoomChat from '../components/RoomChat';
import RoomSidebar from '../components/RoomSidebar';

const ProjectRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFile, setActiveFile] = useState(null);

  useEffect(() => {
    // Fetch room details from API
    const fetchRoomDetails = async () => {
      try {
        setIsLoading(true);
        // Replace with your actual API endpoint
        const response = await fetch(`http://localhost:8000/api/v1/rooms/${roomId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Room not found');
          }
          throw new Error('Failed to fetch room details');
        }
        
        const data = await response.json();
        setRoom(data);
        
        // Set the first file as active if available
        if (data.files && data.files.length > 0) {
          setActiveFile(data.files[0]);
        }
      } catch (err) {
        setError(err.message);
        // For development, use sample data if API fails
        setRoom({
          id: roomId,
          name: 'Sample Project Room',
          description: 'This is a sample collaborative project room',
          members: [
            { id: '1', name: 'John Doe', online: true },
            { id: '2', name: 'Jane Smith', online: false },
            { id: '3', name: 'Alex Johnson', online: true }
          ],
          files: [
            { id: '1', name: 'index.js', language: 'javascript', content: '// Your code here' },
            { id: '2', name: 'styles.css', language: 'css', content: '/* Your CSS here */' }
          ]
        });
        
        // Set the first file as active
        setActiveFile({
          id: '1',
          name: 'index.js',
          language: 'javascript',
          content: '// Your code here'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoomDetails();
  }, [roomId]);

  const handleFileChange = (file) => {
    setActiveFile(file);
  };

  const handleLeaveRoom = () => {
    navigate('/rooms');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading room details...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button 
          onClick={() => navigate('/rooms')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Back to Rooms
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold">{room.name}</h1>
        <button 
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
        >
          Leave Room
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-100 border-r">
          <RoomSidebar 
            room={room} 
            activeFile={activeFile}
            onFileSelect={handleFileChange}
          />
        </div>

        {/* Editor and Chat */}
        <div className="flex flex-col flex-1">
          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <CollaborativeEditor 
                roomId={roomId}
                file={activeFile}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No file selected. Select or create a file to start editing.
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="h-64 border-t">
            <RoomChat roomId={roomId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectRoom;