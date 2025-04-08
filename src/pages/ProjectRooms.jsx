import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CreateRoomModal from '../components/CreateRoomModal';

const ProjectRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Fetch rooms from API
    const fetchRooms = async () => {
      try {
        setIsLoading(true);
        // Replace with your actual API endpoint
        const response = await fetch('http://localhost:8000/api/v1/rooms');
        
        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }
        
        const data = await response.json();
        setRooms(data);
      } catch (err) {
        setError(err.message);
        // For development, we'll use sample data if API fails
        setRooms([
          { id: '1', name: 'React Project', description: 'Collaborative React application', createdAt: new Date().toISOString(), memberCount: 3 },
          { id: '2', name: 'Python API', description: 'FastAPI backend development', createdAt: new Date().toISOString(), memberCount: 2 },
          { id: '3', name: 'UI Design', description: 'Frontend styling and components', createdAt: new Date().toISOString(), memberCount: 4 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const handleCreateRoom = (newRoom) => {
    // In a real app, you'd make an API call first, then update state
    setRooms([...rooms, { ...newRoom, id: Date.now().toString(), createdAt: new Date().toISOString(), memberCount: 1 }]);
    setShowModal(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading rooms...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Project Rooms</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Create New Room
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {rooms.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No rooms available. Create your first room!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <Link 
              to={`/room/${room.id}`} 
              key={room.id}
              className="block border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{room.name}</h2>
              <p className="text-gray-600 mb-4">{room.description}</p>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Created: {new Date(room.createdAt).toLocaleDateString()}</span>
                <span>{room.memberCount} member{room.memberCount !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateRoomModal 
          onClose={() => setShowModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
};

export default ProjectRooms;