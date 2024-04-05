import { createContext, useState, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { retrieveEnvironmentVariable } from "../services/RetrieveEnvironmentVariable";
import { MessageContext } from "./MessageContextProvider";
import { useMemo } from "react";

const url = `${retrieveEnvironmentVariable('VITE_BACKEND_URL')}:${retrieveEnvironmentVariable(
  'VITE_BACKEND_PORT',
)}`;
const SocketContext = createContext();

const SocketContextProvider = ({children}) => {
  
  const socket = useRef(null);
  const firstSession = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const [attemptedConnection, setAttemptedConnection] = useState(false);
  const { messageContextValues: mcv } = useContext(MessageContext);

  useEffect(() => {
    if (!socket.current) {
      socket.current = io(url, { transports: ['websocket'], upgrade: false });
    } else {
      socket.current.on('connect', () => {
        if (firstSession.current) {
          const welcomeMessage = {
            text: 'Hi this is the Library Smart Chatbot. How may I help you?',
            sender: 'chatbot',
          };
          mcv.setMessage((prevMessages) => {
            const updatedMessages = [...prevMessages, welcomeMessage];
            sessionStorage.setItem(
              'chat_messages',
              JSON.stringify(updatedMessages),
            );
            return updatedMessages;
          });
          firstSession.current = false;
        }
        setIsConnected(true);
        setAttemptedConnection(true);
        mcv.setIsTyping(false);
      });
  
      socket.current.on('message', function (message) {
        mcv.setIsTyping(false);
        mcv.addMessage(message, 'chatbot');
      });
  
      socket.current.on('disconnect', function () {
        setIsConnected(false);
        setAttemptedConnection(true);
      });
  
      socket.current.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        setIsConnected(false);
        setAttemptedConnection(true);
      });
  
      socket.current.on('connect_timeout', (timeout) => {
        console.error('Connection Timeout:', timeout);
        setIsConnected(false);
        setAttemptedConnection(true);
      });
  
      return () => {
        socket.current.off('message');
        socket.current.off('disconnect');
        socket.current.off('connect_error');
        socket.current.off('connect_timeout');
      };
    }
  }, [isConnected]);

  const sendUserMessage = (message) => {
    if (socket.current) {
      socket.current.emit("message", message, () => {});
    }
  }

  const offlineTicketSubmit = (formData) => {
    if (socket.current) {
      socket.current.emit(
        "createTicket",
        formData,
        (responseMessage) => {
          console.log(responseMessage);
        }
      )
    }
  };

  const socketContextValues = useMemo(() => ({
    socket: socket.current,
    isConnected,
    setIsConnected,
    attemptedConnection,
    setAttemptedConnection,
    sendUserMessage,
    offlineTicketSubmit,
  }), [isConnected, attemptedConnection])

  return (
    <SocketContext.Provider value={{socketContextValues}}>
      {children}
    </SocketContext.Provider>
  );
}

export { SocketContext, SocketContextProvider };