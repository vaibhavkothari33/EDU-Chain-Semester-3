import React, { useEffect, useRef, useState } from 'react';
// import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { yCollab } from 'y-codemirror.next';

// Map of language identifiers to their corresponding CodeMirror language support
const languageMap = {
  javascript: javascript(),
  html: html(),
  css: css(),
  python: python(),
  json: json(),
  // Add more languages as needed
};

// Generate a unique user ID for this session
const userId = Date.now().toString();

const CollaborativeEditor = ({ roomId, file }) => {
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);

  useEffect(() => {
    // Cleanup function for the current editor instance
    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
      }
      if (providerRef.current) {
        providerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current || !file) return;

    // Clean up previous editor instance
    if (editorViewRef.current) {
      editorViewRef.current.destroy();
    }
    if (providerRef.current) {
      providerRef.current.disconnect();
    }

    const setupEditor = async () => {
      try {
        // Create a new Y document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Use the correct WebSocket URL format
        // Format: ws://localhost:8000/ws/collaboration/{room_id}/{user_id}/{document_id}
        const documentId = file.id;
        const websocketUrl = `ws://localhost:8000/ws/collaboration/${roomId}/${userId}/${documentId}`;
        
        console.log(`Connecting to WebSocket: ${websocketUrl}`);
        
        // The WebsocketProvider constructor expects (serverUrl, roomName, ydoc, options)
        const provider = new WebsocketProvider(
          websocketUrl,  // serverUrl
          roomId,        // roomName (used as a namespace)
          ydoc,          // Y.Doc instance
          { connect: true }  // Ensure we connect immediately
        );
        
        providerRef.current = provider;

        // Handle connection status
        provider.on('status', event => {
          console.log('WebSocket status:', event.status);
          setIsConnected(event.status === 'connected');
        });

        // Handle connection errors
        provider.on('connection-error', err => {
          console.error('Connection error:', err);
          setError('Failed to connect to collaboration server. Check console for details.');
        });

        // Get the shared text from the Y document
        const ytext = ydoc.getText('codemirror');

        // If the document is empty, initialize it with the file content
        if (ytext.toString() === '') {
          ytext.insert(0, file.content || '');
        }

        // Set up CodeMirror with the collaboration plugin
        const language = languageMap[file.language] || languageMap.javascript;
        
        const startState = EditorState.create({
          doc: ytext.toString(),
          extensions: [
            basicSetup,
            language,
            yCollab(ytext, provider.awareness),
            EditorView.updateListener.of(update => {
              // Handle editor updates if needed
              if (update.docChanged) {
                // Document was changed
              }
            })
          ]
        });

        // Create and mount the editor view
        const view = new EditorView({
          state: startState,
          parent: editorRef.current
        });

        editorViewRef.current = view;
      } catch (err) {
        console.error('Error setting up editor:', err);
        setError(`Error setting up editor: ${err.message}`);
      }
    };

    setupEditor();
  }, [roomId, file]);

  return (
    <div className="h-full flex flex-col">
      {/* Editor header */}
      <div className="bg-gray-200 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center">
          <span className="font-mono">{file?.name}</span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-gray-300 rounded">
            {file?.language}
          </span>
        </div>
        <div className="flex items-center">
          <span className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 text-sm">
          {error}
        </div>
      )}

      {/* Editor container */}
      <div 
        ref={editorRef} 
        className="flex-1 overflow-auto font-mono"
        style={{ height: "calc(100% - 40px)" }}
      />
    </div>
  );
};

export default CollaborativeEditor;